from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image, PngImagePlugin
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.social import image_upload_limiter, post_write_limiter
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.services import community_images


def picture_bytes(format='PNG'):
    buffer = BytesIO()
    with Image.new('RGB', (64, 32), color=(37, 99, 235)) as picture:
        if format == 'PNG':
            metadata = PngImagePlugin.PngInfo()
            metadata.add_text('Comment', 'Private metadata that should not be published')
            picture.save(buffer, format=format, pnginfo=metadata)
        else:
            picture.save(buffer, format=format)
    return buffer.getvalue()


@pytest.fixture
def image_context(client, tmp_path, monkeypatch):
    engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    image_upload_limiter.clear()
    post_write_limiter.clear()
    monkeypatch.setattr(community_images, 'IMAGE_DIR', tmp_path / 'community-images')
    with Session(engine) as db:
        db.add_all([User(id=i, email=f'image{i}@example.test', username=f'image-user-{i}', hashed_password='unused', email_verified=i == 1) for i in [1, 2]])
        db.commit()
        def override_db():
            yield db
        previous = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = override_db
        try:
            yield SimpleNamespace(client=client, directory=community_images.IMAGE_DIR,
                                  verified={'Authorization': 'Bearer ' + create_access_token({'sub': '1'})},
                                  unverified={'Authorization': 'Bearer ' + create_access_token({'sub': '2'})})
        finally:
            if previous is None:
                app.dependency_overrides.pop(get_db, None)
            else:
                app.dependency_overrides[get_db] = previous
    engine.dispose()


@pytest.mark.parametrize('format,mime', [('PNG','image/png'), ('JPEG','image/jpeg'), ('WEBP','image/webp')])
def test_upload_reencodes_and_serves_public_image(image_context, format, mime):
    ctx = image_context
    response = ctx.client.post('/api/v1/community/images', headers=ctx.verified,
                               files={'file': ('../../unsafe-name.exe', picture_bytes(format), mime)})
    assert response.status_code == 201
    data = response.json()
    assert data['width'] == 64 and data['height'] == 32
    assert data['url'].startswith('/api/v1/community/images/')
    filename = data['url'].rsplit('/', 1)[1]
    assert community_images.FILENAME.fullmatch(filename)
    served = ctx.client.get(data['url'])
    assert served.status_code == 200
    assert served.headers['content-type'] == 'image/webp'
    assert served.headers['x-content-type-options'] == 'nosniff'
    assert len(served.content) == data['size']
    with Image.open(BytesIO(served.content)) as image:
        assert image.format == 'WEBP'
        assert image.size == (64, 32)
        assert not image.getexif()
        assert 'Comment' not in image.info


def test_upload_requires_verified_account(image_context):
    ctx = image_context
    files = {'file': ('image.png', picture_bytes(), 'image/png')}
    assert ctx.client.post('/api/v1/community/images', files=files).status_code in {401, 403}
    assert ctx.client.post('/api/v1/community/images', headers=ctx.unverified, files=files).status_code == 403
    assert not ctx.directory.exists()


@pytest.mark.parametrize('content,mime,status', [
    (b'', 'image/png', 400),
    (b'not an image', 'image/png', 400),
    (b'<svg><script>alert(1)</script></svg>', 'image/svg+xml', 415),
    (b'x' * (5 * 1024 * 1024 + 1), 'image/png', 413),
], ids=['empty', 'invalid-image', 'svg', 'too-large'])
def test_invalid_or_oversized_upload_is_rejected(image_context, content, mime, status):
    ctx = image_context
    result = ctx.client.post('/api/v1/community/images', headers=ctx.verified, files={'file': ('image.png', content, mime)})
    assert result.status_code == status
    assert not ctx.directory.exists()


def test_pixel_limit_and_missing_paths(image_context, monkeypatch):
    ctx = image_context
    monkeypatch.setattr(community_images, 'MAX_IMAGE_PIXELS', 100)
    result = ctx.client.post('/api/v1/community/images', headers=ctx.verified, files={'file': ('image.png', picture_bytes(), 'image/png')})
    assert result.status_code == 413
    assert ctx.client.get('/api/v1/community/images/not-an-image.txt').status_code == 404
    assert ctx.client.get('/api/v1/community/images/' + '0' * 32 + '.webp').status_code == 404
    assert not ctx.directory.exists()


def test_image_orientation_and_replacement_get_unique_urls(image_context):
    ctx = image_context
    source = BytesIO()
    with Image.new('RGB', (20, 10), color='white') as picture:
        exif = Image.Exif()
        exif[274] = 6
        picture.save(source, format='JPEG', exif=exif)
    urls = []
    for _ in range(2):
        response = ctx.client.post('/api/v1/community/images', headers=ctx.verified, files={'file': ('oriented.jpg', source.getvalue(), 'image/jpeg')})
        assert response.status_code == 201
        assert response.json()['width'] == 10 and response.json()['height'] == 20
        urls.append(response.json()['url'])
    assert urls[0] != urls[1]


def test_upload_rate_limit(image_context, monkeypatch):
    ctx = image_context
    monkeypatch.setattr(image_upload_limiter, 'allow', lambda _key: False)
    response = ctx.client.post('/api/v1/community/images', headers=ctx.verified, files={'file': ('image.png', picture_bytes(), 'image/png')})
    assert response.status_code == 429
    assert not ctx.directory.exists()


def test_uploaded_image_can_be_attached_and_removed_from_a_post(image_context):
    ctx = image_context
    uploaded = ctx.client.post('/api/v1/community/images', headers=ctx.verified, files={'file': ('image.png', picture_bytes(), 'image/png')})
    assert uploaded.status_code == 201
    image_url = 'http://testserver' + uploaded.json()['url']
    created = ctx.client.post('/api/v1/community/posts', headers=ctx.verified, json={
        'title': 'Image attachment check', 'content': 'A screenshot of the result.', 'topic': 'experience', 'image_url': image_url,
    })
    assert created.status_code == 201
    post_id = created.json()['id']
    assert ctx.client.get(f'/api/v1/community/posts/{post_id}').json()['image_url'] == image_url
    removed = ctx.client.patch(f'/api/v1/community/posts/{post_id}', headers=ctx.verified, json={'image_url': None})
    assert removed.status_code == 200 and removed.json()['image_url'] is None
