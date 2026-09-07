# 企业舆情风控管理系统

基于 DashScope 大模型 API 的企业级舆情风控平台，覆盖 7 大社交平台数据采集、向量语义分析、信度评估与 AI 自动审核，面向游戏行业（以米哈游为示例）提供全流程舆情风险监测。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Static)                     │
│  HTML + CSS + Vanilla JS · 自研 SVG 图表库 · 浮动桌宠    │
│  8 功能页面 · 三段式导航: 登录 → 枢纽 → 主系统           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / JSON
┌────────────────────────▼────────────────────────────────┐
│                 FastAPI Backend (Python)                  │
│  14 路由模块 · 40+ 端点 · JWT 认证                       │
├──────────┬──────────┬───────────┬───────────────────────┤
│ 爬虫引擎  │ 分析管线  │  信度引擎  │   AI 审核代理         │
│ 7 平台    │ 向量路由  │  7 因子    │   自动批准/合并/忽略  │
│ 解析器    │ HDBSCAN  │  加权模型  │   交叉验证            │
├──────────┴──────────┴───────────┴───────────────────────┤
│              SQLite (12 表)  +  ChromaDB                 │
└────────────────────────┬────────────────────────────────┘
                         │ API
          ┌──────────────▼──────────────┐
          │   DashScope (阿里云)         │
          │   text-embedding-v3 (1024d) │
          │   qwen-plus (LLM)           │
          └─────────────────────────────┘
```

## 核心功能

### 数据管线

- **7 平台爬虫** — 微博、小红书、知乎、B站、TapTap、小黑盒、米游社
- **DashScope text-embedding-v3** — 1024 维语义向量，归一化处理
- **ChromaDB 持久化** — 向量存储与相似度检索
- **文本清洗管道** — 自动去噪、标准化

### 分析引擎

- **8 大风控主题 + 32 语义锚点** — 版本节奏、抽卡机制、角色设计、技术性能、社区公关、竞品对比、公司治理、合规风险
- **7 因子信度评分模型** — 粉丝量、活跃度、互动真实性、内容一致性、信度强度、平台可信度、游戏领域权重
- **向量相似度主题路由** — known / uncertain / unknown 三级分类
- **HDBSCAN 未知主题发现** — 自动聚类未匹配内容，发现新兴风险
- **AI 审核代理** — 自动批准/合并/忽略候选主题，LLM 驱动决策
- **4 提供商交叉验证** — 多维度结果校验

### 用户界面

- **8 个功能页面** — 舆情总览、舆情列表、语义搜索、风险主题、风控事件、新风险审核、信度分析、来源台账
- **三段式导航** — 登录页（system-log 动画）→ 枢纽页（桌宠展示）→ 主系统
- **自研 SVG 图表库** — lieflat-charts.js，9 种图表类型，像素级渲染
- **浮动桌宠** — 弹簧物理跟随、22 种状态反应、SVG 实时渲染
- **深色游戏风 UI** — 终末地美学，黄黑主色调

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML5 + CSS3 + Vanilla JS（无框架） |
| 图表 | 自研 lieflat-charts.js (SVG) + ECharts（兼容） |
| 后端 | Python 3.11 + FastAPI + Uvicorn |
| 数据库 | SQLite（12 表，结构化存储） |
| 向量库 | ChromaDB（持久化向量索引） |
| Embedding | DashScope text-embedding-v3 (1024 维) |
| LLM | DashScope qwen-plus（温度 0.2） |
| 爬虫 | Requests + BeautifulSoup4 |
| 聚类 | HDBSCAN（未知主题发现） |
| 部署 | Docker + docker-compose / GitHub Pages（静态演示） |

## 快速启动

### 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/si126048/Enterprise-Public-Opinion-Risk-Control-System.git
cd Enterprise-Public-Opinion-Risk-Control-System

# 2. 创建虚拟环境
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置 API 密钥
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY

# 5. 启动服务
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
# 或使用启动脚本
# Windows:
start.bat
# Linux/Mac:
bash start.sh
```

访问 http://localhost:8000/login.html 进入系统。

### Docker 部署

```bash
docker-compose up -d
```

容器名 `opinion-monitor`，端口 8000，数据持久化在 `app-data` 卷。

## API 概览

| 路由模块 | 前缀 | 说明 |
|----------|------|------|
| health | `/api/health` | 健康检查 |
| auth | `/api/auth` | 登录 / 注册（JWT） |
| ingest | `/api/ingest` | 数据导入 |
| content | `/api/content` | 舆情列表 / 筛选 |
| companies | `/api/companies` | 公司配置 CRUD |
| embedding | `/api/embedding` | 向量搜索 / 管理 |
| routing | `/api/routing` | 主题路由 / 状态 |
| discovery | `/api/discovery` | 候选主题 / 审批 |
| validation | `/api/validation` | 数据校验 |
| crawler | `/api/crawler` | 爬虫状态 / 触发 |
| risk_events | `/api/risk/events` | 风控事件管理 |
| analysis | `/api/analysis` | 分析管线 |
| review_agent | `/api/review-agent` | AI 审核代理 |
| credibility | `/api/credibility` | 信度评分 |

## 配置参考

核心配置位于 `config.yaml`：

```yaml
app:
  name: enterprise-risk-monitor
  demo_mode: true
  port: 8000
  default_company: mihoyo

embedding:
  provider: dashscope
  model: text-embedding-v3
  dimension: 1024

llm:
  provider: dashscope
  model: qwen-plus
  temperature: 0.2

database:
  path: data/app.db

vector_store:
  path: data/chroma_db

credibility:
  factors:
    followers: 0.15
    activity: 0.10
    engagement_authenticity: 0.20
    content_consistency: 0.15
    credibility_intensity: 0.15
    platform_credibility: 0.15
    game_level: 0.10

routing:
  top_k_anchors: 5
  candidate_topics: 3
  threshold: 0.65

discovery:
  min_cluster_size: 5

review_agent:
  auto_run_after_discovery: true
  merge_threshold: 0.70
```

## 数据库

12 张 SQLite 表：

| 表名 | 说明 |
|------|------|
| `company_config` | 公司配置（关键词、产品、平台） |
| `raw_content` | 采集的原始舆情内容 |
| `content_analysis` | AI 分析结果（主题、信度、风险、建议） |
| `topics` | 风控主题定义（G001-G008） |
| `topic_anchors` | 主题语义锚文本 |
| `candidate_topics` | 待审核候选主题 |
| `embedding_spaces` | 向量模型版本追踪 |
| `ai_run_log` | LLM 调用审计日志 |
| `cross_validation_results` | 交叉验证记录 |
| `crawl_run_log` | 爬虫执行历史 |
| `risk_events` | 聚合风控事件 |
| `users` | 用户认证账户 |

## 项目结构

```
├── backend/
│   ├── api/              # 14 个 API 路由模块
│   ├── db/               # SQLite 数据库 schema + 迁移
│   ├── models/           # 数据模型 (CompanyConfig)
│   ├── services/         # 8 个业务服务
│   │   ├── embedding_service.py   # DashScope 向量服务
│   │   ├── llm_service.py         # DashScope LLM 服务
│   │   ├── routing_service.py     # 主题路由
│   │   ├── vector_store.py        # ChromaDB 封装
│   │   ├── credibility.py         # 信度评分
│   │   ├── cross_validation.py    # 交叉验证
│   │   ├── review_agent.py        # AI 审核代理
│   │   └── risk_advisor.py        # 风险建议
│   ├── discovery/        # HDBSCAN 主题聚类
│   ├── crawler/          # 爬虫框架 + 7 平台解析器
│   ├── ingestion/        # 文本清洗 + 数据导入
│   └── app.py            # FastAPI 入口
├── frontend/
│   ├── index.html        # 主系统 SPA 壳
│   ├── login.html        # 登录页
│   ├── hub.html          # 枢纽页（桌宠展示）
│   ├── pages/            # 8 个子页面模板
│   ├── js/
│   │   ├── app.js        # 主应用逻辑 + 路由
│   │   ├── hub.js        # 枢纽页逻辑
│   │   ├── login.js      # 登录页逻辑
│   │   ├── lieflat-charts.js  # 自研 SVG 图表库
│   │   ├── demo-config.js     # Demo 模式配置
│   │   └── mascot/       # 桌宠引擎 (8 模块)
│   ├── css/              # 8 个样式文件
│   └── data/mock/        # GitHub Pages 演示数据
├── data/                 # 运行时数据 (SQLite + ChromaDB)
├── config.yaml           # 主配置
├── docker-compose.yml    # Docker 编排
├── Dockerfile            # 容器镜像
├── requirements.txt      # Python 依赖
└── tests/                # 测试套件
```

## 在线演示

[GitHub Pages 静态演示](https://si126048.github.io/Enterprise-Public-Opinion-Risk-Control-System/)

演示版本使用 Mock 数据，无需后端服务即可浏览全部界面。任意账号密码即可登录。
