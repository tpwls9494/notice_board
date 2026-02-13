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
            # Generate realistic English usernames for commenters
            first_parts = [
                "codingking", "devmaster", "techie", "digitalnomad", "cloudguru",
                "john_kim", "sarah_lee", "mike_park", "jenny_choi", "alex_jung",
                "developer", "programmer", "coder", "hacker", "engineer",
                "david_choi", "emily_park", "chris_lee", "jessica_kim", "ryan_jung",
                "techbro", "deventhusiast", "codewizard", "bytemaster", "fullstacker",
                "james_seo", "linda_kang", "kevin_oh", "amy_shin", "eric_han",
                "visitor", "guest", "newbie", "lurker", "reader",
                "susan_yoon", "brian_song", "michelle_jang", "daniel_ryu", "sophia_bae"
            ]

            second_parts = [
                "99", "2024", "2025", "pro", "master", "dev", "lab", "hub", "zone",
                str(random.randint(100, 999)), str(random.randint(10, 99)), "x", "gg"
            ]

            # 65% chance for combined username, 35% for standalone
            if random.random() > 0.35:
                u_name = f"{random.choice(first_parts)}{random.choice(second_parts)}"
            else:
                u_name = random.choice(first_parts)

            # If username already exists, add a number
            existing = db.query(User).filter(User.username == u_name).first()
            if existing:
                u_name = f"{u_name}_{random.randint(1, 999)}"

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

        # Predefined Korean comments for variety
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
            "유익한 정보 공유해주셔서 감사합니다!",
            "이런 걸 찾고 있었어요.",
            "나중에 참고하려고 북마크했습니다.",
            "도움이 많이 되었습니다.",
            "설명이 정말 친절하네요.",
            "튜토리얼 감사합니다!",
            "다음 글도 기대하겠습니다.",
            "이거 완전 게임체인저네요!",
            "좋은 작업 계속 부탁드려요.",
            "최신 버전에서도 작동하나요?",
            "저도 사용해봤는데 강력 추천합니다.",
            "자세한 가이드 감사드립니다 👍",
            "예제 코드도 있을까요?",
            "타이밍이 딱 맞네요, 필요했던 내용이에요!",
            "이해하기 쉽게 설명해주셨네요.",
            "실전에서 바로 써먹을 수 있겠어요.",
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
