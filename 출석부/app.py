from flask import Flask, render_template, request, redirect, url_for, jsonify, session, g, flash, make_response
from models import get_db, init_db, hash_password
from datetime import datetime, date, timezone, timedelta
from functools import wraps
import json
import os

app = Flask(__name__)
app.secret_key = 'tnbedu-attendance-secret-key-2026'

# 학년 정렬 헬퍼 (Python용, 초1→고3 순서)
def grade_sort_key(grade_str):
    if not grade_str:
        return (4, grade_str or '')
    if grade_str.startswith('초'):
        return (1, grade_str)
    if grade_str.startswith('중'):
        return (2, grade_str)
    if grade_str.startswith('고'):
        return (3, grade_str)
    return (4, grade_str)

# 학년 정렬 SQL (초1→고3 순서)
GRADE_SORT_CLASS = "CASE WHEN class.grade_level LIKE '초%' THEN 1 WHEN class.grade_level LIKE '중%' THEN 2 WHEN class.grade_level LIKE '고%' THEN 3 ELSE 4 END, class.grade_level"
GRADE_SORT_PLAIN = "CASE WHEN grade_level LIKE '초%' THEN 1 WHEN grade_level LIKE '중%' THEN 2 WHEN grade_level LIKE '고%' THEN 3 ELSE 4 END, grade_level"
GRADE_SORT_CURR = "CASE WHEN c.grade LIKE '초%' THEN 1 WHEN c.grade LIKE '중%' THEN 2 WHEN c.grade LIKE '고%' THEN 3 ELSE 4 END, c.grade"
GRADE_SORT_CURR_PLAIN = "CASE WHEN grade LIKE '초%' THEN 1 WHEN grade LIKE '중%' THEN 2 WHEN grade LIKE '고%' THEN 3 ELSE 4 END, grade"

# WSGI 환경에서도 DB 초기화 보장
init_db()


# ─── 로그인 체크 ───
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated


def get_user_classes(db):
    """현재 로그인한 사용자가 접근 가능한 반 ID 목록"""
    if session.get('role') == 'admin':
        return None  # None = 모든 반 접근 가능
    user_id = session.get('user_id')
    rows = db.execute('SELECT class_id FROM user_class WHERE user_id = ?', (user_id,)).fetchall()
    return [r['class_id'] for r in rows]


# ─── 로그인/로그아웃 ───
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = ''
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        db = get_db()
        user = db.execute('SELECT * FROM user WHERE username = ? AND password = ?',
                          (username, hash_password(password))).fetchone()
        db.close()
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            session['name'] = user['name']
            return redirect(url_for('index'))
        error = '아이디 또는 비밀번호가 올바르지 않습니다.'
    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ─── 홈 ───
@app.route('/')
@login_required
def index():
    return render_template('index.html')


# ─── 관리: 지점 ─── (관리자 전용)
@app.route('/manage')
@admin_required
def manage():
    db = get_db()
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
    classes = db.execute(f'''
        SELECT class.*, branch.name as branch_name
        FROM class JOIN branch ON class.branch_id = branch.id
        ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name
    ''').fetchall()
    students = db.execute(f'''
        SELECT student.*, class.name as class_name, branch.name as branch_name,
               class.subject as class_subject, class.grade_level as class_grade_level,
               class.class_number as class_class_number, class.day_schedule as class_day_schedule
        FROM student
        LEFT JOIN class ON student.class_id = class.id
        LEFT JOIN branch ON student.branch_id = branch.id
        ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name, student.name
    ''').fetchall()
    db.close()
    return render_template('manage.html', branches=branches, classes=classes, students=students)


@app.route('/branch/add', methods=['POST'])
@admin_required
def branch_add():
    name = request.form.get('name', '').strip()
    if name:
        db = get_db()
        try:
            db.execute('INSERT INTO branch (name) VALUES (?)', (name,))
            db.commit()
        except Exception:
            pass
        db.close()
    return redirect(url_for('manage'))


@app.route('/branch/edit/<int:id>', methods=['POST'])
@admin_required
def branch_edit(id):
    name = request.form.get('name', '').strip()
    if name:
        db = get_db()
        db.execute('UPDATE branch SET name = ? WHERE id = ?', (name, id))
        db.commit()
        db.close()
    return redirect(url_for('manage'))


@app.route('/branch/delete/<int:id>', methods=['POST'])
@admin_required
def branch_delete(id):
    db = get_db()
    db.execute('UPDATE student SET branch_id = NULL WHERE branch_id = ?', (id,))
    db.execute('UPDATE class SET branch_id = NULL WHERE branch_id = ?', (id,))
    db.execute('DELETE FROM branch WHERE id = ?', (id,))
    db.commit()
    db.close()
    return redirect(url_for('manage'))


@app.route('/class/add', methods=['POST'])
@admin_required
def class_add():
    branch_id = request.form.get('branch_id')
    subject = request.form.get('subject', '').strip()
    grade_level = request.form.get('grade_level', '').strip()
    class_number = request.form.get('class_number', '').strip()
    day_schedule = request.form.get('day_schedule', '').strip()
    if branch_id and subject and grade_level and class_number:
        name = f"{subject} {grade_level} {class_number}"
        db = get_db()
        db.execute('INSERT INTO class (name, branch_id, subject, grade_level, class_number, day_schedule) VALUES (?, ?, ?, ?, ?, ?)',
                   (name, branch_id, subject, grade_level, class_number, day_schedule))
        db.commit()
        db.close()
    return redirect(url_for('manage'))


@app.route('/class/edit/<int:id>', methods=['POST'])
@login_required
def class_edit(id):
    subject = request.form.get('subject', '').strip()
    grade_level = request.form.get('grade_level', '').strip()
    class_number = request.form.get('class_number', '').strip()
    day_schedule = request.form.get('day_schedule', '').strip()
    db = get_db()
    # 담당자 권한 체크
    allowed = get_user_classes(db)
    if allowed is not None and int(id) not in allowed:
        db.close()
        return redirect(url_for('my_students'))
    if subject and grade_level and class_number:
        name = f"{subject} {grade_level} {class_number}"
        db.execute('UPDATE class SET name=?, subject=?, grade_level=?, class_number=?, day_schedule=? WHERE id=?',
                   (name, subject, grade_level, class_number, day_schedule, id))
    else:
        db.execute('UPDATE class SET day_schedule = ? WHERE id = ?', (day_schedule, id))
    db.commit()
    db.close()
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


@app.route('/class/delete/<int:id>', methods=['POST'])
@admin_required
def class_delete(id):
    db = get_db()
    db.execute('UPDATE student SET class_id = NULL WHERE class_id = ?', (id,))
    db.execute('DELETE FROM class WHERE id = ?', (id,))
    db.commit()
    db.close()
    return redirect(url_for('manage'))


@app.route('/student/add', methods=['POST'])
@login_required
def student_add():
    name = request.form.get('name', '').strip()
    branch_id = request.form.get('branch_id')
    class_id = request.form.get('class_id')
    change_type = request.form.get('change_type', 'new').strip()
    
    if name and class_id and branch_id:
        db = get_db()
        allowed = get_user_classes(db)
        if allowed is not None and int(class_id) not in allowed:
            db.close()
            return redirect(url_for('my_students'))
            
        cursor = db.execute('INSERT INTO student (name, class_id, branch_id, status) VALUES (?, ?, ?, ?)',
                   (name, class_id, branch_id, 'active'))
        student_id = cursor.lastrowid
        
        # change_type: 'new' = 단순추가, 'register' = 신규등록(결산반영), 're_register' = 재등록(결산반영)
        log_type = change_type if change_type in ('register', 're_register') else 'new'
        db.execute('INSERT INTO student_change_log (student_id, change_type, change_date) VALUES (?, ?, ?)',
                   (student_id, log_type, date.today().isoformat()))
        db.commit()
        db.close()
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


@app.route('/student/edit/<int:id>', methods=['POST'])
@login_required
def student_edit(id):
    name = request.form.get('name', '').strip()
    class_id = request.form.get('class_id')
    branch_id = request.form.get('branch_id')
    if name:
        db = get_db()
        allowed = get_user_classes(db)
        student = db.execute('SELECT * FROM student WHERE id = ?', (id,)).fetchone()
        if allowed is not None and student and student['class_id'] not in allowed:
            db.close()
            return redirect(url_for('my_students'))
        db.execute('UPDATE student SET name = ?, class_id = ?, branch_id = ? WHERE id = ?',
                   (name, class_id, branch_id, id))
        db.commit()
        db.close()
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


@app.route('/student/delete/<int:id>', methods=['POST'])
@login_required
def student_delete(id):
    db = get_db()
    allowed = get_user_classes(db)
    student = db.execute('SELECT * FROM student WHERE id = ?', (id,)).fetchone()
    if allowed is not None and student and student['class_id'] not in allowed:
        db.close()
        return redirect(url_for('my_students'))
    db.execute('INSERT INTO student_change_log (student_id, change_type, change_date) VALUES (?, ?, ?)',
               (id, 'delete', date.today().isoformat()))
    db.execute('DELETE FROM student WHERE id = ?', (id,))
    db.commit()
    db.close()
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


@app.route('/student/leave/<int:id>', methods=['POST'])
@login_required
def student_leave(id):
    """학생 휴원 처리"""
    db = get_db()
    allowed = get_user_classes(db)
    student = db.execute('SELECT * FROM student WHERE id = ?', (id,)).fetchone()
    if not student:
        db.close()
        return redirect(url_for('index'))
    if allowed is not None and student['class_id'] not in allowed:
        db.close()
        return redirect(url_for('my_students'))
    db.execute('UPDATE student SET status = ? WHERE id = ?', ('on_leave', id))
    db.execute('INSERT INTO student_change_log (student_id, change_type, change_date) VALUES (?, ?, ?)',
               (id, 'leave', date.today().isoformat()))
    db.commit()
    db.close()
    flash(f'{student["name"]} 학생이 휴원 처리되었습니다.')
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


@app.route('/student/reregister/<int:id>', methods=['POST'])
@login_required
def student_reregister(id):
    """휴원 학생 재등록 처리"""
    db = get_db()
    allowed = get_user_classes(db)
    student = db.execute('SELECT * FROM student WHERE id = ?', (id,)).fetchone()
    if not student:
        db.close()
        return redirect(url_for('index'))
    if allowed is not None and student['class_id'] not in allowed:
        db.close()
        return redirect(url_for('my_students'))
    db.execute('UPDATE student SET status = ? WHERE id = ?', ('active', id))
    db.execute('INSERT INTO student_change_log (student_id, change_type, change_date) VALUES (?, ?, ?)',
               (id, 're_register', date.today().isoformat()))
    db.commit()
    db.close()
    flash(f'{student["name"]} 학생이 재등록 처리되었습니다.')
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


# ─── 변경이력 관리 (관리자) ───
@app.route('/student/change-log/<int:student_id>')
@login_required
def student_change_log(student_id):
    db = get_db()
    logs = db.execute('''
        SELECT student_change_log.*, student.name as student_name
        FROM student_change_log
        JOIN student ON student_change_log.student_id = student.id
        WHERE student_id = ?
        ORDER BY change_date DESC, created_at DESC
    ''', (student_id,)).fetchall()
    student = db.execute('SELECT * FROM student WHERE id = ?', (student_id,)).fetchone()
    db.close()
    return jsonify([dict(l) for l in logs])


@app.route('/student/change-log/delete/<int:id>', methods=['POST'])
@admin_required
def change_log_delete(id):
    db = get_db()
    db.execute('DELETE FROM student_change_log WHERE id = ?', (id,))
    db.commit()
    db.close()
    flash('변경이력이 삭제되었습니다.')
    return redirect(request.referrer or url_for('index'))


@app.route('/student/change-log/edit/<int:id>', methods=['POST'])
@admin_required
def change_log_edit(id):
    change_type = request.form.get('change_type', '').strip()
    change_date = request.form.get('change_date', '').strip()
    notes = request.form.get('notes', '').strip()
    if change_type and change_date:
        db = get_db()
        db.execute('UPDATE student_change_log SET change_type=?, change_date=?, notes=? WHERE id=?',
                   (change_type, change_date, notes, id))
        db.commit()
        db.close()
        flash('변경이력이 수정되었습니다.')
    return redirect(request.referrer or url_for('index'))


@app.route('/student/change-log/add/<int:student_id>', methods=['POST'])
@admin_required
def change_log_add(student_id):
    change_type = request.form.get('change_type', '').strip()
    change_date = request.form.get('change_date', '').strip()
    notes = request.form.get('notes', '').strip()
    if change_type and change_date:
        db = get_db()
        db.execute('INSERT INTO student_change_log (student_id, change_type, change_date, notes) VALUES (?, ?, ?, ?)',
                   (student_id, change_type, change_date, notes))
        db.commit()
        db.close()
        flash('변경이력이 추가되었습니다.')
    return redirect(request.referrer or url_for('index'))


# ─── 담당자용 학생 관리 ───
@app.route('/my-students')
@login_required
def my_students():
    db = get_db()
    allowed = get_user_classes(db)

    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()

    if allowed is None:
        # 관리자: 전체 학생 조회
        classes = db.execute(f'''
            SELECT class.*, branch.name as branch_name
            FROM class JOIN branch ON class.branch_id = branch.id
            ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name
        ''').fetchall()
        students = db.execute(f'''
            SELECT student.*, class.name as class_name, branch.name as branch_name,
                   class.subject as class_subject, class.grade_level as class_grade_level,
                   class.class_number as class_class_number, class.day_schedule as class_day_schedule
            FROM student
            LEFT JOIN class ON student.class_id = class.id
            LEFT JOIN branch ON student.branch_id = branch.id
            ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name, student.name
        ''').fetchall()
    elif allowed:
        placeholders = ','.join('?' * len(allowed))
        classes = db.execute(f'''
            SELECT class.*, branch.name as branch_name
            FROM class JOIN branch ON class.branch_id = branch.id
            WHERE class.id IN ({placeholders})
            ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name
        ''', allowed).fetchall()
        students = db.execute(f'''
            SELECT student.*, class.name as class_name, branch.name as branch_name,
                   class.subject as class_subject, class.grade_level as class_grade_level,
                   class.class_number as class_class_number, class.day_schedule as class_day_schedule
            FROM student
            LEFT JOIN class ON student.class_id = class.id
            LEFT JOIN branch ON student.branch_id = branch.id
            WHERE student.class_id IN ({placeholders})
            ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name, student.name
        ''', allowed).fetchall()
    else:
        classes = []
        students = []

    db.close()
    return render_template('my_students.html', branches=branches, classes=classes, students=students)


# ─── 담당자 관리 (관리자 전용) ───
@app.route('/users')
@admin_required
def users():
    db = get_db()
    user_list = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall()
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
    classes = db.execute(f'''
        SELECT class.*, branch.name as branch_name
        FROM class JOIN branch ON class.branch_id = branch.id
        ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name
    ''').fetchall()

    # 각 담당자별 배정된 반 목록
    user_classes = {}
    for u in user_list:
        assigned = db.execute('''
            SELECT class.id, class.name, branch.name as branch_name
            FROM user_class
            JOIN class ON user_class.class_id = class.id
            LEFT JOIN branch ON class.branch_id = branch.id
            WHERE user_class.user_id = ?
        ''', (u['id'],)).fetchall()
        user_classes[u['id']] = assigned

    db.close()
    return render_template('users.html', users=user_list, branches=branches,
                           classes=classes, user_classes=user_classes)


@app.route('/user/add', methods=['POST'])
@admin_required
def user_add():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    name = request.form.get('name', '').strip()
    if username and password and name:
        db = get_db()
        try:
            db.execute('INSERT INTO user (username, password, role, name) VALUES (?, ?, ?, ?)',
                       (username, hash_password(password), 'teacher', name))
            db.commit()
        except Exception:
            pass
        db.close()
    return redirect(url_for('users'))


@app.route('/user/delete/<int:id>', methods=['POST'])
@admin_required
def user_delete(id):
    db = get_db()
    db.execute('DELETE FROM user WHERE id = ? AND role != ?', (id, 'admin'))
    db.commit()
    db.close()
    return redirect(url_for('users'))


@app.route('/user/assign/<int:user_id>', methods=['POST'])
@admin_required
def user_assign(user_id):
    class_id = request.form.get('class_id')
    if class_id:
        db = get_db()
        try:
            db.execute('INSERT INTO user_class (user_id, class_id) VALUES (?, ?)', (user_id, class_id))
            db.commit()
        except Exception:
            pass
        db.close()
    return redirect(url_for('users'))


@app.route('/user/unassign/<int:user_id>/<int:class_id>', methods=['POST'])
@admin_required
def user_unassign(user_id, class_id):
    db = get_db()
    db.execute('DELETE FROM user_class WHERE user_id = ? AND class_id = ?', (user_id, class_id))
    db.commit()
    db.close()
    return redirect(url_for('users'))


@app.route('/user/reset-password/<int:id>', methods=['POST'])
@admin_required
def user_reset_password(id):
    new_password = request.form.get('new_password', '')
    if new_password:
        db = get_db()
        db.execute('UPDATE user SET password = ? WHERE id = ?', (hash_password(new_password), id))
        db.commit()
        db.close()
    return redirect(url_for('users'))


@app.route('/admin/update-account', methods=['POST'])
@admin_required
def admin_update_account():
    current_password = request.form.get('current_password', '')
    new_username = request.form.get('new_username', '').strip()
    new_password = request.form.get('new_password', '')

    db = get_db()
    admin = db.execute('SELECT * FROM user WHERE id = ?', (session['user_id'],)).fetchone()

    if not admin or admin['password'] != hash_password(current_password):
        flash('현재 비밀번호가 일치하지 않습니다.')
        db.close()
        return redirect(url_for('users'))

    if new_username:
        existing = db.execute('SELECT id FROM user WHERE username = ? AND id != ?',
                              (new_username, session['user_id'])).fetchone()
        if existing:
            flash('이미 사용 중인 아이디입니다.')
            db.close()
            return redirect(url_for('users'))
        db.execute('UPDATE user SET username = ? WHERE id = ?', (new_username, session['user_id']))
        session['username'] = new_username

    if new_password:
        db.execute('UPDATE user SET password = ? WHERE id = ?',
                   (hash_password(new_password), session['user_id']))

    db.commit()
    db.close()

    if new_username or new_password:
        flash('관리자 계정이 변경되었습니다.')
    else:
        flash('변경할 내용이 없습니다.')
    return redirect(url_for('users'))


# ─── API ───
@app.route('/api/classes/<int:branch_id>')
@login_required
def api_classes(branch_id):
    db = get_db()
    allowed = get_user_classes(db)
    if allowed is None:
        classes = db.execute(f"SELECT * FROM class WHERE branch_id = ? ORDER BY {GRADE_SORT_PLAIN}, name", (branch_id,)).fetchall()
    else:
        placeholders = ','.join('?' * len(allowed)) if allowed else '0'
        classes = db.execute(
            f"SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY {GRADE_SORT_PLAIN}, name",
            [branch_id] + allowed).fetchall()
    db.close()
    return jsonify([dict(c) for c in classes])


@app.route('/api/students/<int:class_id>')
@login_required
def api_students(class_id):
    db = get_db()
    students = db.execute('SELECT * FROM student WHERE class_id = ? ORDER BY name', (class_id,)).fetchall()
    db.close()
    return jsonify([dict(s) for s in students])


# ─── 수업계획서 ───
@app.route('/lesson-plan')
@login_required
def lesson_plan():
    db = get_db()
    allowed = get_user_classes(db)
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()

    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')
    sel_date = request.args.get('date', '')

    classes = []
    plans = []

    if sel_branch:
        if allowed is None:
            classes = db.execute(f"SELECT * FROM class WHERE branch_id = ? ORDER BY {GRADE_SORT_PLAIN}, name",
                                 (sel_branch,)).fetchall()
        else:
            placeholders = ','.join('?' * len(allowed)) if allowed else '0'
            classes = db.execute(
                f"SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY {GRADE_SORT_PLAIN}, name",
                [sel_branch] + allowed).fetchall()

    if sel_class:
        if allowed is not None and int(sel_class) not in allowed:
            db.close()
            return redirect(url_for('lesson_plan'))

        query = '''
            SELECT lesson_plan.*, user.name as teacher_name, class.name as class_name
            FROM lesson_plan
            JOIN user ON lesson_plan.user_id = user.id
            JOIN class ON lesson_plan.class_id = class.id
            WHERE lesson_plan.class_id = ?
        '''
        params = [sel_class]
        if sel_date:
            query += ' AND lesson_plan.date = ?'
            params.append(sel_date)
        query += ' ORDER BY lesson_plan.date DESC'
        plans = db.execute(query, params).fetchall()

    db.close()
    return render_template('lesson_plan.html',
                           branches=branches, classes=classes, plans=plans,
                           sel_branch=sel_branch, sel_class=sel_class, sel_date=sel_date)


@app.route('/lesson-plan/add', methods=['POST'])
@login_required
def lesson_plan_add():
    class_id = request.form.get('class_id')
    plan_date = request.form.get('date', '').strip()
    content = request.form.get('content', '').strip()
    homework = request.form.get('homework', '').strip()
    branch_id = request.form.get('branch_id', '')

    if class_id and plan_date and content:
        db = get_db()
        allowed = get_user_classes(db)
        if allowed is not None and int(class_id) not in allowed:
            db.close()
            return redirect(url_for('lesson_plan'))
        db.execute('''
            INSERT INTO lesson_plan (user_id, class_id, date, content, homework)
            VALUES (?, ?, ?, ?, ?)
        ''', (session['user_id'], class_id, plan_date, content, homework))
        db.commit()
        db.close()
    return redirect(url_for('lesson_plan', branch_id=branch_id, class_id=class_id))


@app.route('/lesson-plan/edit/<int:id>', methods=['POST'])
@login_required
def lesson_plan_edit(id):
    plan_date = request.form.get('date', '').strip()
    content = request.form.get('content', '').strip()
    homework = request.form.get('homework', '').strip()
    branch_id = request.form.get('branch_id', '')
    class_id = request.form.get('class_id', '')

    if plan_date and content:
        db = get_db()
        plan = db.execute('SELECT * FROM lesson_plan WHERE id = ?', (id,)).fetchone()
        if plan:
            allowed = get_user_classes(db)
            if allowed is not None and plan['class_id'] not in allowed:
                db.close()
                return redirect(url_for('lesson_plan'))
            # 관리자이거나 본인이 작성한 계획서만 수정 가능
            if session.get('role') == 'admin' or plan['user_id'] == session['user_id']:
                db.execute('''
                    UPDATE lesson_plan SET date=?, content=?, homework=?, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                ''', (plan_date, content, homework, id))
                db.commit()
        db.close()
    return redirect(url_for('lesson_plan', branch_id=branch_id, class_id=class_id))


@app.route('/lesson-plan/delete/<int:id>', methods=['POST'])
@login_required
def lesson_plan_delete(id):
    db = get_db()
    plan = db.execute('SELECT * FROM lesson_plan WHERE id = ?', (id,)).fetchone()
    if plan:
        allowed = get_user_classes(db)
        if allowed is not None and plan['class_id'] not in allowed:
            db.close()
            return redirect(url_for('lesson_plan'))
        if session.get('role') == 'admin' or plan['user_id'] == session['user_id']:
            db.execute('DELETE FROM lesson_plan WHERE id = ?', (id,))
            db.commit()
    db.close()
    return redirect(request.referrer or url_for('lesson_plan'))


# ─── 공지 포맷 API ───
@app.route('/api/lesson-plan/notice/<int:id>')
@login_required
def lesson_plan_notice(id):
    """수업계획서에서 공지 포맷 텍스트 반환"""
    db = get_db()
    plan = db.execute('''
        SELECT lesson_plan.*, user.name as teacher_name,
               class.name as class_name, branch.name as branch_name
        FROM lesson_plan
        JOIN user ON lesson_plan.user_id = user.id
        JOIN class ON lesson_plan.class_id = class.id
        JOIN branch ON class.branch_id = branch.id
        WHERE lesson_plan.id = ?
    ''', (id,)).fetchone()
    db.close()

    if not plan:
        return jsonify({'error': 'not found'}), 404

    msg = f"[{plan['branch_name']}] {plan['class_name']} 숙제 안내\n"
    msg += f"━━━━━━━━━━━━━━━\n"
    msg += f"날짜: {plan['date']}\n"
    msg += f"담당: {plan['teacher_name']}\n\n"
    msg += f"수업내용:\n{plan['content']}\n\n"
    msg += f"숙제:\n{plan['homework']}\n"
    msg += f"━━━━━━━━━━━━━━━\n"
    msg += f"T&B Education"
    return jsonify({'message': msg})


# ─── 출석부 ───
@app.route('/attendance')
@login_required
def attendance():
    db = get_db()
    allowed = get_user_classes(db)

    # 담당자 목록
    teachers = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall()
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()

    sel_teacher = request.args.get('teacher_id', '')
    sel_date = request.args.get('date', date.today().isoformat())
    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')

    classes = []
    students = []
    records = {}

    # 담당자 선택 시 해당 담당자의 반 필터링
    teacher_class_ids = []
    if sel_teacher:
        rows = db.execute('SELECT class_id FROM user_class WHERE user_id = ?', (sel_teacher,)).fetchall()
        teacher_class_ids = [r['class_id'] for r in rows]

    if sel_branch:
        if allowed is None:
            classes = db.execute(f"SELECT * FROM class WHERE branch_id = ? ORDER BY {GRADE_SORT_PLAIN}, name",
                                 (sel_branch,)).fetchall()
        else:
            placeholders = ','.join('?' * len(allowed)) if allowed else '0'
            classes = db.execute(
                f"SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY {GRADE_SORT_PLAIN}, name",
                [sel_branch] + allowed).fetchall()

        # 담당자 필터 적용
        if sel_teacher and teacher_class_ids:
            classes = [c for c in classes if c['id'] in teacher_class_ids]

        if sel_class:
            # 담당자 권한 체크
            if allowed is not None and int(sel_class) not in allowed:
                db.close()
                return redirect(url_for('attendance'))

            students = db.execute("SELECT * FROM student WHERE class_id = ? AND status = 'active' ORDER BY name",
                                  (sel_class,)).fetchall()
            for s in students:
                row = db.execute('SELECT * FROM attendance WHERE student_id = ? AND date = ?',
                                 (s['id'], sel_date)).fetchone()
                if row:
                    records[s['id']] = dict(row)

    db.close()
    return render_template('attendance.html',
                           branches=branches, classes=classes, students=students,
                           records=records, teachers=teachers,
                           sel_date=sel_date, sel_branch=sel_branch, sel_class=sel_class,
                           sel_teacher=sel_teacher)


@app.route('/attendance/save', methods=['POST'])
@login_required
def attendance_save():
    # AJAX JSON 요청 처리
    if request.is_json:
        data = request.get_json()
        sel_date = data.get('date')
        sel_class = data.get('class_id')
        records_data = data.get('records', [])

        db = get_db()
        allowed = get_user_classes(db)
        if allowed is not None and int(sel_class) not in allowed:
            db.close()
            return jsonify({'success': False, 'message': '권한이 없습니다.'}), 403

        for r in records_data:
            sid = r['student_id']
            status = r.get('status', '정상등원')
            reason = r.get('reason', '')
            homework = r.get('homework', '완료')
            homework_action = r.get('homework_action', '')

            db.execute('''
                INSERT INTO attendance (student_id, date, status, reason, homework, homework_action)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(student_id, date)
                DO UPDATE SET status=?, reason=?, homework=?, homework_action=?, updated_at=CURRENT_TIMESTAMP
            ''', (sid, sel_date, status, reason, homework, homework_action,
                  status, reason, homework, homework_action))

        db.commit()
        db.close()
        return jsonify({'success': True, 'message': '완료되었습니다'})

    # 기존 form 요청 처리 (호환성)
    sel_date = request.form.get('date')
    sel_branch = request.form.get('branch_id')
    sel_class = request.form.get('class_id')
    student_ids = request.form.getlist('student_ids')

    db = get_db()
    allowed = get_user_classes(db)
    if allowed is not None and int(sel_class) not in allowed:
        db.close()
        return redirect(url_for('attendance'))

    for sid in student_ids:
        status = request.form.get(f'status_{sid}', '정상등원')
        reason = request.form.get(f'reason_{sid}', '')
        homework = request.form.get(f'homework_{sid}', '완료')
        homework_action = request.form.get(f'homework_action_{sid}', '')

        db.execute('''
            INSERT INTO attendance (student_id, date, status, reason, homework, homework_action)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, date)
            DO UPDATE SET status=?, reason=?, homework=?, homework_action=?, updated_at=CURRENT_TIMESTAMP
        ''', (sid, sel_date, status, reason, homework, homework_action,
              status, reason, homework, homework_action))

    db.commit()
    db.close()
    return redirect(url_for('attendance', date=sel_date, branch_id=sel_branch, class_id=sel_class))


@app.route('/attendance/delete/<int:id>', methods=['POST'])
@login_required
def attendance_delete(id):
    db = get_db()
    db.execute('DELETE FROM attendance WHERE id = ?', (id,))
    db.commit()
    db.close()
    return redirect(request.referrer or url_for('attendance'))


# ─── 통계 ───
@app.route('/statistics')
@login_required
def statistics():
    db = get_db()
    allowed = get_user_classes(db)
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
    teachers = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall() if session.get('role') == 'admin' else []

    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')
    sel_student = request.args.get('student_id', '')
    sel_year = request.args.get('year', str(date.today().year))
    sel_month = request.args.get('month', str(date.today().month))
    sel_teacher = request.args.get('teacher_id', '')

    classes = []
    students = []
    stats = None
    stat_teachers = []

    teacher_class_ids = []
    if sel_teacher:
        rows = db.execute('SELECT class_id FROM user_class WHERE user_id = ?', (sel_teacher,)).fetchall()
        teacher_class_ids = [r['class_id'] for r in rows]

    if sel_branch:
        if allowed is None:
            classes = db.execute(f"SELECT * FROM class WHERE branch_id = ? ORDER BY {GRADE_SORT_PLAIN}, name",
                                 (sel_branch,)).fetchall()
        else:
            placeholders = ','.join('?' * len(allowed)) if allowed else '0'
            classes = db.execute(
                f"SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY {GRADE_SORT_PLAIN}, name",
                [sel_branch] + allowed).fetchall()

        if sel_teacher and teacher_class_ids:
            classes = [c for c in classes if c['id'] in teacher_class_ids]

    if sel_class:
        if allowed is not None and int(sel_class) not in allowed:
            db.close()
            return redirect(url_for('statistics'))
        students = db.execute('SELECT * FROM student WHERE class_id = ? ORDER BY name',
                              (sel_class,)).fetchall()
        stat_teachers = db.execute('''
            SELECT u.name FROM user u
            JOIN user_class uc ON u.id = uc.user_id
            WHERE uc.class_id = ?
            ORDER BY u.name
        ''', (sel_class,)).fetchall()

    if sel_student and sel_year and sel_month:
        month_str = f"{sel_year}-{int(sel_month):02d}"
        records = db.execute('''
            SELECT * FROM attendance
            WHERE student_id = ? AND date LIKE ?
            ORDER BY date
        ''', (sel_student, f"{month_str}%")).fetchall()

        total = len(records)
        if total > 0:
            normal = sum(1 for r in records if r['status'] == '정상등원')
            late = sum(1 for r in records if r['status'] == '지각')
            absent = sum(1 for r in records if r['status'] == '결석')
            hw_done = sum(1 for r in records if r['homework'] == '완료')
            hw_not = sum(1 for r in records if r['homework'] == '미완료')

            weeks = {}
            for r in records:
                d = datetime.strptime(r['date'], '%Y-%m-%d')
                week_num = (d.day - 1) // 7 + 1
                if week_num not in weeks:
                    weeks[week_num] = {'total': 0, 'normal': 0, 'hw_done': 0}
                weeks[week_num]['total'] += 1
                if r['status'] == '정상등원':
                    weeks[week_num]['normal'] += 1
                if r['homework'] == '완료':
                    weeks[week_num]['hw_done'] += 1

            weekly = []
            for w in sorted(weeks.keys()):
                wk = weeks[w]
                weekly.append({
                    'week': w,
                    'attendance_rate': round(wk['normal'] / wk['total'] * 100, 1) if wk['total'] else 0,
                    'homework_rate': round(wk['hw_done'] / wk['total'] * 100, 1) if wk['total'] else 0
                })

            stats = {
                'total': total,
                'normal': normal, 'normal_pct': round(normal / total * 100, 1),
                'late': late, 'late_pct': round(late / total * 100, 1),
                'absent': absent, 'absent_pct': round(absent / total * 100, 1),
                'hw_done': hw_done, 'hw_done_pct': round(hw_done / total * 100, 1),
                'hw_not': hw_not, 'hw_not_pct': round(hw_not / total * 100, 1),
                'weekly': weekly
            }

    db.close()

    years = list(range(2024, date.today().year + 2))
    months = list(range(1, 13))

    return render_template('statistics.html',
                           branches=branches, classes=classes, students=students,
                           stats=stats, years=years, months=months,
                           sel_branch=sel_branch, sel_class=sel_class,
                           sel_student=sel_student, sel_year=sel_year, sel_month=sel_month,
                           stat_teachers=stat_teachers, teachers=teachers, sel_teacher=sel_teacher)


# ─── 학생 상세 (인적사항 + 상담보고서) ───
@app.route('/student/<int:id>')
@login_required
def student_detail(id):
    db = get_db()
    student = db.execute('''
        SELECT student.*, class.name as class_name, branch.name as branch_name,
               class.subject as class_subject, class.grade_level as class_grade_level,
               class.class_number as class_class_number, class.day_schedule as class_day_schedule
        FROM student
        LEFT JOIN class ON student.class_id = class.id
        LEFT JOIN branch ON student.branch_id = branch.id
        WHERE student.id = ?
    ''', (id,)).fetchone()
    if not student:
        db.close()
        return redirect(url_for('index'))

    allowed = get_user_classes(db)
    if allowed is not None and student['class_id'] not in allowed:
        db.close()
        return redirect(url_for('index'))

    # 관리자용: 지점/반 변경을 위한 목록
    branches = []
    classes_list = []
    if session.get('role') == 'admin':
        branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
        classes_list = db.execute(f'''
            SELECT class.*, branch.name as branch_name
            FROM class JOIN branch ON class.branch_id = branch.id
            ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name
        ''').fetchall()

    consultations = db.execute('''
        SELECT * FROM parent_consultation
        WHERE student_id = ?
        ORDER BY year DESC, month DESC
    ''', (id,)).fetchall()

    scores_raw = db.execute('''
        SELECT * FROM student_score WHERE student_id = ? AND exam_type != 'monthly_eval'
        ORDER BY year DESC, semester DESC, exam_type, mock_month
    ''', (id,)).fetchall()
    scores = [dict(s) for s in scores_raw]

    # 그래프용 (시간순 오름차순: 연도 → 학기 → 중간(1)/기말(2) 순)
    scores_chart = db.execute('''
        SELECT * FROM student_score WHERE student_id = ? AND exam_type != 'monthly_eval'
        ORDER BY year, semester,
            CASE exam_type WHEN 'midterm' THEN 1 WHEN 'final' THEN 2 WHEN 'mock' THEN 3 END,
            mock_month
    ''', (id,)).fetchall()
    scores_chart = [dict(s) for s in scores_chart]

    # 월말평가 데이터
    monthly_evals = db.execute('''
        SELECT * FROM student_score WHERE student_id = ? AND exam_type = 'monthly_eval'
        ORDER BY year DESC, mock_month DESC
    ''', (id,)).fetchall()
    monthly_evals = [dict(s) for s in monthly_evals]

    # 월말평가 그래프용 (시간순 오름차순)
    monthly_evals_chart = db.execute('''
        SELECT * FROM student_score WHERE student_id = ? AND exam_type = 'monthly_eval'
        ORDER BY year, mock_month
    ''', (id,)).fetchall()
    monthly_evals_chart = [dict(s) for s in monthly_evals_chart]

    change_logs = db.execute('''
        SELECT * FROM student_change_log WHERE student_id = ?
        ORDER BY change_date DESC, created_at DESC
    ''', (id,)).fetchall()

    # 고3 여부 확인 (반 이름에 '고3' 포함)
    is_senior = student['class_name'] and '고3' in student['class_name']

    # 형제 정보 및 선택을 위한 전체 학생 목록
    all_students = db.execute('''
        SELECT student.id, student.name, student.branch_id, branch.name as branch_name
        FROM student
        LEFT JOIN branch ON student.branch_id = branch.id
        WHERE student.status='active' AND student.id != ?
        ORDER BY student.name
    ''', (id,)).fetchall()
    sibling = None
    if 'sibling_id' in student.keys() and student['sibling_id']:
        sibling = db.execute("SELECT id, name FROM student WHERE id = ?", (student['sibling_id'],)).fetchone()

    db.close()
    return render_template('student_detail.html', student=student, consultations=consultations,
                           scores=scores, scores_chart=scores_chart,
                           monthly_evals=monthly_evals, monthly_evals_chart=monthly_evals_chart,
                           change_logs=change_logs, is_senior=is_senior,
                           now_year=date.today().year, now_month=date.today().month,
                           all_students=all_students, sibling=sibling,
                           branches=branches, classes_list=classes_list)


@app.route('/student/<int:id>/update-info', methods=['POST'])
@login_required
def student_update_info(id):
    db = get_db()
    student = db.execute('SELECT * FROM student WHERE id = ?', (id,)).fetchone()
    if not student:
        db.close()
        return redirect(url_for('index'))

    allowed = get_user_classes(db)
    if allowed is not None and student['class_id'] not in allowed:
        db.close()
        return redirect(url_for('index'))

    registration_date = request.form.get('registration_date', '')
    phone = request.form.get('phone', '').strip()
    parent_phone = request.form.get('parent_phone', '').strip()
    notes = request.form.get('notes', '').strip()

    tuition_fee_str = request.form.get('tuition_fee')
    tuition_fee = int(tuition_fee_str) if tuition_fee_str and tuition_fee_str.lstrip('-').isdigit() else 0
    book_fee_str = request.form.get('book_fee')
    book_fee = int(book_fee_str) if book_fee_str and book_fee_str.lstrip('-').isdigit() else 0
    etc_fee_str = request.form.get('etc_fee')
    etc_fee = int(etc_fee_str) if etc_fee_str and etc_fee_str.lstrip('-').isdigit() else 0
    special_fee_str = request.form.get('special_fee')
    special_fee = int(special_fee_str) if special_fee_str and special_fee_str.lstrip('-').isdigit() else 0
    discount_rate_str = request.form.get('discount_rate')
    discount_rate = int(discount_rate_str) if discount_rate_str and discount_rate_str.lstrip('-').isdigit() else 0
    sibling_id_val = request.form.get('sibling_id')
    sibling_id = int(sibling_id_val) if sibling_id_val and sibling_id_val.isdigit() else None

    class_schedule = request.form.get('class_schedule', '').strip()

    # 관리자인 경우 지점/반 변경 처리
    if session.get('role') == 'admin':
        new_branch_id = request.form.get('admin_branch_id')
        new_class_id = request.form.get('admin_class_id')
        if new_branch_id and new_class_id:
            db.execute('UPDATE student SET branch_id=?, class_id=? WHERE id=?',
                       (int(new_branch_id), int(new_class_id), id))

    db.execute('''
        UPDATE student SET registration_date=?, phone=?, parent_phone=?, notes=?,
               tuition_fee=?, book_fee=?, etc_fee=?, special_fee=?, discount_rate=?, sibling_id=?, class_schedule=?
        WHERE id=?
    ''', (registration_date, phone, parent_phone, notes,
          tuition_fee, book_fee, etc_fee, special_fee, discount_rate, sibling_id, class_schedule, id))
    db.commit()
    db.close()
    flash('인적사항이 저장되었습니다.')
    return redirect(url_for('student_detail', id=id))


@app.route('/student/<int:id>/consultation/add', methods=['POST'])
@login_required
def consultation_add(id):
    year = int(request.form.get('year'))
    month = int(request.form.get('month'))
    content = request.form.get('content', '').strip()

    if content:
        db = get_db()
        try:
            db.execute('''
                INSERT INTO parent_consultation (student_id, year, month, content)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(student_id, year, month)
                DO UPDATE SET content=?, updated_at=CURRENT_TIMESTAMP
            ''', (id, year, month, content, content))
            db.commit()
            flash('상담보고서가 저장되었습니다.')
        except Exception:
            flash('저장 중 오류가 발생했습니다.')
        db.close()
    return redirect(url_for('student_detail', id=id))


@app.route('/student/<int:student_id>/consultation/delete/<int:id>', methods=['POST'])
@login_required
def consultation_delete(student_id, id):
    db = get_db()
    db.execute('DELETE FROM parent_consultation WHERE id = ?', (id,))
    db.commit()
    db.close()
    flash('상담보고서가 삭제되었습니다.')
    return redirect(url_for('student_detail', id=student_id))


# ─── 성적 관리 ───
@app.route('/student/<int:student_id>/score/add', methods=['POST'])
@login_required
def score_add(student_id):
    year = int(request.form.get('year'))
    semester = int(request.form.get('semester'))
    exam_type = request.form.get('exam_type', '').strip()
    subject = request.form.get('subject', '수학').strip()
    expected_score = request.form.get('expected_score', '').strip()
    target_score = request.form.get('target_score', '').strip()
    actual_score = request.form.get('actual_score', '').strip()
    grade = request.form.get('grade', '').strip()
    mock_month = request.form.get('mock_month', '').strip()

    db = get_db()
    db.execute('''
        INSERT INTO student_score (student_id, year, semester, exam_type, subject,
                                   expected_score, target_score, actual_score, grade, mock_month)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (student_id, year, semester, exam_type, subject,
          float(expected_score) if expected_score else None,
          float(target_score) if target_score else None,
          float(actual_score) if actual_score else None,
          grade,
          int(mock_month) if mock_month else None))
    db.commit()
    db.close()
    flash('성적이 등록되었습니다.')
    return redirect(url_for('student_detail', id=student_id))


@app.route('/student/<int:student_id>/score/edit/<int:id>', methods=['POST'])
@login_required
def score_edit(student_id, id):
    expected_score = request.form.get('expected_score', '').strip()
    target_score = request.form.get('target_score', '').strip()
    actual_score = request.form.get('actual_score', '').strip()
    grade = request.form.get('grade', '').strip()

    db = get_db()
    db.execute('''
        UPDATE student_score SET expected_score=?, target_score=?, actual_score=?, grade=?,
               updated_at=CURRENT_TIMESTAMP WHERE id=?
    ''', (float(expected_score) if expected_score else None,
          float(target_score) if target_score else None,
          float(actual_score) if actual_score else None,
          grade, id))
    db.commit()
    db.close()
    flash('성적이 수정되었습니다.')
    return redirect(url_for('student_detail', id=student_id))


@app.route('/student/<int:student_id>/score/delete/<int:id>', methods=['POST'])
@login_required
def score_delete(student_id, id):
    db = get_db()
    db.execute('DELETE FROM student_score WHERE id = ?', (id,))
    db.commit()
    db.close()
    flash('성적이 삭제되었습니다.')
    return redirect(url_for('student_detail', id=student_id))


@app.route('/api/student/<int:student_id>/scores')
@login_required
def api_student_scores(student_id):
    """성적 데이터 JSON API (그래프용)"""
    db = get_db()
    scores = db.execute('''
        SELECT * FROM student_score WHERE student_id = ?
        ORDER BY year, semester, exam_type, mock_month
    ''', (student_id,)).fetchall()
    db.close()
    return jsonify([dict(s) for s in scores])


# ─── 보고서 센터 ───
@app.route('/reports')
@login_required
def reports():
    db = get_db()
    allowed = get_user_classes(db)
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
    teachers = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall() if session.get('role') == 'admin' else []

    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')
    sel_type = request.args.get('type', '')  # attendance, lesson, settlement, consultation
    sel_teacher = request.args.get('teacher_id', '')

    classes = []
    report_data = None

    teacher_class_ids = []
    if sel_teacher:
        rows = db.execute('SELECT class_id FROM user_class WHERE user_id = ?', (sel_teacher,)).fetchall()
        teacher_class_ids = [r['class_id'] for r in rows]

    if sel_branch:
        if allowed is None:
            classes = db.execute(f"SELECT * FROM class WHERE branch_id = ? ORDER BY {GRADE_SORT_PLAIN}, name",
                                 (sel_branch,)).fetchall()
        else:
            placeholders = ','.join('?' * len(allowed)) if allowed else '0'
            classes = db.execute(
                f"SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY {GRADE_SORT_PLAIN}, name",
                [sel_branch] + allowed).fetchall()

        if sel_teacher and teacher_class_ids:
            classes = [c for c in classes if c['id'] in teacher_class_ids]

    if sel_class and sel_type:
        if allowed is not None and int(sel_class) not in allowed:
            db.close()
            return redirect(url_for('reports'))

        sel_year = request.args.get('year', str(date.today().year))
        sel_month = request.args.get('month', str(date.today().month))

        class_info = db.execute('''
            SELECT class.*, branch.name as branch_name
            FROM class JOIN branch ON class.branch_id = branch.id
            WHERE class.id = ?
        ''', (sel_class,)).fetchone()

        if sel_type == 'attendance':
            month_str = f"{sel_year}-{int(sel_month):02d}"
            records = db.execute('''
                SELECT attendance.*, student.name as student_name
                FROM attendance
                JOIN student ON attendance.student_id = student.id
                WHERE student.class_id = ? AND attendance.date LIKE ?
                ORDER BY attendance.date, student.name
            ''', (sel_class, f"{month_str}%")).fetchall()
            report_data = {'type': 'attendance', 'records': records, 'class': class_info,
                           'year': sel_year, 'month': sel_month}

        elif sel_type == 'lesson':
            month_str = f"{sel_year}-{int(sel_month):02d}"
            plans = db.execute('''
                SELECT lesson_plan.*, user.name as teacher_name
                FROM lesson_plan
                JOIN user ON lesson_plan.user_id = user.id
                WHERE lesson_plan.class_id = ? AND lesson_plan.date LIKE ?
                ORDER BY lesson_plan.date
            ''', (sel_class, f"{month_str}%")).fetchall()
            report_data = {'type': 'lesson', 'plans': plans, 'class': class_info,
                           'year': sel_year, 'month': sel_month}

        elif sel_type == 'consultation':
            students = db.execute('''
                SELECT student.*, parent_consultation.year as c_year,
                       parent_consultation.month as c_month, parent_consultation.content as c_content
                FROM student
                LEFT JOIN parent_consultation ON student.id = parent_consultation.student_id
                    AND parent_consultation.year = ? AND parent_consultation.month = ?
                WHERE student.class_id = ?
                ORDER BY student.name
            ''', (sel_year, sel_month, sel_class)).fetchall()
            report_data = {'type': 'consultation', 'students': students, 'class': class_info,
                           'year': sel_year, 'month': sel_month}

        elif sel_type == 'settlement' and session.get('role') == 'admin':
            settlements = db.execute(f'''
                SELECT settlement.*, branch.name as branch_name,
                       class.name as class_name, user.name as teacher_name
                FROM settlement
                JOIN branch ON settlement.branch_id = branch.id
                JOIN class ON settlement.class_id = class.id
                JOIN user ON settlement.user_id = user.id
                WHERE settlement.year = ?
                ORDER BY settlement.month, branch.id, {GRADE_SORT_CLASS}, class.name
            ''', (sel_year,)).fetchall()
            report_data = {'type': 'settlement', 'settlements': settlements,
                           'year': sel_year}

    db.close()

    years = list(range(2024, date.today().year + 2))
    months = list(range(1, 13))

    return render_template('reports.html',
                           branches=branches, classes=classes,
                           report_data=report_data, years=years, months=months,
                           sel_branch=sel_branch, sel_class=sel_class,
                           sel_type=sel_type,
                           sel_year=request.args.get('year', str(date.today().year)),
                           sel_month=request.args.get('month', str(date.today().month)),
                           teachers=teachers, sel_teacher=sel_teacher)


# ─── 결산서 (관리자 전용) ───
@app.route('/settlement')
@admin_required
def settlement():
    db = get_db()
    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
    sel_year = request.args.get('year', str(date.today().year))
    sel_view = request.args.get('view', 'monthly')  # monthly, quarterly, yearly

    # 전체 결산 데이터 조회
    settlements = db.execute(f'''
        SELECT settlement.*, branch.name as branch_name, class.name as class_name, user.name as teacher_name
        FROM settlement
        JOIN branch ON settlement.branch_id = branch.id
        JOIN class ON settlement.class_id = class.id
        JOIN user ON settlement.user_id = user.id
        WHERE settlement.year = ?
        ORDER BY settlement.month, branch.id, {GRADE_SORT_CLASS}, class.name
    ''', (sel_year,)).fetchall()

    # ── 월별 통계 (담당 선생님별) ──
    teacher_monthly = {}
    branch_monthly = {}

    for s in settlements:
        tid = s['user_id']
        tname = s['teacher_name']
        bid = s['branch_id']
        bname = s['branch_name']
        m = s['month']
        end_count = s['start_count'] + s['new_count'] - s['leave_count']
        leave_rate = round(s['leave_count'] / s['start_count'] * 100, 1) if s['start_count'] > 0 else 0
        net = s['new_count'] - s['leave_count']

        # 담당 선생님별 월별
        if tid not in teacher_monthly:
            teacher_monthly[tid] = {'name': tname, 'months': {}}
        if m not in teacher_monthly[tid]['months']:
            teacher_monthly[tid]['months'][m] = {'start': 0, 'new': 0, 'leave': 0, 'end': 0, 'net': 0}
        teacher_monthly[tid]['months'][m]['start'] += s['start_count']
        teacher_monthly[tid]['months'][m]['new'] += s['new_count']
        teacher_monthly[tid]['months'][m]['leave'] += s['leave_count']
        teacher_monthly[tid]['months'][m]['end'] += end_count
        teacher_monthly[tid]['months'][m]['net'] += net

        # 지점별 월별
        if bid not in branch_monthly:
            branch_monthly[bid] = {'name': bname, 'months': {}}
        if m not in branch_monthly[bid]['months']:
            branch_monthly[bid]['months'][m] = {'start': 0, 'new': 0, 'leave': 0, 'end': 0, 'net': 0}
        branch_monthly[bid]['months'][m]['start'] += s['start_count']
        branch_monthly[bid]['months'][m]['new'] += s['new_count']
        branch_monthly[bid]['months'][m]['leave'] += s['leave_count']
        branch_monthly[bid]['months'][m]['end'] += end_count
        branch_monthly[bid]['months'][m]['net'] += net

    # ── 분기별 통계 계산 ──
    def calc_quarterly(monthly_data):
        quarterly = {}
        for m, d in monthly_data.items():
            q = (m - 1) // 3 + 1
            if q not in quarterly:
                quarterly[q] = {'start': 0, 'new': 0, 'leave': 0, 'end': 0, 'net': 0}
            quarterly[q]['start'] += d['start']
            quarterly[q]['new'] += d['new']
            quarterly[q]['leave'] += d['leave']
            quarterly[q]['end'] += d['end']
            quarterly[q]['net'] += d['net']
        return quarterly

    # ── 연간 누적 통계 계산 ──
    def calc_yearly(monthly_data):
        total = {'start': 0, 'new': 0, 'leave': 0, 'end': 0, 'net': 0}
        for d in monthly_data.values():
            total['start'] += d['start']
            total['new'] += d['new']
            total['leave'] += d['leave']
            total['end'] += d['end']
            total['net'] += d['net']
        return total

    # 휴원율 계산 함수
    def add_leave_rate(data):
        data['leave_rate'] = round(data['leave'] / data['start'] * 100, 1) if data['start'] > 0 else 0
        return data

    # 각 통계에 휴원율 추가
    for tid in teacher_monthly:
        for m in teacher_monthly[tid]['months']:
            add_leave_rate(teacher_monthly[tid]['months'][m])
        teacher_monthly[tid]['quarterly'] = {q: add_leave_rate(d) for q, d in calc_quarterly(teacher_monthly[tid]['months']).items()}
        teacher_monthly[tid]['yearly'] = add_leave_rate(calc_yearly(teacher_monthly[tid]['months']))

    for bid in branch_monthly:
        for m in branch_monthly[bid]['months']:
            add_leave_rate(branch_monthly[bid]['months'][m])
        branch_monthly[bid]['quarterly'] = {q: add_leave_rate(d) for q, d in calc_quarterly(branch_monthly[bid]['months']).items()}
        branch_monthly[bid]['yearly'] = add_leave_rate(calc_yearly(branch_monthly[bid]['months']))

    # 입력용 데이터
    classes = db.execute(f'''
        SELECT class.*, branch.name as branch_name, branch.id as branch_id
        FROM class JOIN branch ON class.branch_id = branch.id
        ORDER BY branch.id, {GRADE_SORT_CLASS}, class.name
    ''').fetchall()

    teachers = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall()

    # ── 자동 집계: 월초/월말 인원 계산 (누적 추가 기반) ──
    # 모든 변경이력을 처음부터 가져와서 누적 계산
    import calendar
    from datetime import date as date_cls

    all_change_logs = db.execute('''
        SELECT student_change_log.*, student.class_id, student.branch_id as student_branch_id
        FROM student_change_log
        JOIN student ON student_change_log.student_id = student.id
        ORDER BY student_change_log.change_date
    ''').fetchall()

    int_year = int(sel_year)

    # 반별/월별 변경 집계 (전체 기간)
    class_month_changes = {}
    for log in all_change_logs:
        cid = log['class_id']
        if not cid:
            continue
        try:
            log_date = log['change_date']
            log_year = int(log_date.split('-')[0])
            log_month = int(log_date.split('-')[1])
        except (IndexError, ValueError):
            continue
        key = (cid, log_year, log_month)
        if key not in class_month_changes:
            class_month_changes[key] = {'new': 0, 'register': 0, 'leave': 0, 're_register': 0}
        ct = log['change_type']
        if ct in class_month_changes[key]:
            class_month_changes[key][ct] += 1

    # 반별 월초인원 = 해당 월 이전까지 누적 (new + register + re_register - leave)
    auto_settlement = []
    for c in classes:
        cid = c['id']
        for m in range(1, 13):
            # 이번 달 변경사항
            changes = class_month_changes.get((cid, int_year, m), {'new': 0, 'register': 0, 'leave': 0, 're_register': 0})
            if changes['register'] == 0 and changes['leave'] == 0 and changes['re_register'] == 0 and changes['new'] == 0:
                continue

            # 월초 = 해당 월 이전까지 누적
            cumulative = 0
            for prev_y in range(2024, int_year + 1):
                end_m = 13 if prev_y < int_year else m
                for prev_m in range(1, end_m):
                    pc = class_month_changes.get((cid, prev_y, prev_m), {'new': 0, 'register': 0, 'leave': 0, 're_register': 0})
                    cumulative += pc['new'] + pc['register'] + pc['re_register'] - pc['leave']

            start_count = cumulative
            reg = changes['register']
            rereg = changes['re_register']
            leave = changes['leave']
            net = reg + rereg - leave
            end_count = start_count + changes['new'] + net

            auto_settlement.append({
                'month': m,
                'class_id': cid,
                'branch_id': c['branch_id'],
                'grade_level': c['grade_level'] if 'grade_level' in c.keys() else '',
                'branch_name': c['branch_name'],
                'class_name': c['name'],
                'start_count': start_count,
                'register': reg,
                're_register': rereg,
                'leave': leave,
                'new_add': changes['new'],
                'net': net,
                'end_count': end_count
            })

    auto_settlement.sort(key=lambda x: (x['month'], x['branch_id'], grade_sort_key(x.get('grade_level', '')), x['class_name']))

    # ── 지점별 자동 집계 (동일 학생 이름 중복 제거) ──
    # 지점/월별로 학생 이름 기준 중복 제거 집계 (전체 기간)
    branch_month_names = {}
    for log in all_change_logs:
        bid = log['student_branch_id']
        if not bid:
            continue
        try:
            log_year = int(log['change_date'].split('-')[0])
            log_month = int(log['change_date'].split('-')[1])
        except (IndexError, ValueError):
            continue
        key = (bid, log_year, log_month)
        if key not in branch_month_names:
            branch_month_names[key] = {'new': set(), 'register': set(), 'leave': set(), 're_register': set()}
        # student_change_log has student_id, get student name via the join
        sname = str(log['student_id'])  # use student_id for uniqueness
        ct = log['change_type']
        if ct in branch_month_names[key]:
            branch_month_names[key][ct].add(sname)

    auto_branch_settlement = []
    for b in branches:
        bid = b['id']
        for m in range(1, 13):
            changes = branch_month_names.get((bid, int_year, m))
            if not changes:
                continue
            reg = len(changes['register'])
            rereg = len(changes['re_register'])
            leave = len(changes['leave'])
            new_add = len(changes['new'])
            if reg == 0 and rereg == 0 and leave == 0 and new_add == 0:
                continue

            # 월초 = 해당 월 이전까지 누적 (이름 기준 중복 제거)
            cumulative = 0
            for prev_y in range(2024, int_year + 1):
                end_m = 13 if prev_y < int_year else m
                for prev_m in range(1, end_m):
                    pc = branch_month_names.get((bid, prev_y, prev_m))
                    if pc:
                        cumulative += len(pc['new']) + len(pc['register']) + len(pc['re_register']) - len(pc['leave'])

            start_count = cumulative
            net = reg + rereg - leave
            end_count = start_count + new_add + net

            auto_branch_settlement.append({
                'month': m,
                'branch_id': b['id'],
                'branch_name': b['name'],
                'start_count': start_count,
                'register': reg,
                're_register': rereg,
                'leave': leave,
                'new_add': new_add,
                'net': net,
                'end_count': end_count
            })

    auto_branch_settlement.sort(key=lambda x: (x['month'], x['branch_id']))

    # 기존 입력된 결산 데이터 (수정용)
    existing = {}
    for s in settlements:
        existing[(s['month'], s['class_id'])] = dict(s)

    db.close()

    years = list(range(2024, date.today().year + 2))

    return render_template('settlement.html',
                           branches=branches, classes=classes, teachers=teachers,
                           teacher_monthly=teacher_monthly, branch_monthly=branch_monthly,
                           existing=existing, settlements=settlements,
                           auto_settlement=auto_settlement,
                           auto_branch_settlement=auto_branch_settlement,
                           sel_year=sel_year, sel_view=sel_view, years=years)


@app.route('/settlement/save', methods=['POST'])
@admin_required
def settlement_save():
    year = int(request.form.get('year'))
    month = int(request.form.get('month'))
    class_id = int(request.form.get('class_id'))
    branch_id = int(request.form.get('branch_id'))
    user_id = int(request.form.get('user_id'))
    start_count = int(request.form.get('start_count', 0))
    new_count = int(request.form.get('new_count', 0))
    leave_count = int(request.form.get('leave_count', 0))

    db = get_db()
    db.execute('''
        INSERT INTO settlement (year, month, branch_id, class_id, user_id, start_count, new_count, leave_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, month, class_id, user_id)
        DO UPDATE SET branch_id=?, user_id=?, start_count=?, new_count=?, leave_count=?, updated_at=CURRENT_TIMESTAMP
    ''', (year, month, branch_id, class_id, user_id, start_count, new_count, leave_count,
          branch_id, user_id, start_count, new_count, leave_count))
    db.commit()
    db.close()
    flash('결산 데이터가 저장되었습니다.')
    return redirect(url_for('settlement', year=year))


@app.route('/settlement/delete/<int:id>', methods=['POST'])
@admin_required
def settlement_delete(id):
    db = get_db()
    s = db.execute('SELECT year FROM settlement WHERE id = ?', (id,)).fetchone()
    year = s['year'] if s else date.today().year
    db.execute('DELETE FROM settlement WHERE id = ?', (id,))
    db.commit()
    db.close()
    flash('결산 데이터가 삭제되었습니다.')
    return redirect(url_for('settlement', year=year))


# ─── 원비명부 (Tuition Ledger) ───
@app.route('/tuition', methods=['GET'])
@login_required
def tuition():
    db = get_db()
    sel_year = request.args.get('year', str(date.today().year))
    sel_month = request.args.get('month', str(date.today().month))
    sel_branch = request.args.get('branch_id', '')
    search_name = request.args.get('search_name', '').strip()

    branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()

    query = '''
        SELECT s.*, b.name as branch_name, c.name as class_name,
               c.grade_level as class_grade_level
        FROM student s
        LEFT JOIN branch b ON s.branch_id = b.id
        LEFT JOIN class c ON s.class_id = c.id
        WHERE s.status = 'active'
    '''
    params = []

    if search_name:
        query += ' AND s.name LIKE ?'
        params.append(f'%{search_name}%')
    elif sel_branch:
        query += ' AND s.branch_id = ?'
        params.append(sel_branch)

    grade_sort = "CASE WHEN c.grade_level LIKE '초%' THEN 1 WHEN c.grade_level LIKE '중%' THEN 2 WHEN c.grade_level LIKE '고%' THEN 3 ELSE 4 END, c.grade_level"
    query += f' ORDER BY b.id, {grade_sort}, s.name'
    students = db.execute(query, params).fetchall()

    ledgers = {}
    total_by_branch = {}
    total_all = 0

    for s in students:
        l = db.execute('SELECT * FROM tuition_ledger WHERE student_id=? AND year=? AND month=?', (s['id'], sel_year, sel_month)).fetchone()
        if l:
            item = dict(l)
        else:
            tuition_fee = s['tuition_fee'] or 0
            book_fee = s['book_fee'] or 0
            etc_fee = s['etc_fee'] or 0
            special_fee = s['special_fee'] or 0
            discount_rate = s['discount_rate'] or 0
            total_amt = int(tuition_fee * (1 - discount_rate / 100.0)) + book_fee + etc_fee + special_fee
            item = {
                'id': None, 'student_id': s['id'], 'year': sel_year, 'month': sel_month,
                'tuition_fee': tuition_fee, 'book_fee': book_fee, 'etc_fee': etc_fee,
                'special_fee': special_fee, 'discount_rate': discount_rate, 'total_amount': total_amt,
                'is_paid': 0, 'note': ''
            }
        ledgers[s['id']] = item

        if session.get('role') == 'admin':
            if item['is_paid']:
                b_name = s['branch_name'] or '미지정'
                total_by_branch[b_name] = total_by_branch.get(b_name, 0) + item['total_amount']
                total_all += item['total_amount']

    # 같은 이름+같은 지점 학생 그룹핑 (과목별 합계 표시용)
    from collections import OrderedDict
    student_groups = OrderedDict()
    for s in students:
        group_key = (s['name'], s['branch_id'] or 0)
        if group_key not in student_groups:
            student_groups[group_key] = []
        student_groups[group_key].append(s)

    db.close()

    years = list(range(2024, date.today().year + 2))
    months = list(range(1, 13))

    return render_template('tuition.html', branches=branches, students=students, ledgers=ledgers,
                           student_groups=student_groups,
                           years=years, months=months, sel_year=sel_year, sel_month=sel_month,
                           sel_branch=sel_branch, search_name=search_name,
                           total_by_branch=total_by_branch, total_all=total_all)

@app.route('/tuition/save', methods=['POST'])
@login_required
def tuition_save():
    # AJAX JSON 요청 처리
    if request.is_json:
        data = request.get_json()
        items = data.get('items', [])
        year = data.get('year')
        month = data.get('month')

        db = get_db()
        KST = timezone(timedelta(hours=9))
        now_kst = datetime.now(KST).strftime('%Y-%m-%d')

        for item in items:
            all_sids = [item['student_id']] + item.get('extra_student_ids', [])
            is_paid = 1 if item.get('is_paid') else 0
            note = item.get('note', '').strip()

            for sid in all_sids:
                s = db.execute('SELECT tuition_fee, book_fee, etc_fee, special_fee, discount_rate FROM student WHERE id=?', (sid,)).fetchone()
                if not s:
                    continue
                tuition_fee = s['tuition_fee'] or 0
                book_fee = s['book_fee'] or 0
                etc_fee = s['etc_fee'] or 0
                special_fee = s['special_fee'] or 0
                discount_rate = s['discount_rate'] or 0
                total_amount = int(tuition_fee * (1 - discount_rate / 100.0)) + book_fee + etc_fee + special_fee

                existing = db.execute(
                    'SELECT is_paid, paid_date FROM tuition_ledger WHERE student_id=? AND year=? AND month=?',
                    (sid, year, month)).fetchone()

                if existing and existing['is_paid'] == 1 and is_paid == 1:
                    db.execute('UPDATE tuition_ledger SET note=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND year=? AND month=?',
                               (note, sid, year, month))
                elif is_paid == 0 and existing:
                    db.execute('''UPDATE tuition_ledger SET tuition_fee=?, book_fee=?, etc_fee=?, special_fee=?, discount_rate=?, total_amount=?, is_paid=0, paid_date='', note=?, updated_at=CURRENT_TIMESTAMP
                                 WHERE student_id=? AND year=? AND month=?''',
                               (tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, note, sid, year, month))
                else:
                    paid_date = now_kst if is_paid else ''
                    db.execute('''INSERT INTO tuition_ledger (student_id, year, month, tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, is_paid, paid_date, note)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                 ON CONFLICT(student_id, year, month)
                                 DO UPDATE SET tuition_fee=?, book_fee=?, etc_fee=?, special_fee=?, discount_rate=?, total_amount=?, is_paid=?, paid_date=?, note=?, updated_at=CURRENT_TIMESTAMP''',
                               (sid, year, month, tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, is_paid, paid_date, note,
                                tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, is_paid, paid_date, note))

        db.commit()
        db.close()
        return jsonify({'success': True, 'message': '완료되었습니다'})

    # 기존 form 요청 처리
    student_id = request.form.get('student_id')
    extra_ids = request.form.getlist('extra_student_ids')
    all_student_ids = [student_id] + extra_ids
    year = request.form.get('year')
    month = request.form.get('month')
    is_paid = 1 if request.form.get('is_paid') == 'on' else 0
    note = request.form.get('note', '').strip()

    db = get_db()
    KST = timezone(timedelta(hours=9))
    now_kst = datetime.now(KST).strftime('%Y-%m-%d')

    for sid in all_student_ids:
        # 각 학생(과목)별 개별 금액 조회
        s = db.execute('SELECT tuition_fee, book_fee, etc_fee, special_fee, discount_rate FROM student WHERE id=?', (sid,)).fetchone()
        if not s:
            continue
        tuition_fee = s['tuition_fee'] or 0
        book_fee = s['book_fee'] or 0
        etc_fee = s['etc_fee'] or 0
        special_fee = s['special_fee'] or 0
        discount_rate = s['discount_rate'] or 0
        total_amount = int(tuition_fee * (1 - discount_rate / 100.0)) + book_fee + etc_fee + special_fee

        existing = db.execute(
            'SELECT is_paid, paid_date FROM tuition_ledger WHERE student_id=? AND year=? AND month=?',
            (sid, year, month)).fetchone()

        if existing and existing['is_paid'] == 1 and is_paid == 1:
            db.execute('''
                UPDATE tuition_ledger SET note=?, updated_at=CURRENT_TIMESTAMP
                WHERE student_id=? AND year=? AND month=?
            ''', (note, sid, year, month))
        elif is_paid == 0 and existing:
            db.execute('''
                UPDATE tuition_ledger SET tuition_fee=?, book_fee=?, etc_fee=?, special_fee=?, discount_rate=?, total_amount=?, is_paid=0, paid_date='', note=?, updated_at=CURRENT_TIMESTAMP
                WHERE student_id=? AND year=? AND month=?
            ''', (tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, note, sid, year, month))
        else:
            paid_date = now_kst if is_paid else ''
            db.execute('''
                INSERT INTO tuition_ledger (student_id, year, month, tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, is_paid, paid_date, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(student_id, year, month)
                DO UPDATE SET tuition_fee=?, book_fee=?, etc_fee=?, special_fee=?, discount_rate=?, total_amount=?, is_paid=?, paid_date=?, note=?, updated_at=CURRENT_TIMESTAMP
            ''', (sid, year, month, tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, is_paid, paid_date, note,
                  tuition_fee, book_fee, etc_fee, special_fee, discount_rate, total_amount, is_paid, paid_date, note))

    db.commit()
    db.close()
    
    search_name = request.form.get('search_name', '')
    branch_id = request.form.get('branch_id', '')
    flash('원비 명부가 업데이트 되었습니다.')
    return redirect(url_for('tuition', year=year, month=month, search_name=search_name, branch_id=branch_id))

# ─── 사용 가이드 ───
@app.route('/guide')
@login_required
def guide():
    if session.get('role') == 'admin':
        return render_template('guide_admin.html')
    return render_template('guide_teacher.html')


# ─── 교육과정 관리 ───
@app.route('/curriculum')
@login_required
def curriculum():
    db = get_db()
    items = db.execute(f'''
        SELECT c.*, u.name as creator_name FROM curriculum c
        LEFT JOIN user u ON c.user_id = u.id
        ORDER BY c.subject, {GRADE_SORT_CURR}, c.unit_major, c.unit_minor
    ''').fetchall()
    db.close()
    return render_template('curriculum.html', items=items)


@app.route('/curriculum/add', methods=['POST'])
@login_required
def curriculum_add():
    subject = request.form.get('subject', '').strip()
    grade = request.form.get('grade', '').strip()
    unit_major = request.form.get('unit_major', '').strip()
    unit_minor = request.form.get('unit_minor', '').strip()
    if subject and grade and unit_major:
        db = get_db()
        db.execute('INSERT INTO curriculum (subject, grade, unit_major, unit_minor, user_id) VALUES (?, ?, ?, ?, ?)',
                   (subject, grade, unit_major, unit_minor, session.get('user_id')))
        db.commit()
        db.close()
        flash('교육과정이 추가되었습니다.')
    return redirect(url_for('curriculum'))


@app.route('/curriculum/delete/<int:id>', methods=['POST'])
@login_required
def curriculum_delete(id):
    db = get_db()
    item = db.execute('SELECT user_id FROM curriculum WHERE id = ?', (id,)).fetchone()
    if item is None:
        db.close()
        return redirect(url_for('curriculum'))
    # 관리자는 모두 삭제 가능, 담당자는 본인 등록건만 삭제 가능
    if session.get('role') == 'admin' or item['user_id'] == session.get('user_id'):
        db.execute('DELETE FROM curriculum WHERE id = ?', (id,))
        db.commit()
    else:
        flash('본인이 등록한 교육과정만 삭제할 수 있습니다.')
    db.close()
    return redirect(url_for('curriculum'))


@app.route('/api/curriculum')
@login_required
def api_curriculum():
    subject = request.args.get('subject', '')
    grade = request.args.get('grade', '')
    unit_major = request.args.get('unit_major', '')
    db = get_db()

    if not subject:
        subjects = db.execute('SELECT DISTINCT subject FROM curriculum ORDER BY subject').fetchall()
        db.close()
        return jsonify([r['subject'] for r in subjects])

    if not grade:
        grades = db.execute(f'SELECT DISTINCT grade FROM curriculum WHERE subject = ? ORDER BY {GRADE_SORT_CURR_PLAIN}',
                            (subject,)).fetchall()
        db.close()
        return jsonify([r['grade'] for r in grades])

    if not unit_major:
        majors = db.execute('SELECT DISTINCT unit_major FROM curriculum WHERE subject = ? AND grade = ? ORDER BY unit_major',
                            (subject, grade)).fetchall()
        db.close()
        return jsonify([r['unit_major'] for r in majors])

    minors = db.execute('SELECT DISTINCT unit_minor FROM curriculum WHERE subject = ? AND grade = ? AND unit_major = ? AND unit_minor != "" ORDER BY unit_minor',
                        (subject, grade, unit_major)).fetchall()
    db.close()
    return jsonify([r['unit_minor'] for r in minors])


# ─── 반 별 통계 ───
@app.route('/class-stats')
@login_required
def class_stats():
    import calendar as cal_mod

    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')
    sel_year = request.args.get('year', str(date.today().year))
    sel_month = request.args.get('month', str(date.today().month))
    sel_teacher = request.args.get('teacher_id', '')

    db = get_db()
    teachers = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall() if session.get('role') == 'admin' else []

    teacher_class_ids = []
    if sel_teacher:
        rows = db.execute('SELECT class_id FROM user_class WHERE user_id = ?', (sel_teacher,)).fetchall()
        teacher_class_ids = [r['class_id'] for r in rows]

    if session.get('role') == 'admin':
        branches = db.execute('SELECT * FROM branch ORDER BY id').fetchall()
    else:
        branches = db.execute('''
            SELECT DISTINCT b.* FROM branch b
            JOIN class c ON c.branch_id = b.id
            JOIN user_class uc ON uc.class_id = c.id
            WHERE uc.user_id = ?
            ORDER BY b.name
        ''', (session['user_id'],)).fetchall()

    classes = []
    if sel_branch:
        if session.get('role') == 'admin':
            classes = db.execute(f'''
                SELECT class.*, branch.name as branch_name
                FROM class JOIN branch ON class.branch_id = branch.id
                WHERE class.branch_id = ? ORDER BY {GRADE_SORT_CLASS}, class.name
            ''', (sel_branch,)).fetchall()
        else:
            classes = db.execute(f'''
                SELECT class.*, branch.name as branch_name
                FROM class JOIN branch ON class.branch_id = branch.id
                JOIN user_class uc ON uc.class_id = class.id
                WHERE class.branch_id = ? AND uc.user_id = ?
                ORDER BY {GRADE_SORT_CLASS}, class.name
            ''', (sel_branch, session['user_id'])).fetchall()

        if sel_teacher and teacher_class_ids:
            classes = [c for c in classes if c['id'] in teacher_class_ids]

    daily_data = {}
    students = []
    class_teachers = []
    if sel_class:
        # 해당 반 담당자 조회
        class_teachers = db.execute('''
            SELECT u.name FROM user u
            JOIN user_class uc ON u.id = uc.user_id
            WHERE uc.class_id = ?
            ORDER BY u.name
        ''', (sel_class,)).fetchall()

        year_int = int(sel_year)
        month_int = int(sel_month)
        days_in_month = cal_mod.monthrange(year_int, month_int)[1]

        students = db.execute('''
            SELECT id, name FROM student
            WHERE class_id = ? AND status = 'active'
            ORDER BY name
        ''', (sel_class,)).fetchall()

        for day in range(1, days_in_month + 1):
            d = f"{year_int}-{month_int:02d}-{day:02d}"

            att = db.execute('''
                SELECT a.status FROM attendance a
                JOIN student s ON a.student_id = s.id
                WHERE s.class_id = ? AND a.date = ? AND s.status = 'active'
            ''', (sel_class, d)).fetchall()

            plan = db.execute('''
                SELECT lp.content, lp.homework, u.name as teacher_name
                FROM lesson_plan lp
                JOIN user u ON lp.user_id = u.id
                WHERE lp.class_id = ? AND lp.date = ?
            ''', (sel_class, d)).fetchall()

            if att or plan:
                total = len(att)
                present = sum(1 for a in att if a['status'] == '정상등원')
                late = sum(1 for a in att if a['status'] == '지각')
                absent = sum(1 for a in att if a['status'] == '결석')

                plan_contents = []
                plan_homeworks = []
                for p in plan:
                    if p['content']:
                        plan_contents.append(p['content'])
                    if p['homework']:
                        plan_homeworks.append(p['homework'])

                daily_data[day] = {
                    'total': total,
                    'present': present,
                    'late': late,
                    'absent': absent,
                    'content': '\n'.join(plan_contents),
                    'homework': '\n'.join(plan_homeworks),
                }

    db.close()

    years = list(range(2024, date.today().year + 2))
    months = list(range(1, 13))

    cal = cal_mod.Calendar(firstweekday=6)
    month_days = cal.monthdayscalendar(int(sel_year), int(sel_month))

    return render_template('class_stats.html',
                           branches=branches, classes=classes,
                           sel_branch=sel_branch, sel_class=sel_class,
                           sel_year=sel_year, sel_month=sel_month,
                           years=years, months=months,
                           daily_data=daily_data, month_days=month_days,
                           students=students, class_teachers=class_teachers,
                           teachers=teachers, sel_teacher=sel_teacher)


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
