# Study Syllabus Tracker

A full-stack CRUD application for tracking topics to study. 

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Backend**: Python (Flask)
- **Database**: SQLite

## Features
- Add new topics to study.
- Track their progress: `Not Started`, `In Progress`, or `Mastered`.
- Delete completed or irrelevant topics.
- Completely responsive layout with smooth transitions.

## Running Locally

1. **Backend Setup**
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install flask flask-cors
python app.py
```
The server will run on port 5000 and automatically generate an SQLite database.

2. **Frontend Setup**
Open `frontend/index.html` directly in your browser or run a simple local server:
```bash
cd frontend
python -m http.server 8000
```
Then navigate to `http://localhost:8000`.
