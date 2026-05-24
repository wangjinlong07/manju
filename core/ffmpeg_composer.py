"""FFmpeg Composer: MoneyPrinterTurbo 音视频合成桥接层"""

import sys
from pathlib import Path

from loguru import logger

from core.model_router import CacheKeyEngine, local_cache

# ──────────────────────────────────────────────
# MoneyPrinterTurbo 服务导入 (graceful fallback)
# ──────────────────────────────────────────────

_mpt_path = str(Path(__file__).resolve().parent.parent / "third_party" / "money_printer")
if _mpt_path not in sys.path:
    sys.path.insert(0, _mpt_path)

_mpt_voice = None
_mpt_video = None

try:
    from services import voice as _mpt_voice  # noqa: F811
    logger.info("[FFmpegComposer] MoneyPrinterTurbo voice service loaded")
except ImportError:
    logger.warning("[FFmpegComposer] MoneyPrinterTurbo voice service unavailable, will use edge-tts fallback")

try:
    from services import video as _mpt_video  # noqa: F811
    logger.info("[FFmpegComposer] MoneyPrinterTurbo video service loaded")
except ImportError:
    logger.warning("[FFmpegComposer] MoneyPrinterTurbo video service unavailable")


# ──────────────────────────────────────────────
# edge-tts fallback
# ──────────────────────────────────────────────

async def _edge_tts_generate(text: str, voice_id: str, output_path: str) -> str:
    """使用 edge-tts 生成语音文件，返回输出路径。"""
    import edge_tts

    communicate = edge_tts.Communicate(text, voice_id)
    await communicate.save(output_path)
    logger.info(f"[edge-tts] TTS audio saved to: {output_path}")
    return output_path


# ──────────────────────────────────────────────
# 核心合成函数
# ──────────────────────────────────────────────

def compose_scene(scene_id: str, text_lines: list[str], voice_id: str, video_url: str) -> str:
    """
    音画合成：TTS 生成语音 + MoneyPrinterTurbo 视频合成。

    Args:
        scene_id: 场景唯一 ID
        text_lines: 台词文本行列表
        voice_id: TTS 语音角色 ID (如 zh-CN-YunxiNeural)
        video_url: 已渲染的视频 URL

    Returns:
        最终合成 MP4 的下载 URL
    """
    # 1. 生成 TTS 缓存键
    cache_key = CacheKeyEngine.generate_key("tts", voice_id, *text_lines)

    # 2. 检查 DiskCache 是否已有 TTS 音频路径
    cached_audio_path = local_cache.get(cache_key)
    if cached_audio_path is not None:
        logger.success(f"💰 [Cache Hit] TTS 缓存命中 | Key: {cache_key[:50]}...")
        audio_path = cached_audio_path
    else:
        logger.info(f"[Cache Miss] 执行 TTS 生成 | voice_id: {voice_id}")

        full_text = "\n".join(text_lines)

        # 优先使用 MoneyPrinterTurbo voice service，否则 edge-tts fallback
        if _mpt_voice is not None:
            try:
                audio_path = _mpt_voice.tts(full_text, voice_id)
                logger.info(f"[MoneyPrinterTurbo] TTS completed: {audio_path}")
            except Exception as e:
                logger.warning(f"[MoneyPrinterTurbo] TTS failed ({e}), falling back to edge-tts")
                import asyncio
                output_path = f".cache/tts_{scene_id}.mp3"
                audio_path = asyncio.run(_edge_tts_generate(full_text, voice_id, output_path))
        else:
            import asyncio
            output_path = f".cache/tts_{scene_id}.mp3"
            audio_path = asyncio.run(_edge_tts_generate(full_text, voice_id, output_path))

        # 缓存 TTS 结果
        local_cache.set(cache_key, audio_path)
        logger.info(f"[Cache Write] TTS 结果已缓存 | Key: {cache_key[:50]}...")

    # 3. 视频 + 音频合成
    if _mpt_video is not None:
        try:
            logger.info(f"[MoneyPrinterTurbo] Compositing video + audio for scene: {scene_id}")
            _mpt_video.composite(video_url=video_url, audio_path=audio_path, scene_id=scene_id)
        except Exception as e:
            logger.error(f"[MoneyPrinterTurbo] Video composite failed: {e}")
            raise RuntimeError(
                f"Video composition failed for scene {scene_id}: {e}. "
                "Ensure MoneyPrinterTurbo is properly installed in third_party/money_printer/"
            ) from e
    else:
        logger.warning(
            "[FFmpegComposer] MoneyPrinterTurbo video service unavailable, "
            "returning mock output URL"
        )

    # 4. 返回最终下载 URL (当前为 mock，实际取决于 MoneyPrinterTurbo 输出)
    download_url = f"https://output.comiccraft.com/{scene_id}_final.mp4"
    logger.info(f"[FFmpegComposer] Compose complete | scene: {scene_id} | URL: {download_url}")
    return download_url
