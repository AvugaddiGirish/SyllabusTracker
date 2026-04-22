from flask import Flask, request, jsonify, render_template, session, make_response
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection
from functools import wraps
from datetime import datetime, timedelta
import csv
import io
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'syllabus-tracker-dev-secret-key-change-in-prod')
CORS(app, supports_credentials=True)

# ──────────────────────────────────────────────
# Auth Decorator
# ──────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated

# ──────────────────────────────────────────────
# Page Routes
# ──────────────────────────────────────────────
@app.route('/')
def home():
    return render_template('index.html')

# ──────────────────────────────────────────────
# Auth API
# ──────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db_connection()
    existing = conn.execute('SELECT id FROM users WHERE email = ? OR username = ?', (email, username)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Username or email already exists"}), 409

    password_hash = generate_password_hash(password)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                   (username, email, password_hash))
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    session['user_id'] = user_id
    session['username'] = username
    return jsonify({"id": user_id, "username": username, "email": email}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({"id": user['id'], "username": user['username'], "email": user['email']})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

@app.route('/api/auth/me', methods=['GET'])
def get_me():
    if 'user_id' not in session:
        return jsonify(None), 200
    return jsonify({"id": session['user_id'], "username": session['username']})

# ──────────────────────────────────────────────
# Subjects API
# ──────────────────────────────────────────────
@app.route('/api/subjects', methods=['GET'])
@login_required
def get_subjects():
    conn = get_db_connection()
    subjects = conn.execute(
        'SELECT s.*, COUNT(t.id) as topic_count FROM subjects s LEFT JOIN topics t ON s.id = t.subject_id WHERE s.user_id = ? GROUP BY s.id ORDER BY s.sort_order, s.name',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(s) for s in subjects])

@app.route('/api/subjects', methods=['POST'])
@login_required
def add_subject():
    data = request.get_json()
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')

    if not name:
        return jsonify({"error": "Name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)',
                   (session['user_id'], name, color))
    conn.commit()
    subject_id = cursor.lastrowid
    conn.close()
    return jsonify({"id": subject_id, "name": name, "color": color, "topic_count": 0}), 201

@app.route('/api/subjects/<int:subject_id>', methods=['PUT'])
@login_required
def update_subject(subject_id):
    data = request.get_json()
    conn = get_db_connection()
    subject = conn.execute('SELECT * FROM subjects WHERE id = ? AND user_id = ?',
                           (subject_id, session['user_id'])).fetchone()
    if not subject:
        conn.close()
        return jsonify({"error": "Subject not found"}), 404

    name = data.get('name', subject['name']).strip()
    color = data.get('color', subject['color'])
    conn.execute('UPDATE subjects SET name = ?, color = ? WHERE id = ?', (name, color, subject_id))
    conn.commit()
    conn.close()
    return jsonify({"id": subject_id, "name": name, "color": color})

@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
@login_required
def delete_subject(subject_id):
    conn = get_db_connection()
    conn.execute('UPDATE topics SET subject_id = NULL WHERE subject_id = ? AND user_id = ?',
                 (subject_id, session['user_id']))
    conn.execute('DELETE FROM subjects WHERE id = ? AND user_id = ?', (subject_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Subject deleted"})

# ──────────────────────────────────────────────
# Topics API (expanded)
# ──────────────────────────────────────────────
@app.route('/api/topics', methods=['GET'])
@login_required
def get_topics():
    conn = get_db_connection()
    user_id = session['user_id']

    query = '''SELECT t.*, s.name as subject_name, s.color as subject_color
               FROM topics t
               LEFT JOIN subjects s ON t.subject_id = s.id
               WHERE t.user_id = ?'''
    params = [user_id]

    # Filtering
    subject_id = request.args.get('subject_id')
    status = request.args.get('status')
    priority = request.args.get('priority')
    tag_id = request.args.get('tag')
    search = request.args.get('search', '').strip()

    if subject_id:
        query += ' AND t.subject_id = ?'
        params.append(subject_id)
    if status:
        query += ' AND t.status = ?'
        params.append(status)
    if priority:
        query += ' AND t.priority = ?'
        params.append(priority)
    if search:
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)'
        params.extend([f'%{search}%', f'%{search}%'])
    if tag_id:
        query += ' AND t.id IN (SELECT topic_id FROM topic_tags WHERE tag_id = ?)'
        params.append(tag_id)

    query += ' ORDER BY t.sort_order, t.created_at DESC'
    topics = conn.execute(query, params).fetchall()
    result = []
    for topic in topics:
        t = dict(topic)
        # Get tags for this topic
        tags = conn.execute('''SELECT tg.id, tg.name, tg.color FROM tags tg
                              JOIN topic_tags tt ON tg.id = tt.tag_id
                              WHERE tt.topic_id = ?''', (t['id'],)).fetchall()
        t['tags'] = [dict(tag) for tag in tags]
        # Get subtasks
        subtasks = conn.execute('SELECT * FROM subtasks WHERE topic_id = ? ORDER BY sort_order', (t['id'],)).fetchall()
        t['subtasks'] = [dict(st) for st in subtasks]
        result.append(t)
    conn.close()
    return jsonify(result)

@app.route('/api/topics', methods=['POST'])
@login_required
def add_topic():
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    description = data.get('description', '')
    status = data.get('status', 'Not Started')
    priority = data.get('priority', 'Medium')
    subject_id = data.get('subject_id') or None
    deadline = data.get('deadline') or None
    tag_ids = data.get('tag_ids', [])

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''INSERT INTO topics (user_id, subject_id, title, description, status, priority, deadline)
                      VALUES (?, ?, ?, ?, ?, ?, ?)''',
                   (session['user_id'], subject_id, title, description, status, priority, deadline))
    topic_id = cursor.lastrowid

    # Add tags
    for tag_id in tag_ids:
        cursor.execute('INSERT OR IGNORE INTO topic_tags (topic_id, tag_id) VALUES (?, ?)', (topic_id, tag_id))

    conn.commit()

    # Fetch the complete topic to return
    topic = conn.execute('''SELECT t.*, s.name as subject_name, s.color as subject_color
                           FROM topics t LEFT JOIN subjects s ON t.subject_id = s.id
                           WHERE t.id = ?''', (topic_id,)).fetchone()
    t = dict(topic)
    tags = conn.execute('''SELECT tg.id, tg.name, tg.color FROM tags tg
                          JOIN topic_tags tt ON tg.id = tt.tag_id WHERE tt.topic_id = ?''', (topic_id,)).fetchall()
    t['tags'] = [dict(tag) for tag in tags]
    t['subtasks'] = []
    conn.close()
    return jsonify(t), 201

@app.route('/api/topics/<int:topic_id>', methods=['PUT'])
@login_required
def update_topic(topic_id):
    data = request.get_json()
    conn = get_db_connection()
    topic = conn.execute('SELECT * FROM topics WHERE id = ? AND user_id = ?',
                         (topic_id, session['user_id'])).fetchone()
    if not topic:
        conn.close()
        return jsonify({"error": "Topic not found"}), 404

    title = data.get('title', topic['title'])
    description = data.get('description', topic['description'])
    status = data.get('status', topic['status'])
    priority = data.get('priority', topic['priority'])
    subject_id = data.get('subject_id', topic['subject_id']) or None
    deadline = data.get('deadline', topic['deadline']) or None

    conn.execute('''UPDATE topics SET title=?, description=?, status=?, priority=?, subject_id=?, deadline=?, updated_at=CURRENT_TIMESTAMP
                    WHERE id = ?''', (title, description, status, priority, subject_id, deadline, topic_id))

    # Update tags if provided
    if 'tag_ids' in data:
        conn.execute('DELETE FROM topic_tags WHERE topic_id = ?', (topic_id,))
        for tag_id in data['tag_ids']:
            conn.execute('INSERT OR IGNORE INTO topic_tags (topic_id, tag_id) VALUES (?, ?)', (topic_id, tag_id))

    conn.commit()

    # Return full topic
    updated = conn.execute('''SELECT t.*, s.name as subject_name, s.color as subject_color
                             FROM topics t LEFT JOIN subjects s ON t.subject_id = s.id
                             WHERE t.id = ?''', (topic_id,)).fetchone()
    t = dict(updated)
    tags = conn.execute('''SELECT tg.id, tg.name, tg.color FROM tags tg
                          JOIN topic_tags tt ON tg.id = tt.tag_id WHERE tt.topic_id = ?''', (topic_id,)).fetchall()
    t['tags'] = [dict(tag) for tag in tags]
    subtasks = conn.execute('SELECT * FROM subtasks WHERE topic_id = ? ORDER BY sort_order', (topic_id,)).fetchall()
    t['subtasks'] = [dict(st) for st in subtasks]
    conn.close()
    return jsonify(t)

@app.route('/api/topics/reorder', methods=['PUT'])
@login_required
def reorder_topics():
    data = request.get_json()
    order = data.get('order', [])  # list of {id, sort_order}
    conn = get_db_connection()
    for item in order:
        conn.execute('UPDATE topics SET sort_order = ? WHERE id = ? AND user_id = ?',
                     (item['sort_order'], item['id'], session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Reorder saved"})

@app.route('/api/topics/<int:topic_id>', methods=['DELETE'])
@login_required
def delete_topic(topic_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM topics WHERE id = ? AND user_id = ?', (topic_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted successfully"})

# ──────────────────────────────────────────────
# Subtasks API
# ──────────────────────────────────────────────
@app.route('/api/topics/<int:topic_id>/subtasks', methods=['GET'])
@login_required
def get_subtasks(topic_id):
    conn = get_db_connection()
    subtasks = conn.execute('SELECT * FROM subtasks WHERE topic_id = ? ORDER BY sort_order', (topic_id,)).fetchall()
    conn.close()
    return jsonify([dict(s) for s in subtasks])

@app.route('/api/topics/<int:topic_id>/subtasks', methods=['POST'])
@login_required
def add_subtask(topic_id):
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    conn = get_db_connection()
    # Verify topic belongs to user
    topic = conn.execute('SELECT id FROM topics WHERE id = ? AND user_id = ?',
                         (topic_id, session['user_id'])).fetchone()
    if not topic:
        conn.close()
        return jsonify({"error": "Topic not found"}), 404

    cursor = conn.cursor()
    cursor.execute('INSERT INTO subtasks (topic_id, title) VALUES (?, ?)', (topic_id, title))
    conn.commit()
    subtask_id = cursor.lastrowid
    conn.close()
    return jsonify({"id": subtask_id, "topic_id": topic_id, "title": title, "completed": 0}), 201

@app.route('/api/subtasks/<int:subtask_id>', methods=['PUT'])
@login_required
def update_subtask(subtask_id):
    data = request.get_json()
    conn = get_db_connection()
    subtask = conn.execute('''SELECT s.* FROM subtasks s JOIN topics t ON s.topic_id = t.id
                             WHERE s.id = ? AND t.user_id = ?''', (subtask_id, session['user_id'])).fetchone()
    if not subtask:
        conn.close()
        return jsonify({"error": "Subtask not found"}), 404

    title = data.get('title', subtask['title'])
    completed = data.get('completed', subtask['completed'])
    conn.execute('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?', (title, completed, subtask_id))
    conn.commit()
    conn.close()
    return jsonify({"id": subtask_id, "title": title, "completed": completed})

@app.route('/api/subtasks/<int:subtask_id>', methods=['DELETE'])
@login_required
def delete_subtask(subtask_id):
    conn = get_db_connection()
    conn.execute('''DELETE FROM subtasks WHERE id = ? AND id IN
                    (SELECT s.id FROM subtasks s JOIN topics t ON s.topic_id = t.id WHERE t.user_id = ?)''',
                 (subtask_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Subtask deleted"})

# ──────────────────────────────────────────────
# Tags API
# ──────────────────────────────────────────────
@app.route('/api/tags', methods=['GET'])
@login_required
def get_tags():
    conn = get_db_connection()
    tags = conn.execute('SELECT * FROM tags WHERE user_id = ? ORDER BY name', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(t) for t in tags])

@app.route('/api/tags', methods=['POST'])
@login_required
def add_tag():
    data = request.get_json()
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')

    if not name:
        return jsonify({"error": "Name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
                   (session['user_id'], name, color))
    conn.commit()
    tag_id = cursor.lastrowid
    conn.close()
    return jsonify({"id": tag_id, "name": name, "color": color}), 201

@app.route('/api/tags/<int:tag_id>', methods=['DELETE'])
@login_required
def delete_tag(tag_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM tags WHERE id = ? AND user_id = ?', (tag_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Tag deleted"})

# ──────────────────────────────────────────────
# Analytics API
# ──────────────────────────────────────────────
@app.route('/api/analytics/progress', methods=['GET'])
@login_required
def get_progress():
    conn = get_db_connection()
    user_id = session['user_id']

    total = conn.execute('SELECT COUNT(*) as c FROM topics WHERE user_id = ?', (user_id,)).fetchone()['c']
    not_started = conn.execute("SELECT COUNT(*) as c FROM topics WHERE user_id = ? AND status = 'Not Started'", (user_id,)).fetchone()['c']
    in_progress = conn.execute("SELECT COUNT(*) as c FROM topics WHERE user_id = ? AND status = 'In Progress'", (user_id,)).fetchone()['c']
    mastered = conn.execute("SELECT COUNT(*) as c FROM topics WHERE user_id = ? AND status = 'Mastered'", (user_id,)).fetchone()['c']

    # By subject
    by_subject = conn.execute('''
        SELECT COALESCE(s.name, 'Uncategorized') as subject_name, COALESCE(s.color, '#94a3b8') as subject_color,
               COUNT(t.id) as total,
               SUM(CASE WHEN t.status = 'Mastered' THEN 1 ELSE 0 END) as mastered
        FROM topics t LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE t.user_id = ? GROUP BY t.subject_id
    ''', (user_id,)).fetchall()

    # Total study time
    total_time = conn.execute('SELECT COALESCE(SUM(duration_seconds), 0) as total FROM study_sessions WHERE user_id = ?',
                              (user_id,)).fetchone()['total']

    conn.close()
    return jsonify({
        "total": total,
        "not_started": not_started,
        "in_progress": in_progress,
        "mastered": mastered,
        "by_subject": [dict(s) for s in by_subject],
        "total_study_time_seconds": total_time
    })

@app.route('/api/analytics/streaks', methods=['GET'])
@login_required
def get_streaks():
    conn = get_db_connection()
    user_id = session['user_id']

    # Get distinct study days (dates where user logged a session)
    days = conn.execute('''SELECT DISTINCT DATE(started_at) as study_date
                          FROM study_sessions WHERE user_id = ?
                          ORDER BY study_date DESC''', (user_id,)).fetchall()
    conn.close()

    if not days:
        return jsonify({"current_streak": 0, "longest_streak": 0})

    dates = [datetime.strptime(d['study_date'], '%Y-%m-%d').date() for d in days]
    today = datetime.now().date()

    # Current streak: start from today or yesterday
    current_streak = 0
    if dates[0] == today or dates[0] == today - timedelta(days=1):
        current_streak = 1
        for i in range(1, len(dates)):
            if (dates[i-1] - dates[i]).days == 1:
                current_streak += 1
            else:
                break

    # Longest streak
    longest_streak = 1
    streak = 1
    for i in range(1, len(dates)):
        if (dates[i-1] - dates[i]).days == 1:
            streak += 1
            longest_streak = max(longest_streak, streak)
        else:
            streak = 1

    return jsonify({"current_streak": current_streak, "longest_streak": longest_streak})

# ──────────────────────────────────────────────
# Study Sessions API
# ──────────────────────────────────────────────
@app.route('/api/study-sessions', methods=['POST'])
@login_required
def add_study_session():
    data = request.get_json()
    topic_id = data.get('topic_id') or None
    duration = data.get('duration_seconds', 0)

    if duration <= 0:
        return jsonify({"error": "Duration must be positive"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO study_sessions (user_id, topic_id, duration_seconds) VALUES (?, ?, ?)',
                   (session['user_id'], topic_id, duration))

    # Also update time_spent_seconds on topic if linked
    if topic_id:
        conn.execute('UPDATE topics SET time_spent_seconds = time_spent_seconds + ? WHERE id = ?',
                     (duration, topic_id))

    conn.commit()
    session_id = cursor.lastrowid
    conn.close()
    return jsonify({"id": session_id, "duration_seconds": duration}), 201

@app.route('/api/study-sessions', methods=['GET'])
@login_required
def get_study_sessions():
    conn = get_db_connection()
    topic_id = request.args.get('topic_id')
    if topic_id:
        sessions = conn.execute('SELECT * FROM study_sessions WHERE user_id = ? AND topic_id = ? ORDER BY started_at DESC',
                                (session['user_id'], topic_id)).fetchall()
    else:
        sessions = conn.execute('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50',
                                (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(s) for s in sessions])

# ──────────────────────────────────────────────
# Export API
# ──────────────────────────────────────────────
@app.route('/api/export/csv', methods=['GET'])
@login_required
def export_csv():
    conn = get_db_connection()
    topics = conn.execute('''SELECT t.title, t.description, t.status, t.priority, t.deadline,
                            COALESCE(s.name, 'Uncategorized') as subject, t.time_spent_seconds, t.created_at
                            FROM topics t LEFT JOIN subjects s ON t.subject_id = s.id
                            WHERE t.user_id = ? ORDER BY t.sort_order, t.created_at DESC''',
                          (session['user_id'],)).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Title', 'Description', 'Status', 'Priority', 'Deadline', 'Subject', 'Time Spent (min)', 'Created'])
    for t in topics:
        writer.writerow([t['title'], t['description'], t['status'], t['priority'],
                        t['deadline'] or '', t['subject'],
                        round(t['time_spent_seconds'] / 60, 1), t['created_at']])

    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = 'attachment; filename=syllabus_export.csv'
    return response

# ──────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5000)
