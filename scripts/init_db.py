import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db.database import init_db


def main():
    print("Initializing database...")
    init_db()
    print("Database initialized successfully.")
    print(f"Location: {Path(__file__).resolve().parent.parent / 'data' / 'app.db'}")


if __name__ == "__main__":
    main()
