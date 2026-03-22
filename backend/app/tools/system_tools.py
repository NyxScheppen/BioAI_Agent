import os
import json
import platform
import shutil
import subprocess
from app.agent.tool_registry import register_tool

def _get_command_version(command, version_arg="--version"):
    """
    获取命令行工具版本
    """
    try:
        result = subprocess.run(
            [command, version_arg],
            capture_output=True,
            text=True,
            timeout=10
        )
        text = (result.stdout or result.stderr).strip().split("\n")[0]
        return text
    except Exception:
        return None

@register_tool(
    name="scan_system_config",
    description="扫描当前后端运行环境的系统配置，包括 Python、R、Git、平台、CPU 等",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    }
)
def scan_system_config():
    """
    注意：这里扫描的是当前运行后端的机器环境，不是浏览器访问者本机
    """
    info = {
        "platform": platform.platform(),
        "python_path": shutil.which("python"),
        "python_version": platform.python_version(),
        "rscript_path": shutil.which("Rscript"),
        "rscript_version": _get_command_version("Rscript", "--version"),
        "git_path": shutil.which("git"),
        "git_version": _get_command_version("git", "--version"),
        "cpu_count": os.cpu_count(),
        "current_working_directory": os.getcwd()
    }
    return json.dumps(info, ensure_ascii=False, indent=2)