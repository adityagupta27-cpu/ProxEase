import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Teacher, TeacherSchedule, Absence, Exception as DBException, ProxyAssignment, ProxyHistory, Setting, AuditLog
from app.schemas.schemas import (
    TeacherResponse, ScheduleResponse, AbsenceCreate, AbsenceResponse,
    ExceptionCreate, ExceptionResponse, ProxyAssignmentResponse,
    SettingResponse, SettingUpdate, AuditLogResponse, DashboardSummary, AnalyticsSummary
)
from app.repositories.repositories import (
    TeacherRepository, ScheduleRepository, AbsenceRepository, ExceptionRepository,
    ProxyAssignmentRepository, ProxyHistoryRepository, SettingRepository, AuditLogRepository
)
from app.services.excel_parser import ExcelParserService
from app.services.optimization_solver import OptimizationSolverService
from app.services.audit_logger import AuditLoggerService

router = APIRouter()

# --- TIMETABLE & TEACHERS ---

@router.post("/timetable/upload")
def upload_timetable(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import tempfile
    import os

    # Save uploaded file temporarily
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        report, teachers_data = ExcelParserService.parse_timetable(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    if not report["success"]:
        AuditLoggerService.log(db, "UPLOAD_TIMETABLE_FAILED", f"Timetable upload failed: {', '.join(report['errors'])}")
        raise HTTPException(status_code=400, detail={"report": report})

    # Clear old database records
    db.query(TeacherSchedule).delete()
    db.query(ProxyHistory).delete()
    db.query(ProxyAssignment).delete()
    db.query(Absence).delete()
    db.query(DBException).delete()
    # Delete teachers but retain FK cascading
    db.query(Teacher).delete()
    db.commit()

    # Bulk insert
    for t_data in teachers_data:
        t_model = Teacher(name=t_data["name"], class_teacher_of=t_data["class_teacher_of"])
        db.add(t_model)
        db.commit()
        db.refresh(t_model)

        # Insert schedule
        for day, periods in t_data["schedule"].items():
            for period_no, cell_value in periods.items():
                sched = TeacherSchedule(
                    teacher_id=t_model.id,
                    day=day,
                    period_no=period_no,
                    cell_value=cell_value
                )
                db.add(sched)
        db.commit()

    AuditLoggerService.log(
        db,
        "UPLOAD_TIMETABLE",
        f"Successfully parsed timetable. Teachers: {len(teachers_data)}, Periods: {report['total_periods']}, Warnings: {len(report['warnings'])}"
    )

    return {"message": "Timetable uploaded and parsed successfully", "report": report}

@router.get("/teachers", response_model=List[TeacherResponse])
def get_teachers(db: Session = Depends(get_db)):
    return db.query(Teacher).all()

@router.get("/timetable/explorer")
def explore_timetable(
    teacher_name: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    day: Optional[str] = Query(None),
    period_no: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(TeacherSchedule).join(Teacher)
    if teacher_name:
        query = query.filter(Teacher.name.like(f"%{teacher_name}%"))
    if class_name:
        query = query.filter(TeacherSchedule.cell_value == class_name)
    if day:
        # Match day capitalized
        query = query.filter(TeacherSchedule.day == day.capitalize())
    if period_no:
        query = query.filter(TeacherSchedule.period_no == period_no)

    results = query.order_by(Teacher.name, TeacherSchedule.day, TeacherSchedule.period_no).all()
    
    explorer_data = []
    for r in results:
        explorer_data.append({
            "id": r.id,
            "teacher_id": r.teacher_id,
            "teacher_name": r.teacher.name,
            "day": r.day,
            "period_no": r.period_no,
            "cell_value": r.cell_value
        })
    return explorer_data

# --- ABSENTEES ---

@router.post("/absentees", response_model=AbsenceResponse)
def create_absence(absence: AbsenceCreate, db: Session = Depends(get_db)):
    # Check if duplicate exists
    existing = db.query(Absence).filter(
        Absence.teacher_id == absence.teacher_id,
        Absence.date == absence.date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Teacher already marked absent for this date.")

    db_abs = Absence(
        teacher_id=absence.teacher_id,
        date=absence.date,
        type=absence.type,
        start_period=absence.start_period,
        end_period=absence.end_period
    )
    db.add(db_abs)
    db.commit()
    db.refresh(db_abs)

    teacher = db.query(Teacher).filter(Teacher.id == db_abs.teacher_id).first()
    t_name = teacher.name if teacher else f"ID {db_abs.teacher_id}"
    
    AuditLoggerService.log(
        db,
        "MARK_ABSENCE",
        f"Marked {t_name} absent today ({db_abs.type}, date: {db_abs.date})"
    )

    return AbsenceResponse(
        id=db_abs.id,
        teacher_id=db_abs.teacher_id,
        teacher_name=t_name,
        date=db_abs.date,
        type=db_abs.type,
        start_period=db_abs.start_period,
        end_period=db_abs.end_period
    )

@router.get("/absentees", response_model=List[AbsenceResponse])
def get_absences(date: str = Query(...), db: Session = Depends(get_db)):
    results = db.query(Absence).filter(Absence.date == date).all()
    response = []
    for r in results:
        teacher = db.query(Teacher).filter(Teacher.id == r.teacher_id).first()
        response.append(AbsenceResponse(
            id=r.id,
            teacher_id=r.teacher_id,
            teacher_name=teacher.name if teacher else None,
            date=r.date,
            type=r.type,
            start_period=r.start_period,
            end_period=r.end_period
        ))
    return response

@router.delete("/absentees/{id}")
def delete_absence(id: int, db: Session = Depends(get_db)):
    repo = AbsenceRepository()
    deleted = repo.delete(db, id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Absence not found.")
        
    teacher = db.query(Teacher).filter(Teacher.id == deleted.teacher_id).first()
    AuditLoggerService.log(
        db,
        "REMOVE_ABSENCE",
        f"Removed absence entry for {teacher.name if teacher else 'Unknown'} (date: {deleted.date})"
    )
    return {"message": "Absence entry deleted successfully"}

# --- EXCEPTIONS ---

@router.post("/exceptions", response_model=ExceptionResponse)
def create_exception(exc: ExceptionCreate, db: Session = Depends(get_db)):
    db_exc = DBException(
        teacher_id=exc.teacher_id,
        date=exc.date,
        type=exc.type,
        start_period=exc.start_period,
        end_period=exc.end_period
    )
    db.add(db_exc)
    db.commit()
    db.refresh(db_exc)

    teacher = db.query(Teacher).filter(Teacher.id == db_exc.teacher_id).first()
    t_name = teacher.name if teacher else f"ID {db_exc.teacher_id}"
    
    AuditLoggerService.log(
        db,
        "CREATE_EXCEPTION",
        f"Added exception '{db_exc.type}' for {t_name} on {db_exc.date}"
    )

    return ExceptionResponse(
        id=db_exc.id,
        teacher_id=db_exc.teacher_id,
        teacher_name=t_name,
        date=db_exc.date,
        type=db_exc.type,
        start_period=db_exc.start_period,
        end_period=db_exc.end_period
    )

@router.get("/exceptions", response_model=List[ExceptionResponse])
def get_exceptions(date: str = Query(...), db: Session = Depends(get_db)):
    results = db.query(DBException).filter(DBException.date == date).all()
    response = []
    for r in results:
        teacher = db.query(Teacher).filter(Teacher.id == r.teacher_id).first()
        response.append(ExceptionResponse(
            id=r.id,
            teacher_id=r.teacher_id,
            teacher_name=teacher.name if teacher else None,
            date=r.date,
            type=r.type,
            start_period=r.start_period,
            end_period=r.end_period
        ))
    return response

@router.delete("/exceptions/{id}")
def delete_exception(id: int, db: Session = Depends(get_db)):
    repo = ExceptionRepository()
    deleted = repo.delete(db, id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Exception not found.")
        
    teacher = db.query(Teacher).filter(Teacher.id == deleted.teacher_id).first()
    AuditLoggerService.log(
        db,
        "REMOVE_EXCEPTION",
        f"Removed exception '{deleted.type}' for {teacher.name if teacher else 'Unknown'} on {deleted.date}"
    )
    return {"message": "Exception entry deleted successfully"}

# --- PROXY SOLVER & GENERATION ---

@router.post("/proxies/generate", response_model=List[ProxyAssignmentResponse])
def generate_proxies(date: str = Query(...), db: Session = Depends(get_db)):
    try:
        assignments = OptimizationSolverService.solve(db, date)
        
        # Format response
        response = []
        for a in assignments:
            abs_t = db.query(Teacher).filter(Teacher.id == a.absent_teacher_id).first()
            proxy_t = db.query(Teacher).filter(Teacher.id == a.assigned_proxy_id).first() if a.assigned_proxy_id else None
            
            alts_raw = json.loads(a.alternatives) if a.alternatives else []
            
            response.append(ProxyAssignmentResponse(
                id=a.id,
                date=a.date,
                absent_teacher_id=a.absent_teacher_id,
                absent_teacher_name=abs_t.name if abs_t else None,
                period_no=a.period_no,
                class_name=a.class_name,
                assigned_proxy_id=a.assigned_proxy_id,
                assigned_proxy_name=proxy_t.name if proxy_t else None,
                score=a.score,
                explanation=a.explanation,
                alternatives=alts_raw
            ))
            
        AuditLoggerService.log(
            db,
            "GENERATE_PROXIES",
            f"Generated proxy assignments for date: {date}. Assignments: {len(assignments)}"
        )
        return response
    except Exception as e:
        logger_err = f"Failed to generate proxies: {str(e)}"
        AuditLoggerService.log(db, "GENERATE_PROXIES_FAILED", logger_err)
        raise HTTPException(status_code=500, detail=logger_err)

@router.get("/proxies/results", response_model=List[ProxyAssignmentResponse])
def get_proxy_results(date: str = Query(...), db: Session = Depends(get_db)):
    results = db.query(ProxyAssignment).filter(ProxyAssignment.date == date).all()
    response = []
    for r in results:
        abs_t = db.query(Teacher).filter(Teacher.id == r.absent_teacher_id).first()
        proxy_t = db.query(Teacher).filter(Teacher.id == r.assigned_proxy_id).first() if r.assigned_proxy_id else None
        
        alts_raw = json.loads(r.alternatives) if r.alternatives else []
        
        response.append(ProxyAssignmentResponse(
            id=r.id,
            date=r.date,
            absent_teacher_id=r.absent_teacher_id,
            absent_teacher_name=abs_t.name if abs_t else None,
            period_no=r.period_no,
            class_name=r.class_name,
            assigned_proxy_id=r.assigned_proxy_id,
            assigned_proxy_name=proxy_t.name if proxy_t else None,
            score=r.score,
            explanation=r.explanation,
            alternatives=alts_raw
        ))
    return response

@router.post("/proxies/{id}/reassign", response_model=ProxyAssignmentResponse)
def reassign_proxy(id: int, db: Session = Depends(get_db)):
    assignment = db.query(ProxyAssignment).filter(ProxyAssignment.id == id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Proxy assignment not found.")

    abs_t = db.query(Teacher).filter(Teacher.id == assignment.absent_teacher_id).first()
    old_proxy = db.query(Teacher).filter(Teacher.id == assignment.assigned_proxy_id).first() if assignment.assigned_proxy_id else None

    # Perform reassignment
    updated = OptimizationSolverService.reassign_proxy(db, id)
    
    new_proxy = db.query(Teacher).filter(Teacher.id == updated.assigned_proxy_id).first() if updated.assigned_proxy_id else None
    
    old_name = old_proxy.name if old_proxy else "None"
    new_name = new_proxy.name if new_proxy else "None"
    
    AuditLoggerService.log(
        db,
        "REASSIGN_PROXY",
        f"Reassigned Period {updated.period_no} class {updated.class_name} for absent {abs_t.name if abs_t else 'Unknown'}. Replaced {old_name} with {new_name}."
    )

    alts_raw = json.loads(updated.alternatives) if updated.alternatives else []

    return ProxyAssignmentResponse(
        id=updated.id,
        date=updated.date,
        absent_teacher_id=updated.absent_teacher_id,
        absent_teacher_name=abs_t.name if abs_t else None,
        period_no=updated.period_no,
        class_name=updated.class_name,
        assigned_proxy_id=updated.assigned_proxy_id,
        assigned_proxy_name=new_name,
        score=updated.score,
        explanation=updated.explanation,
        alternatives=alts_raw
    )

# --- SETTINGS ---

@router.get("/settings", response_model=List[SettingResponse])
def get_settings(db: Session = Depends(get_db)):
    defaults = OptimizationSolverService.get_default_settings()
    for k, v in defaults.items():
        existing = db.query(Setting).filter(Setting.key == k).first()
        if not existing:
            # Create setting in DB
            db.add(Setting(key=k, value=str(v)))
            db.commit()
    return db.query(Setting).all()

@router.put("/settings/{key}", response_model=SettingResponse)
def update_setting(key: str, setting: SettingUpdate, db: Session = Depends(get_db)):
    db_setting = db.query(Setting).filter(Setting.key == key).first()
    if not db_setting:
        db_setting = Setting(key=key, value=setting.value)
        db.add(db_setting)
    else:
        db_setting.value = setting.value
    db.commit()
    db.refresh(db_setting)
    
    AuditLoggerService.log(db, "UPDATE_SETTINGS", f"Updated setting '{key}' to value '{setting.value}'")
    return db_setting

# --- AUDIT LOGS ---

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(limit: int = 100, db: Session = Depends(get_db)):
    repo = AuditLogRepository()
    return repo.get_recent(db, limit)

# --- DASHBOARD & ANALYTICS ---

@router.get("/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary(date: str = Query(...), db: Session = Depends(get_db)):
    t_count = db.query(Teacher).count()
    abs_count = db.query(Absence).filter(Absence.date == date).count()
    
    proxies = db.query(ProxyAssignment).filter(ProxyAssignment.date == date).all()
    proxy_count = sum(1 for p in proxies if p.assigned_proxy_id is not None)
    pending_count = sum(1 for p in proxies if p.assigned_proxy_id is None)

    return DashboardSummary(
        total_teachers=t_count,
        abs_count=abs_count,
        proxy_count=proxy_count,
        pending_count=pending_count
    )

def calculate_fairness_for_date(db: Session, date_str: str, teachers: List[Teacher]) -> Optional[float]:
    try:
        parts = list(map(int, date_str.split('-')))
        import datetime
        dt = datetime.date(parts[0], parts[1], parts[2])
        day_name = dt.strftime('%A')
    except Exception:
        return None

    # Get absent teacher IDs for this date
    absent_ids = [a.teacher_id for a in db.query(Absence).filter(Absence.date == date_str).all()]
    present_teachers = [t for t in teachers if t.id not in absent_ids]
    if not present_teachers:
        return None

    # Get proxy assignments count per teacher on this date
    proxies_by_teacher = {}
    assignments = db.query(ProxyAssignment).filter(ProxyAssignment.date == date_str).all()
    for a in assignments:
        if a.assigned_proxy_id:
            proxies_by_teacher[a.assigned_proxy_id] = proxies_by_teacher.get(a.assigned_proxy_id, 0) + 1

    net_frees = []
    for t in present_teachers:
        base_free = db.query(TeacherSchedule).filter(
            TeacherSchedule.teacher_id == t.id,
            TeacherSchedule.day == day_name,
            (TeacherSchedule.cell_value == None) | (TeacherSchedule.cell_value == "") | (TeacherSchedule.cell_value == "-")
        ).count()
        assigned = proxies_by_teacher.get(t.id, 0)
        net_free = max(0, base_free - assigned)
        net_frees.append(net_free)

    n = len(net_frees)
    if n == 0:
        return None
    sum_x = sum(net_frees)
    sum_x2 = sum(x**2 for x in net_frees)
    if sum_x2 == 0:
        return 1.0
    return (sum_x ** 2) / (n * sum_x2)


def calculate_baseline_weekly_fairness(db: Session, teachers: List[Teacher]) -> float:
    day_fairness = []
    for day_name in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']:
        base_frees = []
        for t in teachers:
            base_free = db.query(TeacherSchedule).filter(
                TeacherSchedule.teacher_id == t.id,
                TeacherSchedule.day == day_name,
                (TeacherSchedule.cell_value == None) | (TeacherSchedule.cell_value == "") | (TeacherSchedule.cell_value == "-")
            ).count()
            base_frees.append(base_free)
        n = len(base_frees)
        if n > 0:
            sum_x = sum(base_frees)
            sum_x2 = sum(x**2 for x in base_frees)
            if sum_x2 > 0:
                day_fairness.append((sum_x ** 2) / (n * sum_x2))
            else:
                day_fairness.append(1.0)
    if not day_fairness:
        return 1.0
    return sum(day_fairness) / len(day_fairness)


@router.get("/analytics", response_model=AnalyticsSummary)
def get_analytics(date: Optional[str] = None, db: Session = Depends(get_db)):
    # 1. Get daily, weekly, monthly proxy statistics
    # Standard query grouped by date
    daily_stats = db.query(ProxyHistory.date, sqlalchemy.func.sum(ProxyHistory.count)).group_by(ProxyHistory.date).all()
    daily_history = [{"date": r[0], "count": int(r[1])} for r in daily_stats]
    
    # Get absent teacher IDs for the specified date to exclude them from the metrics
    absent_ids = []
    if date:
        absent_ids = [a.teacher_id for a in db.query(Absence).filter(Absence.date == date).all()]
    
    # 2. Get utilization counts for all teachers
    # We query ProxyHistory to count total proxies taken by each teacher
    teachers = db.query(Teacher).all()
    utilizations = []
    
    for t in teachers:
        if t.id in absent_ids:
            continue
        total_history = db.query(sqlalchemy.func.sum(ProxyHistory.count)).filter(ProxyHistory.teacher_id == t.id).scalar()
        utilizations.append({
            "teacher_id": t.id,
            "name": t.name,
            "proxy_count": int(total_history) if total_history else 0
        })

    # Sort
    util_sorted = sorted(utilizations, key=lambda x: x["proxy_count"])
    most_utilized = util_sorted[-5:][::-1]  # Top 5 highest
    least_utilized = util_sorted[:5]        # Top 5 lowest

    # 3. Calculate Jain's Fairness Index based on net free periods of present teachers after proxy allocation
    history_dates = db.query(ProxyAssignment.date).distinct().all()
    history_dates = [d[0] for d in history_dates if d[0]]

    fairness_scores = []
    for d_str in history_dates:
        score = calculate_fairness_for_date(db, d_str, teachers)
        if score is not None:
            fairness_scores.append(score)

    if fairness_scores:
        fairness_index = sum(fairness_scores) / len(fairness_scores)
    else:
        fairness_index = calculate_baseline_weekly_fairness(db, teachers)

    return AnalyticsSummary(
        daily_history=daily_history,
        most_utilized=most_utilized,
        least_utilized=least_utilized,
        fairness_index=round(fairness_index, 4)
    )

# Required imports for aggregation
import sqlalchemy
