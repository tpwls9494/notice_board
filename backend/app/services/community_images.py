"""Image storage for the main site's community, independent of blog uploads."""
from io import BytesIO
import logging
import os
from pathlib import Path
import re
import uuid
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError


logger = logging.getLogger(__name__)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
IMAGE_DIR = Path(os.getenv('JION_COMMUNITY_IMAGE_DIR', str(Path(__file__).resolve().parents[2] / 'uploads' / 'community'))).resolve()
FILENAME = re.compile(r'[0-9a-f]{32}\.webp')


def save_community_image(content: bytes) -> dict:
    if not content:
        raise HTTPException(status_code=400, detail='비어 있는 이미지입니다.')
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='이미지는 5MB 이하로 첨부해 주세요.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as original:
                if original.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise HTTPException(status_code=415, detail='PNG, JPG, WebP 이미지만 첨부할 수 있습니다.')
                if original.width * original.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=413, detail='이미지는 1,600만 화소 이하로 첨부해 주세요.')
                original.verify()
            with Image.open(BytesIO(content)) as original:
                original.seek(0)
                oriented = ImageOps.exif_transpose(original)
                mode = 'RGBA' if 'A' in oriented.getbands() or 'transparency' in oriented.info else 'RGB'
                with oriented.convert(mode) as picture:
                    picture.thumbnail((2560, 2560), Image.Resampling.LANCZOS)
                    encoded = BytesIO()
                    picture.save(encoded, format='WEBP', quality=88, method=4)
                    width, height = picture.size
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=400, detail='이미지 파일을 읽을 수 없습니다. 다른 이미지를 선택해 주세요.') from None

    filename = uuid.uuid4().hex + '.webp'
    target = IMAGE_DIR / filename
    try:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as output:
            output.write(encoded.getvalue())
    except OSError:
        logger.exception('Community image could not be stored')
        raise HTTPException(status_code=500, detail='이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.') from None
    return {'url': '/api/v1/community/images/' + filename, 'width': width, 'height': height, 'size': encoded.tell()}


def community_image_path(filename: str) -> Path:
    if not FILENAME.fullmatch(filename):
        raise HTTPException(status_code=404, detail='이미지를 찾을 수 없습니다.')
    target = IMAGE_DIR / filename
    if not target.is_file():
        raise HTTPException(status_code=404, detail='이미지를 찾을 수 없습니다.')
    return target
