"""ComicCraft-Engine FastAPI business API."""

from __future__ import annotations

import time
from typing import Optional

import requests
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.workflow_utils import inject_workflow_params, load_node_mapping, load_workflow_template

app = FastAPI(title="ComicCraft-Engine", version="0.1.0")


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────


class GachaRequest(BaseModel):
    scene_id: str
    prompt: str
    character_face_url: str
    seed: int = -1


class GachaResponse(BaseModel):
    prompt_id: str
    scene_id: str
    status: str


class SceneStatusResponse(BaseModel):
    scene_id: str
    status: str
    prompt_id: Optional[str] = None
    image_url: Optional[str] = None


class RenderVideoRequest(BaseModel):
    scene_id: str
    approved_image_url: str
    motion_type: str


class RenderVideoResponse(BaseModel):
    video_prompt_id: str
    scene_id: str
    status: str


class ErrorResponse(BaseModel):
    error: str
    detail: str
    scene_id: Optional[str] = None


# ──────────────────────────────────────────────
# State Model
# ──────────────────────────────────────────────


class SceneState(BaseModel):
    scene_id: str
    status: str  # CREATED | GENERATING | IMAGE_READY | IMAGE_APPROVED | RENDERING | VIDEO_READY
    prompt_id: Optional[str] = None
    video_prompt_id: Optional[str] = None
    created_at: float


# ──────────────────────────────────────────────
# In-memory State Storage (MVP)
# ──────────────────────────────────────────────

MOCK_DB: dict[str, SceneState] = {}


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

COMFYUI_BASE_URL = "http://localhost:8188"


@app.post("/api/scene/gacha")
async def scene_gacha(request: GachaRequest) -> GachaResponse:
    """Submit an image generation (gacha) request to ComfyUI."""

    # 1. Load workflow template
    try:
        workflow = load_workflow_template("templates/comic_image_gacha.json")
    except (FileNotFoundError, ValueError) as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="template_error",
                detail=str(exc),
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 2. Load node mapping and get gacha section
    try:
        node_mapping = load_node_mapping()
    except (FileNotFoundError, ValueError) as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="node_mapping_error",
                detail=str(exc),
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 3. Build params and inject into workflow
    params = {
        "prompt_text": request.prompt,
        "character_face_url": request.character_face_url,
        "seed": request.seed,
    }

    try:
        modified_workflow = inject_workflow_params(workflow, node_mapping["gacha"], params)
    except KeyError as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="injection_error",
                detail=str(exc),
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 4. Forward to ComfyUI
    try:
        comfy_response = requests.post(
            f"{COMFYUI_BASE_URL}/prompt",
            json={"prompt": modified_workflow},
            timeout=10,
        )
        comfy_response.raise_for_status()
    except requests.ConnectionError:
        return JSONResponse(
            status_code=502,
            content=ErrorResponse(
                error="comfyui_unreachable",
                detail="ComfyUI service is not reachable at " + COMFYUI_BASE_URL,
                scene_id=request.scene_id,
            ).model_dump(),
        )
    except requests.RequestException as exc:
        return JSONResponse(
            status_code=502,
            content=ErrorResponse(
                error="comfyui_error",
                detail=f"ComfyUI request failed: {exc}",
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 5. Extract prompt_id from ComfyUI response
    prompt_id = comfy_response.json().get("prompt_id", "")

    # 6. Update MOCK_DB
    MOCK_DB[request.scene_id] = SceneState(
        scene_id=request.scene_id,
        status="GENERATING",
        prompt_id=prompt_id,
        created_at=time.time(),
    )

    # 7. Return response
    return GachaResponse(
        prompt_id=prompt_id,
        scene_id=request.scene_id,
        status="GENERATING",
    )


@app.post("/api/scene/render_video")
async def render_video(request: RenderVideoRequest) -> RenderVideoResponse:
    """Submit a video rendering request. Requires scene status to be IMAGE_APPROVED."""

    # State gate: check scene exists
    if request.scene_id not in MOCK_DB:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="state_gate_error",
                detail=f"Scene '{request.scene_id}' not found in database",
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # State gate: check status is IMAGE_APPROVED
    current_status = MOCK_DB[request.scene_id].status
    if current_status != "IMAGE_APPROVED":
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error="state_gate_error",
                detail=f"Scene status is '{current_status}', but 'IMAGE_APPROVED' is required to render video",
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 1. Load video workflow template
    try:
        workflow = load_workflow_template("templates/comic_video_render.json")
    except (FileNotFoundError, ValueError) as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="template_error",
                detail=str(exc),
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 2. Load node mapping and get video_render section
    try:
        node_mapping = load_node_mapping()
    except (FileNotFoundError, ValueError) as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="node_mapping_error",
                detail=str(exc),
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 3. Build params and inject into workflow
    params = {
        "approved_image_url": request.approved_image_url,
        "motion_type": request.motion_type,
    }

    try:
        modified_workflow = inject_workflow_params(workflow, node_mapping["video_render"], params)
    except KeyError as exc:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="injection_error",
                detail=str(exc),
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 4. Forward to ComfyUI
    try:
        comfy_response = requests.post(
            f"{COMFYUI_BASE_URL}/prompt",
            json={"prompt": modified_workflow},
            timeout=10,
        )
        comfy_response.raise_for_status()
    except requests.ConnectionError:
        return JSONResponse(
            status_code=502,
            content=ErrorResponse(
                error="comfyui_unreachable",
                detail="ComfyUI service is not reachable at " + COMFYUI_BASE_URL,
                scene_id=request.scene_id,
            ).model_dump(),
        )
    except requests.RequestException as exc:
        return JSONResponse(
            status_code=502,
            content=ErrorResponse(
                error="comfyui_error",
                detail=f"ComfyUI request failed: {exc}",
                scene_id=request.scene_id,
            ).model_dump(),
        )

    # 5. Extract video_prompt_id from ComfyUI response
    video_prompt_id = comfy_response.json().get("prompt_id", "")

    # 6. Update MOCK_DB
    MOCK_DB[request.scene_id].status = "RENDERING"
    MOCK_DB[request.scene_id].video_prompt_id = video_prompt_id

    # 7. Return response
    return RenderVideoResponse(
        video_prompt_id=video_prompt_id,
        scene_id=request.scene_id,
        status="RENDERING",
    )


@app.get("/api/scene/{scene_id}/status")
async def get_scene_status(scene_id: str) -> SceneStatusResponse:
    """Query the current status of a scene, polling ComfyUI when GENERATING."""

    # 1. Look up scene in MOCK_DB
    if scene_id not in MOCK_DB:
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="scene_not_found",
                detail=f"Scene '{scene_id}' not found",
                scene_id=scene_id,
            ).model_dump(),
        )

    scene = MOCK_DB[scene_id]

    # 2. If GENERATING, poll ComfyUI /history/{prompt_id}
    if scene.status == "GENERATING" and scene.prompt_id:
        try:
            history_response = requests.get(
                f"{COMFYUI_BASE_URL}/history/{scene.prompt_id}",
                timeout=10,
            )
            history_response.raise_for_status()
            history_data = history_response.json()

            # Check if ComfyUI has completed the prompt
            if scene.prompt_id in history_data:
                prompt_history = history_data[scene.prompt_id]
                outputs = prompt_history.get("outputs", {})

                # Extract image URL from outputs
                image_url = None
                for _node_id, node_output in outputs.items():
                    images = node_output.get("images", [])
                    if images:
                        image_url = images[0].get("filename", None)
                        break

                # Transition status to IMAGE_READY
                scene.status = "IMAGE_READY"
                MOCK_DB[scene_id] = scene

                return SceneStatusResponse(
                    scene_id=scene_id,
                    status="IMAGE_READY",
                    prompt_id=scene.prompt_id,
                    image_url=image_url,
                )
        except requests.RequestException:
            # If ComfyUI is unreachable, return current status without failing
            pass

    # 3. Return current status
    return SceneStatusResponse(
        scene_id=scene_id,
        status=scene.status,
        prompt_id=scene.prompt_id,
    )
