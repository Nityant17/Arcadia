from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import UserStreakResponse
from routers.auth import get_current_user
from services.streak_service import get_user_streak

router = APIRouter()


@router.get("/user/streak", response_model=UserStreakResponse)
async def user_streak(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    streak = get_user_streak(db, current_user.id)
    return UserStreakResponse(streak=streak)
