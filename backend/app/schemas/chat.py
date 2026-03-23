from pydantic import BaseModel
from typing import List, Dict, Optional

class ChatRequest(BaseModel):
    # 保持前端现有结构兼容
    messages: List[Dict[str, str]]
    # 新增可选 session_id，不传就默认 default
    session_id: Optional[str] = "default"