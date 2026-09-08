import pytest
from test_blog_activity import blog_client  # noqa: F401
from app.core.config import settings
from app.models.user import User


def setup_owners(factory,monkeypatch):
    monkeypatch.setattr(settings,'BLOG_OWNER_USER_ID',1)
    with factory() as db:
        for uid in (1,2):db.get(User,uid).is_admin=True
        db.commit()


@pytest.mark.parametrize('method,path,body',[
    ('GET','/api/v1/blog/manage/posts',None),
    ('GET','/api/v1/blog/drafts',None),
    ('POST','/api/v1/blog/',{'title':'Unauthorized new post','content':'Body'}),
    ('PUT','/api/v1/blog/1',{'title':'Unauthorized edit'}),
    ('DELETE','/api/v1/blog/1',None),
    ('POST','/api/v1/blog/categories',{'name':'Unauthorized category'}),
    ('DELETE','/api/v1/blog/categories/1',None),
    ('DELETE','/api/v1/blog/profile/avatar',None),
])
def test_other_admin_cannot_author_blog(blog_client,monkeypatch,method,path,body):
    client,state,factory=blog_client;setup_owners(factory,monkeypatch);state['user_id']=2
    assert client.request(method,path,json=body).status_code==403
    assert client.get('/api/v1/signals/review-queue').status_code==200


@pytest.mark.parametrize('path',['/api/v1/blog/upload-image','/api/v1/blog/profile/avatar'])
def test_other_admin_cannot_upload(blog_client,monkeypatch,path):
    client,state,factory=blog_client;setup_owners(factory,monkeypatch);state['user_id']=2
    assert client.post(path,files={'file':('sample.png',b'not-an-image','image/png')}).status_code==403


def test_owner_capability_and_full_post_flow(blog_client,monkeypatch):
    client,state,factory=blog_client;setup_owners(factory,monkeypatch)
    assert client.get('/api/v1/auth/me').json()['can_write_blog'] is True
    result=client.post('/api/v1/blog/',json={'title':'Owner blog post','content':'Owner body','is_published':False})
    assert result.status_code==201
    post=result.json()
    assert client.get('/api/v1/blog/'+post['slug']).status_code==200
    assert client.put('/api/v1/blog/'+str(post['id']),json={'title':'Owner edited'}).status_code==200
    assert client.delete('/api/v1/blog/'+str(post['id'])).status_code==204
    state['user_id']=2
    me=client.get('/api/v1/auth/me').json()
    assert me['is_admin'] is True and me['can_write_blog'] is False
    assert client.get('/api/v1/blog/post-3').status_code==404
    assert client.get('/api/v1/blog/post-1').status_code==200


@pytest.mark.parametrize('condition',['unset_owner','revoked_admin','unverified'])
def test_owner_permission_fails_closed(blog_client,monkeypatch,condition):
    client,_,factory=blog_client;setup_owners(factory,monkeypatch)
    if condition=='unset_owner':monkeypatch.setattr(settings,'BLOG_OWNER_USER_ID',None)
    else:
        with factory() as db:
            setattr(db.get(User,1),'is_admin' if condition=='revoked_admin' else 'email_verified',False)
            db.commit()
    assert client.get('/api/v1/auth/me').json()['can_write_blog'] is False
    assert client.post('/api/v1/blog/',json={'title':'No permission','content':'Body'}).status_code==403
