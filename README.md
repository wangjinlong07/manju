# ComicCraft-Engine

漫画场景图像/视频生成编排引擎。整合 ComfyUI（图像/视频生成）和 MoneyPrinterTurbo（音频/视频合成），通过 FastAPI 提供统一业务 API。

## 系统架构

```
客户端 → FastAPI (:8000) → ComfyUI (:8188)
                          → MoneyPrinterTurbo (Python import)
```

本系统**不实现**图像生成或视频渲染，仅负责：
- 加载工作流模板并动态注入参数
- 将工作流转发至 ComfyUI API
- 复用 MoneyPrinterTurbo 的音视频服务
- 管理场景状态流转

## 前置要求

- Python 3.9+
- Git
- GPU 环境（ComfyUI 需要，CPU 模式也可运行但较慢）
- ffmpeg（系统级安装，MoneyPrinterTurbo 需要）

## 快速开始

### 第 1 步：安装 Python 依赖

```bash
cd manju
pip3 install -r requirements.txt
```

### 第 2 步：初始化第三方依赖（填充 third_party/）

`third_party/` 目录初始为空，需要运行初始化脚本来克隆 ComfyUI 和 MoneyPrinterTurbo：

```bash
python3 setup_workspace.py
```

这个脚本会自动完成：
1. 克隆 ComfyUI 到 `third_party/ComfyUI/`
2. 克隆 4 个 ComfyUI 插件到 `third_party/ComfyUI/custom_nodes/`：
   - IPAdapter_plus（人脸融合）
   - Impact-Pack（图像后处理）
   - reactor-node（换脸）
   - VideoHelperSuite（视频辅助）
3. 克隆 MoneyPrinterTurbo 并提取其 `app/` 目录到 `third_party/money_printer/`

> 如果目标目录已存在，脚本会自动跳过，可安全重复执行。

### 第 3 步：安装 ComfyUI 依赖

```bash
pip3 install -r third_party/ComfyUI/requirements.txt
```

### 第 4 步：下载 ComfyUI 模型文件

ComfyUI 需要模型文件才能运行。将模型放到 `third_party/ComfyUI/models/` 对应目录下：
- checkpoints/（主模型，如 SD1.5、SDXL）
- loras/（LoRA 模型）
- controlnet/（ControlNet 模型）

具体需要哪些模型取决于你的工作流模板。

### 第 5 步：配置工作流模板

`templates/` 目录中有占位符模板文件：
- `comic_image_gacha.json` — 图像生成工作流
- `comic_video_render.json` — 视频渲染工作流
- `node_mapping.json` — 节点 ID 映射配置

**你需要用实际从 ComfyUI 导出的工作流替换这些占位符模板。**

替换步骤：
1. 在 ComfyUI Web UI 中设计好你的工作流
2. 点击 "Save (API Format)" 导出为 JSON
3. 用导出的 JSON 替换 `templates/comic_image_gacha.json` 或 `comic_video_render.json`
4. 更新 `templates/node_mapping.json` 中的节点 ID，确保与新工作流中的节点 ID 一致

`node_mapping.json` 格式说明：
```json
{
    "gacha": {
        "prompt_text": {"node_id": "6", "field_path": ["inputs", "text"]},
        "character_face_url": {"node_id": "12", "field_path": ["inputs", "image"]},
        "seed": {"node_id": "3", "field_path": ["inputs", "seed"]}
    },
    "video_render": {
        "approved_image_url": {"node_id": "1", "field_path": ["inputs", "image"]},
        "motion_type": {"node_id": "5", "field_path": ["inputs", "motion_model"]}
    }
}
```

## 启动服务

### 方式一：统一启动（推荐）

一条命令同时启动 ComfyUI 和 FastAPI：

```bash
python3 run.py
```

这会：
1. 启动 ComfyUI 子进程（监听 127.0.0.1:8188，无界面模式）
2. 等待 5 秒让 ComfyUI 初始化
3. 启动 FastAPI 业务 API（监听 0.0.0.0:8000）

按 `Ctrl+C` 可优雅关闭两个服务。

### 方式二：分别启动

如果你需要独立调试，可以分开启动：

```bash
# 终端 1：启动 ComfyUI
python3 third_party/ComfyUI/main.py --listen 127.0.0.1 --port 8188

# 终端 2：启动 FastAPI
uvicorn core.app:app --host 0.0.0.0 --port 8000
```

## API 接口

启动后访问 http://localhost:8000/docs 查看完整的 Swagger 文档。

### POST /api/scene/gacha — 提交图像生成

```bash
curl -X POST http://localhost:8000/api/scene/gacha \
  -H "Content-Type: application/json" \
  -d '{
    "scene_id": "scene-001",
    "prompt": "一个英勇的战士站在幻想风景中",
    "character_face_url": "https://example.com/face.png",
    "seed": 42
  }'
```

返回：
```json
{"prompt_id": "xxx-xxx", "scene_id": "scene-001", "status": "GENERATING"}
```

### GET /api/scene/{scene_id}/status — 查询状态

```bash
curl http://localhost:8000/api/scene/scene-001/status
```

当 ComfyUI 生成完成后，状态会从 `GENERATING` 变为 `IMAGE_READY`，并返回生成图片的地址。

### POST /api/scene/render_video — 提交视频渲染

前提：场景状态必须为 `IMAGE_APPROVED`（需要人工审批通过图片后手动更新状态）。

```bash
curl -X POST http://localhost:8000/api/scene/render_video \
  -H "Content-Type: application/json" \
  -d '{
    "scene_id": "scene-001",
    "approved_image_url": "https://example.com/approved.png",
    "motion_type": "zoom_in"
  }'
```

## 场景状态流转

```
GENERATING → IMAGE_READY → IMAGE_APPROVED → RENDERING → VIDEO_READY
```

- `GENERATING`：ComfyUI 正在生成图像
- `IMAGE_READY`：图像生成完成，等待审批
- `IMAGE_APPROVED`：人工审批通过（需手动设置）
- `RENDERING`：ComfyUI 正在渲染视频
- `VIDEO_READY`：视频渲染完成

## 运行测试

```bash
pytest tests/ -v
```

包含属性测试（property-based tests），使用 hypothesis 框架验证核心逻辑的正确性。

## 目录结构

```
manju/
├── run.py                     # 统一启动器
├── setup_workspace.py         # 工作空间初始化脚本
├── requirements.txt           # Python 依赖
├── core/
│   ├── __init__.py
│   ├── app.py                 # FastAPI 业务 API
│   ├── workflow_utils.py      # 工作流模板加载与参数注入
│   └── ffmpeg_composer.py     # 音视频合成层
├── templates/
│   ├── comic_image_gacha.json # 图像生成工作流模板（需替换为实际工作流）
│   ├── comic_video_render.json# 视频渲染工作流模板（需替换为实际工作流）
│   └── node_mapping.json      # 节点 ID 配置映射
├── tests/                     # 测试文件
└── third_party/               # 第三方依赖（运行 setup_workspace.py 后填充）
    ├── ComfyUI/
    └── money_printer/
```

## 常见问题

**Q: `third_party/` 为什么是空的？**

这是设计如此。第三方仓库体积较大（ComfyUI + 插件 + MoneyPrinterTurbo），不适合放在版本控制中。运行 `python setup_workspace.py` 即可自动克隆所有依赖。

**Q: ComfyUI 启动失败怎么办？**

1. 确认 GPU 驱动和 CUDA 已正确安装
2. 确认已安装 ComfyUI 的依赖：`pip install -r third_party/ComfyUI/requirements.txt`
3. 确认模型文件已放到正确位置

**Q: 只想用 FastAPI API 不想启动 ComfyUI？**

可以单独启动 FastAPI：`uvicorn core.app:app --port 8000`，但调用 gacha/render_video 接口时会返回 502（ComfyUI 不可达）。状态查询接口可正常使用。

**Q: MoneyPrinterTurbo 相关功能报 RuntimeError？**

确认已执行 `python3 setup_workspace.py` 且 `third_party/money_printer/` 目录存在。
