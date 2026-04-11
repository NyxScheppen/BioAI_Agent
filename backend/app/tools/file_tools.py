import os
import json
import gzip
import pandas as pd
from app.agent.tool_registry import register_tool
from app.core.paths import UPLOAD_DIR
from app.utils.file_resolver import resolve_file_path, debug_file_context

@register_tool(
    name="read_csv_data",
    description="读取上传目录中的 CSV 文件，返回表头、前3行和形状（仅支持 CSV）",
    parameters={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "文件名，例如 test.csv"
            }
        },
        "required": ["file_path"]
    }
)


def read_csv_data(file_path: str, session_id: str = None):
    real_path = resolve_file_path(file_path, session_id)

    if not real_path.exists():
        return {
            "status": "error",
            "message": f"文件不存在：{file_path}",
            "debug": debug_file_context(file_path, session_id)
        }

    try:
        df = pd.read_csv(real_path)
        return {
            "status": "success",
            "file_path": str(real_path),
            "shape": df.shape,
            "columns": df.columns.tolist(),
            "data": df.to_dict(orient="records")
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"读取 CSV 失败：{str(e)}",
            "debug": debug_file_context(file_path, session_id)
        }
@register_tool(
    name="load_large_bio_data",
    description="读取大型生信文件（txt/csv/gz），适合 GEO series_matrix 预读",
    parameters={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "文件名，例如 GSE84402_series_matrix.txt.gz"
            }
        },
        "required": ["file_path"]
    }
)
def load_large_bio_data(file_path: str, session_id: str = None):
    real_path = resolve_file_path(file_path, session_id)

    if not real_path.exists():
        debug = debug_file_context(file_path, session_id)
        return (
            f"❌ 找不到文件: {file_path}\n"
            f"解析后路径: {debug['resolved_path']}\n"
            f"当前工作目录: {debug['cwd']}"
        )

    try:
        if str(real_path).endswith(".gz"):
            with gzip.open(real_path, "rt", encoding="utf-8", errors="ignore") as f:
                lines = []
                for i, line in enumerate(f):
                    lines.append(line.rstrip("\n"))
                    if i >= 19:
                        break
            return "\n".join(lines)

        with open(real_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = []
            for i, line in enumerate(f):
                lines.append(line.rstrip("\n"))
                if i >= 19:
                    break
        return "\n".join(lines)

    except Exception as e:
        return f"❌ 读取失败: {str(e)}"
    
@register_tool(
    name="preview_table_file",
    description="预览上传目录中的表格文件（csv/tsv/txt/xlsx），返回列名、前几行和形状。",
    parameters={
        "type": "object",
        "properties": {
            "file_path": {"type": "string"},
            "nrows": {"type": "integer", "default": 5}
        },
        "required": ["file_path"]
    }
)
def preview_table_file(file_path: str, nrows: int = 10, session_id: str = None):
    real_path = resolve_file_path(file_path, session_id)

    if not real_path.exists():
        return {
            "status": "error",
            "message": f"文件不存在: {file_path}",
            "debug": debug_file_context(file_path, session_id)
        }

    try:
        suffix = real_path.suffix.lower()

        if suffix == ".csv":
            df = pd.read_csv(real_path, nrows=nrows)
        elif suffix in [".tsv", ".txt"]:
            df = pd.read_csv(real_path, sep="\t", nrows=nrows)
        elif suffix in [".xlsx", ".xls"]:
            df = pd.read_excel(real_path, nrows=nrows)
        else:
            return {
                "status": "error",
                "message": f"暂不支持预览该文件类型: {real_path.name}"
            }

        return {
            "status": "success",
            "file_path": str(real_path),
            "shape": df.shape,
            "columns": df.columns.tolist(),
            "preview": df.head(nrows).to_dict(orient="records")
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"预览失败: {str(e)}",
            "debug": debug_file_context(file_path, session_id)
        }