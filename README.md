# 企业舆情风控管理系统

> Enterprise Public Opinion Risk Control System

基于 FastAPI + SQLite + BAAI/bge-m3 + Chroma 的企业舆情风控系统，绑定米哈游（miHoYo）游戏舆情监控场景。

## 功能概览

- 多平台舆情采集（微博、小红书、知乎、B站、TapTap、小黑盒、米游社）
- 语义分析 + 主题路由（8大风控主题、32+锚点）
- 风险分级（高/中/低）+ 风控事件管理
- 公司维度隔离（支持多公司切换）
- Dashboard 可视化（ECharts 图表）
- 语义搜索 + 交叉验证

## 技术栈

| 层级 | 选型 |
|:---|:---|
| 后端 | Python 3.11+ / FastAPI / Uvicorn（单 worker） |
| 事实数据库 | SQLite |
| 向量索引 | Chroma（优先）/ FAISS（降级） |
| 前端 | 原生 HTML/CSS/JavaScript + ECharts |
| Embedding | BAAI/bge-m3（本地运行） |
| LLM | 通义千问 DashScope API（可降级为 Mock） |

## 快速启动

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DASHSCOPE_API_KEY（Mock 模式可跳过）

# 3. 初始化数据库
python scripts/init_db.py

# 4. 导入样例数据
python scripts/import_sample.py

# 5. 启动服务
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 1

# 6. 访问
# http://localhost:8000
```

或使用启动脚本（自动创建虚拟环境 + 安装依赖）：

```bash
# Linux / macOS
chmod +x start.sh && ./start.sh

# Windows
start.bat
```

## Docker 部署

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DASHSCOPE_API_KEY

# 2. 构建并启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 停止
docker-compose down
```

数据持久化在 `app-data` volume 中（SQLite + ChromaDB）。

## LLM 配置

默认使用通义千问 DashScope API。在 `config.yaml` 中配置：

```yaml
llm:
  provider: "dashscope"          # 可选: mock / dashscope
  model: "qwen-plus"             # 模型名称
  api_base: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  api_key_env: "DASHSCOPE_API_KEY"
```

API Key 获取：https://dashscope.console.aliyun.com/

设为 `provider: "mock"` 可使用本地关键词匹配模式（无需 API Key）。

## 目录结构

```
wuhua-opinion-monitor/
├── backend/          # Python FastAPI 后端
│   ├── api/          # API 端点
│   ├── services/     # 业务服务
│   ├── crawler/      # 爬虫系统
│   └── db/           # 数据库
├── frontend/         # H5 前端页面
│   ├── pages/        # 子页面
│   ├── js/           # JavaScript 模块
│   ├── css/          # 样式
│   └── data/mock/    # Mock 数据
├── data/             # 数据库 + 样例数据
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
- [x] Phase 7: 企业舆情转型
- [x] Phase 8: 风控事件 + 公司选择器
- [x] Phase 9: 验收收尾

详见 [PROJECT_LOG.md](PROJECT_LOG.md)
