# School Report Card Generator

## Project Structure

```
result_maker/
├── backend/                    # Python FastAPI backend
│   ├── __init__.py
│   ├── main.py                 # App entry point + login endpoint
│   ├── models.py               # SQLAlchemy ORM models
│   ├── schemas.py              # Pydantic request schemas
│   ├── auth.py                 # JWT helpers + current_user dependency
│   ├── database.py             # DB engine & session factory
│   ├── routers/
│   │   ├── students.py         # GET/POST/DELETE /api/students
│   │   ├── settings.py         # GET/POST /api/settings
│   │   ├── users.py            # GET/POST/PUT/DELETE /api/users
│   │   └── class_subjects.py   # GET/POST /api/class-subjects
│   └── scripts/
│       ├── assign_random_marks.py
│       ├── import_script.py
│       └── import_json.py
│
├── frontend/                   # Static HTML/JS frontend
│   ├── index.html
│   ├── styles.css
│   ├── js/
│   │   ├── api.js              # apiFetch, loadDB, saveDB, logout
│   │   ├── data.js             # getSubjectsForClass, calculateGrade, getVisibleStudents
│   │   └── app.js              # UI logic, PDF generation, event wiring
│   └── assets/
│       ├── logo.js             # Base64 logo strings
│       ├── left_logo.png
│       └── right_logo.png
│
├── requirements.txt
└── README.md
```

## Running the Server

```bash
# From the project root directory:
cd result_maker
venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## Utility Scripts

```bash
# Assign random 70-88% marks to all students:
venv/bin/python -m backend.scripts.assign_random_marks
```
