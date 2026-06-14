import sys
sys.path.append("/Users/adityagupta/Desktop/ProxEase/backend")

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine

# Fresh database tables for testing
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_flow():
    # 1. API Root health check
    r = client.get("/")
    assert r.status_code == 200
    print("API Root health check: OK")

    # 2. Upload Timetable Excel file
    excel_path = "/Users/adityagupta/Desktop/ProxEase/Time table 25-26.xlsx"
    with open(excel_path, "rb") as f:
        r = client.post("/api/v1/timetable/upload", files={"file": f})
    assert r.status_code == 200
    res = r.json()
    assert res["report"]["success"] is True
    print(f"Timetable Upload & Parse: OK (Total Teachers: {res['report']['total_teachers']})")

    # 3. Retrieve teachers list
    r = client.get("/api/v1/teachers")
    assert r.status_code == 200
    teachers = r.json()
    assert len(teachers) > 0
    print("Retrieve Teachers List: OK")
    
    # Lookup specific teachers
    poornima_id = next(t["id"] for t in teachers if "Poornima" in t["name"])
    rajesh_id = next(t["id"] for t in teachers if "Rajesh" in t["name"])
    print(f"Target Teachers - Poornima ID: {poornima_id}, Rajesh ID: {rajesh_id}")

    # 4. Mark absence (Poornima Sindhal absent on Monday, 2026-06-15)
    r = client.post("/api/v1/absentees", json={
        "teacher_id": poornima_id,
        "date": "2026-06-15",
        "type": "full_day"
    })
    assert r.status_code == 200
    print("Mark Absence: OK")

    # 5. Mark exception (Rajesh Dabhi unavailable during period 5 on 2026-06-15)
    r = client.post("/api/v1/exceptions", json={
        "teacher_id": rajesh_id,
        "date": "2026-06-15",
        "type": "unavailable",
        "start_period": 5,
        "end_period": 5
    })
    assert r.status_code == 200
    print("Create Exception: OK")

    # 6. Generate Proxies
    r = client.post("/api/v1/proxies/generate?date=2026-06-15")
    assert r.status_code == 200
    assignments = r.json()
    print(f"Generate Proxies: OK (Generated {len(assignments)} assignments)")
    for a in assignments:
        print(f"  Asg: Period {a['period_no']} class {a['class_name']} -> Proxy: {a['assigned_proxy_name']} (Score: {a['score']}) - {a['explanation']}")

    # 7. Emergency Reassignment
    assigned_asg = next((a for a in assignments if a["assigned_proxy_id"] is not None), None)
    if assigned_asg:
        asg_id = assigned_asg["id"]
        r = client.post(f"/api/v1/proxies/{asg_id}/reassign")
        assert r.status_code == 200
        reassigned = r.json()
        print(f"Emergency Reassign: OK (Proxy switched from {assigned_asg['assigned_proxy_name']} to {reassigned['assigned_proxy_name']})")
    else:
        print("No proxy was assigned, skipping reassignment test.")

    # 8. Check Dashboard Summary
    r = client.get("/api/v1/dashboard/summary?date=2026-06-15")
    assert r.status_code == 200
    summary = r.json()
    print(f"Dashboard Summary: {summary}")

    # 9. Check Analytics
    r = client.get("/api/v1/analytics")
    assert r.status_code == 200
    analytics = r.json()
    print(f"Analytics summary - Fairness Index: {analytics['fairness_index']}")

if __name__ == "__main__":
    test_flow()
