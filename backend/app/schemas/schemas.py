from pydantic import BaseModel
from typing import List, Optional, Any

# Teacher Schemas
class TeacherBase(BaseModel):
    name: str
    class_teacher_of: Optional[str] = None

class TeacherCreate(TeacherBase):
    pass

class TeacherResponse(TeacherBase):
    id: int
    class Config:
        from_attributes = True

# Schedule Schemas
class ScheduleResponse(BaseModel):
    id: int
    teacher_id: int
    day: str
    period_no: int
    cell_value: Optional[str] = None
    class Config:
        from_attributes = True

# Absence Schemas
class AbsenceCreate(BaseModel):
    teacher_id: int
    date: str
    type: str  # full_day, half_day_morning, half_day_afternoon, custom
    start_period: Optional[int] = None
    end_period: Optional[int] = None

class AbsenceResponse(AbsenceCreate):
    id: int
    teacher_name: Optional[str] = None
    class Config:
        from_attributes = True

# Exception Schemas
class ExceptionCreate(BaseModel):
    teacher_id: int
    date: str
    type: str  # unavailable, ceremonial_duty, exam_duty, meeting, administrative
    start_period: Optional[int] = None
    end_period: Optional[int] = None

class ExceptionResponse(ExceptionCreate):
    id: int
    teacher_name: Optional[str] = None
    class Config:
        from_attributes = True

# Proxy Assignment Schemas
class AlternativeCandidate(BaseModel):
    teacher_id: int
    name: str
    score: float
    explanation: str

class ProxyAssignmentResponse(BaseModel):
    id: int
    date: str
    absent_teacher_id: int
    absent_teacher_name: Optional[str] = None
    period_no: int
    class_name: str
    assigned_proxy_id: Optional[int] = None
    assigned_proxy_name: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    alternatives: List[AlternativeCandidate] = []
    class Config:
        from_attributes = True

# Settings Schemas
class SettingResponse(BaseModel):
    key: str
    value: str
    class Config:
        from_attributes = True

class SettingUpdate(BaseModel):
    value: str

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: int
    timestamp: str
    user_id: str
    action: str
    details: str
    class Config:
        from_attributes = True

# Dashboard summary
class DashboardSummary(BaseModel):
    total_teachers: int
    abs_count: int
    proxy_count: int
    pending_count: int

# Analytics schemas
class TeacherUtilization(BaseModel):
    teacher_id: int
    name: str
    proxy_count: int

class AnalyticsSummary(BaseModel):
    daily_history: List[Any] = []
    weekly_history: List[Any] = []
    monthly_history: List[Any] = []
    most_utilized: List[TeacherUtilization] = []
    least_utilized: List[TeacherUtilization] = []
    fairness_index: float
