"""
MinIO Storage Service
"""
import io
import uuid
from datetime import timedelta
from typing import Optional, BinaryIO
from minio import Minio
from minio.error import S3Error
import mimetypes
import logging
from urllib.parse import quote, unquote

from app.core.config import settings

logger = logging.getLogger(__name__)


class MinIOService:
    """MinIO object storage service"""
    
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self.bucket = settings.STORAGE_BUCKET
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        """Ensure bucket exists"""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Error checking/creating bucket: {e}")
            raise
    
    def upload_file(
        self,
        file_data: BinaryIO,
        filename: str,
        content_type: Optional[str] = None,
        folder: str = "documents",
        metadata: Optional[dict] = None
    ) -> dict:
        """Upload file to MinIO
        
        Supports UTF-8 filenames by URL-encoding metadata values
        """
        try:
            ext = filename.split('.')[-1].lower() if '.' in filename else ''
            object_name = f"{folder}/{uuid.uuid4()}.{ext}" if ext else f"{folder}/{uuid.uuid4()}"
            
            if not content_type:
                content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            
            file_data.seek(0, 2)
            file_size = file_data.tell()
            file_data.seek(0)
            
            # Encode metadata values to handle UTF-8 characters (Thai, etc.)
            # MinIO metadata only supports ASCII, so we URL-encode non-ASCII characters
            encoded_metadata = {}
            if metadata:
                for key, value in metadata.items():
                    if isinstance(value, str):
                        # URL-encode UTF-8 characters, keep ASCII as-is
                        encoded_metadata[key] = quote(value.encode('utf-8'), safe='')
                    else:
                        encoded_metadata[key] = value
            
            # Always store original filename (URL-encoded)
            encoded_metadata['original-filename'] = quote(filename.encode('utf-8'), safe='')
            
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=file_data,
                length=file_size,
                content_type=content_type,
                metadata=encoded_metadata
            )
            
            logger.info(f"Uploaded file: {object_name} ({file_size} bytes)")
            
            return {
                "storage_path": object_name,
                "storage_bucket": self.bucket,
                "size": file_size,
                "content_type": content_type
            }
            
        except S3Error as e:
            logger.error(f"Error uploading file: {e}")
            raise
    
    def get_presigned_url(self, object_name: str, expires: int = 604800) -> str:
        """Generate presigned URL for file access
        
        Default expires: 7 days (604800 seconds) - same as JWT token
        Max allowed by MinIO: 7 days
        """
        try:
            url = self.client.presigned_get_object(
                bucket_name=self.bucket,
                object_name=object_name,
                expires=timedelta(seconds=expires)
            )
            return url
        except S3Error as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise
    
    def get_object_metadata(self, object_name: str) -> dict:
        """Get object metadata with UTF-8 decoded values
        
        Decodes URL-encoded metadata values back to UTF-8 strings
        """
        try:
            stat = self.client.stat_object(self.bucket, object_name)
            metadata = stat.metadata or {}
            
            # Decode URL-encoded metadata values
            decoded_metadata = {}
            for key, value in metadata.items():
                if isinstance(value, str):
                    try:
                        decoded_metadata[key] = unquote(value)
                    except:
                        decoded_metadata[key] = value
                else:
                    decoded_metadata[key] = value
            
            return decoded_metadata
        except S3Error as e:
            logger.error(f"Error getting metadata: {e}")
            return {}
    
    def get_file_stream(self, object_name: str):
        """Get file as stream for proxy download (no expiration)
        
        Use this when you need permanent access via backend proxy
        """
        try:
            response = self.client.get_object(self.bucket, object_name)
            return response
        except S3Error as e:
            logger.error(f"Error getting file stream: {e}")
            raise
    
    def download_file(self, object_name: str) -> bytes:
        """Download file from MinIO"""
        try:
            response = self.client.get_object(self.bucket, object_name)
            data = response.read()
            response.close()
            return data
        except S3Error as e:
            logger.error(f"Error downloading file: {e}")
            raise
    
    def delete_file(self, object_name: str) -> bool:
        """Delete file from MinIO"""
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"Deleted file: {object_name}")
            return True
        except S3Error as e:
            logger.error(f"Error deleting file: {e}")
            return False


_storage_service = None

def get_storage_service() -> MinIOService:
    """Get storage service singleton"""
    global _storage_service
    if _storage_service is None:
        _storage_service = MinIOService()
    return _storage_service
