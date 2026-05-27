"""FastAPI Business Layer: HTTP routes + scene state machine management."""

import asyncio
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel

from core import (
    MOCK_DB,
    ComposeRequest,
    GachaRequest,
    SceneStatus,
    VideoRenderRequest,
)
from core.model_router import ModelRouter
from core.database import get_pool, close_pool, create_project, list_projects, get_project, update_project, delete_project, create_asset, list_assets

app = FastAPI(title="ComicCraft-Engine V2.0")

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = ModelRouter()


@app.on_event("startup")
async def startup():
    await get_pool()
    logger.info("[App] Database pool ready")


@app.on_event("shutdown")
async def shutdown():
    await close_pool()


# ─────────────────────────────────────────────
# Project (文稿) CRUD endpoints
# ─────────────────────────────────────────────

class ProjectCreateReq(BaseModel):
    name: str = "未命名文稿"
    canvas_json: dict = {}


class ProjectUpdateReq(BaseModel):
    name: Optional[str] = None
    canvas_json: Optional[dict] = None


@app.post("/api/projects")
async def api_create_project(req: ProjectCreateReq):
    project = await create_project(req.name, req.canvas_json)
    logger.info(f"[Project] Created: {project['id']} / {project['name']}")
    return project


@app.get("/api/projects")
async def api_list_projects(limit: int = 50, offset: int = 0):
    return await list_projects(limit, offset)


@app.get("/api/projects/{project_id}")
async def api_get_project(project_id: str):
    project = await get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.put("/api/projects/{project_id}")
async def api_update_project(project_id: str, req: ProjectUpdateReq):
    project = await update_project(project_id, req.name, req.canvas_json)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: str):
    ok = await delete_project(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@app.get("/api/projects/{project_id}/assets")
async def api_list_assets(project_id: str):
    return await list_assets(project_id)


@app.get("/api/models")
async def get_models():
    """前端动态读取可用模型列表 — 真正的插拔式"""
    return router.get_models_for_frontend()





@app.post("/api/scene/gacha")
async def scene_gacha(req: GachaRequest):
    print(f"\n{'='*60}\n[API CALL] /api/scene/gacha\n  prompt: {req.prompt[:100]}\n  model: {req.image_provider}\n  ratio: {req.ratio}\n  resolution: {req.resolution}\n  n: {req.n}\n  reference_images: {len(req.reference_images)}张\n{'='*60}")
    logger.info(f"[Gacha] scene_id={req.scene_id}, provider={req.image_provider}, n={req.n}, ratio={req.ratio}, resolution={req.resolution}")
    logger.info(f"[Gacha] prompt={req.prompt[:200]}")
    logger.info(f"[Gacha] reference_images={len(req.reference_images)}张")
    image_urls = await asyncio.to_thread(
        router.generate_image,
        req.image_provider, req.prompt, req.n, req.ratio, req.resolution, req.reference_images, req.skill
    )

    # 抽卡不自动采纳 — 返回候选列表让前端用户选择
    # 如果 scene_id 不存在（例如前端画布直接拖出的独立生图节点），则自动在 MOCK_DB 中初始化
    if req.scene_id not in MOCK_DB:
        MOCK_DB[req.scene_id] = {
            "scene_id": req.scene_id,
            "status": SceneStatus.IMAGE_READY,
            "image_url": None,
            "video_url": None,
            "download_url": None,
        }
        logger.info(f"[Gacha] Scene {req.scene_id} initialized in MOCK_DB → IMAGE_READY")
    else:
        MOCK_DB[req.scene_id]["status"] = SceneStatus.IMAGE_READY
        logger.info(f"[Gacha] Scene {req.scene_id} → IMAGE_READY ({len(image_urls)} candidates)")

    # 自动记录 assets（如果 project_id 存在）
    if req.project_id:
        for url in image_urls:
            try:
                await create_asset(req.project_id, "image", url, req.prompt, req.image_provider, req.scene_id)
            except Exception as e:
                logger.warning(f"[Gacha] Failed to record asset: {e}")

    return {"image_urls": image_urls, "scene_id": req.scene_id}


@app.post("/api/scene/approve_image")
async def scene_approve_image(req: dict):
    """用户从 N 张候选图中选择一张采纳"""
    scene_id = req.get("scene_id")
    image_url = req.get("image_url")
    if not scene_id or not image_url:
        raise HTTPException(status_code=400, detail="scene_id 和 image_url 必填")
    if scene_id not in MOCK_DB:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")
    scene = MOCK_DB[scene_id]
    if scene["status"] != SceneStatus.IMAGE_READY:
        raise HTTPException(status_code=400, detail=f"Scene {scene_id} 状态为 {scene['status']}，期望 IMAGE_READY")
    MOCK_DB[scene_id]["status"] = SceneStatus.IMAGE_APPROVED
    MOCK_DB[scene_id]["image_url"] = image_url
    logger.info(f"[ApproveImage] Scene {scene_id} → IMAGE_APPROVED")
    return {"scene_id": scene_id, "status": "IMAGE_APPROVED", "image_url": image_url}


@app.post("/api/scene/render_video")
async def scene_render_video(req: VideoRenderRequest):
    # 兼容：前端传 image_url，后端用 approved_image_url
    if not req.approved_image_url and req.image_url:
        req.approved_image_url = req.image_url
    print(f"\n{'='*60}\n[API CALL] /api/scene/render_video\n  prompt: {(req.prompt or '')[:100]}\n  model: {req.video_provider}\n  duration: {req.duration}\n  motion_type: {req.motion_type}\n  image_url: {(req.approved_image_url or '无')[:80]}\n{'='*60}")
    logger.info(f"[RenderVideo] scene_id={req.scene_id}, provider={req.video_provider}, duration={req.duration}, motion_type={getattr(req, 'motion_type', 'N/A')}")
    logger.info(f"[RenderVideo] prompt={req.prompt[:200] if req.prompt else '无'}")
    logger.info(f"[RenderVideo] image_url={getattr(req, 'image_url', None) or req.approved_image_url or '无'}")

    # 如果 scene_id 不存在（例如直接在画布运行生图-视频连线），则自动在 MOCK_DB 中初始化并批准
    if req.scene_id not in MOCK_DB:
        MOCK_DB[req.scene_id] = {
            "scene_id": req.scene_id,
            "status": SceneStatus.IMAGE_APPROVED,
            "image_url": req.approved_image_url,
            "video_url": None,
            "download_url": None,
        }
        logger.info(f"[RenderVideo] Scene {req.scene_id} auto-created & auto-approved in MOCK_DB")
    else:
        scene = MOCK_DB[req.scene_id]
        # 如果是 IMAGE_READY 或 CREATED 状态，且前端直接请求渲染视频（厚客户端直接应用结果），我们自动设置为 APPROVED 并写入图片地址
        if scene["status"] in (SceneStatus.IMAGE_READY, SceneStatus.CREATED):
            scene["status"] = SceneStatus.IMAGE_APPROVED
            scene["image_url"] = req.approved_image_url
            logger.info(f"[RenderVideo] Scene {req.scene_id} status auto-promoted to IMAGE_APPROVED")

    scene = MOCK_DB[req.scene_id]
    if scene["status"] != SceneStatus.IMAGE_APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Scene {req.scene_id} is in state {scene['status']}, expected IMAGE_APPROVED",
        )

    video_url = await asyncio.to_thread(
        router.generate_video,
        req.video_provider, req.approved_image_url, req.motion_type,
        duration=req.duration, prompt=req.prompt
    )

    MOCK_DB[req.scene_id]["status"] = SceneStatus.VIDEO_READY
    MOCK_DB[req.scene_id]["video_url"] = video_url
    logger.info(f"[RenderVideo] Scene {req.scene_id} → VIDEO_READY")

    # 自动记录 video asset
    if req.project_id:
        try:
            await create_asset(req.project_id, "video", video_url, req.prompt, req.video_provider, req.scene_id)
        except Exception as e:
            logger.warning(f"[RenderVideo] Failed to record asset: {e}")

    return {"video_url": video_url, "scene_id": req.scene_id}


@app.post("/api/scene/compose")
async def scene_compose(req: ComposeRequest):
    logger.info(f"[Compose] scene_id={req.scene_id}")

    if req.scene_id not in MOCK_DB:
        raise HTTPException(status_code=404, detail=f"Scene {req.scene_id} not found")

    scene = MOCK_DB[req.scene_id]
    if scene["status"] != SceneStatus.VIDEO_READY:
        raise HTTPException(
            status_code=400,
            detail=f"Scene {req.scene_id} is in state {scene['status']}, expected VIDEO_READY",
        )

    from core.ffmpeg_composer import compose_scene

    download_url = compose_scene(
        scene_id=req.scene_id,
        text_lines=req.text_lines,
        voice_id=req.voice_id,
        video_url=scene["video_url"],
    )

    MOCK_DB[req.scene_id]["status"] = SceneStatus.COMPLETED
    MOCK_DB[req.scene_id]["download_url"] = download_url
    logger.info(f"[Compose] Scene {req.scene_id} → COMPLETED")

    return {"download_url": download_url, "scene_id": req.scene_id}


@app.get("/api/scene/{scene_id}/status")
async def scene_status(scene_id: str):
    if scene_id not in MOCK_DB:
        raise HTTPException(status_code=404, detail=f"Scene {scene_id} not found")

    scene = MOCK_DB[scene_id]
    return {"scene_id": scene_id, "status": scene["status"]}
