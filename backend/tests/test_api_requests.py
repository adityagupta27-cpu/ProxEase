import requests
import sys

BASE_URL = "http://127.0.0.1:8001/api/v1"

def test_api():
    print("Testing live API endpoints...")
    
    # 1. Health check
    r = requests.get("http://127.0.0.1:8001/")
    assert r.status_code == 200
    print("Root API Status: OK", r.json())

    # 2. Upload Timetable
    excel_path = "/Users/adityagupta/Desktop/ProxEase/Time table 25-26.xlsx"
    with open(excel_path, "rb") as f:
        r = requests.post(f"{BASE_URL}/timetable/upload", files={"file": f})
    assert r.status_code == 200
    res = r.json()
    assert res["report"]["success"] is True
    print(f"Timetable Upload API: OK (Parsed {res['report']['total_teachers']} teachers)")

    # 3. Get Teachers
    r = requests.get(f"{BASE_URL}/teachers")
    assert r.status_code == 200
    teachers = r.json()
    assert len(teachers) > 0
    print("Get Teachers API: OK")
    
    # Find teachers
    poornima_id = next(t["id"] for t in teachers if "Poornima" in t["name"])
    rajesh_id = next(t["id"] for t in teachers if "Rajesh" in t["name"])

    # 4. Mark Absence
    r = requests.post(f"{BASE_URL}/absentees", json={
        "teacher_id": poornima_id,
        "date": "2026-06-15",
        "type": "full_day"
    })
    assert r.status_code == 200
    print("Mark Absence API: OK")

    # 5. Create Exception
    r = requests.post(f"{BASE_URL}/exceptions", json={
        "teacher_id": rajesh_id,
        "date": "2026-06-15",
        "type": "unavailable",
        "start_period": 5,
        "end_period": 5
    })
    assert r.status_code == 200
    print("Create Exception API: OK")

    # 6. Generate Proxies
    r = requests.post(f"{BASE_URL}/proxies/generate?date=2026-06-15")
    assert r.status_code == 200
    assignments = r.json()
    print(f"Generate Proxies API: OK (Created {len(assignments)} assignments)")

    # 7. Reassign Proxy (Rank 2 Runner-up)
    assigned = next((a for a in assignments if a["assigned_proxy_id"] is not None), None)
    if assigned:
        asg_id = assigned["id"]
        r = requests.post(f"{BASE_URL}/proxies/{asg_id}/reassign")
        assert r.status_code == 200
        reassigned = r.json()
        print(f"Emergency Reassign API: OK ({assigned['assigned_proxy_name']} -> {reassigned['assigned_proxy_name']})")

    # 8. Dashboard Summary
    r = requests.get(f"{BASE_URL}/dashboard/summary?date=2026-06-15")
    assert r.status_code == 200
    print("Dashboard Summary API: OK", r.json())

    # 9. Get Analytics
    r = requests.get(f"{BASE_URL}/analytics")
    assert r.status_code == 200
    print("Get Analytics API: OK (Fairness Index)", r.json()["fairness_index"])

    # 10. Audit Logs
    r = requests.get(f"{BASE_URL}/audit-logs")
    assert r.status_code == 200
    print("Get Audit Logs API: OK, total logs count:", len(r.json()))

    print("\nALL API ENDPOINTS TESTED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api()
