# BioAgent Hub

一个面向 生物信息学任务的 AI Agent 平台。  
项目采用 **React + FastAPI** 前后端分离架构，结合 **大模型 Tool Calling**、**Python 工具链** 与 **R 生信分析流程**，用于实现从数据上传、任务理解、分析执行到结果展示的完整闭环。

---

## 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [项目目录结构](#项目目录结构)

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

项目目标是构建一个适用于 iGEM 场景的、可扩展的 AI 生信分析工作台。

---

## 核心功能

### 1. 智能对话分析
- 支持自然语言输入生信分析任务
- 支持多轮对话上下文
- 支持基于历史记录继续分析

### 2. 文件上传与管理
- 支持上传 `.csv`、`.txt`、`.gz` 等实验数据文件
- 区分用户上传文件与系统生成结果文件
- 支持结果文件下载

### 3. 生物信息学工具调用
- CSV 数据预览
- GEO / 大型生信数据预读
- GC 含量计算
- R 脚本自动执行

### 4. 图表与结果展示
- 聊天区支持 Markdown 图片渲染
- LAB 工作台支持显示图片
- 支持表格 / 文本 / 模型文件下载

### 5. 会话历史记录
- 支持基于 `session_id` 的会话管理
- 支持历史消息与文件记录查询

### 6. 系统环境扫描
- 检查当前后端运行环境中的 Python / R / Git / CPU 等配置

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
- 自定义 Tool Registry

### 数据与分析
- Python: pandas
- R: data.table / 生信分析相关 R 包
- subprocess 调用 Rscript

---

## 项目目录结构

```bash
backend/
├── app/
│   ├── main.py                 # FastAPI 入口
│   ├── core/                   # 配置与路径管理
│   ├── api/                    # 路由层
│   ├── schemas/                # Pydantic 请求模型
│   ├── agent/                  # Agent 核心逻辑与工具注册
│   ├── tools/                  # 工具函数模块
│   ├── db/                     # 数据库模型与 CRUD
│   ├── services/               # 业务逻辑层
│   └── utils/                  # 工具函数
├── storage/
│   ├── uploads/                # 用户上传文件
│   ├── generated/              # 系统生成结果文件
│   └── temp/                   # 临时脚本与中间文件
├── db_data/
│   └── app.db                  # SQLite 数据库文件
├── .env
└── requirements.txt

frontend/
├── src/
│   ├── App.jsx
│   ├── App.css
│   └── ...
└── package.json
```

---

## 开发日志
### 2026/3/19
项目启动，搭建好了前端网页，连接了ai（暂时用deepseek）

实现了基本聊天功能和R语言自动分析功能

### 2026/3/22
增加了文档下载功能

增加了历史会话功能

修复了打不开图片的bug