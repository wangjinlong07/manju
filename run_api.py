"""ComicCraft-Engine V2.0 - API Launcher."""

import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    uvicorn.run("core.app:app", host="0.0.0.0", port=8000, reload=True)
