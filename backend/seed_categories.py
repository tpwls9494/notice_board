"""
카테고리 시드 데이터 생성 스크립트

실행 방법:
python -m seed_categories
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.db.session import SessionLocal
from app.models.category import Category
# Import all models to ensure SQLAlchemy can resolve relationships
from app.models.user import User  # noqa: F401
from app.models.post import Post  # noqa: F401
from app.models.comment import Comment  # noqa: F401
from app.models.like import Like  # noqa: F401
from app.models.file import File  # noqa: F401
from app.models.bookmark import Bookmark  # noqa: F401
from app.models.notification import Notification  # noqa: F401


def seed_categories():
    """기본 카테고리 데이터를 DB에 삽입"""
    db = SessionLocal()

    try:
        # 기존 카테고리가 있는지 확인
        existing_count = db.query(Category).count()
        if existing_count > 0:
            print(f"이미 {existing_count}개의 카테고리가 존재합니다.")
            response = input("기존 카테고리를 모두 삭제하고 새로 생성하시겠습니까? (y/N): ")
            if response.lower() != 'y':
                print("작업이 취소되었습니다.")
                return

            # 기존 카테고리 삭제
            db.query(Category).delete()
            db.commit()
            print("기존 카테고리를 삭제했습니다.")

        # 기본 카테고리 데이터
        categories = [
            {
                "name": "질문/답변",
                "description": "MCP 서버 개발 및 사용에 대한 질문과 답변",
                "slug": "qna",
                "icon": "❓",
                "order": 1,
                "is_active": True
            },
            {
                "name": "사용 후기",
                "description": "MCP 서버 사용 경험과 리뷰 공유",
                "slug": "review",
                "icon": "⭐",
                "order": 2,
                "is_active": True
            },
            {
                "name": "추천/요청",
                "description": "MCP 서버 추천 및 기능 요청",
                "slug": "request",
                "icon": "💡",
                "order": 3,
                "is_active": True
            },
            {
                "name": "팁/가이드",
                "description": "유용한 팁과 가이드 공유",
                "slug": "guide",
                "icon": "📚",
                "order": 4,
                "is_active": True
            },
            {
                "name": "자유",
                "description": "자유로운 주제의 게시글",
                "slug": "free",
                "icon": "💬",
                "order": 5,
                "is_active": True
            },
        ]

        # 카테고리 생성
        for cat_data in categories:
            category = Category(**cat_data)
            db.add(category)

        db.commit()
        print(f"✅ {len(categories)}개의 카테고리가 성공적으로 생성되었습니다:")

        # 생성된 카테고리 출력
        for cat in db.query(Category).order_by(Category.order).all():
            print(f"  {cat.icon} {cat.name} (slug: {cat.slug})")

    except Exception as e:
        db.rollback()
        print(f"❌ 에러 발생: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_categories()
