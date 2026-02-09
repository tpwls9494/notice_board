from datetime import datetime
from pydantic import BaseModel


class FileResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str | None
    post_id: int
    uploaded_by: int
    created_at: datetime

    class Config:
        from_attributes = True
