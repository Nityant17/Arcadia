import datetime
from sqlalchemy.orm import Session

from models.database import UserStreak


def record_daily_login(db: Session, user_id: str, completed_at: datetime.datetime | None = None) -> tuple[UserStreak, bool]:
    timestamp = completed_at or datetime.datetime.utcnow()
    today = timestamp.date()

    streak = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if not streak:
        streak = UserStreak(
            user_id=user_id,
            current_streak=1,
            longest_streak=1,
            last_completed_date=today,
        )
        db.add(streak)
        return streak, True

    if streak.last_completed_date == today:
        return streak, False

    if streak.last_completed_date == (today - datetime.timedelta(days=1)):
        streak.current_streak = (streak.current_streak or 0) + 1
    else:
        streak.current_streak = 1

    if streak.current_streak > (streak.longest_streak or 0):
        streak.longest_streak = streak.current_streak

    streak.last_completed_date = today
    return streak, True


def update_user_streak(db: Session, user_id: str, completed_at: datetime.datetime | None = None) -> UserStreak:
    streak, _ = record_daily_login(db, user_id, completed_at)
    return streak


def get_user_streak(db: Session, user_id: str) -> int:
    streak = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    return int(streak.current_streak) if streak and streak.current_streak else 0
