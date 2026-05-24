# PupuLin 噗噗凛

纯云端 AI 漫剧生产引擎。React Flow 无限画布 + 配置驱动多厂商路由 + DiskCache 缓存 + Skill 风格预设系统，节点连线即数据流，一键生产完整漫剧。

## 快速启动

### 1. 安装依赖

```bash
# 后端
pip3 install -r requirements.txt

# 前端
cd frontend && npm install
```

### 2. 配置数据库（可选）

```bash
# PostgreSQL 15+ 执行建表
psql -f schema.sql
```

### 3. 配置 API Key

复制 `.env.sample` 为 `.env`，按需填入：

```bash
DEEPSEEK_API_KEY=sk-xxx        # DeepSeek V4（剧本生成）— 必填
SILICON_API_KEY=sk-xxx          # 硅基流动 FLUX（生图）— 必填
ZHIPU_API_KEY=xxx              # 智谱 CogVideoX-3（视频）— 必填
DATABASE_URL=                   # PostgreSQL 连接串（文稿持久化）
REDIS_URL=                      # Redis（可选）
```

### 4. 启动服务

```bash
# 终端 1：后端 API (port 8000)
python3 run_api.py

# 终端 2：前端 (port 5173)
cd frontend && npm run dev
```

### 5. 打开浏览器

访问 **http://localhost:5173**

## 当前可用模型

通过 `models.yaml` 插拔配置，前端自动从 `/api/models` 读取。

| 类型 | 模型 ID | 说明 |
|------|---------|------|
| LLM | deepseek-v4-pro | DeepSeek V4 Pro（支持深度思考） |
| LLM | deepseek-v4-flash | DeepSeek V4 Flash（快速） |
| 生图 | flux-schnell | 硅基流动 Kolors/FLUX |
| 视频 | cogvideox3 | 智谱清影 CogVideoX-3（文/图/首尾帧三模式） |

> 更多模型（GPT Image 2、可灵 3.0、Seedance 2.0、Grok Imagine 等）在 `models.yaml` 中已注释，取消注释并配置对应 Key 即可启用。

## Skill 风格预设

`skills/` 目录下按类型分为三个子目录：

```
skills/
├── script/     # 剧本风格（注入 LLM system prompt）
├── image/      # 生图风格（注入 image_prompt 前缀）
│   ├── cinematic-4k.md
│   ├── cyberpunk.md
│   ├── ghibli-watercolor.md
│   └── manga-bw.md
└── video/      # 视频风格（预留）
```

在前端 textarea 输入 `/` 即可唤起对应节点类型的 Skill 选择器。丢入 `.md` 文件即自动识别。

## 使用流程

1. 从左侧组件库拖拽节点到画布（剧本中枢 / 图像生成 / 视频渲染 / 导入图片）
2. 连线建立数据流（上游 output 自动注入下游 inputData）
3. 选中节点，底部展开输入栏：
   - 输入 `/` 唤起风格选择器
   - 输入 `@` 唤起参考图选择器（引用连入的图片）
   - prompt 中 `@参考图N` 标记会被后端替换为实际 URL
4. 剧本节点生成分镜 → 多选展开为图像节点 → 抽卡生图 → 连线到视频节点渲染

## API 文档

启动后访问：**http://localhost:8000/docs**

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/models | GET | 可用模型 + Skills 列表（按类型分组） |
| /api/script/generate | POST | 剧本生成 |
| /api/scene/gacha | POST | 图像抽卡（支持多张候选 + @参考图解析） |
| /api/scene/approve_image | POST | 采纳候选图 |
| /api/scene/render_video | POST | 视频渲染（图生/文生/首尾帧） |
| /api/scene/compose | POST | TTS 配音 + 音画合成 |
| /api/scene/{id}/status | GET | 查询场景状态 |
| /api/projects | GET/POST | 文稿 CRUD |
| /api/projects/{id} | GET/PUT/DELETE | 单文稿操作 |
| /api/projects/{id}/assets | GET | 生成产物列表 |

## 项目结构

```
manju/
├── .env                    # API Key 配置（不入 git）
├── models.yaml             # 模型注册表（插拔式）
├── requirements.txt
├── schema.sql              # PostgreSQL 建表脚本
├── run_api.py              # 后端启动入口
├── setup_workspace.py      # 工作空间初始化
├── .cache/                 # DiskCache 缓存（自动生成）
├── core/
│   ├── __init__.py         # Pydantic 数据模型 + SceneStatus 状态枚举
│   ├── app.py              # FastAPI 路由 + 场景状态机
│   ├── database.py         # asyncpg 连接池 + 文稿/产物 CRUD
│   ├── model_router.py     # 配置驱动路由 + Skill 解析 + 视频适配器
│   └── ffmpeg_composer.py  # TTS 缓存 + FFmpeg 音视频合成
├── frontend/               # React 19 + Vite 8 + Tailwind CSS 4
│   └── src/
│       ├── App.jsx         # React Flow 无限画布主程序
│       ├── nodes/          # 4 个自包含节点组件
│       │   ├── ScriptNode.jsx
│       │   ├── GachaNode.jsx
│       │   ├── VideoNode.jsx
│       │   └── LocalImageNode.jsx
│       ├── components/     # PupuLinLogo / ProjectManager / SettingsPopover
│       └── store/          # Zustand stores (theme / canvas / project)
├── skills/                 # Skill 风格预设（script/ image/ video/）
└── tests/                  # pytest + hypothesis 测试
```

## 架构

```
React Flow (5173) → Vite Proxy → FastAPI (8000) → ModelRouter
                                                   ├── LiteLLM → DeepSeek（剧本）
                                                   ├── OpenAI API → 硅基流动（生图）
                                                   ├── VideoAdapter → 智谱/可灵/...（视频）
                                                   └── DiskCache (.cache/)
                                                → database.py → PostgreSQL
```

## 运行测试

```bash
python3 -m pytest tests/ -v
```

## 清除缓存

```bash
rm -rf .cache/
```

## 常见问题

**Q: 前端模型下拉为空？**
→ 确认后端 `python3 run_api.py` 已启动，Vite proxy 指向 `localhost:8000`。

**Q: 如何新增模型？**
→ 编辑 `models.yaml` 添加配置节点，重启后端，前端自动展示。

**Q: 如何新增 Skill 风格？**
→ 在 `skills/image/`（或 script/video/）目录丢入 `.md` 文件，格式参考现有文件。无需重启。

**Q: @参考图 如何工作？**
→ 在 textarea 输入 `@` 弹出连入节点的图片列表，选中后插入 `@参考图N` 标记。后端生图时自动将标记替换为对应图片的实际 URL。
