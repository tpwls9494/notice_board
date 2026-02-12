import random
import string
from app.db.base import SessionLocal
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.user import User
from app.core.security import get_password_hash
from datetime import datetime

def create_temp_user(db):
    u_name = f"visitor_{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"
    new_user = User(
        email=f"{u_name}@example.com",
        username=u_name,
        hashed_password=get_password_hash("password123"),
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

random_comments = [
    "정말 유용한 정보네요! 감사합니다.", "이 주제에 대해 더 알아보고 싶었는데 딱이네요.",
    "MCP가 앞으로 어떻게 발전할지 기대됩니다.", "좋은 글 잘 읽었습니다.",
    "저도 한번 적용해봐야겠네요!", "흥미로운 내용이네요. 공유 감사합니다.",
    "혹시 이 부분에 대해서 좀 더 자세히 설명해주실 수 있나요?", "완전 꿀팁이네요 ㅋㅋ",
    "스크랩 해갑니다~", "다음 글도 기대할게요!", "대박... 이런 게 있었군요.",
    "오늘도 하나 배워갑니다.", "추천 누르고 갑니다!", "와... 이런 생각은 못 해봤네요.",
    "진짜 도움 많이 됐습니다.", "혹시 라이브러리 버전 정보 알 수 있을까요?",
    "설명이 깔끔해서 이해하기 쉽네요.", "나중에 보려고 저장해둡니다!",
    "요즘 이게 대세인가 보네요.", "잘 보고 갑니다~"
]

def mega_engage():
    db = SessionLocal()
    try:
        # Get the latest 20 posts we just created
        posts = db.query(Post).order_by(Post.id.desc()).limit(20).all()
        print(f"Engaging with {len(posts)} posts...")
        
        for post in posts:
            print(f"Adding 20 likes and 20 comments to Post {post.id} ('{post.title}')...")
            for i in range(20):
                # Each like/comment from a unique new user
                u_like = create_temp_user(db)
                like = Like(post_id=post.id, user_id=u_like.id)
                db.add(like)
                
                u_comment = create_temp_user(db)
                comment = Comment(
                    post_id=post.id,
                    user_id=u_comment.id,
                    content=random.choice(random_comments),
                    created_at=datetime.now()
                )
                db.add(comment)
                
                if i % 10 == 0: 
                    db.commit() # Periodic commit to avoid massive transaction
            db.commit()
        print("Success!")
    finally:
        db.close()

if __name__ == "__main__":
    mega_engage()
