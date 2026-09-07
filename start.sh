#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 企业舆情风控系统 启动脚本 ==="

if ! command -v python3 &> /dev/null; then
    echo "[ERROR] 未找到 python3，请先安装 Python 3.11+"
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "[INFO] 创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "[INFO] 安装依赖..."
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
    echo "[WARN] .env 不存在，从 .env.example 复制..."
    cp .env.example .env
    echo "[WARN] 请编辑 .env 填入 DASHSCOPE_API_KEY"
fi

echo "[INFO] 初始化数据库..."
python scripts/init_db.py

echo "[INFO] 导入主题锚点..."
python scripts/seed_topics.py || echo "[WARN] 锚点导入失败（可能未配置 API Key），可稍后手动运行: python scripts/seed_topics.py"

echo "[INFO] 启动服务 http://0.0.0.0:8000"
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 1
