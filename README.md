# BioAgent Hub

一个面向 生物信息学任务的 AI Agent 平台。  
项目采用 **React + FastAPI** 前后端分离架构，结合 **大模型 Tool Calling**、**Python 工具链** 与 **R 生信分析流程**，用于实现从数据上传、任务理解、分析执行到结果展示的完整闭环。

---

## 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [主要文件结构](#主要文件结构)
- [助手模块](#助手模块)
- [草履虫都能轻松上手的下载指南](#下载指南)
---

## 项目简介

BioAgent Hub 是一个为生物信息学分析与合成生物学设计的智能 Agent 平台。  
用户可以通过网页端上传实验数据文件，输入自然语言分析需求，系统会调用大模型理解任务，并进一步通过本地工具执行实际分析，包括：

- 表达矩阵读取
- 差异表达分析
- 富集分析
- 生存分析
- 机器学习建模
- 单细胞/空间转录组分析
- R 脚本执行
- 生信图表生成
- 系统环境扫描

(待补充)

---

## 核心功能

| 分析类别 | 支持任务 | 工具链 |
|---------|---------|--------|
| **基础生信** | GC含量计算、文件预览、大型GEO矩阵读取 | Python + pandas |
| **差异表达** | bulk RNA-seq 差异分析、火山图/热图/PCA | R + limma |
| **单基因分析** | 表达差异、生存分析（KM/Cox）、共表达、相关性 | R + survival / cor |
| **预后建模** | LASSO-Cox、单/多因素Cox、机器学习分类（RF/SVM） | R + caret / glmnet |
| **通路富集** | GO / KEGG / GSEA / GSVA | R + clusterProfiler |
| **单细胞/空间** | （待扩展） | 未来支持 Seurat / Squidpy |
| **分子建模** | 蛋白质结构、相互作用、分子对接（待接入） | Python + BioPandas / RDKit |
| **筛选任务** | 药物虚拟筛选、核酸适配体设计 | （正在集成） |
| **文献检索** | PubMed / Europe PMC / Crossref / arXiv / bioRxiv | Python + requests |
| **系统诊断** | 检查 R/Python/Git/环境配置 | `scan_system_config` 工具 |

---

## 技术架构

### 前端
- React
- React Hooks (`useState`, `useEffect`, `useRef`)
- react-markdown

### 后端
- FastAPI
- Pydantic
- SQLAlchemy
- SQLite

### AI / Agent
- DeepSeek API（OpenAI 兼容调用方式）
- Tool Calling / Function Calling

### 数据与分析
- Python: pandas
- R: data.table / 生信分析相关 R 包

---

## 主要文件结构

```bash
frontend/
└── src/
    ├── main.jsx                 前端入口
    ├── App.jsx                  主页面：聊天、会话、上传、结果展示
    └── App.css                  页面样式

backend/app/
├── main.py                      FastAPI入口，注册路由、挂载/files、建表
├── api/
│   ├── chat.py                  API: POST /api/chat
│   ├── upload.py                API: POST /api/upload
│   ├── history.py               API: GET /api/history
│   └── system.py                API: GET /api/system-info
├── services/
│   ├── chat_service.py          聊天主流程调度
│   ├── file_service.py          上传文件保存
│   └── system_service.py        系统信息整理
├── agent/
│   ├── bio_agent.py             Agent主循环：模型+工具调用
│   ├── prompts.py               系统提示词
│   └── tool_registry.py         工具注册中心
├── tools/
│   ├── __init__.py              导入全部工具并触发注册
│   ├── basic_tools.py           基础工具(GC计算)
│   ├── file_tools.py            文件读取工具
│   ├── r_tools.py               R脚本执行工具
│   └── system_tools.py          系统扫描工具
├── db/
│   ├── database.py              数据库连接
│   ├── models.py                数据表定义
│   └── crud.py                  数据库增删查改
├── core/
│   ├── config.py                环境变量配置
│   └── paths.py                 路径配置
└── utils/
    ├── file_utils.py            文件类型识别
    └── response_formatter.py    回复中的文件链接解析与补全

```
---

## 下载指南
**注：最好在linux或者wsl2环境下运行，因为作者用的是wsl2**

1. 环境要求
 
请确保本机已安装以下工具：
 
- Python 3.9 及以上
- pip
- R 4.2 及以上
- Rscript
- Bash（Linux / macOS 默认可用，Windows 推荐使用 Git Bash 或 WSL2）
 
可先用以下命令检查版本：
 
```bash
python --version
pip --version
Rscript --version
```

2. 环境依赖下载

在项目根目录下执行：
```bash
bash scripts/setup_all.sh
```
当看到以下信息时，即安装成功
```bash
======================================
 BioAI Agent environment setup start
======================================
...
======================================
 Setup completed successfully
======================================
```

3. 全工具追求者

如果想使用完整的工具，请在根目录下运行以下代码
```bash
cd backend
pip install -r requirements.txt
cd ..
```
要等很长，很长，很长的一段时间，建议冲一杯咖啡坐在屏幕前，给家人打个电话，或者做点比看着终端发呆更有意义的事情

4. 运行

打开终端，在项目根目录下，运行
```bash
npm run dev
```

5. 报错了？对吧

找到项目的backend/.env这个文件，把你的deepseek api key填进去
