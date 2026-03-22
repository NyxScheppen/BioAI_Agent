from app.db.models import ChatSession, ChatMessage, StoredFile
from sqlalchemy import func

def create_session(db, session_id: str, title: str = "新会话"):
    """
    若会话不存在则创建，会话已存在就直接返回
    """
    existing = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if existing:
        return existing

    session = ChatSession(session_id=session_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_session(db, session_id: str):
    return db.query(ChatSession).filter(ChatSession.session_id == session_id).first()

def update_session_title(db, session_id: str, title: str):
    session = get_session(db, session_id)
    if not session:
        return None

    session.title = title
    db.commit()
    db.refresh(session)
    return session

def ensure_session_title(db, session_id: str, title: str):
    """
    只有标题为空或默认标题时才更新，避免后续覆盖用户已有标题
    """
    session = get_session(db, session_id)
    if not session:
        return None

    current_title = (session.title or "").strip()
    if current_title in ["", "新会话"]:
        session.title = title
        db.commit()
        db.refresh(session)

    return session

def save_message(db, session_id: str, role: str, content: str):
    """
    保存一条消息
    """
    msg = ChatMessage(session_id=session_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_session_messages(db, session_id: str):
    """
    获取某个会话下的所有消息，按时间顺序
    """
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.id.asc())
        .all()
    )

def save_file_record(db, session_id: str, filename: str, relative_path: str, file_type: str, source_type: str):
    """
    保存文件记录
    """
    file_obj = StoredFile(
        session_id=session_id,
        filename=filename,
        relative_path=relative_path,
        file_type=file_type,
        source_type=source_type
    )
    db.add(file_obj)
    db.commit()
    db.refresh(file_obj)
    return file_obj

def get_session_files(db, session_id: str):
    """
    获取某个会话关联的文件
    """
    return (
        db.query(StoredFile)
        .filter(StoredFile.session_id == session_id)
        .order_by(StoredFile.id.desc())
        .all()
    )

def get_first_uploaded_file(db, session_id: str):
    """
    获取该会话最早上传的文件
    """
    return (
        db.query(StoredFile)
        .filter(
            StoredFile.session_id == session_id,
            StoredFile.source_type == "upload"
        )
        .order_by(StoredFile.id.asc())
        .first()
    )

def get_all_sessions(db):
    """
    获取所有会话及其消息数、文件数
    """
    results = (
        db.query(
            ChatSession,
            func.count(ChatMessage.id).label("message_count"),
            func.count(StoredFile.id).label("file_count")
        )
        .outerjoin(ChatMessage, ChatSession.session_id == ChatMessage.session_id)
        .outerjoin(StoredFile, ChatSession.session_id == StoredFile.session_id)
        .group_by(ChatSession.id)
        .order_by(ChatSession.created_at.desc(), ChatSession.id.desc())
        .all()
    )
    return results