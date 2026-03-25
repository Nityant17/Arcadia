"""
OCR Service — Extract text from images (handwritten notes) and PDFs.
Local: Tesseract OCR + pdf2image
Azure: Azure Form Recognizer + GPT-4o Vision
"""
import os
import re
from pathlib import Path
from typing import Optional

import httpx
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import PyPDF2

from config import (
    MODE, AZURE_FORM_RECOGNIZER_ENDPOINT, AZURE_FORM_RECOGNIZER_KEY
)


class OCRService:
    """Extracts text from uploaded images and PDFs."""

    def extract_text(self, file_path: str) -> str:
        """Route to the correct extractor based on file type."""
        ext = Path(file_path).suffix.lower()

        if ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"):
            return self._extract_from_image(file_path)
        elif ext == ".pdf":
            return self._extract_from_pdf(file_path)
        elif ext == ".txt":
            return self._extract_from_text(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    # ─── Image OCR ────────────────────────────────────────────

    def _extract_from_image(self, file_path: str) -> str:
        """Use Tesseract to OCR an image (handwritten or printed)."""
        if MODE == "azure":
            print(f"[OCR] Using AZURE Form Recognizer for image: {file_path}")
            return self._azure_vision_ocr(file_path)

        print(f"[OCR] Using LOCAL Tesseract for image: {file_path}")
        img = Image.open(file_path)
        # Use English + Hindi for bilingual notes
        text = pytesseract.image_to_string(img, lang="eng+hin")
        return self._clean_text(text)

    # ─── PDF Extraction ───────────────────────────────────────

    def _extract_from_pdf(self, file_path: str) -> str:
        """Try text extraction first, fall back to OCR for scanned PDFs."""
        # 1. Try direct text extraction (for digital PDFs)
        text = self._extract_pdf_text(file_path)
        if text and len(text.strip()) > 50:
            return self._clean_text(text)

        # 2. Fall back to OCR (for scanned/photo PDFs)
        if MODE == "azure":
            print(f"[OCR] Using AZURE Form Recognizer for scanned PDF: {file_path}")
            return self._azure_vision_ocr(file_path)
        print(f"[OCR] Using LOCAL Tesseract for PDF OCR: {file_path}")
        return self._ocr_pdf_pages(file_path)

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
        for i, img in enumerate(images):
            page_text = pytesseract.image_to_string(img, lang="eng+hin")
            text_parts.append(f"--- Page {i + 1} ---\n{page_text}")

        return self._clean_text("\n".join(text_parts))

    # ─── Plain Text ───────────────────────────────────────────

    def _extract_from_text(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return self._clean_text(f.read())

    # ─── Azure (placeholder) ──────────────────────────────────

    def _azure_vision_ocr(self, file_path: str) -> str:
        """Azure Form Recognizer (Document Intelligence) for OCR."""
        import time

        endpoint = AZURE_FORM_RECOGNIZER_ENDPOINT.rstrip('/')
        url = f"{endpoint}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31"
        headers = {
            "Ocp-Apim-Subscription-Key": AZURE_FORM_RECOGNIZER_KEY,
            "Content-Type": "application/octet-stream",
        }

        with open(file_path, "rb") as f:
            data = f.read()

        # Submit analysis request
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, content=data)
            if resp.status_code not in (200, 202):
                raise RuntimeError(f"Azure Form Recognizer error: {resp.status_code} {resp.text}")

            result_url = resp.headers.get("Operation-Location")
            if not result_url:
                raise RuntimeError("No Operation-Location header in Form Recognizer response")

            # Poll for result
            poll_headers = {"Ocp-Apim-Subscription-Key": AZURE_FORM_RECOGNIZER_KEY}
            for _ in range(60):  # max ~60 seconds
                time.sleep(1)
                poll_resp = client.get(result_url, headers=poll_headers)
                poll_data = poll_resp.json()
                status = poll_data.get("status", "")
                if status == "succeeded":
                    # Extract text from result
                    content = poll_data.get("analyzeResult", {}).get("content", "")
                    return self._clean_text(content)
                elif status == "failed":
                    raise RuntimeError(f"Azure Form Recognizer analysis failed: {poll_data}")
                # else "running" — keep polling

        raise RuntimeError("Azure Form Recognizer timed out")

    # ─── Cleaning ─────────────────────────────────────────────

    @staticmethod
    def _clean_text(text: str) -> str:
        if not text:
            return ""

        # 🔥 CRITICAL FIX: remove invalid unicode (surrogates like \ud835)
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
