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
import base64
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
        Process document with OCR — routes by configured mode.
        """
        try:
            mode = self._settings_service.get_mode() if self._settings_service else "default"
            if mode == "typhoon":
                return self._process_typhoon(file_data, mime_type)
            elif mode == "custom":
                return self._process_custom(file_data, mime_type)
            else:
                # default: tesseract/pdfplumber
                if mime_type == "application/pdf":
                    return self._process_pdf(file_data)
                elif mime_type.startswith("image/"):
                    return self._process_image(file_data)
                else:
                    return OCRResult(
                        success=False,
                        error=f"Unsupported file type: {mime_type}"
                    )
        except Exception as e:
            logger.error(f"OCR processing error: {e}")
            return OCRResult(
                success=False,
                error=str(e)
            )

    def _process_typhoon(self, file_data: bytes, mime_type: str) -> OCRResult:
        """
        Process document via Typhoon OCR API using OpenAI-compatible chat completions format.
        Renders PDF pages to PNG images and sends each as image_url in messages.
        """
        import httpx

        s = self._settings_service.get_settings() if self._settings_service else {}
        typhoon_url = s.get("typhoon_url", "https://api.opentyphoon.ai")
        typhoon_key = s.get("typhoon_key", "")
        typhoon_model = s.get("typhoon_model", "typhoon-ocr")
        task_type = s.get("typhoon_task_type", "default")
        max_tokens = s.get("typhoon_max_tokens", 16384)
        temperature = s.get("typhoon_temperature", 0.1)
        top_p = s.get("typhoon_top_p", 0.6)
        repetition_penalty = s.get("typhoon_repetition_penalty", 1.2)

        # Always use /v1/chat/completions — strip any stored path suffix
        base_url = re.sub(r'/v1/.*$', '', typhoon_url.rstrip('/'))
        endpoint = f"{base_url}/v1/chat/completions"

        task_prompts = {
            "markdown": (
                "Extract all text from this document image and format it as markdown. "
                "Preserve structure, headers, tables, and lists."
            ),
            "default": "Extract all text content from this document image. Return the complete raw text.",
        }
        prompt_text = task_prompts.get(task_type, task_prompts["default"])

        headers = {
            "Authorization": f"Bearer {typhoon_key}",
            "Content-Type": "application/json",
        }

        # Convert document pages to base64 PNG list
        image_b64_list: List[str] = []
        if mime_type == "application/pdf":
            try:
                images = convert_from_bytes(file_data, dpi=200)
                for img in images:
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    image_b64_list.append(base64.b64encode(buf.getvalue()).decode("utf-8"))
            except Exception as e:
                logger.error(f"PDF to image conversion failed: {e}")
                return OCRResult(success=False, error=f"PDF to image conversion failed: {e}")
        elif mime_type.startswith("image/"):
            # For non-PNG images, normalise to PNG for consistent handling
            try:
                img = Image.open(io.BytesIO(file_data))
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                image_b64_list.append(base64.b64encode(buf.getvalue()).decode("utf-8"))
            except Exception as e:
                logger.error(f"Image conversion failed: {e}")
                return OCRResult(success=False, error=f"Image conversion failed: {e}")
        else:
            return OCRResult(success=False, error=f"Unsupported file type for Typhoon OCR: {mime_type}")

        # Send each page and collect text
        all_texts: List[str] = []
        for img_b64 in image_b64_list:
            payload = {
                "model": typhoon_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                            },
                            {"type": "text", "text": prompt_text},
                        ],
                    }
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "repetition_penalty": repetition_penalty,
            }
            try:
                response = httpx.post(endpoint, json=payload, headers=headers, timeout=120.0)
                response.raise_for_status()
                data = response.json()
                page_text = data["choices"][0]["message"]["content"]
                if page_text:
                    all_texts.append(page_text)
            except Exception as e:
                logger.error(f"Typhoon OCR failed: {e}")
                return OCRResult(success=False, error=f"Typhoon OCR failed: {e}")

        full_text = "\n\n".join(all_texts)
        extracted_data = self._extract_contract_data(full_text) if full_text else {}
        return OCRResult(
            success=True,
            text=full_text,
            confidence=0.9,
            ocr_engine="typhoon",
            pages=len(image_b64_list),
            language=self.language,
            extracted_data=extracted_data,
        )

    def _process_custom(self, file_data: bytes, mime_type: str) -> OCRResult:
        """
        Process document via custom OpenAI-compatible API with vision.
        """
        import httpx

        s = self._settings_service.get_settings() if self._settings_service else {}
        custom_url = s.get("custom_api_url", "").rstrip("/")
        custom_key = s.get("custom_api_key", "")
        custom_model = s.get("custom_api_model", "")

        if not custom_url or not custom_model:
            logger.warning("Custom OCR API URL or model not configured, falling back to default")
            if mime_type == "application/pdf":
                return self._process_pdf(file_data)
            return self._process_image(file_data)

        file_b64 = base64.b64encode(file_data).decode("utf-8")
        headers = {"Content-Type": "application/json"}
        if custom_key:
            headers["Authorization"] = f"Bearer {custom_key}"

        payload = {
            "model": custom_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{file_b64}"},
                        },
                        {
                            "type": "text",
                            "text": "Extract all text from this document. Return only the raw text content.",
                        },
                    ],
                }
            ],
            "max_tokens": 8192,
        }

        try:
            response = httpx.post(
                f"{custom_url}/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            extracted_data = self._extract_contract_data(text) if text else {}
            return OCRResult(
                success=True,
                text=text,
                confidence=0.85,
                ocr_engine="custom",
                language=self.language,
                extracted_data=extracted_data,
            )
        except Exception as e:
            logger.error(f"Custom OCR API failed: {e}")
            return OCRResult(success=False, error=f"Custom OCR API failed: {e}")
    
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
                        ocr_engine="pdfplumber",
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
                ocr_engine="tesseract",
                extracted_data=extracted_data
            )

        except Exception as e:
            logger.error(f"OCR failed: {e}")
            return OCRResult(
                success=False,
                error=f"OCR processing failed: {e}"
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
                ocr_engine="tesseract",
                extracted_data=extracted_data
            )

        except Exception as e:
            logger.error(f"Image OCR failed: {e}")
            return OCRResult(
                success=False,
                error=f"Image processing failed: {e}"
            )
    
    def _extract_contract_data(self, text: str) -> Dict[str, Any]:
        """Extract structured data from contract text"""
        parties = self._extract_parties(text)
        counterparty = self._extract_counterparty(text, parties)
        start_date = self._extract_start_date(text)
        end_date = self._extract_end_date(text)
        
        data = {
            "contract_number": self._extract_contract_number(text),
            "counterparty": counterparty,
            "contract_type": self._extract_contract_type(text),
            "contract_value": self._extract_contract_value(text),
            "project_name": self._extract_project_name(text),
            "start_date": start_date,
            "end_date": end_date,
            "duration_months": self._calculate_duration_months(start_date, end_date),
            "parties": parties,
        }
        return data
    
    def _extract_counterparty(self, text: str, parties: List[Dict[str, str]]) -> Optional[str]:
        """Extract counterparty name (the other party, not government)"""
        # First check parties list for contractor type
        for party in parties:
            if party.get("type") == "contractor":
                return party.get("name")
        
        # Look for company patterns
        company_patterns = [
            r"บริษัท\s*([\u0E01-\u0E5BA-Za-z0-9\s\.\-]+)\s*(จำกัด|มหาชน|Limited)",
            r"ห้างหุ้นส่วน\s*([\u0E01-\u0E5BA-Za-z0-9\s\.\-]+)",
            r"ผู้รับจ้าง\s*[:\s]*([\u0E01-\u0E5BA-Za-z0-9\s\.\-]+)(?:\n|และ|กับ)",
        ]
        for pattern in company_patterns:
            match = re.search(pattern, text)
            if match:
                name = match.group(1).strip()
                # Clean up common suffixes
                name = re.sub(r'\s+(จำกัด|มหาชน|Limited|Ltd\.?).*$', '', name, flags=re.IGNORECASE)
                return name
        return None
    
    def _extract_contract_type(self, text: str) -> Optional[str]:
        """Extract contract type/category"""
        type_patterns = [
            (r"จ้างเหมา|เหมา\s*([ก-์]+)|งานเหมา", "เหมาก่อสร้าง"),
            (r"จัดซื้อ|ซื้อ\s*([ก-์]+)| procurement", "จัดซื้อ"),
            (r"จัดจ้าง|บริการ|service|maintenance", "จัดจ้างบริการ"),
            (r"เช่า|rental|lease", "เช่า"),
            (r"ประกัน|insurance", "ประกันภัย"),
            (r"ก่อสร้าง|construction|build", "ก่อสร้าง"),
            (r"ซ่อมแซม|ซ่อมบำรุง|repair|maintenance", "ซ่อมบำรุง"),
            (r"จัดหา|furnish|supply", "จัดหาอุปกรณ์"),
            (r"พัฒนา|พัฒนาระบบ|develop|software", "พัฒนาระบบ"),
            (r"วิจัย|research|R&D", "วิจัยและพัฒนา"),
            (r"ฝึกอบรม|training|สัมมนา", "ฝึกอบรม"),
            (r"ให้บริการ|บริการ", "จัดจ้างบริการ"),
        ]
        
        # Check in first 2000 characters (usually header area)
        header_text = text[:2000].lower()
        for pattern, contract_type in type_patterns:
            if re.search(pattern, header_text, re.IGNORECASE):
                return contract_type
        
        # Check full text if not found in header
        for pattern, contract_type in type_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return contract_type
        
        return None
    
    def _calculate_duration_months(self, start_date: Optional[str], end_date: Optional[str]) -> Optional[int]:
        """Calculate contract duration in months"""
        if not start_date or not end_date:
            return None
        
        try:
            # Try to parse Thai date format
            thai_months = {
                'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4,
                'พฤษภาคม': 5, 'มิถุนายน': 6, 'กรกฎาคม': 7, 'สิงหาคม': 8,
                'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
                'ม\.ค\.': 1, 'ก\.พ\.': 2, 'มี\.ค\.': 3, 'เม\.ย\.': 4,
                'พ\.ค\.': 5, 'มิ\.ย\.': 6, 'ก\.ค\.': 7, 'ส\.ค\.': 8,
                'ก\.ย\.': 9, 'ต\.ค\.': 10, 'พ\.ย\.': 11, 'ธ\.ค\.': 12,
            }
            
            # Try DD/MM/YYYY format
            for date_str in [start_date, end_date]:
                if '/' in date_str:
                    parts = date_str.split('/')
                    if len(parts) == 3:
                        day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                        if year < 2500:
                            year += 543
                        if date_str == start_date:
                            start_dt = datetime(year, month, day)
                        else:
                            end_dt = datetime(year, month, day)
                else:
                    # Try Thai format
                    for thai_month, num in thai_months.items():
                        if thai_month in date_str:
                            match = re.search(r'(\d{1,2})\s*' + re.escape(thai_month) + r'\s*(\d{4})', date_str)
                            if match:
                                day = int(match.group(1))
                                year = int(match.group(2))
                                if year < 2500:
                                    year += 543
                                if date_str == start_date:
                                    start_dt = datetime(year, num, day)
                                else:
                                    end_dt = datetime(year, num, day)
                                break
            
            # Calculate months difference
            months = (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month)
            return max(1, months)  # Minimum 1 month
        except:
            return None
    
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
