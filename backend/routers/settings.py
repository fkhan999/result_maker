from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DBSettings, DBUser, PingTest
from backend.auth import get_current_user
from backend.schemas import SettingsSchema

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/ping")
def ping(db: Session = Depends(get_db)):
    # This endpoint is used by a GitHub Action to keep Supabase and Render active
    res = db.query(PingTest).first()
    if res:
        res.pinged_at = datetime.utcnow()
    else:
        res = PingTest(pinged_at=datetime.utcnow())
        db.add(res)
    db.commit()
    return {"status": "pong", "pinged_at": res.pinged_at}

@router.get("")
def get_settings(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    setting = db.query(DBSettings).first()
    if not setting:
        setting = DBSettings()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return {
        "name": setting.name,
        "subtitle": setting.subtitle,
        "session": setting.session,
        "classes": setting.classes,
    }


@router.post("")
def update_settings(settings: SettingsSchema, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    setting = db.query(DBSettings).first()
    if not setting:
        setting = DBSettings()
        db.add(setting)
    setting.name = settings.name
    setting.subtitle = settings.subtitle
    setting.session = settings.session
    setting.classes = settings.classes
    db.commit()
    return {"status": "success"}
