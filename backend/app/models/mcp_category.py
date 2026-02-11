from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class McpCategory(Base):
    __tablename__ = "mcp_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(200))
    icon = Column(String(50))
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    servers = relationship("McpServer", back_populates="category")
