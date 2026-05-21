"""Workspace initialization script for ComicCraft-Engine.

Automates cloning and organizing third-party dependencies.
"""

import os
import shutil
import subprocess
from pathlib import Path


def run_cmd(cmd: list[str], cwd: str = None) -> None:
    """Run a shell command with logging.

    Args:
        cmd: Command and arguments as a list of strings.
        cwd: Optional working directory for the command.
    """
    print(f"[setup] Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=cwd)


def clone_if_not_exists(repo_url: str, target_dir: Path, cwd: str = None) -> bool:
    """Clone a git repository if the target directory does not already exist.

    Args:
        repo_url: URL of the git repository to clone.
        target_dir: Path to the expected clone destination directory.
        cwd: Optional working directory for the git clone command.

    Returns:
        True if the clone was performed, False if skipped.
    """
    if target_dir.exists():
        print(f"[setup] Skipped: {target_dir} already exists")
        return False
    run_cmd(["git", "clone", repo_url], cwd=cwd)
    print(f"[setup] Completed: cloned {repo_url}")
    return True


def main() -> None:
    """Initialize the workspace directory structure and clone dependencies.

    Creates:
        - core/
        - templates/
        - third_party/

    Clones:
        - ComfyUI to third_party/ComfyUI/
        - ComfyUI plugins to third_party/ComfyUI/custom_nodes/
        - MoneyPrinterTurbo app/ to third_party/money_printer/
    """
    base_dir = Path(__file__).parent

    directories = [
        base_dir / "core",
        base_dir / "templates",
        base_dir / "third_party",
    ]

    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"[setup] Directory ready: {directory}")

    # Clone ComfyUI
    third_party_dir = str(base_dir / "third_party")
    comfyui_dir = base_dir / "third_party" / "ComfyUI"
    clone_if_not_exists(
        "https://github.com/comfyanonymous/ComfyUI.git",
        comfyui_dir,
        cwd=third_party_dir,
    )

    # Clone ComfyUI plugins to custom_nodes/
    custom_nodes_dir = base_dir / "third_party" / "ComfyUI" / "custom_nodes"
    plugins = [
        ("https://github.com/cubiq/ComfyUI_IPAdapter_plus.git", "ComfyUI_IPAdapter_plus"),
        ("https://github.com/ltdrdata/ComfyUI-Impact-Pack.git", "ComfyUI-Impact-Pack"),
        ("https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git", "ComfyUI-VideoHelperSuite"),
    ]

    for plugin_url, plugin_name in plugins:
        plugin_dir = custom_nodes_dir / plugin_name
        clone_if_not_exists(
            plugin_url,
            plugin_dir,
            cwd=str(custom_nodes_dir),
        )

    # Clone MoneyPrinterTurbo and extract app/ to third_party/money_printer/
    money_printer_dest = base_dir / "third_party" / "money_printer"

    if money_printer_dest.exists():
        print(f"[setup] Skipped: {money_printer_dest} already exists")
    else:
        money_printer_temp = str(base_dir / "third_party" / "MoneyPrinterTurbo_temp")
        run_cmd(
            ["git", "clone", "https://github.com/harry0703/MoneyPrinterTurbo.git", "MoneyPrinterTurbo_temp"],
            cwd=third_party_dir,
        )

        # Extract app/ directory contents to third_party/money_printer/
        money_printer_app_src = os.path.join(money_printer_temp, "app")
        shutil.copytree(money_printer_app_src, str(money_printer_dest))
        print(f"[setup] Completed: extracted MoneyPrinterTurbo app/ to {money_printer_dest}")

        # Clean up temp clone directory
        shutil.rmtree(money_printer_temp)
        print(f"[setup] Completed: cleaned up temp directory {money_printer_temp}")


if __name__ == "__main__":
    main()
