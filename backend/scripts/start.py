import os

from scripts.migrate import migrate

if __name__ == "__main__":
    migrate()
    os.execvp(
        "uvicorn",
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"],
    )