import sys
sys.path.append("/Users/adityagupta/Desktop/ProxEase/backend")

from app.core.database import SessionLocal, Base, engine
from app.services.excel_parser import ExcelParserService
from app.services.optimization_solver import OptimizationSolverService
from app.models.models import Teacher, Absence

def test_direct():
    print("Initializing fresh database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Parse Excel
        excel_path = "/Users/adityagupta/Desktop/ProxEase/Time table 25-26.xlsx"
        print(f"Parsing timetable: {excel_path}")
        report, teachers_data = ExcelParserService.parse_timetable(excel_path)
        assert report["success"] is True
        print(f"Parsed {len(teachers_data)} teachers successfully.")

        # 2. Insert Teachers and schedules
        from app.models.models import TeacherSchedule
        for t_data in teachers_data:
            t_model = Teacher(name=t_data["name"], class_teacher_of=t_data["class_teacher_of"])
            db.add(t_model)
            db.commit()
            db.refresh(t_model)

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
        print("Data inserted into SQLite successfully.")

        # 3. Get Poornima Sindhal
        poornima = db.query(Teacher).filter(Teacher.name.like("%Poornima%")).first()
        assert poornima is not None
        print(f"Found teacher Poornima, ID: {poornima.id}")

        # 4. Mark Poornima absent
        abs_record = Absence(
            teacher_id=poornima.id,
            date="2026-06-15",
            type="full_day"
        )
        db.add(abs_record)
        db.commit()
        print("Marked Poornima absent.")

        # 5. Run solver
        print("Running optimization solver...")
        assignments = OptimizationSolverService.solve(db, "2026-06-15")
        print(f"Generated {len(assignments)} assignments.")
        
        for a in assignments:
            absent_t = db.query(Teacher).filter(Teacher.id == a.absent_teacher_id).first()
            proxy_t = db.query(Teacher).filter(Teacher.id == a.assigned_proxy_id).first() if a.assigned_proxy_id else None
            proxy_name = proxy_t.name if proxy_t else "Unassigned"
            print(f"  Period {a.period_no} class {a.class_name} for {absent_t.name} -> Proxy: {proxy_name}")
            print(f"    Explanation: {a.explanation}")
            print(f"    Alternatives: {a.alternatives}")
            
            # Test reassignment
            if a.assigned_proxy_id:
                print(f"  Attempting reassignment for assignment ID: {a.id}")
                updated = OptimizationSolverService.reassign_proxy(db, a.id)
                new_proxy = db.query(Teacher).filter(Teacher.id == updated.assigned_proxy_id).first() if updated.assigned_proxy_id else None
                new_proxy_name = new_proxy.name if new_proxy else "Unassigned"
                print(f"    Reassigned Proxy: {new_proxy_name}")

    finally:
        db.close()

if __name__ == "__main__":
    test_direct()
