<p align="center">
  <img src="assets/banner.png" alt="ProxEase Banner" width="100%" max-width="800px" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />
</p>

<h1 align="center">📅 ProxEase</h1>
<p align="center"><strong>Smart Substitution & Proxy Workload Management System</strong></p>

<p align="center">
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-16.2.9-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  </a>
  <a href="https://fastapi.tiangolo.com/">
    <img src="https://img.shields.io/badge/FastAPI-0.136.3-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  </a>
  <a href="https://developers.google.com/optimization">
    <img src="https://img.shields.io/badge/Google%20OR--Tools-CP--SAT-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="OR-Tools" />
  </a>
  <a href="https://www.netlify.com/">
    <img src="https://img.shields.io/badge/Netlify-Prerendered-00C8C8?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify" />
  </a>
</p>

<p align="center">
  <strong>ProxEase</strong> is a production-grade, mathematically optimized smart substitution scheduling and proxy workload management system designed for educational institutions. When teachers are absent, ProxEase uses constraint programming (via Google OR-Tools CP-SAT) to globally optimize the allocation of substitute (proxy) duties, ensuring mathematical balance, department familiarity, and administrative fairness across the entire school staff.
</p>

---

## 📖 Table of Contents
1. [Key Features](#-key-features)
2. [Core Mathematical Optimization Model](#-core-mathematical-optimization-model)
3. [Standalone Offline Mode & Fallback Solver](#-standalone-offline-mode--fallback-solver)
4. [Tech Stack](#-tech-stack)
5. [Local Development Setup](#-local-development-setup)
6. [Containerized Launch (Docker Compose)](#-containerized-launch-docker-compose)
7. [Netlify Static Deployment](#-netlify-static-deployment)
8. [Excel Timetable Specifications](#-excel-timetable-specifications)
9. [Running Unit & Integration Tests](#-running-unit--integration-tests)


---

## 🚀 Key Features

*   **⚡ Mathematical Constraint Optimization**: Integrates **Google OR-Tools CP-SAT** to globally solve substitute teacher assignments, satisfying all hard constraints (availability, daily limits, class conflicts) while maximizing soft scores (class familiarity, free period preservation).
*   **🔄 Emergency Reassignment with Runner-ups**: Calculates the top 3 alternative candidate runner-ups (Rank 2 and Rank 3) for every assignment. Administrators can cycle through alternatives with a single click, updating records in `<10ms` without re-solving.
*   **📂 Direct Excel Timetable Parsing**: Uploads and parses school timetable sheets (`.xlsx`/`.xls`) directly, automatically normalizing class headers, days, and periods.
*   **🌐 Standalone Offline/Local Mode (Netlify-Ready)**: Dynamically falls back to **Local Standalone Mode** if the backend API is unreachable. In this state, a pure client-side **Minimum Remaining Values (MRV) Heuristic Solver** executes proxy generation in **<1ms** directly in the browser using `localStorage`.
*   **📊 Workload Balance Analytics**: Charts daily proxy allocation history and calculates **Jain's Fairness Index** to measure duty distribution equality. Excludes absent teachers automatically from all active metrics to avoid reporting skew.
*   **📱 Device-Adaptive UI**: Responsive layouts, navigation drawers, and mobile list cards built with Next.js 16 and custom Tailwind CSS components, fully optimized for all viewports.

---


    

## 🧮 Core Mathematical Optimization Model

The backend leverages the **Google OR-Tools CP-SAT Solver** to formulate the proxy assignment problem.

### 1. Variables
Let $x_{a, t} \in \{0, 1\}$ be the decision variable indicating whether teacher $t$ is assigned to cover absent slot $a$ (which has a specific period $p_a$ and class $c_a$).

### 2. Hard Constraints (Must Be Satisfied)
*   **Uniquely Assigned**: Every absent slot $a$ must be covered by exactly one eligible substitute teacher $t$:
    $$\sum_{t \in \text{Eligible}(a)} x_{a, t} = 1$$
*   **Single Duty per Period**: A teacher $t$ cannot cover multiple absent slots during the same period $p$:
    $$\sum_{a : p_a = p} x_{a, t} \le 1 \quad \forall t$$
*   **Availability**: A teacher $t$ can only be assigned if they are marked present and have a free period during period $p_a$.
*   **Daily Duty Limit**: A teacher $t$ cannot exceed the maximum daily proxy limit ($L_{daily}$, default = 6):
    $$\sum_{a} x_{a, t} \le L_{daily} \quad \forall t$$
*   **Minimum Free Periods**: A teacher $t$ must retain at least $M_{free}$ free periods:
    $$\text{FreePeriods}(t) - \sum_{a} x_{a, t} \ge M_{free} \quad \forall t$$

### 3. Soft Constraints & Objective Functions
We maximize a weighted objective function:

$$\text{Maximize} \quad \sum_{a, t} \text{Score}(a, t) \cdot x_{a, t}$$

The score component for teacher $t$ assigned to duty $a$ is computed as:

$$
\begin{aligned}
\text{Score}(a, t) = & \text{FamiliarityWeight} \cdot \text{HasFamiliarity}(t, c_a) \\
& + \text{FreePeriodWeight} \cdot \text{RemainingFreePeriods}(t) \\
& - \text{DailyWeight} \cdot \text{DailyDutiesCount}(t) \\
& - \text{WeeklyWeight} \cdot \text{WeeklyDutiesCount}(t) \\
& - \text{MonthlyWeight} \cdot \text{MonthlyDutiesCount}(t) \\
& + \text{ConsecutiveWeight} \cdot \text{IsConsecutive}(t, p_a) \\
& + \text{LastFreeWeight} \cdot \text{IsLastFreePeriod}(t)
\end{aligned}
$$

| Weight Parameter | Default Value | Description |
| :--- | :--- | :--- |
| `weight_familiarity` | `50` | Reward for teacher belonging to the same department/subject. |
| `weight_free` | `40` | Reward for selecting teachers with more remaining free periods. |
| `weight_daily` | `30` | Penalty factor for duties already completed today. |
| `weight_weekly` | `20` | Penalty factor for duties completed during this calendar week. |
| `weight_monthly` | `10` | Penalty factor for duties completed during this calendar month. |
| `weight_consecutive` | `-30` | Penalty for assigning a teacher to back-to-back periods. |
| `weight_last_free` | `-1000` | Heavy penalty to prevent taking a teacher's final free period. |

---

## 🌐 Standalone Offline Mode & Fallback Solver

To support zero-backend environments (such as Netlify static deployments), ProxEase embeds a local-first architecture:
1.  **Browser LocalStorage Sync**: Automatically loads and caches timetables, absentees, exceptions, settings, and proxy histories in the client's browser.
2.  **Minimum Remaining Values (MRV) Heuristic Solver**: If the backend is unreachable, the frontend executes a local backtracking solver enhanced with the MRV heuristic:
    *   It selects the absent slot with the *fewest eligible substitute teachers* first (constraining the branching factor).
    *   It breaks ties using the **Least Constraining Value (LCV)** heuristic to assign the teacher that leaves the most free periods available for other assignments.
    *   Executes in **<1ms** on modern browsers for standard workloads.

---

## 🛠️ Tech Stack

### Frontend Portal
*   **Core framework**: Next.js 16.2.9 (App Router, Turbopack)
*   **State manager**: Zustand 5.0.14
*   **Styling**: Tailwind CSS v4
*   **Data visualization**: Recharts 3.8.1
*   **Excel Parsing**: SheetJS (`xlsx` v0.18.5)
*   **Icons**: Lucide React

### Backend API
*   **Core framework**: FastAPI 0.136.3
*   **Server gateway**: Uvicorn 0.28.0
*   **Optimization engine**: Google OR-Tools (CP-SAT v9.8.3296)
*   **Database & ORM**: SQLite + SQLAlchemy 2.0
*   **Testing Suite**: Pytest 8.0

---

## ⚙️ Local Development Setup

### Prerequisites
*   Node.js 18+
*   Python 3.10 - 3.13

### 1. Set Up Backend API
```bash
# Navigate to backend directory
cd backend

# Create a clean virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8001
```
*The FastAPI server will be active at `http://127.0.0.1:8001/` with Swagger docs at `http://127.0.0.1:8001/docs`.*

### 2. Set Up Frontend Web App
```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install node dependencies
npm install

# Start the Next.js dev server
npm run dev
```
*The frontend portal will be active at `http://localhost:3000`.*

---

## 🐳 Containerized Launch (Docker Compose)

Launch both services in a unified local container cluster:

```bash
# From the project root
docker-compose up --build
```
*   **Portal URL**: `http://localhost:3000`
*   **API Sandbox**: `http://localhost:8001/docs`

---

## 🌩️ Netlify Static Deployment

Because ProxEase features an integrated client-side solver, the frontend can be deployed statically to Netlify without requiring a persistent Python backend database.

### Deployment Configuration (`netlify.toml`)
ProxEase includes a pre-configured `netlify.toml` file inside the `frontend` folder:
```toml
[build]
  command = "npm run build"
  publish = "out"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/_next/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Steps to Deploy
1.  Connect your GitHub repository to **Netlify**.
2.  Set the **Base directory** to `frontend`.
3.  Netlify will automatically detect `netlify.toml`, run `npm run build` (triggering Next.js `output: "export"`), and deploy static files from `out/` with optimized long-term asset caching headers.

---

## 📋 Excel Timetable Specifications

When uploading schedules, the system expects the Excel file to follow these conventions:
1.  **Horizontal Day Headers**: Class and period grids mapped Monday through Saturday.
2.  **Period Headers**: Columns labeled P1 through P8 representing consecutive school slots.
3.  **Busy/Blocked Indicators**: Cells marked with `-` or `B` are treated as occupied, busy, or unassignable (e.g. assembly, laboratory blocks).
4.  **Free Periods**: Empty or null cells represent free periods that are eligible candidate slots for substitute coverage.

---

## 🧪 Running Unit & Integration Tests

Execute the backend python test suites:

```bash
# Navigate to backend and run Pytest
cd backend
./venv/bin/pytest
```

---


