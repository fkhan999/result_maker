import pandas as pd
import requests
import json
import math
import os

# Provide the excel file name or relative path
excel_file = os.getenv("EXCEL_FILE")

if not excel_file:
    print("Please set the EXCEL_FILE environment variable.")
    exit(1)

df = pd.read_excel(excel_file, sheet_name='Students List', header=2)

for index, row in df.iterrows():
    if pd.isna(row['Name']):
        continue
        
    student_class = f"{row['Class']}-{row['Section']}" if not pd.isna(row['Section']) else str(row['Class'])
    
    student_data = {
        "id": str(int(row['Student PEN'])) if not pd.isna(row['Student PEN']) else str(index),
        "student_name": str(row['Name']),
        "student_class": student_class,
        "fathers_name": str(row['Father Name']) if not pd.isna(row['Father Name']) else "",
        "mother_name": str(row['Mother Name']) if not pd.isna(row['Mother Name']) else "",
        "dob": "",  # DOB is not in the export
        "pen_number": str(int(row['Student PEN'])) if not pd.isna(row['Student PEN']) else "",
        "sr_number": "", 
        "TOTAL": 0,
        "total_pct": 0,
        "total_grade": ""
    }
    
    requests.post('http://127.0.0.1:8000/api/students', json=student_data)

print(f"Imported {len(df)} students.")
