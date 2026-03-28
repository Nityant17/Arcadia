"""
Whiteboard Router — Azure GPT-4o vision hint generation.
"""
import base64

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from config import (
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_VISION_DEPLOYMENT,
)
from models.database import User
from routers.auth import get_current_user
from services.safety_service import safety_service

router = APIRouter()


class WhiteboardHintRequest(BaseModel):
    image_base64: str = ""
    question: str = ""
    topic: str = ""
    rough_work_text: str = ""


def _extract_text_content(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        merged = "".join(
            str(item.get("text", ""))
            for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        )
        return merged.strip()
    return ""


def _prepare_image_payload(image_payload: str) -> tuple[str, str]:
    payload = (image_payload or "").strip()
    if not payload:
        return "", ""

    if payload.startswith("data:image/"):
        if "," not in payload:
            raise HTTPException(400, "Invalid data URL image format")
        _, encoded = payload.split(",", 1)
        encoded = encoded.strip()
        if not encoded:
            raise HTTPException(400, "Image payload is empty")
        return payload, encoded

    encoded = payload
    return f"data:image/png;base64,{encoded}", encoded


def _azure_vision_url() -> str:
    deployment = (AZURE_OPENAI_VISION_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT or "").strip()
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY or not deployment:
        raise HTTPException(
            503,
            "Azure Vision is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, and AZURE_OPENAI_VISION_DEPLOYMENT.",
        )
    return (
        f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/"
        f"{deployment}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
    )


async def _azure_vision_chat(messages: list[dict], *, max_tokens: int = 900, temperature: float = 0.3) -> str:
    headers = {"Content-Type": "application/json", "api-key": AZURE_OPENAI_KEY}
    payload = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(_azure_vision_url(), headers=headers, json=payload)

    if response.status_code >= 400:
        raise HTTPException(500, f"Azure AI error ({response.status_code}): {response.text[:500]}")

    body = response.json()
    message = body.get("choices", [{}])[0].get("message", {})
    text = _extract_text_content(message.get("content"))
    if not text:
        raise HTTPException(500, "Azure AI returned an empty response")
    return text


@router.post("/whiteboard/hint")
async def whiteboard_hint(
    request: WhiteboardHintRequest,
    _current_user: User = Depends(get_current_user),
):
    image_data_url, encoded_image = _prepare_image_payload(request.image_base64)
    manual_work = (request.rough_work_text or "").strip()

    if not image_data_url and not manual_work:
        raise HTTPException(400, "Provide a rough-work image or typed rough work")

    if encoded_image:
        try:
            base64.b64decode(encoded_image, validate=True)
        except Exception:
            raise HTTPException(400, "Invalid image data")

    # Keep lightweight text safety checks and avoid local image model loading.
    safety = safety_service.check_text((request.question or "") + "\n" + manual_work)
    if not safety.allowed:
        raise HTTPException(400, safety.reason)

    ocr_text = ""
    if image_data_url:
        ocr_text = await _azure_vision_chat(
            [
                {
                    "role": "system",
                    "content": "You are an OCR extraction engine. Return only extracted text.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract all visible handwritten or printed text from this whiteboard image. Return only extracted text.",
                        },
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                },
            ],
            max_tokens=1200,
            temperature=0.0,
        )

    combined_safety = safety_service.check_text((request.question or "") + "\n" + manual_work + "\n" + (ocr_text or ""))
    if not combined_safety.allowed:
        raise HTTPException(400, combined_safety.reason)

    system_prompt = (
        "You are Arcadia whiteboard coach. Provide only safe educational hints. "
        "Do not provide final answers directly. Keep hints concise and step-by-step."
    )
    user_text = (
        f"Question: {request.question}\n"
        f"Topic: {request.topic}\n"
        f"Student rough work extracted via OCR:\n{ocr_text}\n\n"
        f"Student typed rough work:\n{manual_work}\n\n"
        "Give 2-4 hints based on student's work and likely mistake patterns."
    )
    user_content: list[dict] = [{"type": "text", "text": user_text}]
    if image_data_url:
        user_content.append({"type": "image_url", "image_url": {"url": image_data_url}})

    hint = await _azure_vision_chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        max_tokens=900,
        temperature=0.4,
    )
    return {"hint": hint, "ocr_text": ocr_text}
