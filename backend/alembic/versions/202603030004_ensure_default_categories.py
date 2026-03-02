"""Ensure default community categories exist

Revision ID: 202603030004
Revises: 202603030003
Create Date: 2026-03-03 23:50:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603030004"
down_revision: Union[str, None] = "202603030003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _insert_default_category(
    name: str,
    description: str,
    slug: str,
    icon: str,
    order: int,
) -> None:
    op.execute(
        f"""
        INSERT INTO categories (name, description, slug, icon, "order", is_active)
        SELECT
            '{name}',
            '{description}',
            '{slug}',
            '{icon}',
            {order},
            TRUE
        WHERE NOT EXISTS (
            SELECT 1
            FROM categories
            WHERE slug = '{slug}' OR name = '{name}'
        )
        """
    )


def upgrade() -> None:
    _insert_default_category("공지", "공지사항 및 운영 관련 안내", "notice", "📢", 1)
    _insert_default_category("자유", "자유로운 주제의 이야기", "free", "💬", 2)
    _insert_default_category("유머", "웃긴 이야기와 짤 공유", "humor", "😂", 3)
    _insert_default_category("질문", "개발 및 IT 관련 질문과 답변", "qna", "❓", 4)
    _insert_default_category("IT 뉴스", "IT 업계 뉴스와 트렌드", "dev-news", "💻", 5)
    _insert_default_category("팁 추천", "유용한 팁, 서비스 추천", "tips", "🛠️", 6)
    _insert_default_category("프로젝트", "자신의 프로젝트와 작업물 공유", "showcase", "🚀", 7)

    # Keep recruit category name consistent and place it after defaults for fresh DB cases.
    op.execute(
        """
        UPDATE categories
        SET
            name = '팀 모집',
            description = COALESCE(description, '프로젝트/스터디 팀 모집 게시판'),
            is_active = TRUE,
            "order" = CASE WHEN "order" <= 7 THEN 8 ELSE "order" END
        WHERE slug = 'team-recruit'
        """
    )


def downgrade() -> None:
    # Keep existing categories to avoid deleting production data on downgrade.
    pass
