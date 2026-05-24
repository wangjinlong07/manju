"""ComicCraft-Engine V2.0 - Workspace Setup Script."""

import os
import shutil
import subprocess
from pathlib import Path

from loguru import logger


def setup_workspace() -> None:
    """Create required directories and clone third-party dependencies."""
    base = Path(__file__).parent

    # Create core directories
    for dirname in ("core", "third_party", ".cache"):
        dirpath = base / dirname
        dirpath.mkdir(parents=True, exist_ok=True)
        logger.info(f"Directory ready: {dirpath}")

    # Clone MoneyPrinterTurbo
    money_printer_dir = base / "third_party" / "money_printer"
    if money_printer_dir.exists():
        logger.info("third_party/money_printer/ already exists, skipping clone.")
        return

    temp_dir = base / "_tmp_moneyprinter_clone"
    try:
        logger.info("Cloning MoneyPrinterTurbo...")
        subprocess.run(
            ["git", "clone", "https://github.com/harry0703/MoneyPrinterTurbo.git", str(temp_dir)],
            check=True,
        )

        # Extract app/ contents to third_party/money_printer/
        source_app = temp_dir / "app"
        if source_app.exists():
            shutil.copytree(source_app, money_printer_dir)
            logger.info(f"Extracted app/ to {money_printer_dir}")
        else:
            money_printer_dir.mkdir(parents=True, exist_ok=True)
            logger.info("No app/ directory found in clone, created empty money_printer/")
    finally:
        # Clean up temp clone
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
            logger.info("Cleaned up temporary clone directory.")


if __name__ == "__main__":
    setup_workspace()
