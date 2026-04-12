# Study Syllabus Tracker

A highly responsive, clean CRUD application for tracking topics to study. 

## Tech Stack
- **Frontend / UI**: Vanilla HTML, CSS (Glassmorphism design), JavaScript
- **Backend / API**: Python (Flask)
- **Database**: SQLite (No installation required)

## Features
- Add new topics you wish to study.
- Track their progress: `Not Started`, `In Progress`, or `Mastered`.
- Delete completed or irrelevant topics at any time.
- Completely responsive layout equipped with smooth transitions and status-color toggling.

---

## Running Locally

Because the API and Frontend have been consolidated into a single Flask application, running this locally on your own machine is extremely straightforward.

### Step 1: Clone the Repository
Open your terminal (Command Prompt, PowerShell, or Bash) and clone the repository to your local machine:
```bash
git clone https://github.com/AvugaddiGirish/SyllabusTracker.git
cd SyllabusTracker/backend
```

### Step 2: Create a Virtual Environment (Optional but Recommended)
It is always good practice to install Python packages in an isolated environment.
```bash
python -m venv venv

# If using Windows:
venv\Scripts\activate

# If using Mac/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies
Install Flask, Gunicorn, and other required packages via pip:
```bash
pip install -r requirements.txt
```

### Step 4: Run the Application
Start the Flask server.
```bash
python app.py
```
*Note: SQLite will automatically generate a `syllabus.db` file the first time the application runs.*

### Step 5: View the Application
Open any web browser and navigate directly to:
**[http://localhost:5000](http://localhost:5000)**

You should now see the Syllabus Tracker UI and can begin adding topics!

## Deployment

To deploy this publicly, you can host the repository on [Render](https://render.com). Simply link this repository as a new `Web Service` using Python 3, configuring the start command as `gunicorn -w 4 -b 0.0.0.0:$PORT --chdir backend app:app`, and mounting a persistent disk to `/opt/render/project/src/backend` so your SQLite data is saved permanently.
