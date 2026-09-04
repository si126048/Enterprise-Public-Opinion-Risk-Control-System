# 五华区民意诉求语义分析系统

> Public Opinion Semantic Analysis System for Kunming Wuhua District

基于 FastAPI + SQLite + Qwen3-Embedding-4B + Chroma 的民意诉求语义分析原型，绑定昆明市五华区基层治理场景。

## 技术栈

| 层级 | 选型 |
|:---|:---|
| 后端 | Python 3.11+ / FastAPI / Uvicorn（单 worker） |
| 事实数据库 | SQLite |
| 向量索引 | Chroma（优先）/ FAISS（降级） |
| 前端 | 原生 HTML/CSS/JavaScript + ECharts |
| Embedding | Qwen3-Embedding-4B（本地运行） |
| LLM | Mock（可配置为 DeepSeek / 通义千问 / Kimi） |

## 快速启动

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 LLM API Key（Mock 模式可跳过）

# 3. 初始化数据库（Phase 1）
python scripts/init_db.py

# 4. 导入样例数据（Phase 1）
python scripts/import_sample.py

# 5. 启动服务
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 1

# 6. 访问 H5
# http://localhost:8000
```

## 目录结构

```
wuhua-opinion-monitor/
├── backend/          # Python FastAPI 后端
├── frontend/         # H5 前端页面
├── data/             # 数据库 + 样例数据
├── evidence/         # 课程证据
├── cross_validation/ # 三模型交叉验证
├── tests/            # 测试
├── scripts/          # 工具脚本
├── config.yaml       # 全局配置
└── requirements.txt
```

## 实施进度

- [x] Phase 0: 环境与骨架
- [x] Phase 1: 事实数据库
- [x] Phase 2: Embedding 服务
- [x] Phase 3: 主题路由 + LLM
- [x] Phase 4: Dashboard + 语义搜索
- [x] Phase 5: Unknown Negative 发现
- [x] Phase 6: 课程化收尾

详见 [PROJECT_LOG.md](PROJECT_LOG.md)
