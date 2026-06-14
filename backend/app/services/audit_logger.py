from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import AuditLog
from app.repositories.repositories import AuditLogRepository

class AuditLoggerService:
    @staticmethod
    def log(db: Session, action: str, details: str, user_id: str = "coordinator"):
        repo = AuditLogRepository()
        log_obj = AuditLog(
            timestamp=datetime.utcnow().isoformat() + "Z",
            user_id=user_id,
            action=action,
            details=details
        )
        repo.create(db, log_obj)
        return log_obj
