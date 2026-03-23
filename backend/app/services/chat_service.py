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

    # 去掉前端拼的文件提示前缀
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

        # 情况1：模型回复的是相对路径，例如 generated/pheno_analysis/a.png
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

        # 情况2：模型回复的是 generated 下的子路径，例如 pheno_analysis/a.png
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

        # 情况3：模型回复的只是文件名，例如 a.png
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

async def handle_chat(db, session_id: str, messages: list):
    """
    聊天总业务流程：
    1. 创建会话
    2. 标准化前端消息角色
    3. 自动设置会话标题
    4. 调 Agent
    5. 提取生成文件
    6. 保存聊天记录和文件记录
    7. 返回 reply + files
    """
    crud.create_session(db, session_id=session_id)

    standard_messages = []
    for msg in messages:
        frontend_role = msg.get("role", "user")
        safe_role = "assistant" if frontend_role == "ai" else frontend_role
        standard_messages.append({
            "role": safe_role,
            "content": str(msg.get("content", ""))
        })

    # 自动设置标题：优先上传文件名，否则第一句用户消息
    session_obj = crud.get_session(db, session_id)
    if session_obj and (not session_obj.title or session_obj.title == "新会话"):
        first_uploaded = crud.get_first_uploaded_file(db, session_id)
        first_uploaded_filename = first_uploaded.filename if first_uploaded else ""

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

    answer = await run_bio_agent(standard_messages)

    # 安全清洗
    answer = answer.encode("utf-8", "ignore").decode("utf-8")
    answer = answer.replace("\x00", "")

    # 从回复中提取文件引用
    file_refs = extract_generated_files_from_reply(answer)

    # 解析成真实文件
    files = resolve_generated_files(file_refs)

    # 自动补 markdown 链接/图片
    for f in files:
        answer = append_markdown_if_missing(
            reply=answer,
            filename=f["name"],
            relative_path=f["relative_path"]
        )

    # 保存最后一轮 user 消息
    if standard_messages:
        last_user_msg = standard_messages[-1]
        if last_user_msg["role"] == "user":
            crud.save_message(db, session_id, "user", last_user_msg["content"])

    crud.save_message(db, session_id, "assistant", answer)

    # 保存生成文件记录
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