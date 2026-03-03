# backend/main.py — Clean FastAPI entry point
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.database import SessionLocal, Base, engine, get_db
from backend.models import DBUser, DBClassSubject, DBSettings
from backend.schemas import LoginSchema
from backend.auth import create_token
from backend.routers import students, settings, users, class_subjects

# Create all tables
Base.metadata.create_all(bind=engine)


def prepopulate(db: Session):
    if db.query(DBUser).count() == 0:
        db.add(DBUser(username=os.getenv("ADMIN_USER"), password="password123", role="principal", assigned_class=None))
        setting = db.query(DBSettings).first()
        if setting and setting.classes:
            for i, class_name in enumerate([c.strip() for c in setting.classes.split(',') if c.strip()]):
                db.add(DBUser(username=f"class{i+1}", password="password123", role="teacher", assigned_class=class_name))

    if db.query(DBClassSubject).count() == 0:
        default_subs = ["Hindi", "English", "Mathematics", "Science",
                        "Social Science", "Art", "Sanskrit",
                        "Environment Studies", "Physical Education"]
        for sub in default_subs:
            db.add(DBClassSubject(class_name="default", subject_name=sub))

    db.commit()


db_session = SessionLocal()
prepopulate(db_session)
db_session.close()

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="School Report Card API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(students.router)
app.include_router(settings.router)
app.include_router(users.router)
app.include_router(class_subjects.router)


# ── Login (no auth required) ──────────────────────────────────────────────────
@app.post("/api/login")
def login(login_data: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.username == login_data.username).first()
    if not user or user.password != login_data.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "success": True,
        "username": user.username,
        "role": user.role,
        "assigned_class": user.assigned_class,
        "token": create_token(user.username),
    }


# ── Static frontend files ─────────────────────────────────────────────────────
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
