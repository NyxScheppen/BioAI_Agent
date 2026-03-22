import os
import shutil
from app.core.paths import UPLOAD_DIR
from app.db import crud
from app.utils.file_utils import detect_file_type

def save_upload_file(db, file, session_id: str = "default"):
    """
    保存上传文件到 uploads 目录，并写数据库记录
    """
    filename = os.path.basename(file.filename)
    save_path = os.path.join(UPLOAD_DIR, filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_type = detect_file_type(filename)

    crud.create_session(db, session_id=session_id)
    crud.save_file_record(
        db=db,
        session_id=session_id,
        filename=filename,
        relative_path=f"uploads/{filename}",
        file_type=file_type,
        source_type="upload"
    )

    return {
        "message": "上传成功",
        "filename": filename,
        "url": f"http://127.0.0.1:8000/files/uploads/{filename}",
        "type": file_type
    }