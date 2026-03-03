# backend/routers/students.py
import json
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DBStudent, DBUser
from backend.auth import get_current_user

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("")
def get_students(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    students = db.query(DBStudent).all()
    results = []
    for s in students:
        s_dict = {
            "id": s.id,
            "student_name": s.student_name,
            "student_class": s.student_class,
            "fathers_name": s.fathers_name,
            "mother_name": s.mother_name,
            "dob": s.dob,
            "pen_number": s.pen_number,
            "sr_number": s.sr_number,
            "TOTAL": s.TOTAL,
            "total_pct": s.total_pct,
            "total_grade": s.total_grade,
        }
        if s.marks_data:
            s_dict.update(json.loads(s.marks_data))
        results.append(s_dict)
    return results


@router.post("")
def create_or_update_student(student: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    known_fields = ["id", "student_name", "student_class", "fathers_name", "mother_name", "dob",
                    "pen_number", "sr_number", "TOTAL", "total_pct", "total_grade"]
    marks = {k: v for k, v in student.items() if k not in known_fields}

    student_id = student.get("id") or str(uuid.uuid4())
    db_student = db.query(DBStudent).filter(DBStudent.id == student_id).first()

    if db_student:
        db_student.student_name = student.get("student_name", "")
        db_student.student_class = student.get("student_class", "")
        db_student.fathers_name = student.get("fathers_name", "")
        db_student.mother_name = student.get("mother_name", "")
        db_student.dob = student.get("dob", "")
        db_student.pen_number = student.get("pen_number", "")
        db_student.sr_number = student.get("sr_number", "")
        db_student.TOTAL = student.get("TOTAL", 0)
        db_student.total_pct = student.get("total_pct", 0)
        db_student.total_grade = student.get("total_grade", "")
        db_student.marks_data = json.dumps(marks)
    else:
        db_student = DBStudent(
            id=student_id,
            student_name=student.get("student_name", ""),
            student_class=student.get("student_class", ""),
            fathers_name=student.get("fathers_name", ""),
            mother_name=student.get("mother_name", ""),
            dob=student.get("dob", ""),
            pen_number=student.get("pen_number", ""),
            sr_number=student.get("sr_number", ""),
            TOTAL=student.get("TOTAL", 0),
            total_pct=student.get("total_pct", 0),
            total_grade=student.get("total_grade", ""),
            marks_data=json.dumps(marks),
        )
        db.add(db_student)

    db.commit()
    return {"status": "success"}


@router.delete("/{student_id}")
def delete_student(student_id: str, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    db.query(DBStudent).filter(DBStudent.id == student_id).delete()
    db.commit()
    return {"status": "success"}
