import re
from app.utils.file_utils import detect_file_type

def extract_generated_files_from_reply(reply: str):
    """
    从模型回复中提取文件名
    这里只提取常见结果文件后缀
    """
    pattern = r'[\w\-.\/]+\.(?:png|jpg|jpeg|svg|csv|txt|rds|xlsx|tsv|pdb)'
    all_files = re.findall(pattern, reply)

    # 统一只保留文件名本体，避免 data/xxx、generated/xxx 混乱
    clean_files = []
    seen = set()

    for f in all_files:
        name = f.split("/")[-1]
        if name not in seen:
            clean_files.append(name)
            seen.add(name)

    return clean_files

def build_file_url(filename: str) -> str:
    """
    统一生成 generated 结果文件访问地址
    """
    return f"http://127.0.0.1:8000/files/generated/{filename}"

def append_markdown_if_missing(reply: str, filename: str) -> str:
    """
    如果模型提到了文件名但没带 URL，则自动补一个可点击链接
    图片补 Markdown 图片，其它补普通下载链接
    """
    url = build_file_url(filename)
    file_type = detect_file_type(filename)

    if url in reply:
        return reply

    if file_type == "image":
        return reply + f"\n![{filename}]({url})\n"
    else:
        return reply + f"\n[{filename}]({url})\n"

def build_file_list(file_names: list):
    """
    构造给前端的结构化 files 列表
    """
    files = []
    for name in file_names:
        files.append({
            "url": build_file_url(name),
            "name": name,
            "type": detect_file_type(name)
        })
    return files