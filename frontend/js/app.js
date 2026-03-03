// Helpers loaded from api.js and data.js via separate <script> tags

function renderMarksTable(className) {
    const marksBody = document.getElementById('marks-body');
    if (!marksBody) return;
    marksBody.innerHTML = '';
    const classSubjects = getSubjectsForClass(className);

    classSubjects.forEach(sub => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-white/10 last:border-0 hover:bg-white/5 transition';
        tr.innerHTML = `
            <td class="p-2 font-medium text-white">${sub.label}</td>
            <td class="p-2"><input type="number" min="0" max="10" id="${sub.key}_ft" required placeholder="0-10" class="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-center text-white focus:outline-none focus:border-indigo-500"></td>
            <td class="p-2"><input type="number" min="0" max="30" id="${sub.key}_hy" required placeholder="0-30" class="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-center text-white focus:outline-none focus:border-indigo-500"></td>
            <td class="p-2"><input type="number" min="0" max="10" id="${sub.key}_st" required placeholder="0-10" class="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-center text-white focus:outline-none focus:border-indigo-500"></td>
            <td class="p-2"><input type="number" min="0" max="50" id="${sub.key}_ay" required placeholder="0-50" class="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-center text-white focus:outline-none focus:border-indigo-500"></td>
        `;
        marksBody.appendChild(tr);
    });
}

// Calculate Grade Logic
// calculateGrade is imported from data.js

// Database logic (from API)
let studentsDB = [];
let systemUsers = []; // State for user management
let currentSubjectMap = {}; // State for the visual manager
let userRole = localStorage.getItem('userRole') || 'principal';
let userClass = localStorage.getItem('userClass') || '';
let authToken = localStorage.getItem('token') || null;
let loggedInUser = localStorage.getItem('username') || '';

let schoolSettings = {
    name: "",
    subtitle: "",
    session: "",
    classes: ""
};



function updateUserMenu() {
    if (authToken) {
        document.getElementById('user-menu').classList.remove('hidden');
        document.getElementById('logged-in-user').textContent = loggedInUser.toUpperCase();
        document.getElementById('logged-in-role').textContent = userRole === 'teacher' ? `Teacher: ${userClass}` : 'Principal';
    }
}

// loadDB, saveDB, saveSchoolSettings are defined in api.js


function populateClassDropdown() {
    const classSelect = document.getElementById('student_class');
    if (!classSelect) return;
    classSelect.innerHTML = '';

    const classes = schoolSettings.classes.split(',').map(c => c.trim()).filter(c => c);

    classes.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        classSelect.appendChild(option);
    });

    // Populate new user class dropdown as well
    const newUserClassSelect = document.getElementById('new_user_class');
    if (newUserClassSelect) {
        newUserClassSelect.innerHTML = '<option value="">None</option>';
        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            newUserClassSelect.appendChild(option);
        });
    }

    const listClassFilter = document.getElementById('list_class_filter');
    if (listClassFilter) {
        listClassFilter.innerHTML = '<option value="">All Classes</option>';
        classes.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            listClassFilter.appendChild(option);
        });

        listClassFilter.removeEventListener('change', window.onListClassFilterChange);
        window.onListClassFilterChange = () => renderStudentsList();
        listClassFilter.addEventListener('change', window.onListClassFilterChange);
    }

    classSelect.addEventListener('change', (e) => {
        renderMarksTable(e.target.value);
    });
}

function populateSettingsForm() {
    const settingForm = document.getElementById('settings-form');
    if (!settingForm) return;
    document.getElementById('setting_school_name').value = schoolSettings.name;
    document.getElementById('setting_subtitle').value = schoolSettings.subtitle;
    document.getElementById('setting_session').value = schoolSettings.session;

    const classesInput = document.getElementById('setting_classes');
    classesInput.value = schoolSettings.classes;

    // Setup listener so manager updates live when classes change
    classesInput.removeEventListener('input', renderSubjectsManager);
    classesInput.addEventListener('input', renderSubjectsManager);

    if (schoolSettings.class_subjects_map) {
        currentSubjectMap = JSON.parse(JSON.stringify(schoolSettings.class_subjects_map));
    } else {
        currentSubjectMap = {};
    }

    if (!currentSubjectMap['default']) {
        currentSubjectMap['default'] = ['Hindi', 'English', 'Mathematics', 'Science'];
    }

    renderSubjectsManager();
}

function renderSubjectsManager() {
    const container = document.getElementById('subjects_manager_container');
    if (!container) return;
    container.innerHTML = '';

    // Get all classes from the classes input + 'default'
    const classesStr = document.getElementById('setting_classes').value || schoolSettings.classes || '';
    let classNames = ['default', ...classesStr.split(',').map(c => c.trim()).filter(c => c)];

    // Collect unique keys
    classNames = [...new Set(classNames)];

    classNames.forEach(className => {
        const subjects = currentSubjectMap[className] || [];

        const row = document.createElement('div');
        row.className = "bg-white/5 border border-white/10 rounded-xl p-4";

        const header = document.createElement('div');
        header.className = "flex justify-between items-center mb-3";
        header.innerHTML = `<h4 class="font-bold text-white text-lg">${className === 'default' ? 'Default Subjects (Fallback)' : `Class: ${className}`}</h4>`;

        const pillsContainer = document.createElement('div');
        pillsContainer.className = "flex flex-wrap gap-2 mb-3";

        if (subjects.length === 0) {
            pillsContainer.innerHTML = '<span class="text-xs text-gray-400 italic">No subjects configured. Will use default.</span>';
        } else {
            subjects.forEach((sub, idx) => {
                const pill = document.createElement('div');
                pill.className = "bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-indigo-500/30";
                pill.innerHTML = `
                    ${sub}
                    <button type="button" class="ml-2 hover:text-red-400 text-indigo-400 transition cursor-pointer" onclick="removeSubject('${className}', ${idx})">
                        &times;
                    </button>
                `;
                pillsContainer.appendChild(pill);
            });
        }

        const addContainer = document.createElement('div');
        addContainer.className = "flex space-x-2";
        addContainer.innerHTML = `
            <input type="text" id="add_sub_input_${className}" placeholder="New Subject (e.g. Maths)" class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            <button type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-md cursor-pointer" onclick="addSubject('${className}')">Add</button>
        `;

        row.appendChild(header);
        row.appendChild(pillsContainer);
        row.appendChild(addContainer);

        container.appendChild(row);

        // Enter key to add subject
        const inputField = document.getElementById(`add_sub_input_${className}`);
        if (inputField) {
            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubject(className);
                }
            });
        }
    });
}

window.addSubject = function (className) {
    const input = document.getElementById(`add_sub_input_${className}`);
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        if (!currentSubjectMap[className]) currentSubjectMap[className] = [];
        if (!currentSubjectMap[className].includes(val)) {
            currentSubjectMap[className].push(val);
            renderSubjectsManager();
        }
    }
}

window.removeSubject = function (className, idx) {
    if (currentSubjectMap[className]) {
        currentSubjectMap[className].splice(idx, 1);
        renderSubjectsManager();
    }
}

function applyRoleUI() {
    const tabSettings = document.getElementById('tab-settings');
    const studentClassVal = document.getElementById('student_class');
    const userManagementSection = document.getElementById('user-management-section');
    const classFilterContainer = document.getElementById('class-filter-container');

    if (userManagementSection) {
        if (userRole === 'principal') {
            userManagementSection.classList.remove('hidden');
        } else {
            userManagementSection.classList.add('hidden');
        }
    }

    // Show class filter for principal only
    if (classFilterContainer) {
        if (userRole === 'principal') {
            classFilterContainer.classList.remove('hidden');
        } else {
            classFilterContainer.classList.add('hidden');
        }
    }

    if (userRole === 'teacher') {
        tabSettings.classList.add('hidden');
        studentClassVal.disabled = true;
        studentClassVal.value = userClass;
        renderMarksTable(userClass);

        if (!document.getElementById('content-settings').classList.contains('hidden')) {
            document.getElementById('tab-list').click();
        }
    } else {
        tabSettings.classList.remove('hidden');
        studentClassVal.disabled = false;
        if (studentClassVal.value) renderMarksTable(studentClassVal.value);
    }
    renderStudentsList();
}

function initLoginHandler() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uname = document.getElementById('login_username').value.trim().toLowerCase();
            const pword = document.getElementById('login_password').value;
            const errorP = document.getElementById('login-error');

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const ogText = submitBtn.innerText;
            submitBtn.innerText = 'Verifying...';
            submitBtn.disabled = true;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: uname, password: pword })
                });

                if (res.ok) {
                    const data = await res.json();
                    userRole = data.role;
                    userClass = data.assigned_class || '';
                    authToken = data.token;
                    loggedInUser = data.username;
                    localStorage.setItem('userRole', userRole);
                    localStorage.setItem('userClass', userClass);
                    localStorage.setItem('token', authToken);
                    localStorage.setItem('username', loggedInUser);
                    document.getElementById('login-modal').classList.add('hidden');
                    updateUserMenu();
                    applyRoleUI();
                    loadDB();
                } else {
                    errorP.textContent = 'Invalid username or password.';
                    errorP.classList.remove('hidden');
                }
            } catch (err) {
                errorP.textContent = 'Network error. Could not connect to server.';
                errorP.classList.remove('hidden');
            } finally {
                submitBtn.innerText = ogText;
                submitBtn.disabled = false;
            }
        });
    }
}

// getVisibleStudents is imported from data.js

document.addEventListener('DOMContentLoaded', () => {
    initLoginHandler();

    // Wire up logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    if (authToken) {
        document.getElementById('login-modal').classList.add('hidden');
        updateUserMenu();
        applyRoleUI();
        loadDB();
    }
});

const settingForm = document.getElementById('settings-form');
if (settingForm) {
    settingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        schoolSettings.name = document.getElementById('setting_school_name').value;
        schoolSettings.subtitle = document.getElementById('setting_subtitle').value;
        schoolSettings.session = document.getElementById('setting_session').value;
        schoolSettings.classes = document.getElementById('setting_classes').value;
        await saveSchoolSettings();
        await loadDB(); // Reload everything to pull latest map
    });
}

const userForm = document.getElementById('add-user-form');
if (userForm) {
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const uname = document.getElementById('new_user_name').value.trim();
        const role = 'teacher';
        const assignedClass = document.getElementById('new_user_class').value || null;

        try {
            const res = await apiFetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: uname,
                    password: 'password123',
                    role: role,
                    assigned_class: assignedClass
                })
            });
            if (res.ok) {
                alert('Teacher added successfully!');
                userForm.reset();
                await loadDB(); // refresh users
            } else {
                const data = await res.json();
                alert('Error: ' + (data.detail || 'Could not add teacher'));
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to server');
        }
    });
}

function renderUsersList() {
    const body = document.getElementById('users-body');
    if (!body) return;
    body.innerHTML = '';

    systemUsers.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition';
        const isPrincipal = u.role === 'principal';
        tr.innerHTML = `
            <td class="p-4 font-medium">${u.username}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${isPrincipal ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}">${u.role.toUpperCase()}</span></td>
            <td class="p-4 text-gray-400">${u.assigned_class || '-'}</td>
            <td class="p-4 text-right">
                ${!isPrincipal ? `<button onclick="deleteUser(${u.id})" class="text-xs bg-red-600/20 hover:bg-red-600 hover:text-white text-red-400 font-semibold px-3 py-1.5 rounded transition cursor-pointer">Delete</button>` : `<span class="text-xs text-gray-500">Admin</span>`}
            </td>
        `;
        body.appendChild(tr);
    });
}

window.deleteUser = async function (userId) {
    if (!confirm('Are you sure you want to delete this teacher account?')) return;
    try {
        const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
            await loadDB();
        } else {
            alert('Failed to delete user');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to connect to server');
    }
}

// Form Submission
const studentForm = document.getElementById('student-form');
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const student = {
            id: document.getElementById('student_id')?.value || Date.now().toString(),
            student_name: document.getElementById('student_name').value,
            student_class: document.getElementById('student_class').value,
            fathers_name: document.getElementById('fathers_name').value,
            mother_name: document.getElementById('mother_name').value,
            dob: document.getElementById('dob').value,
            pen_number: document.getElementById('pen_number').value,
            sr_number: document.getElementById('sr_number').value
        };

        let totalMarks = 0;
        const currentClassSubjects = getSubjectsForClass(student.student_class);

        currentClassSubjects.forEach(sub => {
            const ft = parseFloat(document.getElementById(`${sub.key}_ft`)?.value) || 0;
            const hy = parseFloat(document.getElementById(`${sub.key}_hy`)?.value) || 0;
            const st = parseFloat(document.getElementById(`${sub.key}_st`)?.value) || 0;
            const ay = parseFloat(document.getElementById(`${sub.key}_ay`)?.value) || 0;

            student[`${sub.key}_ft_marks`] = ft;
            student[`${sub.key}_hy_marks`] = hy;
            student[`${sub.key}_st_marks`] = st;
            student[`${sub.key}_ay_marks`] = ay;

            totalMarks += (ft + hy + st + ay);
        });

        student.TOTAL = totalMarks;
        const maxMarks = currentClassSubjects.length * 100;
        student.total_pct = maxMarks > 0 ? (totalMarks / maxMarks * 100).toFixed(2) : 0;
        student.total_grade = calculateGrade(parseFloat(student.total_pct));

        await saveDB(student);

        e.target.reset();
        document.getElementById('student_id').value = '';
        renderMarksTable(document.getElementById('student_class').value); // reset marks
        document.getElementById('tab-list').click();
    });
}

// UI Logic
const tabAdd = document.getElementById('tab-add');
const tabList = document.getElementById('tab-list');
const tabSettings = document.getElementById('tab-settings');
const contentAdd = document.getElementById('content-add');
const contentList = document.getElementById('content-list');
const contentSettings = document.getElementById('content-settings');

function switchTab(activeTab, activeContent) {
    [tabAdd, tabList, tabSettings].forEach(t => {
        if (!t) return;
        t.className = "text-xl font-bold text-gray-400 px-4 py-2 hover:text-white transition cursor-pointer";
    });
    [contentAdd, contentList, contentSettings].forEach(c => {
        if (!c) return;
        c.classList.add('hidden');
    });

    if (activeTab) activeTab.className = "text-xl font-bold text-indigo-400 border-b-2 border-indigo-400 px-4 py-2 hover:text-white transition cursor-pointer";
    if (activeContent) activeContent.classList.remove('hidden');
}

if (tabAdd) tabAdd.addEventListener('click', () => switchTab(tabAdd, contentAdd));
if (tabList) tabList.addEventListener('click', () => switchTab(tabList, contentList));
if (tabSettings) tabSettings.addEventListener('click', () => switchTab(tabSettings, contentSettings));

// Render List
function renderStudentsList() {
    const tbody = document.getElementById('students-body');
    const badge = document.getElementById('student-count-badge');
    const visibleStudents = getVisibleStudents();

    if (badge) badge.textContent = visibleStudents.length;

    if (!tbody) return;
    tbody.innerHTML = '';

    if (visibleStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400 italic">No students found. Switch to "Add Student" to begin.</td></tr>`;
        return;
    }

    visibleStudents.forEach((student) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-white/10 hover:bg-white/5 transition';
        tr.innerHTML = `
            <td class="p-4 font-semibold">${student.student_name}</td>
            <td class="p-4 text-indigo-200">${student.student_class || 'N/A'}</td>
            <td class="p-4 text-indigo-200">${student.pen_number}</td>
            <td class="p-4">${student.TOTAL}&nbsp;/&nbsp;1000</td>
            <td class="p-4"><span class="bg-indigo-500 text-white text-xs px-2 py-1 rounded font-bold">${student.total_grade}</span></td>
            <td class="p-4 text-right flex gap-2 justify-end">
                <button onclick="editStudent('${student.id}')" class="text-blue-300 hover:text-blue-200 font-medium bg-blue-400/10 px-3 py-1 rounded-lg">Edit</button>
                <button onclick="downloadStudentPDF('${student.id}')" class="text-indigo-300 hover:text-indigo-200 font-medium bg-indigo-400/10 px-3 py-1 rounded-lg">PDF</button>
                <button onclick="deleteStudent('${student.id}')" class="text-red-400 hover:text-red-300 font-medium bg-red-400/10 px-3 py-1 rounded-lg">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteStudent = async function (id) {
    if (confirm('Are you sure you want to delete this student from the database?')) {
        try {
            await apiFetch(`/api/students/${id}`, { method: 'DELETE' });
            await loadDB();
        } catch (e) {
            console.error('Error deleting student', e);
        }
    }
}

window.editStudent = function (id) {
    const student = studentsDB.find(s => s.id === id);
    if (!student) return;

    document.getElementById('student_id').value = student.id;
    document.getElementById('student_name').value = student.student_name || '';
    if (student.student_class) {
        document.getElementById('student_class').value = student.student_class;
        renderMarksTable(student.student_class);
    }
    document.getElementById('fathers_name').value = student.fathers_name || '';
    document.getElementById('mother_name').value = student.mother_name || '';
    document.getElementById('dob').value = student.dob || '';
    document.getElementById('pen_number').value = student.pen_number || '';
    document.getElementById('sr_number').value = student.sr_number || '';

    const classSubjects = getSubjectsForClass(student.student_class);
    classSubjects.forEach(sub => {
        if (document.getElementById(`${sub.key}_ft`)) document.getElementById(`${sub.key}_ft`).value = student[`${sub.key}_ft_marks`] || 0;
        if (document.getElementById(`${sub.key}_hy`)) document.getElementById(`${sub.key}_hy`).value = student[`${sub.key}_hy_marks`] || 0;
        if (document.getElementById(`${sub.key}_st`)) document.getElementById(`${sub.key}_st`).value = student[`${sub.key}_st_marks`] || 0;
        if (document.getElementById(`${sub.key}_ay`)) document.getElementById(`${sub.key}_ay`).value = student[`${sub.key}_ay_marks`] || 0;
    });

    document.getElementById('tab-add').click();
    window.scrollTo(0, 0);
}

// ============ PDF GENERATION (jsPDF - real text) ============

function buildStudentPDF(student) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    addReportPage(doc, student);
    return doc;
}

function addReportPage(doc, student) {
    const pw = 297, ph = 210;
    const mx = 12; // margin x

    // --- Gold top line ---
    doc.setFillColor(218, 165, 32);
    doc.rect(0, 0, pw, 2.5, 'F');

    // --- Navy header band ---
    doc.setFillColor(33, 62, 114);
    doc.rect(0, 2.5, pw, 22, 'F');
    // gradient effect - second rect
    doc.setFillColor(45, 85, 150);
    doc.rect(pw * 0.4, 2.5, pw * 0.6, 22, 'F');

    // School name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolSettings.name, pw / 2, 13, { align: 'center' });

    // Sub info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolSettings.subtitle, pw / 2, 19, { align: 'center' });

    // Logos
    if (typeof leftLogoBase64 !== 'undefined' && leftLogoBase64) {
        try {
            doc.addImage(leftLogoBase64, 'PNG', 8, 4, 18, 18);
        } catch (e) { /* logo load fail, skip */ }
    }
    if (typeof rightLogoBase64 !== 'undefined' && rightLogoBase64) {
        try {
            doc.addImage(rightLogoBase64, 'PNG', pw - 26, 4, 18, 18);
        } catch (e) { /* logo load fail, skip */ }
    }

    // --- Sub-header strip ---
    doc.setFillColor(240, 244, 255);
    doc.rect(0, 24.5, pw, 8, 'F');
    doc.setDrawColor(199, 210, 232);
    doc.setLineWidth(0.4);
    doc.line(0, 32.5, pw, 32.5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 62, 114);
    doc.text(`Academic Year: ${schoolSettings.session}`, pw / 2 - 15, 30.2, { align: 'right' });
    doc.setTextColor(184, 134, 11);
    doc.text('STUDENT REPORT CARD', pw / 2 + 15, 30.2, { align: 'left' });

    // --- Student Details Table ---
    const studentName = student.student_name || '';
    const fathersName = student.fathers_name || student.father_name || '';
    const mothersName = student.mother_name || student.mothers_name || '';
    const dob = student.dob || '';
    const penNumber = student.pen_number || 'N/A';
    const srNumber = student.sr_number || 'N/A';

    const labelStyle = { fillColor: [232, 237, 245], fontStyle: 'bold', textColor: [55, 65, 81] };
    const valueStyle = { textColor: [30, 64, 175] };

    doc.autoTable({
        startY: 34,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5, lineColor: [199, 210, 232], lineWidth: 0.3 },
        body: [
            [
                { content: 'Student Name', styles: labelStyle }, { content: studentName, styles: { ...valueStyle, fontStyle: 'bold' } },
                { content: "Father's Name", styles: labelStyle }, { content: fathersName, styles: valueStyle },
                { content: "Mother's Name", styles: labelStyle }, { content: mothersName, styles: valueStyle }
            ],
            [
                { content: 'DOB', styles: labelStyle }, { content: dob, styles: valueStyle },
                { content: 'PEN Number', styles: labelStyle }, { content: penNumber, styles: valueStyle },
                { content: 'SR Number', styles: labelStyle }, { content: srNumber, styles: valueStyle }
            ],
            [
                { content: 'Class', styles: labelStyle }, { content: student.student_class || 'N/A', styles: { ...valueStyle, fontStyle: 'bold' } },
                { content: '', styles: { fillColor: [248, 250, 252] } }, { content: '', styles: { fillColor: [248, 250, 252] } },
                { content: '', styles: { fillColor: [248, 250, 252] } }, { content: '', styles: { fillColor: [248, 250, 252] } }
            ]
        ],
        columnStyles: {
            0: { cellWidth: 28 }, 1: { cellWidth: 50 },
            2: { cellWidth: 28 }, 3: { cellWidth: 50 },
            4: { cellWidth: 28 }, 5: { cellWidth: 50 }
        },
        margin: { left: mx, right: mx }
    });

    // --- Marks Table ---
    let marksY = doc.lastAutoTable.finalY + 3;

    const marksHead = [['SUBJECT', 'FT Max', 'FT Marks', 'HY Max', 'HY Marks', 'ST Max', 'ST Marks', 'Annual Max', 'Annual Marks', 'Total Max', 'Total Marks']];
    const marksBody = [];
    let totalFt = 0, totalHy = 0, totalSt = 0, totalAy = 0, totalTotals = 0;

    const studentSubjects = getSubjectsForClass(student.student_class);

    studentSubjects.forEach(sub => {
        const ft = parseFloat(student[`${sub.key}_ft_marks`]) || 0;
        const hy = parseFloat(student[`${sub.key}_hy_marks`]) || 0;
        const st = parseFloat(student[`${sub.key}_st_marks`]) || 0;
        const ay = parseFloat(student[`${sub.key}_ay_marks`]) || 0;
        const total = ft + hy + st + ay;
        totalFt += ft; totalHy += hy; totalSt += st; totalAy += ay; totalTotals += total;

        marksBody.push([
            { content: sub.label, styles: { fontStyle: 'bold' } },
            { content: '10', styles: { textColor: [100, 116, 139] } }, ft,
            { content: '30', styles: { textColor: [100, 116, 139] } }, hy,
            { content: '10', styles: { textColor: [100, 116, 139] } }, st,
            { content: '50', styles: { textColor: [100, 116, 139] } }, ay,
            { content: '100', styles: { textColor: [100, 116, 139] } },
            { content: String(total), styles: { fontStyle: 'bold', textColor: [30, 64, 175] } }
        ]);
    });

    const finalTotal = totalTotals;
    const grandRowStyle = { fillColor: [33, 62, 114], textColor: [255, 255, 255], fontStyle: 'bold' };

    const numSubs = studentSubjects.length;
    marksBody.push([
        { content: 'Grand Total', colSpan: 1, styles: grandRowStyle },
        { content: String(numSubs * 10), styles: grandRowStyle },
        { content: String(totalFt), styles: grandRowStyle },
        { content: String(numSubs * 30), styles: grandRowStyle },
        { content: String(totalHy), styles: grandRowStyle },
        { content: String(numSubs * 10), styles: grandRowStyle },
        { content: String(totalSt), styles: grandRowStyle },
        { content: String(numSubs * 50), styles: grandRowStyle },
        { content: String(totalAy), styles: grandRowStyle },
        { content: String(numSubs * 100), styles: grandRowStyle },
        { content: String(finalTotal), styles: { ...grandRowStyle, textColor: [251, 191, 36], fontSize: 11 } }
    ]);

    doc.autoTable({
        startY: marksY,
        head: marksHead,
        body: marksBody,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2, halign: 'center', lineColor: [199, 210, 232], lineWidth: 0.3 },
        headStyles: { fillColor: [33, 62, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 244, 255] },
        columnStyles: {
            0: { halign: 'left', cellWidth: 38 }
        },
        margin: { left: mx, right: mx }
    });

    // --- Summary bar ---
    let sumY = doc.lastAutoTable.finalY + 3;

    // Recalculate accurately based entirely on rendered table data
    const tableMaxMarks = studentSubjects.length * 100;
    const realPct = tableMaxMarks > 0 ? (totalTotals / tableMaxMarks * 100).toFixed(2) : 0;
    const realGrade = typeof calculateGrade === 'function' ? calculateGrade(parseFloat(realPct)) : (student.total_grade || '');

    const totalPct = realPct;
    const totalGrade = realGrade;

    // Summary background
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(mx, sumY, pw - mx * 2, 9, 2, 2, 'F');
    doc.setDrawColor(199, 210, 232);
    doc.roundedRect(mx, sumY, pw - mx * 2, 9, 2, 2, 'S');

    // Percentage
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Overall Percentage:', mx + 5, sumY + 6);
    doc.setTextColor(30, 64, 175);
    doc.text(`${totalPct}%`, mx + 48, sumY + 6);

    // Divider
    doc.setDrawColor(199, 210, 232);
    doc.line(mx + 62, sumY + 1.5, mx + 62, sumY + 7.5);

    // Grade badge
    doc.setTextColor(55, 65, 81);
    doc.text('Grade:', mx + 67, sumY + 6);

    let gradeBg = [99, 102, 241];
    if (totalGrade === 'A+') gradeBg = [5, 150, 105];
    else if (totalGrade === 'A') gradeBg = [13, 148, 136];
    else if (totalGrade === 'B') gradeBg = [37, 99, 235];
    else if (totalGrade === 'C') gradeBg = [217, 119, 6];
    else if (totalGrade === 'D') gradeBg = [220, 38, 38];
    else gradeBg = [107, 114, 128];

    doc.setFillColor(...gradeBg);
    doc.roundedRect(mx + 82, sumY + 1.5, 14, 6, 1.5, 1.5, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(totalGrade, mx + 89, sumY + 5.8, { align: 'center' });

    // Divider
    doc.setDrawColor(199, 210, 232);
    doc.line(mx + 102, sumY + 1.5, mx + 102, sumY + 7.5);

    // Promotion remark
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    // Determine Pass/Fail based on Grade
    const isPassing = !['D', 'E', 'F'].includes(totalGrade);

    // Determine the next class assuming Roman numeral format (e.g. "VIII-A" -> "IX-A")
    let nextClassStr = "";
    if (student.student_class) {
        let parts = student.student_class.split('-');
        if (parts.length > 0) {
            let numStr = parts[0].toUpperCase();
            let section = parts.length > 1 ? `-${parts.slice(1).join('-')}` : "";

            const romanMap = { "I": "II", "II": "III", "III": "IV", "IV": "V", "V": "VI", "VI": "VII", "VII": "VIII", "VIII": "IX", "IX": "X", "X": "XI", "XI": "XII" };
            const integerMatch = numStr.match(/^(\d+)$/);

            if (romanMap[numStr]) {
                nextClassStr = romanMap[numStr];
            } else if (integerMatch) {
                nextClassStr = (parseInt(integerMatch[1]) + 1).toString();
            } else {
                nextClassStr = "the next higher class";
            }
        }
    }

    const nextSessionParts = schoolSettings.session.split('-');
    let nextSession = schoolSettings.session;
    if (nextSessionParts.length === 2 && !isNaN(nextSessionParts[0]) && !isNaN(nextSessionParts[1])) {
        nextSession = `${parseInt(nextSessionParts[0]) + 1}-${parseInt(nextSessionParts[1]) + 1}`;
    }

    if (isPassing) {
        doc.setTextColor(4, 120, 87);
        doc.text(`\u2713 Promoted for admission to class ${nextClassStr || 'next standard'} in academic year ${nextSession}`, mx + 107, sumY + 6);
    } else {
        doc.setTextColor(220, 38, 38);
        doc.text(`Needs improvement. Retained in class ${student.student_class} for academic year ${nextSession}`, mx + 107, sumY + 6);
    }

    // --- Signatures ---
    const sigY = ph - 16;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text("Class Teacher's Signature:", mx + 5, sigY);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(mx + 58, sigY, mx + 58 + 50, sigY);

    doc.text("Principal's Signature:", pw - mx - 55 - 50, sigY);
    doc.line(pw - mx - 55, sigY, pw - mx - 5, sigY);

    // --- Gold bottom line ---
    doc.setFillColor(218, 165, 32);
    doc.rect(0, ph - 2.5, pw, 2.5, 'F');

    // --- Navy border ---
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(1);
    doc.rect(0.5, 0.5, pw - 1, ph - 1, 'S');
}

// Helper: reliable PDF download with correct filename
function downloadPDFWithName(doc, filename) {
    const blob = doc.output('blob');
    const navigator = window.navigator;

    // For IE / Edge
    if (navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(blob, filename);
        return;
    }

    // For other browsers
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// --- Per-student download ---
window.downloadStudentPDF = function (id) {
    const student = studentsDB.find(s => s.id === id);
    if (!student) return;
    const doc = buildStudentPDF(student);
    const safeName = (student.pen_number || student.student_name || 'student').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadPDFWithName(doc, `report_card_${safeName}.pdf`);
}

renderStudentsList();

// --- Bulk controls ---
const generateBtn = document.getElementById('generate-all-btn');
const generateSingleBtn = document.getElementById('generate-single-btn');
const progressArea = document.getElementById('progress-area');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPct = document.getElementById('progress-pct');

// ZIP - separate PDFs
if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
        const visibleStudents = getVisibleStudents();
        if (visibleStudents.length === 0) { alert("List is empty. Add students first."); return; }

        generateBtn.disabled = true;
        generateBtn.innerHTML = `<span class="loader-spinner"></span> <span class="ml-2">Generating ZIP...</span>`;
        progressArea.classList.remove('hidden');

        const zip = new JSZip();

        for (let i = 0; i < visibleStudents.length; i++) {
            const student = visibleStudents[i];
            const doc = buildStudentPDF(student);
            const pdfBlob = doc.output('blob');
            const fileName = `report_card_${student.pen_number || `student_${i + 1}`}.pdf`;
            zip.file(fileName, pdfBlob);

            const pct = Math.round(((i + 1) / visibleStudents.length) * 100);
            progressBar.style.width = `${pct}%`;
            progressPct.textContent = `${pct}%`;
            progressText.textContent = `Generated ${i + 1} of ${visibleStudents.length} PDFs...`;
            await new Promise(r => setTimeout(r, 50)); // yield to UI
        }

        progressText.textContent = 'Zipping files...';
        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, 'School_Report_Cards.zip');
        } catch (err) { console.error("ZIP Error:", err); }

        progressArea.classList.add('hidden');
        progressBar.style.width = '0%';
        generateBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg> ZIP (Separate)`;
        generateBtn.disabled = false;
    });
}

// SINGLE combined PDF
if (generateSingleBtn) {
    generateSingleBtn.addEventListener('click', async () => {
        const visibleStudents = getVisibleStudents();
        if (visibleStudents.length === 0) { alert("List is empty. Add students first."); return; }

        generateSingleBtn.disabled = true;
        generateSingleBtn.innerHTML = `<span class="loader-spinner"></span> <span class="ml-2">Generating...</span>`;
        progressArea.classList.remove('hidden');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        for (let i = 0; i < visibleStudents.length; i++) {
            if (i > 0) doc.addPage();
            addReportPage(doc, visibleStudents[i]);

            const pct = Math.round(((i + 1) / visibleStudents.length) * 100);
            progressBar.style.width = `${pct}%`;
            progressPct.textContent = `${pct}%`;
            progressText.textContent = `Generating page ${i + 1} of ${visibleStudents.length}...`;
            await new Promise(r => setTimeout(r, 50));
        }

        downloadPDFWithName(doc, 'All_Report_Cards.pdf');

        setTimeout(() => {
            progressArea.classList.add('hidden');
            progressBar.style.width = '0%';
            generateSingleBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> Single PDF`;
            generateSingleBtn.disabled = false;
        }, 800);
    });
}

