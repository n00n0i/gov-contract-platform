"""
Document Service - Business Logic

This service now uses centralized OCR Settings for all document processing.
All OCR operations use settings from Settings > OCR (OCRSettingsService).
"""
import io
import uuid
import logging
import asyncio
from typing import Optional, BinaryIO
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.contract import ContractAttachment, Contract, ContractStatus, ContractType, ClassificationLevel
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, OCRResult, DocumentStatus, FileType, DocumentType
)
from app.services.storage.minio_service import get_storage_service
from app.services.document.ocr_service import get_ocr_service, OCRService
from app.services.document.ocr_settings_service import get_ocr_settings_service, OCRSettingsService
from app.services.agent.trigger_service import on_contract_created
from sqlalchemy import func

logger = logging.getLogger(__name__)


class DocumentService:
    """Document management service"""
    
    def __init__(self, db: Session, user_id: str = None, tenant_id: str = None):
        self.db = db
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.storage = get_storage_service()
    
    async def upload_document(
        self,
        file: BinaryIO,
        filename: str,
        content_type: str,
        document_data: DocumentCreate
    ) -> ContractAttachment:
        """
        Upload and process document
        
        Flow:
        1. Upload file to MinIO
        2. If document_type is 'contract' and contract_id is None, create a new Contract
        3. Create document record (attach to existing or new contract)
        4. Queue OCR processing (async)
        """
        try:
            # Upload to storage
            upload_result = self.storage.upload_file(
                file_data=file,
                filename=filename,
                content_type=content_type,
                folder=f"tenant_{self.tenant_id or 'default'}/documents",
                metadata={
                    "uploaded_by": self.user_id,
                    "document_type": document_data.document_type.value if hasattr(document_data.document_type, 'value') else str(document_data.document_type),
                    "original_filename": filename
                }
            )
            
            # Determine file type
            file_type = self._get_file_type(content_type, filename)
            extension = filename.split('.')[-1].lower() if '.' in filename else ''
            
            # If uploading a contract document without an existing contract, create one
            new_contract = None
            if document_data.document_type == DocumentType.CONTRACT and not document_data.contract_id:
                # Generate contract number based on year and sequence
                year = datetime.utcnow().year
                max_contract = self.db.query(func.max(Contract.contract_no)).filter(
                    Contract.contract_no.like(f"CON-{year}-%")
                ).scalar()
                
                if max_contract:
                    # Extract sequence number
                    seq = int(max_contract.split("-")[-1]) + 1
                    contract_no = f"CON-{year}-{seq:06d}"
                else:
                    contract_no = f"CON-{year}-000001"
                
                # Create new contract
                new_contract = Contract(
                    id=str(uuid.uuid4()),
                    contract_no=contract_no,
                    title=f"สัญญาใหม่ - {filename}",
                    title_en=f"New Contract - {filename}",
                    description=f"สร้างจากเอกสารอัปโหลด: {filename}",
                    contract_type=ContractType.PROCUREMENT,
                    classification=ClassificationLevel.RESTRICTED,
                    status=ContractStatus.DRAFT,
                    currency="THB",
                    owner_user_id=self.user_id,
                    created_by=self.user_id,
                    updated_by=self.user_id,
                )
                self.db.add(new_contract)
                self.db.commit()
                self.db.refresh(new_contract)
                
                logger.info(f"Created new contract {new_contract.id} from document upload: {contract_no}")
            
            # Create document record
            document = ContractAttachment(
                id=str(uuid.uuid4()),
                tenant_id=self.tenant_id,
                contract_id=document_data.contract_id or (new_contract.id if new_contract else None),
                
                # File info
                filename=document_data.filename or filename,
                original_filename=filename,
                file_size=upload_result["size"],
                file_type=file_type.value,
                mime_type=content_type,
                extension=extension,
                
                # Storage
                storage_path=upload_result["storage_path"],
                storage_bucket=upload_result["storage_bucket"],
                
                # Document type & description
                document_type=document_data.document_type.value if hasattr(document_data.document_type, 'value') else str(document_data.document_type),
                description=document_data.description,
                tags=document_data.tags if document_data.tags else [],
                
                # Status
                status=DocumentStatus.UPLOADING.value,
                ocr_status="pending",

                # Document role
                is_draft=document_data.is_draft if hasattr(document_data, 'is_draft') else True,
                is_main_document=document_data.is_main_document if hasattr(document_data, 'is_main_document') else False,

                # Audit
                uploaded_by=self.user_id,
                uploaded_at=datetime.utcnow(),
                is_deleted=0
            )
            
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)
            
            # If we created a new contract, update stats and trigger agents
            if new_contract:
                try:
                    await self._update_contract_stats(self.db, new_contract, self.user_id)
                except Exception as e:
                    logger.error(f"Failed to update contract stats: {e}")
                
                try:
                    await on_contract_created(
                        contract_id=new_contract.id,
                        contract_data={
                            "title": new_contract.title,
                            "value": float(new_contract.value_original) if new_contract.value_original else 0,
                            "contract_type": new_contract.contract_type.value if new_contract.contract_type else None,
                            "vendor_name": new_contract.vendor_name,
                        },
                        user_id=self.user_id
                    )
                except Exception as e:
                    logger.error(f"Failed to trigger contract agents: {e}")
            
            # Queue OCR processing (import here to avoid circular import)
            from app.tasks.document import process_document_ocr
            process_document_ocr.delay(document.id, self.tenant_id)
            
            logger.info(f"Document uploaded: {document.id} - {filename}")
            
            return document
            
        except Exception as e:
            logger.error(f"Document upload failed: {e}")
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Upload failed: {str(e)}"
            )
    
    async def _update_contract_stats(self, db: Session, contract: Contract, user_id: str):
        """
        Update contract statistics after contract creation.
        This updates dashboard stats and other aggregated data.
        """
        from app.models.user import UserActivity
        import uuid
        
        # Log activity for stats tracking
        activity = UserActivity(
            id=str(uuid.uuid4()),
            user_id=user_id,
            action="contract_created",
            entity_type="contract",
            entity_id=contract.id,
            details={
                "contract_no": contract.contract_no,
                "title": contract.title,
                "value": float(contract.value_original) if contract.value_original else 0,
                "contract_type": contract.contract_type.value if contract.contract_type else None,
                "status": contract.status.value if contract.status else None,
            }
        )
        db.add(activity)
        db.commit()
        
        logger.info(f"Updated contract stats for new contract {contract.id}")
    
    def get_document(self, document_id: str) -> ContractAttachment:
        """Get document by ID with presigned URL"""
        document = self.db.query(ContractAttachment).filter(
            ContractAttachment.id == document_id,
            ContractAttachment.is_deleted == 0
        ).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Generate download URL
        try:
            document.download_url = self.storage.get_presigned_url(
                document.storage_path,
                expires=3600
            )
        except Exception as e:
            logger.error(f"Failed to generate download URL: {e}")
            document.download_url = None
        
        return document
    
    def list_documents(
        self,
        contract_id: Optional[str] = None,
        document_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> dict:
        """List documents with filters"""
        query = self.db.query(ContractAttachment).filter(
            ContractAttachment.is_deleted == 0
        )
        
        if contract_id:
            query = query.filter(ContractAttachment.contract_id == contract_id)
        
        if document_type:
            query = query.filter(ContractAttachment.document_type == document_type)
        
        if status:
            query = query.filter(ContractAttachment.status == status)
        
        # Order by newest first
        query = query.order_by(ContractAttachment.uploaded_at.desc())
        
        # Count and paginate
        total = query.count()
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        
        # Generate URLs for each document
        for doc in items:
            try:
                doc.download_url = self.storage.get_presigned_url(
                    doc.storage_path,
                    expires=3600
                )
            except:
                doc.download_url = None
        
        pages = (total + page_size - 1) // page_size
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages
        }
    
    def update_document(
        self,
        document_id: str,
        update_data: DocumentUpdate
    ) -> ContractAttachment:
        """Update document metadata"""
        document = self.get_document(document_id)
        
        # Update fields
        if update_data.document_type:
            document.document_type = update_data.document_type.value if hasattr(update_data.document_type, 'value') else str(update_data.document_type)
        if update_data.description:
            document.description = update_data.description
        if update_data.tags:
            document.tags = update_data.tags
        if update_data.contract_id:
            document.contract_id = update_data.contract_id
        if update_data.vendor_id:
            document.vendor_id = update_data.vendor_id
        
        document.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(document)
        
        return document
    
    def delete_document(self, document_id: str):
        """Soft delete document"""
        document = self.get_document(document_id)
        
        document.is_deleted = 1
        document.deleted_by = self.user_id
        document.deleted_at = datetime.utcnow()
        
        self.db.commit()
        
        logger.info(f"Document deleted: {document_id}")
    
    def process_ocr(self, document_id: str) -> OCRResult:
        """
        Process OCR for document (called by Celery task)
        
        Uses centralized OCR Settings from Settings > OCR.
        """
        document = self.db.query(ContractAttachment).filter(
            ContractAttachment.id == document_id
        ).first()
        
        if not document:
            return OCRResult(success=False, error="Document not found")

        try:
            # Update status
            document.ocr_status = "processing"
            self.db.commit()

            # Download file
            file_data = self.storage.download_file(document.storage_path)

            # Get centralized OCR settings
            ocr_settings_service = get_ocr_settings_service(
                db=self.db,
                user_id=self.user_id
            )

            # Validate settings before processing
            validation = ocr_settings_service.validate_settings()
            if not validation["valid"]:
                error_msg = f"OCR settings validation failed: {'; '.join(validation['errors'])}"
                logger.error(f"[OCR] {error_msg}")
                document.ocr_status = "failed"
                document.ocr_error = error_msg
                self.db.commit()
                return OCRResult(success=False, error=error_msg)

            # Log OCR mode being used
            s = ocr_settings_service.get_settings()
            mode = ocr_settings_service.get_mode()
            engine = ocr_settings_service.get_engine()
            language = ocr_settings_service.get_language()
            logger.info(f"[OCR] Processing document {document_id} with mode={mode}, engine={engine}, lang={language}")

            # Build human-readable engine label and persist it early so frontend can show it
            if mode == "typhoon":
                engine_label = f"Typhoon OCR ({s.get('typhoon_model', 'typhoon-ocr')})"
            elif mode == "custom":
                cm = s.get("custom_api_model", "")
                engine_label = f"Custom API ({cm})" if cm else "Custom API"
            else:
                engine_label = f"Tesseract ({language})"
            document.ocr_engine = engine_label
            
            # Process OCR with centralized settings
            ocr_service = OCRService(ocr_settings_service=ocr_settings_service)
            result = ocr_service.process_document(file_data, document.mime_type)
            
            if result.success:
                # Update document with OCR results
                document.extracted_text = result.text
                document.ocr_confidence = result.confidence
                document.ocr_status = "completed"
                document.status = DocumentStatus.OCR_COMPLETED.value
                document.processed_at = datetime.utcnow()
                
                # Extract structured data
                if result.extracted_data:
                    document.extracted_contract_number = result.extracted_data.get("contract_number")
                    document.extracted_contract_value = result.extracted_data.get("contract_value")
                    document.extracted_start_date = result.extracted_data.get("start_date")
                    document.extracted_end_date = result.extracted_data.get("end_date")
                    document.extracted_parties = result.extracted_data.get("parties")
                    document.extracted_data = result.extracted_data
                
                logger.info(f"OCR completed for document: {document_id}")
            else:
                document.ocr_status = "failed"
                document.status = DocumentStatus.OCR_FAILED.value
                document.ocr_error = result.error
                logger.error(f"OCR failed for document: {document_id} - {result.error}")

            self.db.commit()
            return result

        except Exception as e:
            logger.error(f"OCR processing error: {e}")
            document.ocr_status = "failed"
            document.status = DocumentStatus.OCR_FAILED.value
            document.ocr_error = str(e)
            self.db.commit()

            return OCRResult(success=False, error=str(e))
    
    def verify_document(self, document_id: str, verified_data: dict) -> ContractAttachment:
        """Mark document as verified with corrections"""
        document = self.get_document(document_id)
        
        document.status = DocumentStatus.VERIFIED.value
        document.verified_by = self.user_id
        document.verified_at = datetime.utcnow()
        document.verified_data = verified_data
        
        self.db.commit()
        self.db.refresh(document)
        
        return document
    
    def _get_file_type(self, mime_type: str, filename: str) -> FileType:
        """Determine file type from MIME type or extension"""
        if mime_type == "application/pdf":
            return FileType.PDF
        elif mime_type.startswith("image/"):
            return FileType.IMAGE
        elif mime_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
            return FileType.WORD
        elif mime_type in ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]:
            return FileType.EXCEL
        else:
            # Try from extension
            ext = filename.split('.')[-1].lower() if '.' in filename else ''
            if ext == 'pdf':
                return FileType.PDF
            elif ext in ['jpg', 'jpeg', 'png', 'tiff', 'tif']:
                return FileType.IMAGE
            elif ext in ['doc', 'docx']:
                return FileType.WORD
            elif ext in ['xls', 'xlsx']:
                return FileType.EXCEL
        
        return FileType.PDF  # Default
