from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class McpServer(Base):
    __tablename__ = "mcp_servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    short_description = Column(String(300))

    # GitHub
    github_url = Column(String(500))
    github_stars = Column(Integer, default=0)
    github_readme = Column(Text)
    github_last_synced = Column(DateTime(timezone=True))

    # Install
    install_command = Column(Text)
    package_name = Column(String(200))

    # Curation
    is_featured = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    demo_video_url = Column(String(500))
    showcase_data = Column(Text)  # JSON: highlights, use_cases, scenarios

    # Cached stats
    avg_rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)

    # Relations
    category_id = Column(Integer, ForeignKey("mcp_categories.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("McpCategory", back_populates="servers")
    creator = relationship("User")
    tools = relationship("McpTool", back_populates="server", cascade="all, delete-orphan")
    reviews = relationship("McpReview", back_populates="server", cascade="all, delete-orphan")
    install_guides = relationship("McpInstallGuide", back_populates="server", cascade="all, delete-orphan")
