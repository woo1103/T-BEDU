from flask import Flask, render_template, request, redirect, url_for, jsonify, session, g, flash
from models import get_db, init_db, hash_password
from datetime import datetime, date
from functools import wraps
import requests as http_requests
import json
import os

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


# ─── 수업계획서 ───
@app.route('/lesson-plan')
@login_required
def lesson_plan():
    db = get_db()
    allowed = get_user_classes(db)
    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()

    sel_branch = request.args.get('branch_id', '')
    sel_class = request.args.get('class_id', '')
    sel_date = request.args.get('date', '')

    classes = []
    plans = []

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


# ─── 카카오 알림톡 설정 ───
KAKAO_API_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

def get_kakao_token():
    """카카오 토큰을 DB 설정에서 가져오기"""
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key = 'kakao_token'").fetchone()
    db.close()
    return row['value'] if row else None


def send_kakao_message(token, message):
    """카카오톡 메시지 전송"""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    template = {
        'object_type': 'text',
        'text': message,
        'link': {
            'web_url': '',
            'mobile_web_url': ''
        }
    }
    data = {'template_object': json.dumps(template)}
    try:
        resp = http_requests.post(KAKAO_API_URL, headers=headers, data=data, timeout=10)
        return resp.status_code == 200
    except Exception:
        return False


def format_homework_message(plan, class_name, teacher_name, branch_name):
    """숙제 알림 메시지 포맷"""
    msg = f"📚 [{branch_name}] {class_name} 숙제 안내\n"
    msg += f"━━━━━━━━━━━━━━━\n"
    msg += f"📅 날짜: {plan['date']}\n"
    msg += f"👨‍🏫 담당: {teacher_name}\n\n"
    msg += f"📖 수업내용:\n{plan['content']}\n\n"
    msg += f"✏️ 숙제:\n{plan['homework']}\n"
    msg += f"━━━━━━━━━━━━━━━\n"
    msg += f"T&B Education"
    return msg


@app.route('/kakao-settings', methods=['GET', 'POST'])
@admin_required
def kakao_settings():
    db = get_db()
    if request.method == 'POST':
        token = request.form.get('kakao_token', '').strip()
        if token:
            db.execute('''
                INSERT INTO settings (key, value) VALUES ('kakao_token', ?)
                ON CONFLICT(key) DO UPDATE SET value=?
            ''', (token, token))
            db.commit()
            flash('카카오톡 토큰이 저장되었습니다.')
    current_token = db.execute("SELECT value FROM settings WHERE key = 'kakao_token'").fetchone()
    db.close()
    return render_template('kakao_settings.html',
                           current_token=current_token['value'] if current_token else '')


@app.route('/lesson-plan/send/<int:id>', methods=['POST'])
@login_required
def lesson_plan_send(id):
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

    if not plan:
        db.close()
        flash('수업계획서를 찾을 수 없습니다.')
        return redirect(url_for('lesson_plan'))

    allowed = get_user_classes(db)
    if allowed is not None and plan['class_id'] not in allowed:
        db.close()
        return redirect(url_for('lesson_plan'))

    token = db.execute("SELECT value FROM settings WHERE key = 'kakao_token'").fetchone()
    db.close()

    if not token:
        flash('카카오톡 토큰이 설정되지 않았습니다. 관리자에게 문의하세요.')
        return redirect(request.referrer or url_for('lesson_plan'))

    message = format_homework_message(plan, plan['class_name'], plan['teacher_name'], plan['branch_name'])
    success = send_kakao_message(token['value'], message)

    if success:
        flash('숙제가 카카오톡으로 전송되었습니다!')
    else:
        flash('카카오톡 전송에 실패했습니다. 토큰을 확인해주세요.')

    return redirect(request.referrer or url_for('lesson_plan'))


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


# ─── 결산서 (관리자 전용) ───
@app.route('/settlement')
@admin_required
def settlement():
    db = get_db()
    branches = db.execute('SELECT * FROM branch ORDER BY name').fetchall()
    sel_year = request.args.get('year', str(date.today().year))
    sel_view = request.args.get('view', 'monthly')  # monthly, quarterly, yearly

    # 전체 결산 데이터 조회
    settlements = db.execute('''
        SELECT settlement.*, branch.name as branch_name, class.name as class_name, user.name as teacher_name
        FROM settlement
        JOIN branch ON settlement.branch_id = branch.id
        JOIN class ON settlement.class_id = class.id
        JOIN user ON settlement.user_id = user.id
        WHERE settlement.year = ?
        ORDER BY settlement.month, branch.name, class.name
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
    classes = db.execute('''
        SELECT class.*, branch.name as branch_name, branch.id as branch_id
        FROM class JOIN branch ON class.branch_id = branch.id
        ORDER BY branch.name, class.name
    ''').fetchall()

    teachers = db.execute("SELECT * FROM user WHERE role = 'teacher' ORDER BY name").fetchall()

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


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
