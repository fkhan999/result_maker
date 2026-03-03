# backend/schemas.py
from pydantic import BaseModel
from typing import Optional


class SettingsSchema(BaseModel):
    name: str
    subtitle: str
    session: str
    classes: str


class ClassSubjectSchema(BaseModel):
    class_name: str
    subjects: list[str]


class LoginSchema(BaseModel):
    username: str
    password: str


class UserSchema(BaseModel):
    username: str
    password: str
    role: str
    assigned_class: Optional[str] = None
