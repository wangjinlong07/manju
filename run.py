"""
Unified Launcher for ComicCraft-Engine.
Starts ComfyUI as a subprocess and then launches the FastAPI application via uvicorn.
"""

import signal
import subprocess
import sys
import time
from typing import Optional

import uvicorn
from loguru import logger

from core.app import app

# Global reference to the ComfyUI subprocess
_comfyui_process: Optional[subprocess.Popen] = None


def _terminate_comfyui() -> None:
    """Terminate the ComfyUI subprocess gracefully."""
    global _comfyui_process
    if _comfyui_process is not None and _comfyui_process.poll() is None:
        logger.info("Terminating ComfyUI subprocess (pid={})...", _comfyui_process.pid)
        _comfyui_process.terminate()
        try:
            _comfyui_process.wait(timeout=10)
            logger.info("ComfyUI subprocess terminated gracefully.")
        except subprocess.TimeoutExpired:
            logger.warning("ComfyUI did not exit in time, killing...")
            _comfyui_process.kill()
            _comfyui_process.wait()
            logger.info("ComfyUI subprocess killed.")


def _signal_handler(signum: int, frame) -> None:
    """Handle SIGTERM and SIGINT for graceful shutdown."""
    sig_name = signal.Signals(signum).name
    logger.info("Received signal {}, shutting down...", sig_name)
    _terminate_comfyui()
    sys.exit(0)


def main() -> None:
    """
    1. 以 --listen 127.0.0.1 --port 8188 --headless 启动 ComfyUI 子进程
    2. 等待 5 秒
    3. 通过 uvicorn.run() 启动 FastAPI (port 8000)
    4. 注册信号处理器，优雅终止子进程
    """
    global _comfyui_process

    # Register signal handlers for graceful termination
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    # Launch ComfyUI as a subprocess in headless mode
    comfyui_cmd = [
        sys.executable,
        "third_party/ComfyUI/main.py",
        "--listen", "127.0.0.1",
        "--port", "8188",
        "--headless",
    ]
    logger.info("Starting ComfyUI subprocess: {}", " ".join(comfyui_cmd))
    _comfyui_process = subprocess.Popen(comfyui_cmd)

    # Wait 5 seconds for ComfyUI to initialize
    logger.info("Waiting 5 seconds for ComfyUI to initialize...")
    time.sleep(5)

    # Check if ComfyUI exited unexpectedly during startup
    if _comfyui_process.poll() is not None:
        exit_code = _comfyui_process.returncode
        logger.error(
            "ComfyUI subprocess exited unexpectedly during startup with code {}. "
            "Aborting launch.",
            exit_code,
        )
        sys.exit(1)

    logger.info("Starting FastAPI application on port 8000...")
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        # Check if ComfyUI exited unexpectedly while FastAPI was running
        if _comfyui_process.poll() is not None:
            exit_code = _comfyui_process.returncode
            logger.error(
                "ComfyUI subprocess exited unexpectedly with code {}. "
                "Cleaning up resources.",
                exit_code,
            )
        else:
            _terminate_comfyui()


if __name__ == "__main__":
    main()
