from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.mcp_install_guide import McpInstallGuide


def get_guides_by_server(db: Session, server_id: int) -> List[McpInstallGuide]:
    return db.query(McpInstallGuide).filter(McpInstallGuide.server_id == server_id).all()


def get_install_guide(db: Session, guide_id: int) -> Optional[McpInstallGuide]:
    return db.query(McpInstallGuide).filter(McpInstallGuide.id == guide_id).first()


def create_install_guide(
    db: Session, client_name: str, config_json: str, instructions: str, server_id: int
) -> McpInstallGuide:
    db_guide = McpInstallGuide(
        client_name=client_name,
        config_json=config_json,
        instructions=instructions,
        server_id=server_id,
    )
    db.add(db_guide)
    db.commit()
    db.refresh(db_guide)
    return db_guide


def update_install_guide(db: Session, guide_id: int, **kwargs) -> Optional[McpInstallGuide]:
    db_guide = get_install_guide(db, guide_id)
    if not db_guide:
        return None

    for key, value in kwargs.items():
        if hasattr(db_guide, key) and value is not None:
            setattr(db_guide, key, value)

    db.commit()
    db.refresh(db_guide)
    return db_guide


def delete_install_guide(db: Session, guide_id: int) -> bool:
    db_guide = get_install_guide(db, guide_id)
    if not db_guide:
        return False
    db.delete(db_guide)
    db.commit()
    return True
