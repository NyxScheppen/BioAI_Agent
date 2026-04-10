import re
from pathlib import Path
from app.agent.bio_agent import run_bio_agent
from app.db import crud
from app.core.paths import STORAGE_DIR, GENERATED_DIR
from app.utils.file_utils import detect_file_type
from app.utils.response_formatter import (
    extract_generated_files_from_reply,
    append_markdown_if_missing
)


def extract_file_marker_from_message(content: str) -> str:
    """
    从前端消息里提取 [文件:xxx] 标记
    例如：
    发送的文件：[文件:test.csv] 请帮我分析
    """
    if not content:
        return ""

    match = re.search(r"\[文件:(.*?)\]", content)
    if match:
        return match.group(1).strip()
    return ""


def generate_session_title(first_user_message: str = "", first_uploaded_filename: str = "") -> str:
    """
    优先使用第一个上传文件名，否则使用第一句用户消息
    """
    if first_uploaded_filename:
        return first_uploaded_filename.strip()[:80]

    text = (first_user_message or "").strip()
    if not text:
        return "新会话"

    text = re.sub(r"发送的文件：\s*\[文件:.*?\]\s*", "", text).strip()
    text = text.replace("\n", " ").replace("\r", " ").strip()
    text = " ".join(text.split())
    text = text.lstrip("#*- ").strip()

    if not text:
        return "新会话"

    if len(text) > 30:
        text = text[:30] + "..."

    return text


def resolve_generated_files(file_refs: list):
    """
    根据模型回复里提到的文件名或相对路径，
    在 GENERATED_DIR 下递归查找真实文件。
    """
    files = []
    seen = set()

    for ref in file_refs:
        if not ref:
            continue

        ref = str(ref).replace("\\", "/").strip()

        if ref.startswith("generated/"):
            full_path = Path(STORAGE_DIR) / ref
            if full_path.exists() and full_path.is_file():
                relative_path = full_path.relative_to(STORAGE_DIR).as_posix()
                if relative_path not in seen:
                    seen.add(relative_path)
                    files.append({
                        "url": f"/files/{relative_path}",
                        "name": full_path.name,
                        "type": detect_file_type(full_path.name),
                        "relative_path": relative_path
                    })
            continue

        if "/" in ref:
            full_path = Path(GENERATED_DIR) / ref
            if full_path.exists() and full_path.is_file():
                relative_path = full_path.relative_to(STORAGE_DIR).as_posix()
                if relative_path not in seen:
                    seen.add(relative_path)
                    files.append({
                        "url": f"/files/{relative_path}",
                        "name": full_path.name,
                        "type": detect_file_type(full_path.name),
                        "relative_path": relative_path
                    })
            continue

        matches = list(Path(GENERATED_DIR).rglob(ref))
        for path in matches:
            if not path.is_file():
                continue

            relative_path = path.relative_to(STORAGE_DIR).as_posix()
            if relative_path in seen:
                continue

            seen.add(relative_path)
            files.append({
                "url": f"/files/{relative_path}",
                "name": path.name,
                "type": detect_file_type(path.name),
                "relative_path": relative_path
            })

    return files


def build_uploaded_files_context(session_id: str, attached_files: list) -> str:
    """
    把当前会话上传文件整理成给 Agent 的上下文文本
    """
    if not attached_files:
        return ""

    lines = [
        f"当前会话 session_id: {session_id}",
        "当前会话已上传文件如下："
    ]

    for idx, f in enumerate(attached_files, start=1):
        filename = f.get("filename", "")
        relative_path = f.get("relative_path") or f"uploads/{session_id}/{filename}"
        file_type = f.get("type", "other")
        abs_hint = str(Path(STORAGE_DIR) / relative_path)

        lines.append(
            f"{idx}. 文件名: {filename} | 类型: {file_type} | 相对路径: {relative_path} | 绝对路径参考: {abs_hint}"
        )

    lines.append("如果用户要求分析文件，请优先基于上述文件路径读取数据。")
    lines.append("不要声称“找不到文件”，除非你已经明确检查过这些路径不存在。")

    return "\n".join(lines)


def prepend_file_context(messages: list, file_context: str) -> list:
    """
    把文件上下文注入消息最前面
    """
    if not file_context:
        return messages

    return [
        {
            "role": "system",
            "content": file_context
        },
        *messages
    ]


def fallback_attached_files_from_db(db, session_id: str) -> list:
    """
    如果前端 attached_files 没传到，则尝试从数据库按 session 回查 upload 文件记录
    """
    results = []

    if hasattr(crud, "get_files_by_session"):
        try:
            db_files = crud.get_files_by_session(db, session_id)
            for f in db_files:
                if getattr(f, "source_type", "") != "upload":
                    continue
                results.append({
                    "filename": f.filename,
                    "relative_path": f.relative_path,
                    "type": getattr(f, "file_type", "other")
                })
            return results
        except Exception as e:
            print(f"⚠️ get_files_by_session 查询失败: {e}")

    upload_dir = Path(STORAGE_DIR) / "uploads" / session_id
    if upload_dir.exists() and upload_dir.is_dir():
        for p in sorted(upload_dir.iterdir(), key=lambda x: x.name.lower()):
            if p.is_file():
                results.append({
                    "filename": p.name,
                    "relative_path": f"uploads/{session_id}/{p.name}",
                    "type": detect_file_type(p.name)
                })

    return results


async def handle_chat(db, session_id: str, messages: list, attached_files: list | None = None):
    """
    聊天总业务流程：
    1. 创建会话
    2. 标准化前端消息角色
    3. 自动设置会话标题
    4. 注入当前会话上传文件上下文
    5. 调 Agent
    6. 提取生成文件
    7. 保存聊天记录和文件记录
    8. 返回 reply + files
    """
    crud.create_session(db, session_id=session_id)

    attached_files = attached_files or []

    standard_messages = []
    for msg in messages:
        frontend_role = msg.get("role", "user")
        safe_role = "assistant" if frontend_role == "ai" else frontend_role
        standard_messages.append({
            "role": safe_role,
            "content": str(msg.get("content", ""))
        })

    if not attached_files:
        attached_files = fallback_attached_files_from_db(db, session_id)

    print(f"🧾 handle_chat session_id={session_id}")
    print(f"🧾 attached_files={attached_files}")

    session_obj = crud.get_session(db, session_id)
    if session_obj and (not session_obj.title or session_obj.title == "新会话"):
        first_uploaded_filename = attached_files[0]["filename"] if attached_files else ""

        first_user_message = ""
        embedded_file_name = ""

        for msg in standard_messages:
            if msg["role"] == "user" and msg["content"].strip():
                first_user_message = msg["content"].strip()
                embedded_file_name = extract_file_marker_from_message(first_user_message)
                break

        title = generate_session_title(
            first_user_message=first_user_message,
            first_uploaded_filename=first_uploaded_filename or embedded_file_name
        )
        crud.ensure_session_title(db, session_id, title)

    file_context = build_uploaded_files_context(session_id, attached_files)
    agent_messages = prepend_file_context(standard_messages, file_context)

    print("🧠 注入给 Agent 的文件上下文：")
    print(file_context if file_context else "(空)")

    answer = await run_bio_agent(agent_messages)

    answer = answer.encode("utf-8", "ignore").decode("utf-8")
    answer = answer.replace("\x00", "")

    file_refs = extract_generated_files_from_reply(answer)
    files = resolve_generated_files(file_refs)

    for f in files:
        answer = append_markdown_if_missing(
            reply=answer,
            filename=f["name"],
            relative_path=f["relative_path"]
        )

    if standard_messages:
        last_user_msg = standard_messages[-1]
        if last_user_msg["role"] == "user":
            crud.save_message(db, session_id, "user", last_user_msg["content"])

    crud.save_message(db, session_id, "assistant", answer)

    for f in files:
        crud.save_file_record(
            db=db,
            session_id=session_id,
            filename=f["name"],
            relative_path=f["relative_path"],
            file_type=f["type"],
            source_type="generated"
        )

    return {
        "reply": answer,
        "files": files,
        "session_id": session_id,
        "title": crud.get_session(db, session_id).title
    }