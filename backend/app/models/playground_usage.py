from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class PlaygroundUsage(Base):
    __tablename__ = "playground_usages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    server_id = Column(Integer, ForeignKey("mcp_servers.id", ondelete="SET NULL"), nullable=True)
    tool_name = Column(String(100), nullable=False)
    execution_time_ms = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    server = relationship("McpServer")
