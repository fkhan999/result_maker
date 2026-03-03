"""
assign_random_marks.py
----------------------
Assigns random marks to all students in the database, ensuring
their total percentage falls between 70% and 88%.

Each subject has 4 components:
  - FT (First Term):   max 10
  - HY (Half Yearly):  max 30
  - ST (Second Term):  max 10
  - AY (Annual Exam):  max 50
  Total per subject: 100

Usage:
    python assign_random_marks.py
"""
import json
import random
import sys
import os
import re

# Add the project root so we can import from backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import SessionLocal
from backend.models import DBStudent, DBClassSubject, DBSettings


def calculate_grade(pct):
    if pct >= 80: return 'A+'
    if pct >= 70: return 'A'
    if pct >= 60: return 'B'
    if pct >= 50: return 'C'
    if pct >= 40: return 'D'
    return 'E'


def random_marks_for_subject(target_total):
    """
    Returns (ft, hy, st, ay) ensuring no zeros.
    FT and ST are out of 10: forced to be 6, 7, 8, or 9.
    HY is out of 30, AY is out of 50.
    """
    ft = random.randint(6, 9)
    st = random.randint(6, 9)
    
    remain = target_total - ft - st
    
    # We don't want 0s in HY (max 30) or AY (max 50) either.
    # Minimum for HY let's say 18.
    # Minimum for AY let's say 30.
    hy_low = max(18, remain - 50)
    hy_high = min(30, remain - 30)
    
    if hy_low > hy_high:
        hy_low = hy_high
        
    hy = random.randint(hy_low, hy_high)
    ay = remain - hy
    
    # Just in case maths drift slightly, clamp AY
    ay = max(0, min(50, ay))
    
    return (ft, hy, st, ay)


def get_subjects_for_class(db, class_name, default_subjects):
    rows = db.query(DBClassSubject).filter(DBClassSubject.class_name == class_name).all()
    if rows:
        return [r.subject_name for r in rows]
    return default_subjects


def main():
    db = SessionLocal()
    try:
        # Load default subjects
        default_rows = db.query(DBClassSubject).filter(DBClassSubject.class_name == "default").all()
        default_subjects = [r.subject_name for r in default_rows] if default_rows else [
            "Hindi", "English", "Mathematics", "Social Science", "Science", 
            "Sanskrit", "Agriculture/Home Craft", "Elective Arts", 
            "Environment Studies", "Physical Education"
        ]

        students = db.query(DBStudent).all()
        if not students:
            print("No students found in the database.")
            return

        MIN_PCT = 76  # minimum percentage across all subjects
        MAX_PCT = 89  # maximum percentage across all subjects

        updated = 0
        for student in students:
            class_name = student.student_class or "default"
            subjects = get_subjects_for_class(db, class_name, default_subjects)

            num_subjects = len(subjects)
            # Total max marks = 100 * num_subjects
            total_max = 100 * num_subjects

            marks_data = {}
            total_marks = 0

            # Generate marks per subject ensuring overall range
            # Strategy: pick an overall target total, then distribute
            target_total = random.randint(
                round(MIN_PCT / 100 * total_max),
                round(MAX_PCT / 100 * total_max)
            )

            # Assign each subject roughly equal share of target
            subject_totals = []
            for i in range(num_subjects):
                if i == num_subjects - 1:
                    # Last subject gets remainder, clamped
                    t = target_total - sum(subject_totals)
                    t = max(round(MIN_PCT / 100 * 100), min(round(MAX_PCT / 100 * 100), t))
                else:
                    # Random per-subject total 60–92 (slightly wider than goal for spread)
                    t = random.randint(round(MIN_PCT * 0.90), round(MAX_PCT * 1.02))
                subject_totals.append(t)

            # Re-normalise so first approach sums to target more closely on average
            for idx, sub in enumerate(subjects):
                # Using regex to exactly match the JS key generation logic
                key = re.sub(r'[^a-z0-9]', '_', sub.lower())
                target_sub = subject_totals[idx]
                # Distribute within the subject around the target out of 100
                ft, hy, st, ay = random_marks_for_subject(
                    max(50, min(100, target_sub))
                )
                marks_data[f"{key}_ft_marks"] = ft
                marks_data[f"{key}_hy_marks"] = hy
                marks_data[f"{key}_st_marks"] = st
                marks_data[f"{key}_ay_marks"] = ay
                total_marks += ft + hy + st + ay

            # Clamp total to allowed range
            low_bound = round(MIN_PCT / 100 * total_max)
            high_bound = round(MAX_PCT / 100 * total_max)
            total_marks = max(low_bound, min(high_bound, total_marks))

            pct = round(total_marks / total_max * 100, 2)
            grade = calculate_grade(pct)

            student.marks_data = json.dumps(marks_data)
            student.TOTAL = total_marks
            student.total_pct = pct
            student.total_grade = grade
            updated += 1

            print(f"  {student.student_name:30s} | Class: {class_name:8s} | "
                  f"Total: {total_marks}/{total_max} | {pct}% | Grade: {grade}")

        db.commit()
        print(f"\n✅ Updated {updated} student(s) with random marks (76–89%).")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
