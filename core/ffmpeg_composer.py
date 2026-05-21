"""
FFmpeg Composer - 音视频合成层

通过 MoneyPrinterTurbo 服务提供音视频合成能力。
"""

import sys
from pathlib import Path

# MoneyPrinterTurbo 的服务代码位于 third_party/money_printer/ 目录中，
# 该目录并非一个已安装的 Python 包，因此需要通过 sys.path 注入使其模块可被 import。
# 插入到 sys.path[0] 确保该路径的优先级最高，避免与其他同名模块冲突。
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_MONEY_PRINTER_PATH = str(_PROJECT_ROOT / "third_party" / "money_printer")
sys.path.insert(0, _MONEY_PRINTER_PATH)

try:
    from services import voice, video
except ImportError:
    voice = None
    video = None


def generate_voice_for_scene(text: str, voice_name: str, output_path: str) -> str:
    """调用 MoneyPrinterTurbo voice.tts() 生成语音

    Args:
        text: 需要转换为语音的文本内容
        voice_name: 语音名称（对应 TTS 引擎支持的 voice 标识）
        output_path: 生成音频文件的输出路径

    Returns:
        生成的音频文件路径

    Raises:
        RuntimeError: MoneyPrinterTurbo services not available
    """
    if voice is None:
        raise RuntimeError(
            "MoneyPrinterTurbo services not available. Run setup_workspace.py first."
        )
    voice.tts(text=text, voice_name=voice_name, voice_file=output_path)
    return output_path


def stitch_comic_episode(scene_materials: list[str], output_mp4_path: str) -> str:
    """调用 MoneyPrinterTurbo video 服务拼接漫画片段

    Args:
        scene_materials: 需要拼接的片段路径列表
        output_mp4_path: 输出 MP4 文件路径

    Returns:
        输出的 MP4 文件路径

    Raises:
        RuntimeError: MoneyPrinterTurbo services not available
    """
    if video is None:
        raise RuntimeError(
            "MoneyPrinterTurbo services not available. Run setup_workspace.py first."
        )
    video.stitch(clips=scene_materials, output_path=output_mp4_path)
    return output_mp4_path
