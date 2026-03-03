# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DBUser
from backend.auth import get_current_user
from backend.schemas import UserSchema

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_principal(current_user: DBUser):
    if current_user.role != "principal":
        raise HTTPException(status_code=403, detail="Not authorized")


@router.get("")
def get_users(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    _require_principal(current_user)
    users = db.query(DBUser).all()
    return [
        {"id": u.id, "username": u.username, "role": u.role,
         "assigned_class": u.assigned_class, "password": u.password}
        for u in users
    ]


@router.post("")
def create_user(user_data: UserSchema, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    _require_principal(current_user)
    if db.query(DBUser).filter(DBUser.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    db.add(DBUser(username=user_data.username, password=user_data.password,
                  role=user_data.role, assigned_class=user_data.assigned_class))
    db.commit()
    return {"status": "success"}


@router.put("/{user_id}")
def update_user(user_id: int, user_data: UserSchema, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    _require_principal(current_user)
    db_user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db_user.username = user_data.username
    db_user.password = user_data.password
    db_user.role = user_data.role
    db_user.assigned_class = user_data.assigned_class
    db.commit()
    return {"status": "success"}


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    _require_principal(current_user)
    db.query(DBUser).filter(DBUser.id == user_id).delete()
    db.commit()
    return {"status": "success"}
