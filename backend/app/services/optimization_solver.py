import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.models.models import Teacher, TeacherSchedule, Absence, Exception as DBException, ProxyAssignment, ProxyHistory, Setting
from app.repositories.repositories import TeacherRepository, ScheduleRepository, AbsenceRepository, ExceptionRepository, ProxyAssignmentRepository, ProxyHistoryRepository, SettingRepository
from app.services.explanation_engine import ExplanationEngine

logger = logging.getLogger(__name__)

class OptimizationSolverService:
    @staticmethod
    def get_default_settings() -> Dict[str, Any]:
        return {
            "daily_proxy_limit": 6,
            "min_free_periods": 0,
            "weight_free": 40,
            "weight_familiarity": 50,
            "weight_daily": 30,
            "weight_weekly": 20,
            "weight_monthly": 10,
            "weight_consecutive": -30,
            "weight_last_free": -1000,
            "blocked_symbols": "B,-"
        }

    @classmethod
    def get_settings(cls, db: Session) -> Dict[str, Any]:
        repo = SettingRepository()
        defaults = cls.get_default_settings()
        settings = {}
        for k, v in defaults.items():
            setting_obj = repo.get_by_key(db, k)
            if setting_obj:
                try:
                    if isinstance(v, int):
                        settings[k] = int(setting_obj.value)
                    else:
                        settings[k] = setting_obj.value
                except ValueError:
                    settings[k] = v
            else:
                settings[k] = v
        return settings

    @classmethod
    def solve(cls, db: Session, date_str: str) -> List[ProxyAssignment]:
        # Parse day of week
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = dt.strftime("%A")  # Monday, Tuesday, etc.

        settings = cls.get_settings(db)
        blocked_symbols = [s.strip() for s in settings["blocked_symbols"].split(",")]

        # Delete existing proxy assignments and history records for this date first
        # to ensure deterministic behavior on subsequent solves.
        db.query(ProxyAssignment).filter(ProxyAssignment.date == date_str).delete()
        db.query(ProxyHistory).filter(ProxyHistory.date == date_str).delete()
        db.commit()

        # Load all data
        teacher_repo = TeacherRepository()
        absence_repo = AbsenceRepository()
        exception_repo = ExceptionRepository()
        schedule_repo = ScheduleRepository()

        teachers = teacher_repo.get_all(db)
        absences = absence_repo.get_by_date(db, date_str)
        exceptions = exception_repo.get_by_date(db, date_str)

        # Map absences and exceptions by teacher_id for fast lookup
        # An absence or exception can cover full day, half day, or specific periods
        teacher_absences = {}
        for abs_obj in absences:
            teacher_absences[abs_obj.teacher_id] = abs_obj

        teacher_exceptions = {}
        for exc_obj in exceptions:
            if exc_obj.teacher_id not in teacher_exceptions:
                teacher_exceptions[exc_obj.teacher_id] = []
            teacher_exceptions[exc_obj.teacher_id].append(exc_obj)

        # Helper to check if a teacher is absent/unavailable during a specific period
        def is_teacher_unavailable(t_id: int, p_num: int) -> Tuple[bool, str]:
            # Check absence
            if t_id in teacher_absences:
                abs_obj = teacher_absences[t_id]
                if abs_obj.type == "full_day":
                    return True, "Absent (Full Day)"
                elif abs_obj.type == "half_day_morning" and p_num <= 4:
                    return True, "Absent (Morning Half)"
                elif abs_obj.type == "half_day_afternoon" and p_num > 4:
                    return True, "Absent (Afternoon Half)"
                elif abs_obj.type == "custom" and abs_obj.start_period and abs_obj.end_period:
                    if abs_obj.start_period <= p_num <= abs_obj.end_period:
                        return True, f"Absent (Periods {abs_obj.start_period}-{abs_obj.end_period})"

            # Check exceptions
            if t_id in teacher_exceptions:
                for exc_obj in teacher_exceptions[t_id]:
                    if exc_obj.type == "unavailable":
                        if not exc_obj.start_period or (exc_obj.start_period <= p_num <= exc_obj.end_period):
                            return True, "Unavailable (Full Day)" if not exc_obj.start_period else f"Unavailable (Periods {exc_obj.start_period}-{exc_obj.end_period})"
                    else:
                        # Ceremonial, meeting, exam, administrative
                        if not exc_obj.start_period or (exc_obj.start_period <= p_num <= exc_obj.end_period):
                            return True, f"Duty: {exc_obj.type.title()}"
            return False, ""

        # Identify absent teachers and the periods they need proxies for
        absent_periods = []  # List of dict: {absent_teacher_id, period_no, class_name}
        for t in teachers:
            is_abs, reason = is_teacher_unavailable(t.id, 1)  # check broad absence
            # Let's inspect their periods
            t_schedules = schedule_repo.get_by_teacher_and_day(db, t.id, day_of_week)
            for sched in t_schedules:
                # If they have a class and are unavailable during that period
                is_p_abs, p_reason = is_teacher_unavailable(t.id, sched.period_no)
                if is_p_abs and sched.cell_value and sched.cell_value not in blocked_symbols:
                    absent_periods.append({
                        "absent_teacher_id": t.id,
                        "absent_teacher_name": t.name,
                        "period_no": sched.period_no,
                        "class_name": sched.cell_value
                    })

        if not absent_periods:
            return []

        # Find eligibility and free periods for all other teachers
        # A teacher is eligible if they are not absent/unavailable during the period AND their schedule cell is empty/None
        teacher_original_free_periods = {}  # t_id -> list of free period numbers today
        for t in teachers:
            free_p = []
            t_schedules = schedule_repo.get_by_teacher_and_day(db, t.id, day_of_week)
            for s in t_schedules:
                is_unavail, _ = is_teacher_unavailable(t.id, s.period_no)
                if not is_unavail and (not s.cell_value or s.cell_value.strip() == ""):
                    free_p.append(s.period_no)
            teacher_original_free_periods[t.id] = free_p

        # Load proxy histories for this week/month/day
        history_repo = ProxyHistoryRepository()
        teacher_histories = {}
        for t in teachers:
            # We can calculate daily/weekly/monthly history counts.
            # For this MVP, let's query the database proxy_assignments or proxy_history table.
            # To simplify, we will query proxy_history.
            # Let's sum proxy counts.
            daily_cnt = 0
            weekly_cnt = 0
            monthly_cnt = 0
            # Get histories
            histories = history_repo.get_by_teacher(db, t.id)
            for h in histories:
                # Parse date
                try:
                    h_dt = datetime.strptime(h.date, "%Y-%m-%d")
                    if h.date == date_str:
                        daily_cnt += h.count
                    # Check if in same week
                    if h_dt.isocalendar()[1] == dt.isocalendar()[1] and h_dt.year == dt.year:
                        weekly_cnt += h.count
                    # Check if in same month
                    if h_dt.month == dt.month and h_dt.year == dt.year:
                        monthly_cnt += h.count
                except Exception:
                    pass
            teacher_histories[t.id] = {
                "daily": daily_cnt,
                "weekly": weekly_cnt,
                "monthly": monthly_cnt
            }

        # Define relaxation levels
        # Level 0: Strict settings
        # Level 1: daily_proxy_limit + 1, min_free_periods - 1
        # Level 2: daily_proxy_limit = 8 (effectively disabled), min_free_periods = 0
        relaxation_levels = [
            {"daily_limit": settings["daily_proxy_limit"], "min_free": settings["min_free_periods"]},
            {"daily_limit": settings["daily_proxy_limit"] + 1, "min_free": max(0, settings["min_free_periods"] - 1)},
            {"daily_limit": 8, "min_free": 0}
        ]

        winning_assignments = []
        winning_level = relaxation_levels[0]

        for level in relaxation_levels:
            # Build CP-SAT Model
            model = cp_model.CpModel()
            
            # Decision variables: x[a_idx, t_id] = 1 if teacher t_id is proxy for absent_period a_idx
            x = {}
            for a_idx, ap in enumerate(absent_periods):
                p_num = ap["period_no"]
                abs_t_id = ap["absent_teacher_id"]
                
                for t in teachers:
                    # Check eligibility
                    is_unavail, _ = is_teacher_unavailable(t.id, p_num)
                    is_free = p_num in teacher_original_free_periods[t.id]
                    is_self = (t.id == abs_t_id)
                    
                    if not is_unavail and is_free and not is_self:
                        # Eligible
                        x[a_idx, t.id] = model.NewBoolVar(f"x_{a_idx}_{t.id}")

            # Constraints
            # 1. At most one proxy is assigned per absent period
            for a_idx, ap in enumerate(absent_periods):
                vars_for_period = [x[a_idx, t.id] for t in teachers if (a_idx, t.id) in x]
                model.AddAtMostOne(vars_for_period)

            # 2. No teacher can be assigned to multiple proxy duties in the same period
            for p_num in range(1, 9):
                for t in teachers:
                    vars_for_teacher_period = [
                        x[a_idx, t.id]
                        for a_idx, ap in enumerate(absent_periods)
                        if ap["period_no"] == p_num and (a_idx, t.id) in x
                    ]
                    model.AddAtMostOne(vars_for_teacher_period)

            # 3. Daily Proxy Limit and Min Free Periods
            for t in teachers:
                vars_for_teacher = [x[a_idx, t.id] for a_idx, ap in enumerate(absent_periods) if (a_idx, t.id) in x]
                if not vars_for_teacher:
                    continue
                    
                total_proxies_today = sum(vars_for_teacher)
                
                # Daily Limit constraint
                model.Add(total_proxies_today <= level["daily_limit"])
                
                # Min Free Periods constraint
                orig_free_cnt = len(teacher_original_free_periods[t.id])
                max_assignable = orig_free_cnt - level["min_free"]
                if max_assignable < 0:
                    max_assignable = 0
                model.Add(total_proxies_today <= max_assignable)

            # Auxiliary variables for soft constraints
            # Consecutive Proxy Penalty
            consec_vars = []
            for t in teachers:
                for p in range(1, 8):
                    vars_p = [x[a_idx, t.id] for a_idx, ap in enumerate(absent_periods) if ap["period_no"] == p and (a_idx, t.id) in x]
                    vars_p1 = [x[a_idx, t.id] for a_idx, ap in enumerate(absent_periods) if ap["period_no"] == p+1 and (a_idx, t.id) in x]
                    
                    if vars_p and vars_p1:
                        y_p = sum(vars_p)
                        y_p1 = sum(vars_p1)
                        
                        consec_var = model.NewBoolVar(f"consec_{t.id}_{p}")
                        model.Add(consec_var <= y_p)
                        model.Add(consec_var <= y_p1)
                        model.Add(consec_var >= y_p + y_p1 - 1)
                        consec_vars.append((consec_var, settings["weight_consecutive"]))

            # Last Free Period Penalty
            last_free_vars = []
            for t in teachers:
                orig_free_cnt = len(teacher_original_free_periods[t.id])
                if orig_free_cnt <= 0:
                    continue
                    
                vars_for_teacher = [x[a_idx, t.id] for a_idx, ap in enumerate(absent_periods) if (a_idx, t.id) in x]
                if not vars_for_teacher:
                    continue
                    
                total_proxies_today = sum(vars_for_teacher)
                last_free_used = model.NewBoolVar(f"last_free_used_{t.id}")
                
                threshold = orig_free_cnt - 1
                model.Add(total_proxies_today >= threshold).OnlyEnforceIf(last_free_used)
                model.Add(total_proxies_today < threshold).OnlyEnforceIf(last_free_used.Not())
                
                last_free_vars.append((last_free_used, settings["weight_last_free"]))

            # Objective Function coefficients
            obj_expr = []
            
            # 1. Base assignment reward to maximize coverage (set to 1,000,000 to override soft penalties)
            for (a_idx, t_id), var in x.items():
                obj_expr.append(var * 1000000)

            # 2. Familiarity
            for (a_idx, t_id), var in x.items():
                ap = absent_periods[a_idx]
                target_class = ap["class_name"]
                t_obj = next(t for t in teachers if t.id == t_id)
                
                is_familiar = False
                if t_obj.class_teacher_of == target_class:
                    is_familiar = True
                else:
                    for sched in t_obj.schedules:
                        if sched.cell_value == target_class:
                            is_familiar = True
                            break
                
                if is_familiar:
                    obj_expr.append(var * settings["weight_familiarity"])

            # 3. History penalties
            for (a_idx, t_id), var in x.items():
                history = teacher_histories[t_id]
                penalty = (
                    history["daily"] * settings["weight_daily"] +
                    history["weekly"] * settings["weight_weekly"] +
                    history["monthly"] * settings["weight_monthly"]
                )
                obj_expr.append(var * (-penalty))

            # 4. Remaining free periods reward
            for (a_idx, t_id), var in x.items():
                obj_expr.append(var * (-settings["weight_free"]))

            # 5. Consecutive and Last Free penalties
            for consec_var, penalty in consec_vars:
                obj_expr.append(consec_var * penalty)
                
            for last_free_used, penalty in last_free_vars:
                obj_expr.append(last_free_used * penalty)

            model.Maximize(sum(obj_expr))

            # Solve
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 2.0
            status = solver.Solve(model)

            # Process results
            solved_assignments = []
            if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                for a_idx, ap in enumerate(absent_periods):
                    assigned_proxy_id = None
                    for t in teachers:
                        if (a_idx, t.id) in x and solver.Value(x[a_idx, t.id]) == 1:
                            assigned_proxy_id = t.id
                            break
                    
                    solved_assignments.append({
                        "absent_teacher_id": ap["absent_teacher_id"],
                        "absent_teacher_name": ap["absent_teacher_name"],
                        "period_no": ap["period_no"],
                        "class_name": ap["class_name"],
                        "proxy_id": assigned_proxy_id
                    })
            else:
                for a_idx, ap in enumerate(absent_periods):
                    solved_assignments.append({
                        "absent_teacher_id": ap["absent_teacher_id"],
                        "absent_teacher_name": ap["absent_teacher_name"],
                        "period_no": ap["period_no"],
                        "class_name": ap["class_name"],
                        "proxy_id": None
                    })

            winning_assignments = solved_assignments
            winning_level = level

            # Check if there are any unresolved proxies
            unresolved_count = sum(1 for ass in solved_assignments if ass["proxy_id"] is None)
            if unresolved_count == 0:
                break
        
        # Helper function to compute candidate score & explanation
        def compute_candidate_score_and_details(t_id: int, ap: Dict[str, Any], current_assignments: List[Dict[str, Any]]) -> Tuple[float, str]:
            t_obj = next(t for t in teachers if t.id == t_id)
            target_class = ap["class_name"]
            p_num = ap["period_no"]
            
            # Base
            score = 100.0  # Free period baseline
            reasons = []

            # 1. Familiarity
            is_ct = t_obj.class_teacher_of == target_class
            is_sched = False
            for sched in t_obj.schedules:
                if sched.cell_value == target_class:
                    is_sched = True
                    break
            if is_ct or is_sched:
                score += settings["weight_familiarity"]
                reasons.append(f"Teaches regular class {target_class}" if is_sched else f"Class Teacher of {target_class}")

            # 2. Free periods
            orig_free_cnt = len(teacher_original_free_periods[t_id])
            # count current assignments, excluding the current slot to avoid double counting
            assigned_today_count = sum(
                1 for ass in current_assignments 
                if ass["proxy_id"] == t_id and not (ass["period_no"] == ap["period_no"] and ass["absent_teacher_id"] == ap["absent_teacher_id"])
            )
            # including this one
            assigned_today_count += 1
            rem_free = orig_free_cnt - assigned_today_count
            score += rem_free * settings["weight_free"]
            reasons.append(f"Retains {rem_free} free periods")

            # 3. History
            history = teacher_histories[t_id]
            daily_hist = history["daily"]
            weekly_hist = history["weekly"]
            monthly_hist = history["monthly"]
            
            score -= (daily_hist * settings["weight_daily"] +
                      weekly_hist * settings["weight_weekly"] +
                      monthly_hist * settings["weight_monthly"])
            
            reasons.append(f"Proxies count: {daily_hist} today, {weekly_hist} this week, {monthly_hist} this month")

            # 4. Consecutive
            # check if assigned in p_num - 1 or p_num + 1 in current assignments
            has_consec = False
            for ass in current_assignments:
                if ass["proxy_id"] == t_id and abs(ass["period_no"] - p_num) == 1:
                    has_consec = True
                    break
            if has_consec:
                score += settings["weight_consecutive"]
                reasons.append("Consecutive period penalty applied")

            # 5. Last free
            if rem_free <= 1:
                score += settings["weight_last_free"]
                reasons.append("Losing last free period penalty applied")

            explanation = "; ".join(reasons)
            return score, explanation

        # Post-process unresolved assignments to assign the runner-up physically available candidate.
        # This acts as a fallback to ensure we resolve slots when physically possible.
        for ass in winning_assignments:
            if ass["proxy_id"] is None:
                p_num = ass["period_no"]
                abs_t_id = ass["absent_teacher_id"]
                candidates = []
                for t in teachers:
                    if t.id == abs_t_id:
                        continue
                    # Physical constraints only:
                    is_unavail, _ = is_teacher_unavailable(t.id, p_num)
                    is_free = p_num in teacher_original_free_periods[t.id]
                    is_busy_in_period = any(
                        other["proxy_id"] == t.id and other["period_no"] == p_num
                        for other in winning_assignments
                    )
                    if not is_unavail and is_free and not is_busy_in_period:
                        # Compute score for this candidate
                        score, explanation = compute_candidate_score_and_details(t.id, ass, winning_assignments)
                        candidates.append({
                            "teacher_id": t.id,
                            "name": t.name,
                            "score": score,
                            "explanation": explanation
                        })
                if candidates:
                    candidates.sort(key=lambda item: item["score"], reverse=True)
                    best_cand = candidates[0]
                    ass["proxy_id"] = best_cand["teacher_id"]
                    logger.info(f"Resolved unresolved proxy for {ass['absent_teacher_name']} period {p_num} with runner-up candidate {best_cand['name']}")

        # Save to database and compute explanations/alternatives
        proxy_assign_repo = ProxyAssignmentRepository()
        
        # First, delete existing assignments for this date
        existing = proxy_assign_repo.get_by_date(db, date_str)
        for e in existing:
            db.delete(e)
        db.commit()

        final_models = []
        for ass in winning_assignments:
            p_num = ass["period_no"]
            abs_t_id = ass["absent_teacher_id"]
            assigned_id = ass["proxy_id"]

            # Compute alternative candidates (eligible teachers except the assigned one)
            alternatives = []
            for t in teachers:
                if t.id == abs_t_id or (assigned_id and t.id == assigned_id):
                    continue
                # check hard constraints eligibility for this specific period
                is_unavail, _ = is_teacher_unavailable(t.id, p_num)
                is_free = p_num in teacher_original_free_periods[t.id]
                # Is not already assigned to another proxy duty in this period in the optimal solution
                is_busy_in_period = any(
                    other["proxy_id"] == t.id and other["period_no"] == p_num
                    for other in winning_assignments
                )
                # Check daily limit and min free (including this potential assignment)
                assigned_today_count = sum(1 for other in winning_assignments if other["proxy_id"] == t.id)
                new_assigned_count = assigned_today_count + 1
                orig_free_cnt = len(teacher_original_free_periods[t.id])
                
                within_daily_limit = new_assigned_count <= winning_level["daily_limit"]
                within_min_free = (orig_free_cnt - new_assigned_count) >= winning_level["min_free"]

                if not is_unavail and is_free and not is_busy_in_period and within_daily_limit and within_min_free:
                    # Compute alternative score
                    alt_score, alt_exp = compute_candidate_score_and_details(t.id, ass, winning_assignments)
                    alternatives.append({
                        "teacher_id": t.id,
                        "name": t.name,
                        "score": alt_score,
                        "explanation": alt_exp
                    })

            # Sort alternatives by score descending
            alternatives.sort(key=lambda item: item["score"], reverse=True)
            top_alternatives = alternatives[:3]

            # Safeguard: if unresolved but alternatives exist, fill it with the first alternative (Rank 2)
            if not assigned_id and top_alternatives:
                best_alternative = top_alternatives.pop(0)
                assigned_id = best_alternative["teacher_id"]
                ass["proxy_id"] = assigned_id
                logger.info(f"Promoted alternative Rank 2 candidate {best_alternative['name']} to resolve proxy for {ass['absent_teacher_name']} period {p_num}")

            # Compute score and explanation for assigned proxy
            assigned_score = 0.0
            assigned_explanation = "No eligible proxy available."
            if assigned_id:
                assigned_score, assigned_explanation = compute_candidate_score_and_details(assigned_id, ass, winning_assignments)

            # Create Database object
            proxy_model = ProxyAssignment(
                date=date_str,
                absent_teacher_id=abs_t_id,
                period_no=p_num,
                class_name=ass["class_name"],
                assigned_proxy_id=assigned_id,
                score=assigned_score if assigned_id else None,
                explanation=assigned_explanation,
                alternatives=json.dumps(top_alternatives)
            )
            proxy_assign_repo.create(db, proxy_model)
            final_models.append(proxy_model)

            # Record in history table if proxy is assigned
            if assigned_id:
                history_repo = ProxyHistoryRepository()
                hist_record = history_repo.get_by_teacher_and_date(db, assigned_id, date_str)
                if hist_record:
                    hist_record.count += 1
                    db.commit()
                else:
                    new_hist = ProxyHistory(date=date_str, teacher_id=assigned_id, count=1)
                    history_repo.create(db, new_hist)

        return final_models

    @classmethod
    def reassign_proxy(cls, db: Session, assignment_id: int) -> ProxyAssignment:
        """
        Instantly switches the assigned proxy to the next best alternative.
        This provides live resilience without recalculating the whole day's schedules.
        """
        proxy_assign_repo = ProxyAssignmentRepository()
        history_repo = ProxyHistoryRepository()
        
        assignment = proxy_assign_repo.get(db, assignment_id)
        if not assignment or not assignment.alternatives:
            return assignment

        alternatives = json.loads(assignment.alternatives)
        if not alternatives:
            return assignment

        # Decrement old proxy history
        old_proxy_id = assignment.assigned_proxy_id
        if old_proxy_id:
            old_hist = history_repo.get_by_teacher_and_date(db, old_proxy_id, assignment.date)
            if old_hist and old_hist.count > 0:
                old_hist.count -= 1
                db.commit()

        # Get the first alternative
        next_candidate = alternatives.pop(0)  # Rank 2 becomes active
        new_proxy_id = next_candidate["teacher_id"]
        new_score = next_candidate["score"]
        new_explanation = next_candidate["explanation"]

        # Increment new proxy history
        new_hist = history_repo.get_by_teacher_and_date(db, new_proxy_id, assignment.date)
        if new_hist:
            new_hist.count += 1
            db.commit()
        else:
            new_hist_record = ProxyHistory(date=assignment.date, teacher_id=new_proxy_id, count=1)
            history_repo.create(db, new_hist_record)

        # Update assignment details
        assignment.assigned_proxy_id = new_proxy_id
        assignment.score = new_score
        assignment.explanation = new_explanation
        assignment.alternatives = json.dumps(alternatives)
        
        db.commit()
        db.refresh(assignment)
        return assignment
