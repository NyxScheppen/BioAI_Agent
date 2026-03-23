from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.upload import router as upload_router
from app.api.history import router as history_router
from app.api.system import router as system_router

from app.core.paths import STORAGE_DIR
from app.db.database import Base, engine

import os
from app.core.paths import STORAGE_DIR, GENERATED_DIR

print("STORAGE_DIR =", STORAGE_DIR)
print("GENERATED_DIR =", GENERATED_DIR)
print("STORAGE exists =", os.path.exists(str(STORAGE_DIR)))
print("GENERATED exists =", os.path.exists(str(GENERATED_DIR)))

# 自动建表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bio Agent Backend")

# 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 暴露 storage 目录
# 所以：
# /files/uploads/xxx
# /files/generated/xxx
# 都可以访问
app.mount("/files", StaticFiles(directory=str(STORAGE_DIR)), name="files")

# 注册接口
app.include_router(chat_router)
app.include_router(upload_router)
app.include_router(history_router)
app.include_router(system_router)

@app.get("/")
async def root():
    return {"message": "Bio Agent Backend is running"}