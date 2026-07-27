# TrackForge â€” Personal DSA Progress Tracker

TrackForge combines LeetCode, GeeksforGeeks, and the
[ZeroTrac problem-rating dataset](https://github.com/zerotrac/leetcode_problem_rating)
into one topic-wise checklist.

## What is included

- React + TypeScript dashboard
- FastAPI API with SQLite locally and PostgreSQL support in production
- Chrome/Edge Manifest V3 extension
- LeetCode accepted-submission sync
- GFG profile-page import and accepted-submission capture
- ZeroTrac rating import and solved badges on the original ZeroTrac website
- Pasted URL status checking
- Manual solved/unsolved overrides
- Standard and custom topics
- Manual cross-platform equivalence links

## Quick start

### 1. Start the API

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`.

### 2. Start the dashboard

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The default API URL is
`http://localhost:8000`.

### 3. Load the extension

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the `extension` folder.
4. Open the extension popup and save your API URL, personal token, and
   platform usernames.
5. Stay signed in to LeetCode and GFG in the same browser.

For GFG history import, open your GFG profile page and click
**Scan current GFG profile** in the extension. Future accepted solutions
are detected from problem pages.

## ZeroTrac

Use **Import / refresh ZeroTrac** in the dashboard. The backend downloads the
published `data.json`, upserts its problems, and preserves all personal
statuses. The extension adds solved badges to
`https://zerotrac.github.io/leetcode_problem_rating/#/`.

## Configuration

Backend settings are documented in `backend/.env.example`. For a personal
cloud deployment, set `DATABASE_URL` to a PostgreSQL connection string and set
`TRACKER_TOKEN` to a long random value. Enter the same token in the dashboard
and extension.

The platform adapters deliberately keep account passwords and cookies inside
the browser. Only problem metadata and accepted status are sent to TrackForge.

## Docker

```powershell
docker compose up --build
```

This starts the API on port 8000 and the built dashboard on port 5173.


