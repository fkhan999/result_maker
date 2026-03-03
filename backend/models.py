# backend/models.py
from sqlalchemy import Column, Integer, String, Float, Text
from backend.database import Base


class DBStudent(Base):
    __tablename__ = "students"
    id = Column(String, primary_key=True, index=True)
    student_name = Column(String)
    student_class = Column(String)
    fathers_name = Column(String)
    mother_name = Column(String)
    dob = Column(String)
    pen_number = Column(String)
    sr_number = Column(String)
    marks_data = Column(Text)
    TOTAL = Column(Float)
    total_pct = Column(Float)
    total_grade = Column(String)


class DBSettings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="")
    subtitle = Column(String, default="")
    session = Column(String, default="")
    classes = Column(String, default="")


class DBClassSubject(Base):
    __tablename__ = "class_subjects"
    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String, index=True)
    subject_name = Column(String)


class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)
    assigned_class = Column(String, nullable=True)
