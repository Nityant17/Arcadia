from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import AUDIO_DIR, CHROMA_DB_DIR, SQLITE_DB_PATH, UPLOAD_DIR
from models.database import init_db


def _remove_path(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        path.unlink(missing_ok=True)
        return 1
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
        return 1
    return 0


def reset_all_data(force: bool) -> None:
    if not force:
        response = input(
            "This will delete users/sessions, uploads, quiz/chat/planner data, vector memory, and cached TTS audio. Continue? [y/N]: "
        ).strip().lower()
        if response not in {"y", "yes"}:
            print("Cancelled.")
            return

    db_path = Path(SQLITE_DB_PATH)
    chroma_path = Path(CHROMA_DB_DIR)
    upload_path = Path(UPLOAD_DIR)
    audio_path = Path(AUDIO_DIR)

    removed_db = _remove_path(db_path)
    removed_chroma = _remove_path(chroma_path)
    removed_uploads = _remove_path(upload_path)

    audio_removed = 0
    if audio_path.exists():
        for audio_file in audio_path.glob("*.mp3"):
            audio_file.unlink(missing_ok=True)
            audio_removed += 1

    upload_path.mkdir(parents=True, exist_ok=True)
    chroma_path.mkdir(parents=True, exist_ok=True)
    audio_path.mkdir(parents=True, exist_ok=True)

    init_db()

    print("Reset complete.")
    print(f"- Database recreated: {'yes' if removed_db else 'fresh/new'}")
    print(f"- Chroma store removed: {'yes' if removed_chroma else 'already empty'}")
    print(f"- Upload directory reset: {'yes' if removed_uploads else 'already empty'}")
    print(f"- TTS audio files removed: {audio_removed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset Arcadia runtime data")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()
    reset_all_data(force=args.yes)
