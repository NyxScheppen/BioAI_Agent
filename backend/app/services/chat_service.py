from app.agent.bio_agent import run_bio_agent
from app.db import crud
from app.utils.response_formatter import (
    extract_generated_files_from_reply,
    build_file_list,
    append_markdown_if_missing
)

async def handle_chat(db, session_id: str, messages: list):
    """
    聊天总业务流程：
    1. 创建会话
    2. 标准化前端消息角色
    3. 调 Agent
    4. 提取生成文件
    5. 保存聊天记录和文件记录
    6. 返回 reply + files
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

    answer = await run_bio_agent(standard_messages)

    # 安全清洗，避免奇怪字符破坏 JSON
    answer = answer.encode("utf-8", "ignore").decode("utf-8")
    answer = answer.replace("\x00", "")

    # 提取模型回复中的结果文件
    file_names = extract_generated_files_from_reply(answer)
    files = build_file_list(file_names)

    # 若回复中只提了文件名但没带 URL，自动补 Markdown
    for f in file_names:
        answer = append_markdown_if_missing(answer, f)

    # 保存最后一轮消息
    # 注意：这里采取“保存整轮对话”的简单做法
    # 若你后面想更严格去重，可以做消息 hash
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
            relative_path=f"generated/{f['name']}",
            file_type=f["type"],
            source_type="generated"
        )

    return {
        "reply": answer,
        "files": files
    }