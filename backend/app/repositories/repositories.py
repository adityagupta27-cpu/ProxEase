from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.models import (
    Teacher,
    TeacherSchedule,
    Absence,
    Exception as DBException,
    ProxyAssignment,
    ProxyHistory,
    Setting,
    AuditLog,
)

class TeacherRepository(BaseRepository[Teacher]):
    def __init__(self):
        super().__init__(Teacher)

    def get_by_name(self, db: Session, name: str):
        return db.query(Teacher).filter(Teacher.name == name).first()

class ScheduleRepository(BaseRepository[TeacherSchedule]):
    def __init__(self):
        super().__init__(TeacherSchedule)

    def get_by_teacher_and_day(self, db: Session, teacher_id: int, day: str):
        return db.query(TeacherSchedule).filter(
            TeacherSchedule.teacher_id == teacher_id,
            TeacherSchedule.day == day
        ).order_by(TeacherSchedule.period_no).all()

    def get_by_day_and_period(self, db: Session, day: str, period_no: int):
        return db.query(TeacherSchedule).filter(
            TeacherSchedule.day == day,
            TeacherSchedule.period_no == period_no
        ).all()

class AbsenceRepository(BaseRepository[Absence]):
    def __init__(self):
        super().__init__(Absence)

    def get_by_date(self, db: Session, date: str):
        return db.query(Absence).filter(Absence.date == date).all()

    def get_by_teacher_and_date(self, db: Session, teacher_id: int, date: str):
        return db.query(Absence).filter(
            Absence.teacher_id == teacher_id,
            Absence.date == date
        ).all()

class ExceptionRepository(BaseRepository[DBException]):
    def __init__(self):
        super().__init__(DBException)

    def get_by_date(self, db: Session, date: str):
        return db.query(DBException).filter(DBException.date == date).all()

    def get_by_teacher_and_date(self, db: Session, teacher_id: int, date: str):
        return db.query(DBException).filter(
            DBException.teacher_id == teacher_id,
            DBException.date == date
        ).all()

class ProxyAssignmentRepository(BaseRepository[ProxyAssignment]):
    def __init__(self):
        super().__init__(ProxyAssignment)

    def get_by_date(self, db: Session, date: str):
        return db.query(ProxyAssignment).filter(ProxyAssignment.date == date).all()

class ProxyHistoryRepository(BaseRepository[ProxyHistory]):
    def __init__(self):
        super().__init__(ProxyHistory)

    def get_by_teacher(self, db: Session, teacher_id: int):
        return db.query(ProxyHistory).filter(ProxyHistory.teacher_id == teacher_id).all()

    def get_by_teacher_and_date(self, db: Session, teacher_id: int, date: str):
        return db.query(ProxyHistory).filter(
            ProxyHistory.teacher_id == teacher_id,
            ProxyHistory.date == date
        ).first()

class SettingRepository(BaseRepository[Setting]):
    def __init__(self):
        super().__init__(Setting)

    def get_by_key(self, db: Session, key: str):
        return db.query(Setting).filter(Setting.key == key).first()

class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog)

    def get_recent(self, db: Session, limit: int = 100):
        return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
