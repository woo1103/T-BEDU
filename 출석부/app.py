from flask import Flask, render_template, request, redirect, url_for, jsonify, session, g
from models import get_db, init_db, hash_password
from datetime import datetime, date
from functools import wraps

app = Flask(__name__)
app.secret_key = 'tnbedu-attendance-secret-key-2026'


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
    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()
    classes = db.execute('''
        SELECT class.*, branch.name as branch_name
        FROM class JOIN branch ON class.branch_id = branch.id
        ORDER BY branch.name, class.name
    ''').fetchall()
    students = db.execute('''
        SELECT student.*, class.name as class_name, branch.name as branch_name
        FROM student
        LEFT JOIN class ON student.class_id = class.id
        LEFT JOIN branch ON student.branch_id = branch.id
        ORDER BY branch.name, class.name, student.name
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
    name = request.form.get('name', '').strip()
    branch_id = request.form.get('branch_id')
    if name and branch_id:
        db = get_db()
        db.execute('INSERT INTO class (name, branch_id) VALUES (?, ?)', (name, branch_id))
        db.commit()
        db.close()
    return redirect(url_for('manage'))


@app.route('/class/edit/<int:id>', methods=['POST'])
@admin_required
def class_edit(id):
    name = request.form.get('name', '').strip()
    branch_id = request.form.get('branch_id')
    if name:
        db = get_db()
        db.execute('UPDATE class SET name = ?, branch_id = ? WHERE id = ?', (name, branch_id, id))
        db.commit()
        db.close()
    return redirect(url_for('manage'))


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
    class_id = request.form.get('class_id')
    branch_id = request.form.get('branch_id')
    if name and class_id and branch_id:
        db = get_db()
        allowed = get_user_classes(db)
        if allowed is not None and int(class_id) not in allowed:
            db.close()
            return redirect(url_for('my_students'))
        db.execute('INSERT INTO student (name, class_id, branch_id) VALUES (?, ?, ?)',
                   (name, class_id, branch_id))
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
    db.execute('DELETE FROM student WHERE id = ?', (id,))
    db.commit()
    db.close()
    if session.get('role') == 'admin':
        return redirect(url_for('manage'))
    return redirect(url_for('my_students'))


# ─── 담당자용 학생 관리 ───
@app.route('/my-students')
@login_required
def my_students():
    db = get_db()
    allowed = get_user_classes(db)
    if allowed is None:
        return redirect(url_for('manage'))

    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()

    if allowed:
        placeholders = ','.join('?' * len(allowed))
        classes = db.execute(f'''
            SELECT class.*, branch.name as branch_name
            FROM class JOIN branch ON class.branch_id = branch.id
            WHERE class.id IN ({placeholders})
            ORDER BY branch.name, class.name
        ''', allowed).fetchall()
        students = db.execute(f'''
            SELECT student.*, class.name as class_name, branch.name as branch_name
            FROM student
            LEFT JOIN class ON student.class_id = class.id
            LEFT JOIN branch ON student.branch_id = branch.id
            WHERE student.class_id IN ({placeholders})
            ORDER BY class.name, student.name
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
    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()
    classes = db.execute('''
        SELECT class.*, branch.name as branch_name
        FROM class JOIN branch ON class.branch_id = branch.id
        ORDER BY branch.name, class.name
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


# ─── API ───
@app.route('/api/classes/<int:branch_id>')
@login_required
def api_classes(branch_id):
    db = get_db()
    allowed = get_user_classes(db)
    if allowed is None:
        classes = db.execute('SELECT * FROM class WHERE branch_id = ? ORDER BY name', (branch_id,)).fetchall()
    else:
        placeholders = ','.join('?' * len(allowed)) if allowed else '0'
        classes = db.execute(
            f'SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY name',
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


# ─── 출석부 ───
@app.route('/attendance')
@login_required
def attendance():
    db = get_db()
    allowed = get_user_classes(db)
    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()

    sel_date = request.args.get('date', date.today().isoformat())
    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')

    classes = []
    students = []
    records = {}

    if sel_branch:
        if allowed is None:
            classes = db.execute('SELECT * FROM class WHERE branch_id = ? ORDER BY name',
                                 (sel_branch,)).fetchall()
        else:
            placeholders = ','.join('?' * len(allowed)) if allowed else '0'
            classes = db.execute(
                f'SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY name',
                [sel_branch] + allowed).fetchall()

        if sel_class:
            # 담당자 권한 체크
            if allowed is not None and int(sel_class) not in allowed:
                db.close()
                return redirect(url_for('attendance'))

            students = db.execute('SELECT * FROM student WHERE class_id = ? ORDER BY name',
                                  (sel_class,)).fetchall()
            for s in students:
                row = db.execute('SELECT * FROM attendance WHERE student_id = ? AND date = ?',
                                 (s['id'], sel_date)).fetchone()
                if row:
                    records[s['id']] = dict(row)

    db.close()
    return render_template('attendance.html',
                           branches=branches, classes=classes, students=students,
                           records=records,
                           sel_date=sel_date, sel_branch=sel_branch, sel_class=sel_class)


@app.route('/attendance/save', methods=['POST'])
@login_required
def attendance_save():
    sel_date = request.form.get('date')
    sel_branch = request.form.get('branch_id')
    sel_class = request.form.get('class_id')
    student_ids = request.form.getlist('student_ids')

    # 담당자 권한 체크
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
    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()

    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')
    sel_student = request.args.get('student_id', '')
    sel_year = request.args.get('year', str(date.today().year))
    sel_month = request.args.get('month', str(date.today().month))

    classes = []
    students = []
    stats = None

    if sel_branch:
        if allowed is None:
            classes = db.execute('SELECT * FROM class WHERE branch_id = ? ORDER BY name',
                                 (sel_branch,)).fetchall()
        else:
            placeholders = ','.join('?' * len(allowed)) if allowed else '0'
            classes = db.execute(
                f'SELECT * FROM class WHERE branch_id = ? AND id IN ({placeholders}) ORDER BY name',
                [sel_branch] + allowed).fetchall()

    if sel_class:
        if allowed is not None and int(sel_class) not in allowed:
            db.close()
            return redirect(url_for('statistics'))
        students = db.execute('SELECT * FROM student WHERE class_id = ? ORDER BY name',
                              (sel_class,)).fetchall()

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
                           sel_student=sel_student, sel_year=sel_year, sel_month=sel_month)


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
