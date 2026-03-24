"""
Whiteboard Router — OCR rough work + hint generation.
"""
import base64
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from models.database import User
from routers.auth import get_current_user

from services.ocr_service import ocr_service
from services.llm_service import llm_service
from services.safety_service import safety_service

router = APIRouter()


class WhiteboardHintRequest(BaseModel):
    image_base64: str = ""
    question: str = ""
    topic: str = ""
    rough_work_text: str = ""


@router.post("/whiteboard/hint")
async def whiteboard_hint(
    request: WhiteboardHintRequest,
    current_user: User = Depends(get_current_user),
):
    image_payload = (request.image_base64 or "").strip()
    manual_work = (request.rough_work_text or "").strip()

    if not image_payload and not manual_work:
        raise HTTPException(400, "Provide a rough-work image or typed rough work")

    ocr_text = ""
    if image_payload:
        try:
            raw = base64.b64decode(image_payload)
        except Exception:
            raise HTTPException(400, "Invalid image data")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)

        try:
            image_safety = safety_service.check_image_file(str(tmp_path))
            if not image_safety.allowed:
                raise HTTPException(400, image_safety.reason)

            ocr_text = ocr_service.extract_text(str(tmp_path))
        finally:
            tmp_path.unlink(missing_ok=True)

    safety = safety_service.check_text(
        (request.question or "") + "\n" + (ocr_text or "") + "\n" + manual_work
    )
    if not safety.allowed:
        raise HTTPException(400, safety.reason)

    system_prompt = (
        "You are Arcadia whiteboard coach. Provide only safe educational hints. "
        "Do not provide final answers directly. Keep hints concise and step-by-step."
    )
    user_prompt = (
        f"Question: {request.question}\n"
        f"Topic: {request.topic}\n"
        f"Student rough work extracted via OCR:\n{ocr_text}\n\n"
        f"Student typed rough work:\n{manual_work}\n\n"
        "Give 2-4 hints based on student's work and likely mistake patterns."
    )

    hint = await llm_service.generate(user_prompt, system_prompt, temperature=0.4)
    return {"hint": hint, "ocr_text": ocr_text}
