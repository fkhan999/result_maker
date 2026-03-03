import json
import requests
import os

# Provide the excel file name or relative path
json_file = os.getenv("JSON_FILE")

if not json_file:
    print("Please set the JSON_FILE environment variable.")
    exit(1)

with open(json_file, 'r') as f:
    data = json.load(f)

students = data.get('data', [])
imported_count = 0

for row in students:
    class_desc = row.get('classDesc', '')
    section_desc = row.get('sectionDesc', '')
    student_class = f"{class_desc}-{section_desc}" if section_desc else str(class_desc)
    
    pen_number = str(row.get('studentCodeNat', ''))
    
    student_data = {
        "id": pen_number if pen_number else str(row.get('studentId', '')),
        "student_name": str(row.get('studentName', '')),
        "student_class": student_class,
        "fathers_name": str(row.get('fatherName', '')),
        "mother_name": str(row.get('motherName', '')),
        "dob": str(row.get('dob', '')),
        "pen_number": pen_number,
        "sr_number": str(row.get('admnNumber', '')) if row.get('admnNumber') is not None else "",
        "TOTAL": 0,
        "total_pct": 0,
        "total_grade": ""
    }
    
    requests.post('http://127.0.0.1:8000/api/students', json=student_data)
    imported_count += 1

print(f"Imported {imported_count} students from student.json.")
