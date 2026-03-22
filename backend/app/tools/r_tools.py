import json
import uuid
import subprocess
from pathlib import Path
from app.agent.tool_registry import register_tool
from app.core.paths import TEMP_DIR, UPLOAD_DIR, GENERATED_DIR

@register_tool(
    name="run_r_analysis",
    description="执行 R 代码进行生信分析。R 当前工作目录已经是 GENERATED_DIR。保存输出文件时不要再手动创建或拼接 'generated/' 前缀。若需要子目录，请使用 ensure_output_dir('subdir') 并写入 file.path(out_dir, 'xxx.png')。",
    parameters={
        "type": "object",
        "properties": {
            "r_code": {
                "type": "string",
                "description": "纯 R 代码"
            }
        },
        "required": ["r_code"]
    }
)
def run_r_analysis(r_code: str):
    """
    核心工具：把 Agent 生成的 R 代码写成脚本，用 Rscript 执行
    """
    job_id = str(uuid.uuid4())[:8]
    script_name = f"temp_task_{job_id}.R"
    script_path = Path(TEMP_DIR) / script_name

    Path(GENERATED_DIR).mkdir(parents=True, exist_ok=True)

    r_prefix = f"""
library(data.table)

UPLOAD_DIR <- "{Path(UPLOAD_DIR).as_posix()}"
GENERATED_DIR <- "{Path(GENERATED_DIR).as_posix()}"

cat("注意：当前工作目录已经是 GENERATED_DIR。\n")
cat("保存结果时不要再写 generated/xxx，也不要再 dir.create('generated')。\n")
cat("如需子目录，请使用 ensure_output_dir('subdir')。\n")

# 所有输出默认进入 generated
dir.create(GENERATED_DIR, recursive = TRUE, showWarnings = FALSE)
setwd(GENERATED_DIR)

smart_read <- function(file_path) {{
  # 如果传入的是纯文件名，则自动补到 uploads
  if (!grepl("^/", file_path) && !grepl("^[A-Za-z]:", file_path)) {{
    file_path <- file.path(UPLOAD_DIR, file_path)
  }}
  return(file_path)
}}

ensure_output_dir <- function(subdir = NULL) {{
  if (is.null(subdir) || subdir == "") {{
    dir.create(GENERATED_DIR, recursive = TRUE, showWarnings = FALSE)
    return(GENERATED_DIR)
  }}
  out_dir <- file.path(GENERATED_DIR, subdir)
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  return(out_dir)
}}

cat("R 环境已准备完成\\n")
cat(paste("UPLOAD_DIR =", UPLOAD_DIR, "\\n"))
cat(paste("GENERATED_DIR =", GENERATED_DIR, "\\n"))
"""

    injected_code = r_prefix + "\n" + r_code

    with open(script_path, "w", encoding="utf-8") as f:
        f.write(injected_code)

    try:
        result = subprocess.run(
            ["Rscript", str(script_path)],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode == 0 or result.stdout:
            return json.dumps({
                "status": "success",
                "stdout": result.stdout,
                "stderr": result.stderr
            }, ensure_ascii=False)
        else:
            return json.dumps({
                "status": "error",
                "error_message": result.stderr
            }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "error_message": f"R 脚本执行失败: {str(e)}"
        }, ensure_ascii=False)

    finally:
        if script_path.exists():
            script_path.unlink()