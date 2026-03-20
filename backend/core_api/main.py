from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from typing import List, Dict
# 假设你的 run_bio_agent 已经支持接收 list 格式的历史记录
from agent_system.bio_agent import run_bio_agent 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路径管理
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_WORKSPACE = os.path.join(BASE_DIR, "data")

if not os.path.exists(DATA_WORKSPACE):
    os.makedirs(DATA_WORKSPACE)

# 挂载静态目录，这样前端访问 http://localhost:8000/files/test.png 就能看到图
app.mount("/files", StaticFiles(directory=DATA_WORKSPACE), name="files")

# --- 请求模型修改：接收完整历史记录 ---
class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]  # 格式: [{"role": "user", "content": "..."}, ...]

@app.post("/api/chat")  
async def chat_endpoint(request: ChatRequest):  
    try:  
        # 🌟 新增：清洗和转换消息格式
        standard_messages = []
        for msg in request.messages:
            # 前端的 'ai' 换成大模型标准的 'assistant'
            safe_role = "assistant" if msg.get("role") == "ai" else "user"
            
            # 组装成大模型最喜欢的标准格式
            standard_messages.append({
                "role": safe_role,
                "content": str(msg.get("content", ""))
            })

        # 把清洗后的标准格式传给你的 agent
        answer = await run_bio_agent(standard_messages)  
        
        # 替换图片路径（如果你有的话）
        final_reply = answer.replace("data/", "http://127.0.0.1:8000/files/")
        
        return {"reply": final_reply}  
    except Exception as e:  
        print(f"Error: {e}")  
        return {"reply": f"服务器内部出错了: {str(e)}"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(DATA_WORKSPACE, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 返回文件名，方便前端展示
        return {
            "message": "上传成功", 
            "filename": file.filename, 
            "url": f"http://127.0.0.1:8000/files/{file.filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))