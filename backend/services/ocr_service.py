"""
OCR Service — Extract text from images (handwritten notes) and PDFs.
Local: Tesseract OCR + pdf2image
Azure: GPT-4o vision OCR for handwritten content + Azure Form Recognizer for printed content
"""
import base64
import io
import mimetypes
import re
import time
from pathlib import Path

import httpx
import pytesseract
from PIL import Image, ImageSequence
from pdf2image import convert_from_path
import PyPDF2

from config import (
    MODE,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_VISION_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_REASONING_EFFORT,
    AZURE_FORM_RECOGNIZER_ENDPOINT,
    AZURE_FORM_RECOGNIZER_KEY,
    AZURE_FORM_RECOGNIZER_MODEL,
    AZURE_FORM_RECOGNIZER_API_VERSION,
)


class OCRService:
    """Extracts text from uploaded images and PDFs."""

    def extract_text(self, file_path: str, ocr_mode: str = "auto") -> str:
        """Route to the correct extractor based on file type and OCR mode."""
        ext = Path(file_path).suffix.lower()
        normalized_mode = (ocr_mode or "auto").strip().lower()
        if normalized_mode not in {"auto", "printed", "handwritten"}:
            raise ValueError("Invalid ocr_mode. Use 'auto', 'printed', or 'handwritten'.")

        if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"):
            return self._extract_from_image(file_path, normalized_mode)
        if ext == ".pdf":
            return self._extract_from_pdf(file_path, normalized_mode)
        if ext == ".txt":
            return self._extract_from_text(file_path)
        raise ValueError(f"Unsupported file type: {ext}")

    # ─── Image OCR ────────────────────────────────────────────

    def _extract_from_image(self, file_path: str, ocr_mode: str) -> str:
        """Use GPT-4o Vision (handwritten) or Form Recognizer (printed)."""
        if MODE == "azure":
            if ocr_mode == "printed":
                print(f"[OCR] Using AZURE Form Recognizer for printed image: {file_path}")
                try:
                    return self._azure_form_recognizer_ocr(file_path)
                except Exception as e:
                    print(f"[OCR] Form Recognizer failed for image, falling back to Tesseract: {e}")
            else:
                print(f"[OCR] Using AZURE OpenAI Vision for image: {file_path}")
                try:
                    return self._azure_vision_ocr(file_path)
                except Exception as e:
                    # Keep ingestion resilient even if cloud OCR has transient issues.
                    print(f"[OCR] Azure vision OCR failed for image, falling back to Tesseract: {e}")

        print(f"[OCR] Using LOCAL Tesseract for image: {file_path}")
        with Image.open(file_path) as img:
            text = pytesseract.image_to_string(img, lang="eng+hin")
        cleaned = self._clean_text(text)
        return self._llm_cleanup(cleaned)

    # ─── PDF Extraction ───────────────────────────────────────

    def _extract_from_pdf(self, file_path: str, ocr_mode: str) -> str:
        """Try embedded text first, then OCR for scanned PDFs based on mode."""
        if ocr_mode != "handwritten":
            text = self._extract_pdf_text(file_path)
            if text and len(text.strip()) > 50:
                return self._clean_text(text)

        if MODE == "azure":
            if ocr_mode == "printed":
                print(f"[OCR] Using AZURE Form Recognizer for printed PDF: {file_path}")
                try:
                    return self._azure_form_recognizer_ocr(file_path)
                except Exception as e:
                    print(f"[OCR] Form Recognizer failed for PDF, falling back to Tesseract: {e}")
            else:
                print(f"[OCR] Using AZURE OpenAI Vision for scanned PDF: {file_path}")
                try:
                    return self._azure_vision_ocr(file_path)
                except Exception as e:
                    print(f"[OCR] Azure vision OCR failed for PDF, falling back to Tesseract: {e}")

        print(f"[OCR] Using LOCAL Tesseract for PDF OCR: {file_path}")
        cleaned = self._ocr_pdf_pages(file_path)
        return self._llm_cleanup(cleaned)

    def _extract_pdf_text(self, file_path: str) -> str:
        """Extract embedded text from a PDF."""
        text_parts = []
        try:
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
        except Exception as e:
            print(f"PDF text extraction failed: {e}")
        return self._clean_text("\n".join(text_parts))

    def _ocr_pdf_pages(self, file_path: str) -> str:
        """Convert PDF pages to images, then OCR each page."""
        try:
            images = convert_from_path(file_path, dpi=300)
        except Exception as e:
            print(f"PDF to image conversion failed: {e}")
            return ""

        text_parts = []
        for i, img in enumerate(images, start=1):
            page_text = pytesseract.image_to_string(img, lang="eng+hin")
            text_parts.append(f"--- Page {i} ---\n{page_text}")

        return self._clean_text("\n".join(text_parts))

    # ─── Plain Text ───────────────────────────────────────────

    def _extract_from_text(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return self._clean_text(f.read())

    # ─── Azure Form Recognizer OCR ────────────────────────────

    @staticmethod
    def _mime_for_file(file_path: str) -> str:
        guessed, _ = mimetypes.guess_type(file_path)
        return guessed or "application/octet-stream"

    @staticmethod
    def _extract_form_recognizer_text(result_payload: dict) -> str:
        analyze_result = result_payload.get("analyzeResult") if isinstance(result_payload, dict) else None
        payload = analyze_result if isinstance(analyze_result, dict) else result_payload

        if isinstance(payload, dict):
            direct_content = payload.get("content")
            if isinstance(direct_content, str) and direct_content.strip():
                return OCRService._clean_text(direct_content)

            pages = payload.get("pages")
            if isinstance(pages, list):
                lines: list[str] = []
                for page in pages:
                    if not isinstance(page, dict):
                        continue
                    for line in page.get("lines", []) or []:
                        if isinstance(line, dict) and isinstance(line.get("content"), str):
                            lines.append(line["content"])
                return OCRService._clean_text("\n".join(lines))

        return ""

    def _poll_form_recognizer_result(self, client: httpx.Client, operation_url: str) -> dict:
        headers = {"Ocp-Apim-Subscription-Key": AZURE_FORM_RECOGNIZER_KEY}
        for _ in range(40):
            poll_response = client.get(operation_url, headers=headers)
            poll_response.raise_for_status()
            payload = poll_response.json()
            status = str(payload.get("status", "")).lower()

            if status == "succeeded":
                return payload
            if status in {"failed", "canceled"}:
                error_payload = payload.get("error") if isinstance(payload, dict) else None
                raise RuntimeError(f"Form Recognizer OCR failed: {error_payload or payload}")

            time.sleep(1)

        raise RuntimeError("Timed out while waiting for Form Recognizer OCR result")

    def _azure_form_recognizer_ocr(self, file_path: str) -> str:
        endpoint = (AZURE_FORM_RECOGNIZER_ENDPOINT or "").strip()
        key = (AZURE_FORM_RECOGNIZER_KEY or "").strip()
        model = (AZURE_FORM_RECOGNIZER_MODEL or "prebuilt-read").strip()
        api_version = (AZURE_FORM_RECOGNIZER_API_VERSION or "2023-07-31").strip()

        if not endpoint or not key:
            raise RuntimeError(
                "Azure Form Recognizer OCR is not configured. Set AZURE_FORM_RECOGNIZER_ENDPOINT and AZURE_FORM_RECOGNIZER_KEY"
            )

        analyze_url = (
            f"{endpoint.rstrip('/')}/formrecognizer/documentModels/"
            f"{model}:analyze?api-version={api_version}"
        )
        headers = {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": self._mime_for_file(file_path),
        }

        with open(file_path, "rb") as source:
            file_bytes = source.read()

        with httpx.Client(timeout=180.0) as client:
            response = client.post(analyze_url, headers=headers, content=file_bytes)
            if response.status_code == 200:
                result_payload = response.json()
            elif response.status_code == 202:
                operation_location = response.headers.get("operation-location") or response.headers.get("Operation-Location")
                if not operation_location:
                    raise RuntimeError("Missing operation-location header from Form Recognizer response")
                result_payload = self._poll_form_recognizer_result(client, operation_location)
            else:
                raise RuntimeError(
                    f"Form Recognizer request failed ({response.status_code}): {response.text[:500]}"
                )

        extracted = self._extract_form_recognizer_text(result_payload)
        if len(extracted.strip()) < 20:
            raise RuntimeError("Azure Form Recognizer returned too little text")

        return self._llm_cleanup(extracted)

    # ─── Azure OpenAI Vision OCR ──────────────────────────────

    @staticmethod
    def _is_reasoning_model() -> bool:
        deployment = (AZURE_OPENAI_DEPLOYMENT or "").strip().lower()
        return deployment.startswith(("gpt-5", "o1", "o3", "o4"))

    @staticmethod
    def _extract_response_text(content) -> str:
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

    @staticmethod
    def _image_to_data_url(image: Image.Image) -> str:
        rgb = image.convert("RGB")

        # Keep payload size bounded for reliable transport.
        max_edge = 2048
        if max(rgb.size) > max_edge:
            rgb.thumbnail((max_edge, max_edge))

        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=88, optimize=True)
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    @staticmethod
    def _render_file_to_vision_pages(file_path: str) -> list[Image.Image]:
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            return convert_from_path(file_path, dpi=220)

        pages: list[Image.Image] = []
        with Image.open(file_path) as img:
            total_frames = getattr(img, "n_frames", 1) or 1
            for frame_idx in range(total_frames):
                if total_frames > 1:
                    img.seek(frame_idx)
                pages.append(img.convert("RGB").copy())

        if not pages:
            raise RuntimeError("Image contains no pages")
        return pages

    def _azure_vision_ocr_image(self, image: Image.Image, page_number: int | None = None, total_pages: int | None = None) -> str:
        deployment = (AZURE_OPENAI_VISION_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT or "").strip()
        if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY or not deployment:
            raise RuntimeError(
                "Azure vision OCR is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, and AZURE_OPENAI_VISION_DEPLOYMENT"
            )

        page_hint = ""
        if page_number and total_pages:
            page_hint = f"This is page {page_number} of {total_pages}. "

        prompt = (
            f"{page_hint}Extract all visible text from this page exactly as written. "
            "Preserve headings, bullets, equations, and line breaks when possible. "
            "Return only the extracted text, with no commentary."
        )

        url = (
            f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/"
            f"{deployment}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
        )
        headers = {"Content-Type": "application/json", "api-key": AZURE_OPENAI_KEY}
        payload = {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an OCR extraction engine. Output only extracted text.",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": self._image_to_data_url(image)},
                        },
                    ],
                },
            ],
            "temperature": 0,
            "max_tokens": 3000,
        }

        with httpx.Client(timeout=180.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        message = data.get("choices", [{}])[0].get("message", {})
        content = self._extract_response_text(message.get("content"))
        return content

    def _azure_vision_ocr(self, file_path: str) -> str:
        """Use Azure OpenAI Vision OCR for image and scanned PDF extraction."""
        try:
            pages = self._render_file_to_vision_pages(file_path)
        except Exception as e:
            raise RuntimeError(f"Failed to convert file into OCR pages: {e}") from e

        text_parts: list[str] = []
        total_pages = len(pages)
        for idx, page_image in enumerate(pages, start=1):
            page_text = self._azure_vision_ocr_image(page_image, page_number=idx, total_pages=total_pages)
            text_parts.append(f"--- Page {idx} ---\n{page_text}")

        extracted = self._clean_text("\n\n".join(text_parts))

        if len(extracted.strip()) < 30:
            raise RuntimeError("Azure OpenAI Vision returned too little text")

        return self._llm_cleanup(extracted)

    def _llm_cleanup(self, text: str) -> str:
        """Fix OCR errors using LLM (Azure OpenAI)."""
        if not text or len(text.strip()) < 20:
            return text
        if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_KEY or not AZURE_OPENAI_DEPLOYMENT:
            return text

        prompt = (
            "You are an OCR correction system.\n\n"
            "Fix errors in the following OCR text, especially from handwritten notes.\n\n"
            "Rules:\n"
            "- DO NOT hallucinate new content\n"
            "- Preserve original meaning\n"
            "- Fix spelling, spacing, broken words\n"
            "- Keep structure (lists, equations if any)\n\n"
            "OCR TEXT:\n"
            f"{text}"
        )

        try:
            url = (
                f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/"
                f"{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
            )
            headers = {"Content-Type": "application/json", "api-key": AZURE_OPENAI_KEY}
            payload: dict = {
                "messages": [
                    {"role": "system", "content": "You only correct OCR text. Never add new facts."},
                    {"role": "user", "content": prompt},
                ],
            }
            if self._is_reasoning_model():
                payload["max_completion_tokens"] = 2048
                reasoning_effort = (AZURE_OPENAI_REASONING_EFFORT or "").strip().lower()
                if reasoning_effort in {"low", "medium", "high"}:
                    payload["reasoning_effort"] = reasoning_effort
            else:
                payload["temperature"] = 0.1
                payload["max_tokens"] = 2048
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                message = data.get("choices", [{}])[0].get("message", {})
                content = self._extract_response_text(message.get("content"))
                return content or text
        except Exception as e:
            print(f"[OCR] LLM cleanup failed: {e}")
            return text

    # ─── Cleaning ─────────────────────────────────────────────

    @staticmethod
    def _clean_text(text: str) -> str:
        if not text:
            return ""

        # Remove invalid unicode (surrogates like \ud835)
        text = text.encode("utf-8", "ignore").decode("utf-8", "ignore")

        # Remove excessive whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)

        # Remove common OCR artifacts
        text = re.sub(r'[|}{~`]', '', text)

        # Optional: remove weird control chars
        text = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', text)

        return text.strip()


# Singleton
ocr_service = OCRService()
