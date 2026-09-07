@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === 企业舆情风控系统 启动脚本 ===

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 未找到 python，请先安装 Python 3.11+
    pause
    exit /b 1
)

if not exist "venv" (
    echo [INFO] 创建虚拟环境...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo [INFO] 安装依赖...
pip install -r requirements.txt -q

if not exist ".env" (
    echo [WARN] .env 不存在，从 .env.example 复制...
    copy .env.example .env
    echo [WARN] 请编辑 .env 填入 DASHSCOPE_API_KEY
)

echo [INFO] 初始化数据库...
python scripts/init_db.py

echo [INFO] 导入主题锚点...
python scripts/seed_topics.py
if %ERRORLEVEL% neq 0 (
    echo [WARN] 锚点导入失败（可能未配置 API Key），可稍后手动运行: python scripts/seed_topics.py
)

echo [INFO] 启动服务 http://0.0.0.0:8000
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 1

pause
