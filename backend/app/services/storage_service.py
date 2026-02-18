import structlog
from typing import Optional
import base64
from datetime import datetime
import uuid
import os
from pathlib import Path

from ..core.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


class StorageService:
    def __init__(self):
        self.storage_path = Path(settings.LOCAL_STORAGE_PATH)

        if not self.storage_path.exists():
            logger.error("Storage path does not exist", path=str(self.storage_path))
            raise FileNotFoundError(f"Storage path not found: {self.storage_path}")

        self.images_path = self.storage_path / "Images"
        self.transcripts_path = self.storage_path / "Transcripts"

        # Auto-create — never crash if folders are missing
        self.images_path.mkdir(parents=True, exist_ok=True)
        self.transcripts_path.mkdir(parents=True, exist_ok=True)

        logger.info("Storage initialized",
                    path=str(self.storage_path),
                    images=str(self.images_path),
                    transcripts=str(self.transcripts_path))

    async def upload_image(self, session_id: str, image_data: str, page_number: int) -> Optional[str]:
        try:
            if "," in image_data:
                image_data = image_data.split(",")[1]

            image_bytes = base64.b64decode(image_data)

            session_dir = self.images_path / session_id
            session_dir.mkdir(parents=True, exist_ok=True)

            timestamp = int(datetime.utcnow().timestamp())
            filename = f"page_{page_number}_{timestamp}.png"
            filepath = session_dir / filename

            with open(filepath, "wb") as f:
                f.write(image_bytes)

            url = f"file://{filepath.absolute()}"
            logger.info("Image saved", session_id=session_id, page=page_number, path=str(filepath))
            return url
        except Exception as e:
            logger.error("Image save failed", error=str(e), session_id=session_id)
            return None

    async def delete_file(self, file_url: str):
        try:
            if file_url.startswith("file://"):
                filepath = Path(file_url.replace("file://", ""))
                if filepath.exists():
                    filepath.unlink()
                    logger.info("File deleted", path=str(filepath))
        except Exception as e:
            logger.error("File deletion failed", error=str(e), url=file_url)


storage_service = StorageService()
