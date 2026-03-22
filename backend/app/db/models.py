from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.db.database import Base

class ChatSession(Base):
    """
    会话表：一条记录代表一次会话
    """
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, default="新会话")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatMessage(Base):
    """
    消息表：存每轮 user / assistant 对话内容
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)   # user / assistant / system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class StoredFile(Base):
    """
    文件表：记录上传文件和生成文件
    """
    __tablename__ = "stored_files"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=True)
    filename = Column(String, nullable=False)
    relative_path = Column(String, nullable=False)  # 如 uploads/test.csv 或 generated/plot.png
    file_type = Column(String, nullable=False)      # image / table / text / other
    source_type = Column(String, nullable=False)    # upload / generated
    created_at = Column(DateTime(timezone=True), server_default=func.now())