from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_db_connection

app = Flask(__name__)
CORS(app)  # Allow all domains for local development

@app.route('/api/topics', methods=['GET'])
def get_topics():
    conn = get_db_connection()
    topics = conn.execute('SELECT * FROM topics ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(topic) for topic in topics])

@app.route('/api/topics', methods=['POST'])
def add_topic():
    data = request.get_json()
    title = data.get('title')
    status = data.get('status', 'Not Started')
    
    if not title:
        return jsonify({"error": "Title is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO topics (title, status) VALUES (?, ?)', (title, status))
    conn.commit()
    topic_id = cursor.lastrowid
    conn.close()
    
    return jsonify({"id": topic_id, "title": title, "status": status}), 201

@app.route('/api/topics/<int:topic_id>', methods=['PUT'])
def update_topic(topic_id):
    data = request.get_json()
    conn = get_db_connection()
    
    topic = conn.execute('SELECT * FROM topics WHERE id = ?', (topic_id,)).fetchone()
    if not topic:
        conn.close()
        return jsonify({"error": "Topic not found"}), 404

    new_title = data.get('title', topic['title'])
    new_status = data.get('status', topic['status'])
    
    conn.execute('UPDATE topics SET title = ?, status = ? WHERE id = ?', 
                 (new_title, new_status, topic_id))
    conn.commit()
    conn.close()

    return jsonify({"id": topic_id, "title": new_title, "status": new_status})

@app.route('/api/topics/<int:topic_id>', methods=['DELETE'])
def delete_topic(topic_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM topics WHERE id = ?', (topic_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Deleted successfully"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
