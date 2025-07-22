import os
import json
import tempfile
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from pomodoro import cli, storage


def test_add_and_start_demo():
    with tempfile.TemporaryDirectory() as tmp:
        os.environ['POMODORO_DATA_FILE'] = os.path.join(tmp, 'data.json')
        args = type('obj', (object,), {'name': 'Task1', 'sessions': 2})
        cli.add_task(args)

        data = storage.load_data()
        assert len(data['tasks']) == 1
        task_id = data['tasks'][0]['id']

        start_args = type('obj', (object,), {
            'task': task_id,
            'focus': 1,
            'break_time': 1,
            'long_break': 1,
            'demo': True
        })
        cli.start(start_args)
        data = storage.load_data()
        assert data['tasks'][0].get('real_sessions', 0) >= 1
        assert data['stats']
