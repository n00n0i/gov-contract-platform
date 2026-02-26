"""
OCR Service - Document text extraction

This service now uses centralized OCR Settings from the database.
All OCR operations should go through OCRSettingsService for configuration.

Usage:
    from app.services.document.ocr_settings_service import get_ocr_settings_service
    
    ocr_settings_service = get_ocr_settings_service(db, user_id)
    ocr_service = OCRService(ocr_settings_service)
    result = ocr_service.process_document(file_data, mime_type)
"""
import io
import logging
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import pdfplumber
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.document import OCRResult
from app.services.document.ocr_settings_service import OCRSettingsService, get_ocr_settings_service

logger = logging.getLogger(__name__)


class OCRService:
    """
    OCR processing service - now uses centralized OCR Settings
    
    This service uses OCRSettingsService to get configuration from database.
    Do not use settings.OCR_LANGUAGE directly - always use ocr_settings_service.
    """
    
    def __init__(self, ocr_settings_service: Optional[OCRSettingsService] = None):
        """
        Initialize OCR Service
        
        Args:
            ocr_settings_service: OCR settings service instance.
                                  If not provided, uses default settings from config.
        """
        self._settings_service = ocr_settings_service
        # Fallback to config settings if no settings service provided
        self._language = settings.OCR_LANGUAGE if ocr_settings_service is None else None
    
    def _get_settings_service(self) -> Optional[OCRSettingsService]:
        """Get the OCR settings service"""
        return self._settings_service
    
    @property
    def language(self) -> str:
        """Get OCR language from settings service or fallback"""
        if self._settings_service:
            return self._settings_service.get_language()
        return self._language or "tha+eng"
    
    def process_document(self, file_data: bytes, mime_type: str) -> OCRResult:
        """
        Process document with OCR
        
        Args:
            file_data: Raw file bytes
            mime_type: File MIME type
        
        Returns:
            OCRResult with extracted text and data
        """
        try:
            if mime_type == "application/pdf":
                return self._process_pdf(file_data)
            elif mime_type.startswith("image/"):
                return self._process_image(file_data)
            else:
                return OCRResult(
                    success=False,
                    error_message=f"Unsupported file type: {mime_type}"
                )
        except Exception as e:
            logger.error(f"OCR processing error: {e}")
            return OCRResult(
                success=False,
                error_message=str(e)
            )
    
    def _process_pdf(self, file_data: bytes) -> OCRResult:
        """Process PDF file"""
        text_parts = []
        confidence_scores = []
        
        # Try pdfplumber first for text extraction
        try:
            with pdfplumber.open(io.BytesIO(file_data)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                
                if text_parts:
                    full_text = "\n\n".join(text_parts)
                    extracted_data = self._extract_contract_data(full_text)
                    
                    return OCRResult(
                        success=True,
                        text=full_text,
                        confidence=0.85,
                        pages=len(pdf.pages),
                        language=self.language,
                        extracted_data=extracted_data
                    )
        except Exception as e:
            logger.warning(f"pdfplumber failed, falling back to OCR: {e}")
        
        # Fallback to OCR for scanned PDFs
        try:
            images = convert_from_bytes(file_data, dpi=200)
            
            for image in images:
                page_text = pytesseract.image_to_string(
                    image,
                    lang=self.language
                )
                text_parts.append(page_text)
                
                # Get confidence
                data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
                confidences = [int(c) for c in data['conf'] if int(c) > 0]
                if confidences:
                    confidence_scores.append(sum(confidences) / len(confidences))
            
            full_text = "\n\n".join(text_parts)
            avg_confidence = sum(confidence_scores) / len(confidence_scores) / 100 if confidence_scores else 0.7
            
            extracted_data = self._extract_contract_data(full_text)
            
            return OCRResult(
                success=True,
                text=full_text,
                confidence=avg_confidence,
                pages=len(images),
                language=self.language,
                extracted_data=extracted_data
            )
            
        except Exception as e:
            logger.error(f"OCR failed: {e}")
            return OCRResult(
                success=False,
                error_message=f"OCR processing failed: {e}"
            )
    
    def _process_image(self, file_data: bytes) -> OCRResult:
        """Process image file"""
        try:
            image = Image.open(io.BytesIO(file_data))
            
            # Run OCR
            text = pytesseract.image_to_string(image, lang=self.language)
            
            # Get confidence
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.7
            
            # Extract structured data
            extracted_data = self._extract_contract_data(text)
            
            return OCRResult(
                success=True,
                text=text,
                confidence=avg_confidence,
                pages=1,
                language=self.language,
                extracted_data=extracted_data
            )
            
        except Exception as e:
            logger.error(f"Image OCR failed: {e}")
            return OCRResult(
                success=False,
                error_message=f"Image processing failed: {e}"
            )
    
    def _extract_contract_data(self, text: str) -> Dict[str, Any]:
        """Extract structured data from contract text"""
        data = {
            "contract_number": self._extract_contract_number(text),
            "contract_value": self._extract_contract_value(text),
            "start_date": self._extract_start_date(text),
            "end_date": self._extract_end_date(text),
            "parties": self._extract_parties(text),
            "project_name": self._extract_project_name(text),
        }
        return data
    
    def _extract_contract_number(self, text: str) -> Optional[str]:
        """Extract contract number"""
        # Thai government contract patterns
        patterns = [
            r"เลขที่\s*[:\s]+([A-Z\-0-9/]+)",
            r"สัญญาเลขที่\s*[:\s]+([A-Z\-0-9/]+)",
            r"ที่\s+([0-9]+/[0-9]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_contract_value(self, text: str) -> Optional[float]:
        """Extract contract value"""
        # Look for Thai Baht amounts
        patterns = [
            r"เป็นเงิน\s*([0-9,]+)\s*บาท",
            r"([0-9,]+)\s*บาท\s*\(?[0-9\s\u0E01-\u0E5B]*\)?",
            r"จำนวนเงิน\s*([0-9,]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    value_str = match.group(1).replace(",", "")
                    return float(value_str)
                except ValueError:
                    continue
        return None
    
    def _extract_start_date(self, text: str) -> Optional[str]:
        """Extract contract start date"""
        # Thai date patterns
        patterns = [
            r"ตั้งแต่วันที่\s+(\d{1,2}\s+[\u0E01-\u0E5B]+\s*\d{4})",
            r"วันที่เริ่มสัญญา\s*[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_end_date(self, text: str) -> Optional[str]:
        """Extract contract end date"""
        patterns = [
            r"ถึงวันที่\s+(\d{1,2}\s+[\u0E01-\u0E5B]+\s*\d{4})",
            r"วันที่สิ้นสุดสัญญา\s*[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_parties(self, text: str) -> List[Dict[str, str]]:
        """Extract contract parties"""
        parties = []
        
        # Look for government agency
        gov_patterns = [
            r"(กระทรวง[\u0E01-\u0E5B\s]+)",
            r"(กรม[\u0E01-\u0E5B\s]+)",
            r"(สำนักงาน[\u0E01-\u0E5B\s]+)",
        ]
        for pattern in gov_patterns:
            match = re.search(pattern, text)
            if match:
                parties.append({
                    "type": "government",
                    "name": match.group(1).strip()
                })
                break
        
        # Look for contractor
        contractor_patterns = [
            r"ผู้รับจ้าง\s*([\u0E01-\u0E5BA-Za-z\s\.]+)",
            r"บริษัท\s*([\u0E01-\u0E5BA-Za-z\s\.]+)\s*จำกัด",
        ]
        for pattern in contractor_patterns:
            match = re.search(pattern, text)
            if match:
                parties.append({
                    "type": "contractor",
                    "name": match.group(1).strip()
                })
                break
        
        return parties
    
    def _extract_project_name(self, text: str) -> Optional[str]:
        """Extract project name"""
        patterns = [
            r"โครงการ\s*[:\s]+([\u0E01-\u0E5BA-Za-z\s\-]+)",
            r"งาน([\u0E01-\u0E5BA-Za-z\s\-]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        return None


# Singleton
_ocr_service = None

def get_ocr_service() -> OCRService:
    """Get OCR service singleton"""
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRService()
    return _ocr_service
