TOOL_REGISTRY = {}
TOOLS_SCHEMA = []

def register_tool(name: str, description: str, parameters: dict):
    """
    工具注册装饰器
    后续新增工具时，只需要：
    1. 写函数
    2. 加这个装饰器
    就能自动注册到 Agent 中
    """
    def decorator(func):
        TOOL_REGISTRY[name] = func
        TOOLS_SCHEMA.append({
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters
            }
        })
        return func
    return decorator