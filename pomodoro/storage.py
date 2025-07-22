import json
import os
from datetime import date

DATA_FILE = os.environ.get("POMODORO_DATA_FILE", os.path.expanduser("~/.pomodoro_data.json"))


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"tasks": [], "stats": {}}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def next_task_id(tasks):
    if not tasks:
        return 1
    return max(t["id"] for t in tasks) + 1


def record_session(data, task_id=None, minutes=25):
    today = str(date.today())
    data.setdefault("stats", {})
    data["stats"][today] = data["stats"].get(today, 0) + 1
    if task_id:
        for t in data.get("tasks", []):
            if t["id"] == task_id:
                t["real_sessions"] = t.get("real_sessions", 0) + 1
                t["minutes"] = t.get("minutes", 0) + minutes
                break
