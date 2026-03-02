from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.recruit_application import RecruitApplication


def get_application(db: Session, application_id: int) -> Optional[RecruitApplication]:
    return db.query(RecruitApplication).filter(RecruitApplication.id == application_id).first()


def get_application_by_post_and_applicant(
    db: Session,
    recruit_post_id: int,
    applicant_id: int,
) -> Optional[RecruitApplication]:
    return (
        db.query(RecruitApplication)
        .filter(
            RecruitApplication.recruit_post_id == recruit_post_id,
            RecruitApplication.applicant_id == applicant_id,
        )
        .first()
    )


def create_application(
    db: Session,
    recruit_post_id: int,
    applicant_id: int,
    message: str,
    link: Optional[str] = None,
) -> RecruitApplication:
    application = RecruitApplication(
        recruit_post_id=recruit_post_id,
        applicant_id=applicant_id,
        message=message,
        link=link,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def list_applications_by_post(db: Session, recruit_post_id: int) -> List[RecruitApplication]:
    return (
        db.query(RecruitApplication)
        .filter(RecruitApplication.recruit_post_id == recruit_post_id)
        .order_by(desc(RecruitApplication.created_at))
        .all()
    )


def update_application_status(
    db: Session,
    application: RecruitApplication,
    status: str,
) -> RecruitApplication:
    application.status = status
    db.commit()
    db.refresh(application)
    return application
