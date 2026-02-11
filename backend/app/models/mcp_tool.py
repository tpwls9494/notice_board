from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class McpTool(Base):
    __tablename__ = "mcp_tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    input_schema = Column(Text)
    server_id = Column(Integer, ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("McpServer", back_populates="tools")
