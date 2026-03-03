// api.js - API interaction helpers (loaded as plain script)

async function apiFetch(url, options = {}) {
    if (authToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401 && url !== '/api/login') {
        logout();
    }
    return res;
}

function logout() {
    authToken = null;
    userRole = 'principal';
    userClass = '';
    loggedInUser = '';
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userClass');
    localStorage.removeItem('username');
    document.getElementById('user-menu').classList.add('hidden');
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('login-error').classList.add('hidden');
    studentsDB = [];
    renderStudentsList();
    renderMarksTable('');
}

async function loadDB() {
    if (!authToken) return;
    try {
        const setRes = await apiFetch('/api/settings');
        if (setRes.ok) {
            schoolSettings = await setRes.json();
            const subRes = await apiFetch('/api/class-subjects');
            if (subRes.ok) {
                schoolSettings.class_subjects_map = await subRes.json();
            } else {
                schoolSettings.class_subjects_map = {};
            }
            populateClassDropdown();
            populateSettingsForm();
        }
        const stuRes = await apiFetch('/api/students');
        if (stuRes.ok) {
            studentsDB = await stuRes.json();
            renderStudentsList();
        }
        if (userRole === 'principal') {
            const userRes = await apiFetch('/api/users');
            if (userRes.ok) {
                systemUsers = await userRes.json();
                renderUsersList();
            }
        }
    } catch (err) {
        console.error('Failed to load DB', err);
    }
}

async function saveDB(student) {
    try {
        await apiFetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(student)
        });
        await loadDB();
    } catch (e) {
        console.error('Error saving student', e);
    }
}

async function saveSchoolSettings() {
    try {
        await apiFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schoolSettings)
        });
        let parsed = [];
        for (const [cls, subs] of Object.entries(currentSubjectMap)) {
            if (subs.length > 0) {
                parsed.push({ class_name: cls, subjects: subs });
            }
        }
        await apiFetch('/api/class-subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
        });
        alert('Settings Saved Successfully!');
        populateClassDropdown();
    } catch (e) {
        console.error('Error saving settings', e);
    }
}
