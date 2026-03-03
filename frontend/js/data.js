// data.js - Data helper utilities (loaded as plain script)

function getSubjectsForClass(className) {
    const map = schoolSettings.class_subjects_map || {};
    let subjects = [];
    if (map[className] && map[className].length > 0) {
        subjects = map[className];
    } else if (map['default'] && map['default'].length > 0) {
        subjects = map['default'];
    } else {
        subjects = ['Hindi', 'English', 'Mathematics', 'Social Science', 'Science', 'Sanskrit', 'Agriculture/Home Craft', 'Elective Arts', 'Environment Studies', 'Physical Education'];
    }
    return subjects.map(sub => ({
        key: sub.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: sub
    }));
}

function calculateGrade(percentage) {
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'E';
}

function getVisibleStudents() {
    // For principal: filter by the class filter dropdown if set
    const classFilter = document.getElementById('list_class_filter');
    const selectedClass = classFilter ? classFilter.value : '';

    let pool = (userRole === 'principal') ? studentsDB : studentsDB.filter(s => s.student_class === userClass);

    if (selectedClass) {
        pool = pool.filter(s => s.student_class === selectedClass);
    }
    return pool;
}
