import sqlite3
import os
import hashlib

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attendance.db')


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS branch (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS class (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS student (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER,
            branch_id INTEGER,
            name TEXT NOT NULL,
            registration_date TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            parent_phone TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (class_id) REFERENCES class(id) ON DELETE SET NULL,
            FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'teacher',
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_class (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            class_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
            FOREIGN KEY (class_id) REFERENCES class(id) ON DELETE CASCADE,
            UNIQUE(user_id, class_id)
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT '정상등원',
            reason TEXT DEFAULT '',
            homework TEXT NOT NULL DEFAULT '완료',
            homework_action TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
            UNIQUE(student_id, date)
        );

        CREATE TABLE IF NOT EXISTS lesson_plan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            class_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            homework TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
            FOREIGN KEY (class_id) REFERENCES class(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS parent_consultation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
            UNIQUE(student_id, year, month)
        );

        CREATE TABLE IF NOT EXISTS settlement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            branch_id INTEGER NOT NULL,
            class_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            start_count INTEGER NOT NULL DEFAULT 0,
            new_count INTEGER NOT NULL DEFAULT 0,
            leave_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE CASCADE,
            FOREIGN KEY (class_id) REFERENCES class(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
            UNIQUE(year, month, class_id, user_id)
        );
    ''')

    conn.commit()

    # 기존 student 테이블에 컬럼 추가 (마이그레이션)
    try:
        cursor.execute("ALTER TABLE student ADD COLUMN registration_date TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE student ADD COLUMN phone TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE student ADD COLUMN parent_phone TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE student ADD COLUMN notes TEXT DEFAULT ''")
    except Exception:
        pass
    conn.commit()

    # 기본 관리자 계정 생성
    existing = conn.execute('SELECT id FROM user WHERE username = ?', ('admin',)).fetchone()
    if not existing:
        conn.execute('INSERT INTO user (username, password, role, name) VALUES (?, ?, ?, ?)',
                     ('admin', hash_password('admin1234'), 'admin', '관리자'))
        conn.commit()

    conn.close()


if __name__ == '__main__':
    init_db()
    print("DB initialized.")
