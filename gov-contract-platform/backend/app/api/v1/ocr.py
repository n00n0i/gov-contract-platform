"""
OCR API Routes - Test and process documents with various OCR engines

All OCR operations use settings from the centralized OCR Settings (Settings > OCR).
This ensures consistent OCR behavior across the entire application.
"""
import base64
import io
import json
import logging
from typing import Optional, Dict, Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pdf2image import convert_from_bytes
from PIL import Image
import pytesseract
from sqlalchemy.orm import Session

from app.core.security import get_current_user_payload, get_current_user_id
from app.core.logging import get_logger
from app.db.database import get_db
from app.services.document.ocr_settings_service import get_ocr_settings_service, OCRSettingsService

router = APIRouter(prefix="/ocr", tags=["OCR"])
logger = get_logger(__name__)


@router.post("/process")
async def process_with_ocr_settings(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Process document using centralized OCR Settings from Settings > OCR
    
    This endpoint uses the OCR settings configured in the system settings.
    All document processing should use this endpoint to ensure consistency.
    
    - **file**: PDF or image file to process
    
    Returns extracted text from the document using the configured OCR engine.
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "image/jpeg", "image/png", "image/tiff", "image/jpg"
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, JPG, PNG, TIFF"
        )
    
    # Validate file size (10MB max)
    MAX_SIZE = 10 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )
    
    # Get OCR settings from centralized service
    ocr_settings_service = get_ocr_settings_service(db, user_id)
    ocr_settings = ocr_settings_service.get_settings()
    
    # Validate settings before processing
    validation = ocr_settings_service.validate_settings()
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OCR settings validation failed: {'; '.join(validation['errors'])}"
        )
    
    mode = ocr_settings_service.get_mode()
    logger.info(f"Processing OCR with mode: {mode} for user {user_id}")

    try:
        if mode == "typhoon":
            result = await process_typhoon_ocr(file_content, file.content_type, file.filename, ocr_settings)
        elif mode == "ollama":
            result = await process_ollama_ocr(file_content, file.content_type, file.filename, ocr_settings)
        elif mode == "custom":
            result = await process_custom_ocr(file_content, file.content_type, file.filename, ocr_settings)
        else:  # default - Tesseract
            result = await process_tesseract_ocr(file_content, file.content_type, ocr_settings)
        
        # Add settings info to result
        result["settings_used"] = {
            "mode": mode,
            "engine": ocr_settings.get("engine", "tesseract"),
            "language": ocr_settings.get("language", "tha+eng")
        }
        
        return result
        
    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.post("/test")
async def test_ocr(
    file: UploadFile = File(...),
    settings: str = Form(...),  # JSON string of OCR settings
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Test OCR with custom settings (for testing purposes)
    
    This endpoint allows testing with custom settings without saving them.
    For production use, use /process endpoint which uses saved OCR settings.
    
    - **file**: PDF or image file to process
    - **settings**: JSON string containing OCR configuration
        - mode: "default" | "typhoon" | "custom"
        - Other mode-specific settings
    
    Returns extracted text from the document.
    """
    # Validate file type
    allowed_types = [
        "application/pdf",
        "image/jpeg", "image/png", "image/tiff", "image/jpg"
    ]
    
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, JPG, PNG, TIFF"
        )
    
    # Validate file size (10MB max for test)
    MAX_SIZE = 10 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )
    
    # Parse settings
    try:
        ocr_settings = json.loads(settings)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid settings JSON"
        )
    
    mode = ocr_settings.get("mode", "default")

    try:
        if mode == "typhoon":
            result = await process_typhoon_ocr(file_content, file.content_type, file.filename, ocr_settings)
        elif mode == "ollama":
            result = await process_ollama_ocr(file_content, file.content_type, file.filename, ocr_settings)
        elif mode == "custom":
            # Test endpoint only processes first page to avoid gateway timeouts
            result = await process_custom_ocr(file_content, file.content_type, file.filename, ocr_settings, first_page_only=True)
        else:  # default - Tesseract
            result = await process_tesseract_ocr(file_content, file.content_type, ocr_settings)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.get("/status")
def get_ocr_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get current OCR settings status
    
    Returns the current OCR mode and validation status.
    Use this to check if OCR is properly configured before processing.
    """
    ocr_settings_service = get_ocr_settings_service(db, user_id)
    settings = ocr_settings_service.get_settings()
    validation = ocr_settings_service.validate_settings()
    
    return {
        "success": True,
        "data": {
            "mode": settings.get("mode", "default"),
            "engine": settings.get("engine", "tesseract"),
            "language": settings.get("language", "tha+eng"),
            "is_typhoon_configured": ocr_settings_service.is_typhoon_configured(),
            "is_custom_api_configured": ocr_settings_service.is_custom_api_configured(),
            "validation": validation
        }
    }


async def process_tesseract_ocr(
    file_data: bytes,
    mime_type: str,
    settings: Dict[str, Any]
) -> Dict[str, Any]:
    """Process document with Tesseract OCR (local)"""
    language = settings.get("language", "tha+eng")
    
    text_parts = []
    confidence_scores = []
    
    if mime_type == "application/pdf":
        # Convert PDF to images
        images = convert_from_bytes(file_data, dpi=300)
        for image in images:
            page_text = pytesseract.image_to_string(image, lang=language)
            text_parts.append(page_text)
            
            # Get confidence
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            if confidences:
                confidence_scores.append(sum(confidences) / len(confidences))
    else:
        # Process image directly
        image = Image.open(io.BytesIO(file_data))
        page_text = pytesseract.image_to_string(image, lang=language)
        text_parts.append(page_text)
        
        # Get confidence
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        confidences = [int(c) for c in data['conf'] if int(c) > 0]
        if confidences:
            confidence_scores.append(sum(confidences) / len(confidences))
    
    full_text = "\n\n--- Page Break ---\n\n".join(text_parts)
    avg_confidence = sum(confidence_scores) / len(confidence_scores) / 100 if confidence_scores else 0.7
    
    return {
        "success": True,
        "mode": "tesseract",
        "text": full_text,
        "confidence": round(avg_confidence, 2),
        "pages": len(text_parts),
        "language": language
    }


async def process_typhoon_ocr(
    file_data: bytes,
    mime_type: str,
    filename: str,
    settings: Dict[str, Any]
) -> Dict[str, Any]:
    """Process document with Typhoon OCR API"""
    url = settings.get("typhoon_url", "https://api.opentyphoon.ai/v1/ocr")
    api_key = settings.get("typhoon_key", "")
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Typhoon API key is required"
        )
    
    # Prepare multipart form data
    form_data = {
        "model": settings.get("typhoon_model", "typhoon-ocr"),
        "task_type": settings.get("typhoon_task_type", "default"),
        "max_tokens": str(settings.get("typhoon_max_tokens", 16384)),
        "temperature": str(settings.get("typhoon_temperature", 0.1)),
        "top_p": str(settings.get("typhoon_top_p", 0.6)),
        "repetition_penalty": str(settings.get("typhoon_repetition_penalty", 1.2)),
    }
    
    # Handle pages parameter
    pages = settings.get("typhoon_pages", "")
    if pages:
        try:
            pages_json = json.loads(pages)
            form_data["pages"] = json.dumps(pages_json)
        except:
            pass
    
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    # Determine file extension and content type
    ext = filename.split('.')[-1].lower() if '.' in filename else 'jpg'
    mime_mapping = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'tiff': 'image/tiff',
        'tif': 'image/tiff'
    }
    file_mime = mime_mapping.get(ext, 'image/jpeg')
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        files = {"file": (filename, io.BytesIO(file_data), file_mime)}
        
        try:
            response = await client.post(url, data=form_data, files=files, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Typhoon OCR API error: {e.response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Typhoon OCR API error: {e.response.status_code}"
            )
        except httpx.RequestError as e:
            logger.error(f"Typhoon OCR request error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Cannot connect to Typhoon OCR API: {str(e)}"
            )
    
    result_data = response.json()
    
    # Extract text from Typhoon response
    extracted_texts = []
    for page_result in result_data.get("results", []):
        if page_result.get("success") and page_result.get("message"):
            try:
                content = page_result["message"]["choices"][0]["message"]["content"]
                # Try to parse as JSON if it's structured output
                try:
                    parsed = json.loads(content)
                    text = parsed.get("natural_text", content)
                except json.JSONDecodeError:
                    text = content
                extracted_texts.append(text)
            except (KeyError, IndexError):
                continue
        elif not page_result.get("success"):
            error_msg = page_result.get("error", "Unknown error")
            logger.error(f"Typhoon OCR page error: {error_msg}")
    
    full_text = "\n\n--- Page Break ---\n\n".join(extracted_texts)
    
    return {
        "success": len(extracted_texts) > 0,
        "mode": "typhoon",
        "text": full_text,
        "pages": len(extracted_texts),
        "raw_response": result_data if not extracted_texts else None
    }


def _compress_image(image: Image.Image, max_size_mb: float = 1.5, max_edge: int = 1600) -> bytes:
    """Compress PIL image to JPEG bytes under max_size_mb.

    Caps the longest edge at max_edge px. Balance between:
    - Large enough for vision model to read text clearly
    - Small enough to avoid upstream gateway timeouts
    """
    # Downscale to max_edge px on the longest side
    w, h = image.size
    if max(w, h) > max_edge:
        scale = max_edge / max(w, h)
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    quality = 80
    while quality >= 30:
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=quality, optimize=True)
        size_kb = buf.tell() / 1024
        logger.debug(f"Compressed image: {image.size} quality={quality} size={size_kb:.0f}KB")
        if buf.tell() <= max_size_mb * 1024 * 1024:
            return buf.getvalue()
        quality -= 10
    # Last resort: downscale 50%
    w, h = image.size
    image = image.resize((w // 2, h // 2), Image.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=40, optimize=True)
    return buf.getvalue()


def _build_completions_url(base_url: str) -> str:
    """Ensure the URL points to the chat completions endpoint."""
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


def _is_garbage_line(line: str) -> bool:
    """Return True if a line looks like OCR garbage (scattered chars, high whitespace ratio).

    Garbage lines are produced when the vision model tries to interpret
    document margins, stamps, watermarks, or scan artifacts, e.g.:
      'va y     6. a ve บ   '           จ       al     ย เ     ว      v'
      '๑7    เว   aw  wwe   ew a     wy      ๐   wad'
    Characteristics:
      - Very high proportion of whitespace (>45% of line)
      - Average token length very short (<2.5 chars)
      - Line is long enough to not just be a short legitimate entry
    """
    if not line.strip():
        return False  # blank lines handled separately

    total = len(line)
    if total < 15:
        return False  # too short to judge

    spaces = line.count(' ') + line.count('\t')
    space_ratio = spaces / total

    tokens = line.split()
    if not tokens:
        return False

    avg_token_len = sum(len(t) for t in tokens) / len(tokens)

    # High whitespace ratio AND short average token → scattered garbage characters
    return space_ratio > 0.45 and avg_token_len < 2.5


def _clean_ocr_text(text: str) -> str:
    """Remove common model-generated artifacts from OCR output.

    Removes:
      - Model page metadata: "PageNumber: Page 3 of 7", "Page 3 of 7"
      - Garbage scatter lines from scan artifacts / watermarks
      - Excessive blank lines (3+ → 2)
    """
    import re

    lines = text.splitlines()
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Model-generated page number metadata
        if re.match(r'^PageNumber\s*:', stripped, re.IGNORECASE):
            continue
        if re.match(r'^Page\s+\d+\s+of\s+\d+\s*$', stripped, re.IGNORECASE):
            continue
        if re.match(r'^\[?Page\s+\d+\]?\s*$', stripped, re.IGNORECASE):
            continue
        # Garbage scatter lines
        if _is_garbage_line(line):
            continue
        cleaned.append(line)

    # Collapse 3+ consecutive blank lines → 2
    result = re.sub(r'\n{3,}', '\n\n', '\n'.join(cleaned))
    return result.strip()


def _extract_chat_text(data: Any) -> str:
    """Extract text from an OpenAI-compatible chat completions response.

    Handles Typhoon OCR models that return JSON-encoded content like:
      {"natural_text": "...", "markdown": "..."}
    or wrapped in a code block:
      ```json\n{"natural_text": "..."}\n```
    """
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        # Fallback: search common top-level keys
        if isinstance(data, dict):
            for key in ["text", "content", "result", "output", "extracted_text"]:
                if key in data:
                    val = data[key]
                    return "\n".join(str(v) for v in val) if isinstance(val, list) else str(val)
        return json.dumps(data, ensure_ascii=False, indent=2)

    if not isinstance(content, str):
        return str(content)

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    stripped = content.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        # Remove first line (```json or ```) and last line (```)
        inner_lines = lines[1:] if len(lines) > 1 else lines
        if inner_lines and inner_lines[-1].strip() == "```":
            inner_lines = inner_lines[:-1]
        stripped = "\n".join(inner_lines).strip()

    # Try to parse as JSON and prefer natural_text > markdown > text
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            for key in ("natural_text", "markdown", "text", "content", "output"):
                val = parsed.get(key)
                if val and isinstance(val, str) and val.strip():
                    logger.debug(f"Extracted text from JSON key '{key}'")
                    return val.strip()
    except (json.JSONDecodeError, TypeError):
        pass

    return content


async def _call_vision_api(
    completions_url: str,
    headers: dict,
    model: str,
    prompt: str,
    img_b64: str,
) -> Any:
    """POST one image (base64) to an OpenAI-compatible vision endpoint.

    Sends images in BOTH formats simultaneously:
    - content[image_url]: OpenAI / LiteLLM format
    - message.images[]: Ollama native format

    This ensures compatibility regardless of whether the backend is
    pure Ollama, LiteLLM proxy, or a standard OpenAI-compatible API.
    """
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                # OpenAI-compatible content array
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"},
                    },
                    {"type": "text", "text": prompt},
                ],
                # Ollama native image array (ignored by non-Ollama servers)
                "images": [img_b64],
            }
        ],
        "max_tokens": 8192,
    }
    logger.info(f"Custom OCR → POST {completions_url} model={model} has_key={bool(headers.get('Authorization'))}")
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            response = await client.post(completions_url, json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            body = e.response.text[:500]
            logger.error(f"Custom OCR API {e.response.status_code}: {body}")
            # Parse API error detail if JSON
            api_msg = body
            try:
                err_data = e.response.json()
                api_msg = (
                    err_data.get("error", {}).get("message")
                    or err_data.get("detail")
                    or err_data.get("message")
                    or body
                )
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Custom OCR API {e.response.status_code}: {api_msg}",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Cannot connect to Custom OCR API: {str(e)}",
            )
    data = response.json()
    # Log actual content for debugging
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "?")
    logger.info(f"Custom OCR response content ({len(content)} chars): {content[:800]}")
    return data


async def process_ollama_ocr(
    file_data: bytes,
    mime_type: str,
    filename: str,
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    """Process document via Ollama vision model.

    Sends each page as a JPEG image to Ollama's /v1/chat/completions endpoint
    using a fixed OCR prompt (no user-configurable template).
    Processes ALL pages and concatenates results.
    """
    base_url = settings.get("ollama_url", "").rstrip("/")
    api_key = settings.get("ollama_key", "")
    model = settings.get("ollama_model", "")

    if not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ollama URL is required",
        )
    if not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ollama model is required",
        )

    completions_url = _build_completions_url(base_url)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # Fixed prompt — Ollama OCR models work best with a simple extraction instruction
    prompt = "Extract all text from this document image. Return only the raw text content, preserving the original layout as much as possible."

    page_texts: list[str] = []
    failed_pages: list[int] = []

    if mime_type == "application/pdf":
        try:
            images = convert_from_bytes(file_data, dpi=150)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot convert PDF to images: {str(e)}",
            )
        logger.info(f"Ollama OCR: processing {len(images)} page(s) from PDF")
        for page_num, img in enumerate(images, start=1):
            if img.mode != "RGB":
                img = img.convert("RGB")
            img_bytes = _compress_image(img)
            img_b64 = base64.b64encode(img_bytes).decode()
            logger.info(f"Ollama OCR page {page_num}/{len(images)}: {img.size} → {len(img_bytes)//1024}KB")
            try:
                data = await _call_vision_api(completions_url, headers, model, prompt, img_b64)
                text = _clean_ocr_text(_extract_chat_text(data))
                if text:
                    page_texts.append(text)
            except Exception as e:
                logger.warning(f"Ollama OCR page {page_num} failed (skipping): {e}")
                failed_pages.append(page_num)
    else:
        try:
            img = Image.open(io.BytesIO(file_data))
            if img.mode != "RGB":
                img = img.convert("RGB")
            img_bytes = _compress_image(img)
        except Exception:
            img_bytes = file_data
        img_b64 = base64.b64encode(img_bytes).decode()
        try:
            data = await _call_vision_api(completions_url, headers, model, prompt, img_b64)
            text = _clean_ocr_text(_extract_chat_text(data))
            if text:
                page_texts.append(text)
        except Exception as e:
            logger.warning(f"Ollama OCR image failed (skipping): {e}")
            failed_pages.append(1)

    combined = "\n\n".join(page_texts)
    result: Dict[str, Any] = {
        "success": bool(combined),
        "mode": "ollama",
        "text": combined or "(ไม่พบข้อความจาก Ollama)",
        "pages": len(page_texts),
        "endpoint": completions_url,
    }
    if failed_pages:
        result["warnings"] = [f"หน้า {p} ไม่สามารถอ่านได้ (ข้ามไป)" for p in failed_pages]
    return result


async def process_custom_ocr(
    file_data: bytes,
    mime_type: str,
    filename: str,
    settings: Dict[str, Any],
    first_page_only: bool = False,
) -> Dict[str, Any]:
    """Process document with custom OpenAI-compatible vision API.

    Sends images as base64 JSON to /v1/chat/completions — same format as
    ocr_service.py production path. PDFs are converted page-by-page.

    Args:
        first_page_only: If True, only process page 1 (used by test endpoint
                         to stay within Cloudflare's ~100s timeout).
    """
    base_url = settings.get("custom_api_url", "").rstrip("/")
    api_key = settings.get("custom_api_key", "")
    model = settings.get("custom_api_model", "")
    prompt = settings.get("ocr_template", "").strip() or \
        "Extract all text from this document image. Return only the raw text content."

    if not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom API URL is required",
        )
    if not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom API Model is required",
        )

    completions_url = _build_completions_url(base_url)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    page_texts: list[str] = []
    failed_pages: list[int] = []

    if mime_type == "application/pdf":
        try:
            images = convert_from_bytes(file_data, dpi=150)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot convert PDF to images: {str(e)}",
            )
        if first_page_only:
            images = images[:1]
        for page_num, img in enumerate(images, start=1):
            if img.mode != "RGB":
                img = img.convert("RGB")
            img_bytes = _compress_image(img)
            logger.info(f"Sending page {page_num}/{len(images)}: {img.size} → {len(img_bytes)/1024:.0f}KB (b64={len(base64.b64encode(img_bytes))//1024}KB)")
            img_b64 = base64.b64encode(img_bytes).decode()
            try:
                data = await _call_vision_api(completions_url, headers, model, prompt, img_b64)
                page_texts.append(_clean_ocr_text(_extract_chat_text(data)))
            except Exception as e:
                logger.warning(f"Custom OCR page {page_num} failed (skipping): {e}")
                failed_pages.append(page_num)
    else:
        try:
            img = Image.open(io.BytesIO(file_data))
            if img.mode != "RGB":
                img = img.convert("RGB")
            img_bytes = _compress_image(img)
        except Exception:
            img_bytes = file_data
        logger.info(f"Sending image: size={len(img_bytes)/1024:.0f}KB (b64={len(base64.b64encode(img_bytes))//1024}KB)")
        img_b64 = base64.b64encode(img_bytes).decode()
        try:
            data = await _call_vision_api(completions_url, headers, model, prompt, img_b64)
            page_texts.append(_clean_ocr_text(_extract_chat_text(data)))
        except Exception as e:
            logger.warning(f"Custom OCR image failed (skipping): {e}")
            failed_pages.append(1)

    combined = "\n\n".join(t for t in page_texts if t)
    note = " (ทดสอบเฉพาะหน้าแรก)" if first_page_only and mime_type == "application/pdf" else ""
    result: Dict[str, Any] = {
        "success": bool(combined),
        "mode": "custom",
        "text": combined or "(ไม่พบข้อความจาก API)",
        "pages": len(page_texts),
        "endpoint": completions_url,
        "note": note.strip() if note else None,
    }
    if failed_pages:
        result["warnings"] = [f"หน้า {p} ไม่สามารถอ่านได้ (ข้ามไป)" for p in failed_pages]
    return result
