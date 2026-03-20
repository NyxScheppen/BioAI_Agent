# backend/agent_system/tools.py
import json
import os
import uuid
import subprocess
import pandas as pd

# 获取项目根目录下的 data 文件夹绝对路径
# os.path.dirname(__file__) 是 agent_system 目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_WORKSPACE = os.path.join(BASE_DIR, "data")

if not os.path.exists(DATA_WORKSPACE):
    os.makedirs(DATA_WORKSPACE)

# ==========================================
# 1. 具体的工具函数定义
# ==========================================

def calculate_gc_content(sequence: str):
    """(工具1) 计算 DNA 序列的 GC 含量"""
    seq = sequence.upper()
    gc = (seq.count("G") + seq.count("C")) / len(seq) * 100 if len(seq) > 0 else 0
    return json.dumps({"gc_content_percentage": round(gc, 2)})

def read_csv_data(file_path: str):
    """(工具2) 读取 CSV 文件的表头和前 3 行"""
    # 强制锁死在 data 目录下找文件，不听它瞎传的路径
    file_name = os.path.basename(file_path)
    safe_path = os.path.join(DATA_WORKSPACE, file_name)
    
    try:
        if not os.path.exists(safe_path):
            return json.dumps({"status": "error", "message": f"文件不存在！请确保文件在 {DATA_WORKSPACE} 目录下。"})
        
        df = pd.read_csv(safe_path)
        info = {
            "columns": df.columns.tolist(),
            "preview": df.head(3).to_dict(orient="records"),
            "shape": df.shape
        }
        return json.dumps({"status": "success", "data": info})
    except Exception as e:
        return json.dumps({"status": "error", "message": f"读取失败: {str(e)}"})

def run_r_analysis(r_code: str):
    """(工具3) 接收 R 代码并在本地执行"""
    job_id = str(uuid.uuid4())[:8]
    script_name = f"temp_task_{job_id}.R"
    script_path = os.path.join(DATA_WORKSPACE, script_name)
    
    # 注入强制设置工作目录的 R 代码，让它生成的图表也保存在 data 里
    injected_code = f'setwd("{DATA_WORKSPACE.replace(chr(92), "/")}")\n' + r_code
    
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(injected_code)
    
    try:
        result = subprocess.run(["Rscript", script_path], capture_output=True, text=True, timeout=60)
        if os.path.exists(script_path):
            os.remove(script_path)
            
        if result.returncode == 0:
            return json.dumps({"status": "success", "output": result.stdout})
        else:
            return json.dumps({"status": "error", "error_message": result.stderr})
    except Exception as e:
        return json.dumps({"status": "error", "error_message": f"R 脚本出错: {str(e)}"})

# ==========================================
# 2. 统一对外暴露的配置 (给 Agent 使用)
# ==========================================

# 存放函数实体
AVAILABLE_FUNCTIONS = {
    "calculate_gc_content": calculate_gc_content,
    "read_csv_data": read_csv_data,
    "run_r_analysis": run_r_analysis
}

# 存放给大模型看的 Schema
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "calculate_gc_content",
            "description": "计算 DNA 序列的 GC 含量",
            "parameters": {
                "type": "object",
                "properties": {"sequence": {"type": "string", "description": "DNA 序列"}},
                "required": ["sequence"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_csv_data",
            "description": "读取服务器上 data 目录下的 CSV 文件预览。",
            "parameters": {
                "type": "object",
                "properties": {"file_path": {"type": "string", "description": "直接输入文件名即可，如 data.csv"}},
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_r_analysis",
            "description": "执行完整的 R 语言代码进行生信分析。当前工作目录已默认设定为项目 data 文件夹。",
            "parameters": {
                "type": "object",
                "properties": {"r_code": {"type": "string", "description": "纯 R 语言代码"}},
                "required": ["r_code"]
            }
        }
    }
]