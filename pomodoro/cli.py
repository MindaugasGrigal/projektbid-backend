import argparse
import time
from . import storage


def run_timer(seconds):
    for remaining in range(seconds, 0, -1):
        mins, secs = divmod(remaining, 60)
        print(f"{mins:02d}:{secs:02d}", end="\r")
        time.sleep(1)
    print()


def add_task(args):
    data = storage.load_data()
    task = {
        "id": storage.next_task_id(data["tasks"]),
        "name": args.name,
        "planned_sessions": args.sessions,
        "done": False,
    }
    data["tasks"].append(task)
    storage.save_data(data)
    print(f"Added task {task['id']}: {task['name']}")


def list_tasks(args):
    data = storage.load_data()
    if not data["tasks"]:
        print("No tasks")
        return
    for t in data["tasks"]:
        real = t.get("real_sessions", 0)
        planned = t.get("planned_sessions", 0)
        status = "done" if t.get("done") else "open"
        print(f"{t['id']}: {t['name']} [{real}/{planned}] {status}")


def done_task(args):
    data = storage.load_data()
    for t in data["tasks"]:
        if t["id"] == args.id:
            t["done"] = True
            storage.save_data(data)
            print(f"Task {args.id} marked done")
            return
    print("Task not found")


def start(args):
    data = storage.load_data()
    focus = args.focus * 60
    short_break = args.break_time * 60
    long_break = args.long_break * 60
    if args.demo:
        focus = 2
        short_break = 1
        long_break = 2
    cycles = 4
    for cycle in range(cycles):
        print(f"Focus {cycle + 1}")
        run_timer(focus)
        storage.record_session(data, args.task, args.focus)
        storage.save_data(data)
        if cycle == cycles - 1:
            break
        print("Short break")
        run_timer(short_break)
    print("Long break")
    run_timer(long_break)
    storage.save_data(data)
    print("Pomodoro session done")


def stats(args):
    data = storage.load_data()
    for day, count in sorted(data.get("stats", {}).items()):
        print(day, count)


def main():
    parser = argparse.ArgumentParser(description="Pomodoro Productivity Tool")
    sub = parser.add_subparsers(dest="cmd")

    p_add = sub.add_parser("add", help="Add task")
    p_add.add_argument("name")
    p_add.add_argument("--sessions", type=int, default=1)
    p_add.set_defaults(func=add_task)

    p_list = sub.add_parser("list", help="List tasks")
    p_list.set_defaults(func=list_tasks)

    p_done = sub.add_parser("done", help="Mark task done")
    p_done.add_argument("id", type=int)
    p_done.set_defaults(func=done_task)

    p_start = sub.add_parser("start", help="Start pomodoro session")
    p_start.add_argument("--task", type=int, help="Task id")
    p_start.add_argument("--focus", type=int, default=25)
    p_start.add_argument("--break-time", type=int, default=5)
    p_start.add_argument("--long-break", type=int, default=15)
    p_start.add_argument("--demo", action="store_true", help="Short demo mode")
    p_start.set_defaults(func=start)

    p_stats = sub.add_parser("stats", help="Show statistics")
    p_stats.set_defaults(func=stats)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
