import sqlite3

DATABASE_URL = 'syllabus.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'Not Started'
        )
    ''')
    conn.commit()
    conn.close()

# Initialize DB on module load
init_db()
