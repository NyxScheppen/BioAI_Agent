import os
import json
import gzip
import pandas as pd
from app.agent.tool_registry import register_tool
from app.core.paths import UPLOAD_DIR

@register_tool(
    name="read_csv_data",
    description="读取上传目录中的 CSV 文件，返回表头、前3行和形状",
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
def read_csv_data(file_path: str):
    """
    读取 CSV 预览，给 Agent 先看数据结构
    """
    file_name = os.path.basename(file_path)
    safe_path = os.path.join(UPLOAD_DIR, file_name)

    try:
        if not os.path.exists(safe_path):
            return json.dumps({
                "status": "error",
                "message": f"文件不存在：{file_name}"
            }, ensure_ascii=False)

        df = pd.read_csv(safe_path)
        info = {
            "columns": df.columns.tolist(),
            "preview": df.head(3).to_dict(orient="records"),
            "shape": list(df.shape)
        }
        return json.dumps({
            "status": "success",
            "data": info
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"读取失败: {str(e)}"
        }, ensure_ascii=False)

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
def load_large_bio_data(file_path: str):
    """
    用于读取大型生信文件前几行和样本分组线索
    适合 GEO matrix 数据预判
    """
    full_path = os.path.join(UPLOAD_DIR, os.path.basename(file_path))

    if not os.path.exists(full_path):
        return f"❌ 找不到文件: {file_path}"

    try:
        metadata = {"titles": [], "characteristics": []}
        data_start_line = 0
        opener = gzip.open if full_path.endswith(".gz") else open

        # 快速扫描 GEO 头信息
        with opener(full_path, "rt", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f):
                if line.startswith("!Sample_title"):
                    metadata["titles"] = line.strip().split("\t")[1:]
                elif line.startswith("!Sample_characteristics_ch1"):
                    metadata["characteristics"].append(line.strip().split("\t")[1:])
                elif "!series_matrix_table_begin" in line:
                    data_start_line = i + 1
                    break
                if i > 1000:
                    break

        df_preview = pd.read_csv(
            full_path,
            sep="\t",
            skiprows=data_start_line,
            nrows=100,
            comment="!"
        )

        clean_characteristics = []
        if metadata["characteristics"]:
            raw_char = metadata["characteristics"][0]
            clean_characteristics = [c.replace('"', '').strip() for c in raw_char]

        summary = [
            f"✅ 文件识别成功: {file_path}",
            f"📊 矩阵预览: 共 {len(df_preview.columns)} 列",
            f"🆔 样本示例: {', '.join([str(c).replace('\"', '') for c in df_preview.columns[1:6]])}..."
        ]

        if clean_characteristics:
            summary.append(f"🔍 探测到分组线索: {', '.join(clean_characteristics[:3])}...")
            summary.append(f"💡 共检测到 {len(clean_characteristics)} 个样本分组信息，可据此编写 R 差异分析脚本。")
        else:
            summary.append("⚠️ 未检测到明确分组信息，请尝试根据样本标题分组。")

        return "\n".join(summary).replace('"', "'")

    except Exception as e:
        return f"❌ 读取失败: {str(e)}"