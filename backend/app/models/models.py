from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, unique=True, index=True, nullable=False)
    class_teacher_of = Column(String, nullable=True)

    # Relationships
    schedules = relationship("TeacherSchedule", back_populates="teacher", cascade="all, delete-orphan")
    absences = relationship("Absence", back_populates="teacher", cascade="all, delete-orphan")
    exceptions = relationship("Exception", back_populates="teacher", cascade="all, delete-orphan")

class TeacherSchedule(Base):
    __tablename__ = "teacher_schedule"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    day = Column(String, nullable=False)  # Monday, Tuesday, etc.
    period_no = Column(Integer, nullable=False)  # 1 to 8
    cell_value = Column(String, nullable=True)  # e.g., '1', 'Nursery', 'B', '-', or null for free

    teacher = relationship("Teacher", back_populates="schedules")

class Absence(Base):
    __tablename__ = "absences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    type = Column(String, nullable=False)  # full_day, half_day_morning, half_day_afternoon, custom
    start_period = Column(Integer, nullable=True)  # 1 to 8 (relevant for custom / half_day)
    end_period = Column(Integer, nullable=True)    # 1 to 8 (relevant for custom / half_day)

    teacher = relationship("Teacher", back_populates="absences")

class Exception(Base):
    __tablename__ = "exceptions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    type = Column(String, nullable=False)  # unavailable, ceremonial_duty, exam_duty, meeting, administrative
    start_period = Column(Integer, nullable=True)  # 1 to 8
    end_period = Column(Integer, nullable=True)    # 1 to 8

    teacher = relationship("Teacher", back_populates="exceptions")

class ProxyAssignment(Base):
    __tablename__ = "proxy_assignments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    absent_teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    period_no = Column(Integer, nullable=False)
    class_name = Column(String, nullable=False)
    assigned_proxy_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)  # Null if unassigned (unsolvable)
    score = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    alternatives = Column(Text, nullable=True)  # JSON-serialized list of alternative candidate dicts

    absent_teacher = relationship("Teacher", foreign_keys=[absent_teacher_id])
    assigned_proxy = relationship("Teacher", foreign_keys=[assigned_proxy_id])

class ProxyHistory(Base):
    __tablename__ = "proxy_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    count = Column(Integer, default=0, nullable=False)

    teacher = relationship("Teacher")

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, nullable=False)  # ISO-8601 string
    user_id = Column(String, nullable=False)  # e.g., admin, coordinator
    action = Column(String, nullable=False)  # e.g., GENERATE_PROXIES, REASSIGN_PROXY, MARK_ABSENCE, UPDATE_SETTINGS
    details = Column(Text, nullable=False)
