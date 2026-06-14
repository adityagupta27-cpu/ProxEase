import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { parseTimetableJS, solveAssignments } from './localStoreHelper';

const excelPath = "/Users/adityagupta/Desktop/Mummy/Time table 25-26.xlsx";

function testLocalSolver() {
  console.log("Reading Excel file:", excelPath);
  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  console.log("Parsing using parseTimetableJS...");
  const parsed = parseTimetableJS(sheetData);
  
  const teachers = parsed.teachers_data.map((t: any, index: number) => ({
    id: index + 1,
    name: t.name,
    class_teacher_of: t.class_teacher_of
  }));

  const poornima = teachers.find((t: any) => t.name.includes("Poornima"));
  if (!poornima) {
    console.error("Poornima Sindhal not found!");
    return;
  }
  console.log("Found Poornima, ID:", poornima.id);

  // Monday 2026-06-15
  const date = "2026-06-15";
  const dayName = "Monday";

  const absences = [
    {
      id: 1,
      teacher_id: poornima.id,
      teacher_name: poornima.name,
      date,
      type: "full_day",
      start_period: null,
      end_period: null
    }
  ];

  const exceptions: any[] = [];

  const schedules: any[] = [];
  parsed.teachers_data.forEach((tData: any, index: number) => {
    const tId = index + 1;
    Object.entries(tData.schedule).forEach(([day, periods]: any) => {
      Object.entries(periods).forEach(([pNumStr, cell_value]) => {
        const period_no = parseInt(pNumStr, 10);
        schedules.push({
          id: schedules.length + 1,
          teacher_id: tId,
          day,
          period_no,
          cell_value
        });
      });
    });
  });

  const duties: any[] = [];
  absences.forEach(abs => {
    const teacher = teachers.find((t: any) => t.id === abs.teacher_id);
    if (!teacher) return;
    
    const teacherDaySchedules = schedules.filter((s: any) => s.teacher_id === teacher.id && s.day === dayName);
    teacherDaySchedules.forEach((s: any) => {
      const period_no = s.period_no;
      const class_name = s.cell_value;
      
      let isAbsentInPeriod = false;
      if (abs.type === 'full_day') isAbsentInPeriod = true;
      
      if (isAbsentInPeriod && class_name && !["B", "-"].includes(class_name)) {
        duties.push({
          absent_teacher_id: teacher.id,
          absent_teacher_name: teacher.name,
          period_no,
          class_name
        });
      }
    });
  });

  const teacherOriginalFreePeriods: Record<number, number[]> = {};
  teachers.forEach((t: any) => {
    const freePeriods = schedules.filter((s: any) => 
      s.teacher_id === t.id && 
      s.day === dayName && 
      (s.cell_value === null || s.cell_value === "" || s.cell_value === "-")
    ).map((s: any) => s.period_no);
    teacherOriginalFreePeriods[t.id] = freePeriods;
  });

  const teacherHistories: Record<number, { daily: number; weekly: number; monthly: number }> = {};
  teachers.forEach((t: any) => {
    teacherHistories[t.id] = { daily: 0, weekly: 0, monthly: 0 };
  });

  const settings = {
    daily_proxy_limit: 6,
    min_free_periods: 0,
    weight_free: 40,
    weight_familiarity: 50,
    weight_daily: 30,
    weight_weekly: 20,
    weight_monthly: 10,
    weight_consecutive: -30,
    weight_last_free: -1000,
    blocked_symbols: "B,-"
  };

  console.log("Running solveAssignments...");
  try {
    const results = solveAssignments(
      duties,
      teachers,
      absences,
      exceptions,
      teacherOriginalFreePeriods,
      teacherHistories,
      settings
    );
    console.log("Local solver generated assignments count:", results.length);
    results.forEach((r: any) => {
      console.log(`  Period ${r.period_no} class ${r.class_name} for absent ${r.absent_teacher_name} -> Proxy: ${r.assigned_proxy_name}`);
      console.log(`    Score: ${r.score}, Explanation: ${r.explanation}`);
      console.log(`    Alternatives:`, r.alternatives);
    });
  } catch (err: any) {
    console.error("Local solver failed:", err);
  }
}

testLocalSolver();
