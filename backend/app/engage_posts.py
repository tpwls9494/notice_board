import argparse
import sys
import random
from datetime import datetime

from app.db.base import SessionLocal
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.user import User

def get_latest_posts(db, limit=5):
    return db.query(Post).order_by(Post.created_at.desc()).limit(limit).all()

def add_comment(db, post_id, user_id, content):
    comment = Comment(
        post_id=post_id,
        user_id=user_id,
        content=content,
        created_at=datetime.now()
    )
    db.add(comment)
    db.commit()
    print(f"Added comment to Post {post_id}: '{content}'")

def add_like(db, post_id, user_id):
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == user_id).first()
    if not existing_like:
        like = Like(
            post_id=post_id,
            user_id=user_id,
        )
        db.add(like)
        db.commit()
        print(f"Added like to Post {post_id}")
    else:
        print(f"Post {post_id} already liked by user {user_id}")

def engage_posts(user_interaction_type="both"):
    db = SessionLocal()
    try:
        from app.core.security import get_password_hash
        import string

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

        posts = get_latest_posts(db, limit=10) # Look at more posts
        if not posts:
            print("No posts found.")
            return

        # Predefined comments for variety
        random_comments = [
            "정말 유용한 정보네요! 감사합니다.",
            "이 주제에 대해 더 알아보고 싶었는데 딱이네요.",
            "MCP가 앞으로 어떻게 발전할지 기대됩니다.",
            "좋은 글 잘 읽었습니다.",
            "저도 한번 적용해봐야겠네요!",
            "흥미로운 내용이네요. 공유 감사합니다.",
            "혹시 이 부분에 대해서 좀 더 자세히 설명해주실 수 있나요?",
            "완전 꿀팁이네요 ㅋㅋ",
            "스크랩 해갑니다~",
            "다음 글도 기대할게요!",
            "대박... 이런 게 있었군요.",
            "오늘도 하나 배워갑니다.",
        ]

        for post in posts:
            # 50% chance to interact with a post to avoid spamming everything
            if random.random() > 0.5:
                # Interaction 1: Like (from a completely new random user)
                if user_interaction_type in ["like", "both"]:
                    if random.random() > 0.3: # 70% chance to like if interacting
                        u = create_temp_user(db)
                        try:
                            add_like(db, post.id, u.id)
                        except Exception:
                            db.rollback()

                # Interaction 2: Comment (from another new random user)
                if user_interaction_type in ["comment", "both"]:
                    if random.random() > 0.4: # 60% chance to comment if interacting
                        u = create_temp_user(db)
                        content = random.choice(random_comments)
                        add_comment(db, post.id, u.id, content)
            else:
                print(f"Skipping interaction for Post {post.id} (Probability check)")

    except Exception as e:
        print(f"Error engaging with posts: {e}", file=sys.stderr)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Engage with recent posts (Like/Comment)")
    parser.add_argument("--type", choices=["like", "comment", "both"], default="both", help="Type of interaction")
    
    args = parser.parse_args()
    engage_posts(args.type)
