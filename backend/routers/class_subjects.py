# backend/routers/class_subjects.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DBClassSubject, DBUser
from backend.auth import get_current_user
from backend.schemas import ClassSubjectSchema

router = APIRouter(prefix="/api/class-subjects", tags=["class-subjects"])


@router.get("")
def get_class_subjects(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    rows = db.query(DBClassSubject).all()
    mapping = {}
    for r in rows:
        mapping.setdefault(r.class_name, []).append(r.subject_name)
    return mapping


@router.post("")
def update_class_subjects(data: list[ClassSubjectSchema], db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    db.query(DBClassSubject).delete()
    for item in data:
        for sub in item.subjects:
            db.add(DBClassSubject(class_name=item.class_name, subject_name=sub))
    db.commit()
    return {"status": "success"}
