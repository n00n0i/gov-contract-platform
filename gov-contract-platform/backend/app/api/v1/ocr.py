"""
OCR API Routes - Test and process documents with various OCR engines

All OCR operations use settings from the centralized OCR Settings (Settings > OCR).
This ensures consistent OCR behavior across the entire application.
"""
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
        elif mode == "custom":
            result = await process_custom_ocr(file_content, file.content_type, file.filename, ocr_settings)
        else:  # default - Tesseract
            result = await process_tesseract_ocr(file_content, file.content_type, ocr_settings)
        
        return result
        
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


async def process_custom_ocr(
    file_data: bytes,
    mime_type: str,
    filename: str,
    settings: Dict[str, Any]
) -> Dict[str, Any]:
    """Process document with custom OCR API"""
    url = settings.get("custom_api_url", "")
    api_key = settings.get("custom_api_key", "")
    
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom API URL is required"
        )
    
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    
    # Determine file extension
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
            response = await client.post(url, files=files, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Custom OCR API error: {e.response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Custom OCR API error: {e.response.status_code}"
            )
        except httpx.RequestError as e:
            logger.error(f"Custom OCR request error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Cannot connect to Custom OCR API: {str(e)}"
            )
    
    result_data = response.json()
    
    # Try to extract text from common response formats
    text = ""
    if isinstance(result_data, dict):
        # Try common text field names
        for key in ["text", "content", "result", "data", "extracted_text"]:
            if key in result_data:
                text = result_data[key]
                if isinstance(text, list):
                    text = "\n\n--- Page Break ---\n\n".join(str(t) for t in text)
                break
    elif isinstance(result_data, str):
        text = result_data
    
    return {
        "success": bool(text),
        "mode": "custom",
        "text": text or json.dumps(result_data, indent=2),
        "raw_response": result_data if not text else None
    }
