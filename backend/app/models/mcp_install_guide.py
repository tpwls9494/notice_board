from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class McpInstallGuide(Base):
    __tablename__ = "mcp_install_guides"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String(50), nullable=False)
    config_json = Column(Text, nullable=False)
    instructions = Column(Text)
    server_id = Column(Integer, ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    server = relationship("McpServer", back_populates="install_guides")
