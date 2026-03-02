from sqlalchemy import or_

from app.db.session import SessionLocal
from app.models.category import Category


DEFAULT_CATEGORIES = [
    {
        "name": "공지",
        "description": "공지사항 및 운영 관련 안내",
        "slug": "notice",
        "icon": "📢",
        "order": 1,
        "is_active": True,
    },
    {
        "name": "자유",
        "description": "자유로운 주제의 이야기",
        "slug": "free",
        "icon": "💬",
        "order": 2,
        "is_active": True,
    },
    {
        "name": "유머",
        "description": "웃긴 이야기와 짤 공유",
        "slug": "humor",
        "icon": "😂",
        "order": 3,
        "is_active": True,
    },
    {
        "name": "질문",
        "description": "개발 및 IT 관련 질문과 답변",
        "slug": "qna",
        "icon": "❓",
        "order": 4,
        "is_active": True,
    },
    {
        "name": "IT 뉴스",
        "description": "IT 업계 뉴스와 트렌드",
        "slug": "dev-news",
        "icon": "💻",
        "order": 5,
        "is_active": True,
    },
    {
        "name": "팁 추천",
        "description": "유용한 팁, 서비스 추천",
        "slug": "tips",
        "icon": "🛠️",
        "order": 6,
        "is_active": True,
    },
    {
        "name": "프로젝트",
        "description": "자신의 프로젝트와 작업물 공유",
        "slug": "showcase",
        "icon": "🚀",
        "order": 7,
        "is_active": True,
    },
]


def ensure_default_categories() -> tuple[int, int]:
    db = SessionLocal()
    inserted_count = 0
    existing_count = 0
    try:
        for category_data in DEFAULT_CATEGORIES:
            existing = (
                db.query(Category)
                .filter(
                    or_(
                        Category.slug == category_data["slug"],
                        Category.name == category_data["name"],
                    )
                )
                .first()
            )
            if existing:
                existing_count += 1
                continue

            db.add(Category(**category_data))
            inserted_count += 1

        db.commit()
        return inserted_count, existing_count
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    inserted, existing = ensure_default_categories()
    print(
        f"Default category ensure completed: inserted={inserted}, already_present={existing}"
    )
