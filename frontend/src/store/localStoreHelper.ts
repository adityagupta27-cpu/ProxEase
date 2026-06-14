import * as XLSX from 'xlsx';
import { Teacher, Absence, Exception, ProxyAssignment, Setting, AuditLog, DashboardSummary, AnalyticsSummary, AlternativeCandidate } from './useStore';

// Helper to normalize day string
export function fuzzyMatchDay(dayStr: string): string | null {
  if (!dayStr || typeof dayStr !== 'string') return null;
  dayStr = dayStr.trim().toUpperCase();
  if (dayStr.includes("MON")) return "Monday";
  if (dayStr.includes("TUE")) return "Tuesday";
  if (dayStr.includes("WED") || dayStr.includes("WEN")) return "Wednesday";
  if (dayStr.includes("THU")) return "Thursday";
  if (dayStr.includes("FRI")) return "Friday";
  if (dayStr.includes("SAT")) return "Saturday";
  return null;
}

// Helper to normalize class
export function normalizeClass(classVal: any): string | null {
  if (classVal === undefined || classVal === null || classVal === "") return null;
  
  if (typeof classVal === 'number') {
    return String(Math.floor(classVal));
  }
  
  const valStr = String(classVal).trim();
  if (valStr === "" || valStr === "nan" || valStr.toLowerCase() === "nan") return null;
  
  const valUpper = valStr.toUpperCase();
  if (["N", "NUR", "NURSERY"].includes(valUpper)) return "N";
  if (["L", "LKG"].includes(valUpper)) return "L";
  if (["U", "UKG"].includes(valUpper)) return "U";
  
  return valStr;
}

// Parse Excel timetable using SheetJS
export function parseTimetableJS(sheetData: any[][]): { report: any; teachers_data: any[] } {
  let headerRowIdx: number | null = null;
  let srColIdx: number | null = null;
  let teacherColIdx: number | null = null;
  let ctColIdx: number | null = null;
  
  for (let rIdx = 0; rIdx < sheetData.length; rIdx++) {
    const row = sheetData[rIdx] || [];
    const rowStrs = row.map(val => (val !== undefined && val !== null) ? String(val).trim().toLowerCase() : "");
    const hasSr = rowStrs.some(s => s.includes("sr.") || s.includes("serial") || s.includes("no."));
    const hasTeacher = rowStrs.some(s => s.includes("class teacher") || s.includes("teacher name") || s.includes("teacher"));
    
    if (hasSr && hasTeacher) {
      headerRowIdx = rIdx;
      for (let cIdx = 0; cIdx < rowStrs.length; cIdx++) {
        const s = rowStrs[cIdx];
        if (s.includes("sr.") || s.includes("no.")) {
          srColIdx = cIdx;
        } else if (s.includes("class teacher") || s.includes("teacher")) {
          teacherColIdx = cIdx;
        } else if (s.includes("c.t.") || s === "ct") {
          ctColIdx = cIdx;
        }
      }
      break;
    }
  }
  
  if (headerRowIdx === null) {
    throw new Error("Could not locate the header row containing 'Sr. No.' and 'Class Teacher'.");
  }
  
  if (teacherColIdx === null) teacherColIdx = 2;
  if (ctColIdx === null) ctColIdx = 3;
  
  const dayRowIdx = headerRowIdx > 0 ? headerRowIdx - 1 : 0;
  const dayHeaders: Record<string, number> = {};
  const dayRow = sheetData[dayRowIdx] || [];
  
  for (let cIdx = teacherColIdx + 1; cIdx < dayRow.length; cIdx++) {
    const val = dayRow[cIdx];
    if (val !== undefined && val !== null) {
      const matchedDay = fuzzyMatchDay(String(val));
      if (matchedDay) {
        dayHeaders[matchedDay] = cIdx;
      }
    }
  }
  
  if (Object.keys(dayHeaders).length === 0) {
    for (let rSearch = 0; rSearch < Math.min(5, headerRowIdx); rSearch++) {
      const row = sheetData[rSearch] || [];
      for (let cIdx = teacherColIdx + 1; cIdx < row.length; cIdx++) {
        const val = row[cIdx];
        if (val !== undefined && val !== null) {
          const matchedDay = fuzzyMatchDay(String(val));
          if (matchedDay) {
            dayHeaders[matchedDay] = cIdx;
          }
        }
      }
    }
  }
  
  const expectedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const sortedDayCols = Object.entries(dayHeaders).sort((a, b) => a[1] - b[1]);
  
  const colToDayPeriod: Record<number, [string, number]> = {};
  let maxCols = 0;
  sheetData.forEach(r => { if (r.length > maxCols) maxCols = r.length; });
  
  for (let i = 0; i < sortedDayCols.length; i++) {
    const [dayName, startCol] = sortedDayCols[i];
    const endCol = (i + 1 < sortedDayCols.length) ? sortedDayCols[i+1][1] : maxCols;
    let periodNum = 1;
    for (let cIdx = startCol; cIdx < endCol; cIdx++) {
      const pVal = sheetData[headerRowIdx][cIdx];
      if (pVal !== undefined && pVal !== null && pVal !== "") {
        const pNum = parseInt(String(pVal), 10);
        if (!isNaN(pNum)) {
          colToDayPeriod[cIdx] = [dayName, pNum];
        } else {
          colToDayPeriod[cIdx] = [dayName, periodNum];
        }
      } else {
        colToDayPeriod[cIdx] = [dayName, periodNum];
      }
      periodNum++;
    }
  }
  
  if (Object.keys(colToDayPeriod).length === 0) {
    throw new Error("Could not map columns to periods. Verify that period numbers are listed.");
  }
  
  const teachersData: any[] = [];
  const teacherNamesSet = new Set();
  
  for (let rIdx = headerRowIdx + 1; rIdx < sheetData.length; rIdx++) {
    const row = sheetData[rIdx] || [];
    const teacherNameRaw = row[teacherColIdx];
    if (teacherNameRaw === undefined || teacherNameRaw === null || String(teacherNameRaw).trim() === "") {
      continue;
    }
    
    const teacherName = String(teacherNameRaw).trim();
    teacherNamesSet.add(teacherName);
    
    const ctValRaw = row[ctColIdx];
    const ctClass = normalizeClass(ctValRaw);
    
    const schedule: Record<string, Record<number, string | null>> = {};
    for (const day of expectedDays) {
      schedule[day] = {};
      for (let p = 1; p <= 8; p++) {
        schedule[day][p] = null;
      }
    }
    
    for (const [cIdxStr, [day, pNum]] of Object.entries(colToDayPeriod)) {
      const cIdx = parseInt(cIdxStr, 10);
      if (cIdx < row.length) {
        const cellVal = row[cIdx];
        if (cellVal !== undefined && cellVal !== null) {
          const cellStr = String(cellVal).trim();
          if (cellStr === "" || cellStr === "nan" || cellStr.toLowerCase() === "nan") {
            schedule[day][pNum] = null;
          } else if (["B", "-"].includes(cellStr)) {
            if (pNum >= 6 && ctClass && ["N", "L", "U", "Nursery", "LKG", "UKG"].includes(ctClass)) {
              schedule[day][pNum] = null;
            } else {
              schedule[day][pNum] = cellStr;
            }
          } else {
            const normVal = normalizeClass(cellVal);
            const isPrePrimaryVal = normVal && ["N", "L", "U", "Nursery", "LKG", "UKG"].includes(normVal);
            const isPrePrimaryCt = ctClass && ["N", "L", "U", "Nursery", "LKG", "UKG"].includes(ctClass);
            if (pNum >= 6 && (isPrePrimaryVal || isPrePrimaryCt)) {
              schedule[day][pNum] = null;
            } else {
              schedule[day][pNum] = normVal;
            }
          }
        }
      }
    }
    
    teachersData.push({
      name: teacherName,
      class_teacher_of: ctClass,
      schedule
    });
  }
  
  return {
    report: {
      success: true,
      errors: [],
      warnings: [],
      total_teachers: teachersData.length,
      total_periods: Object.keys(colToDayPeriod).length
    },
    teachers_data: teachersData
  };
}

// Helper to compute candidate score
function computeCandidateScoreAndDetails(
  teacher: Teacher,
  class_name: string,
  period_no: number,
  currentAssignments: any[],
  teacherOriginalFreePeriods: Record<number, number[]>,
  teacherHistories: Record<number, { daily: number; weekly: number; monthly: number }>,
  settings: Record<string, any>
): { score: number; explanation: string } {
  let score = 100.0;
  const reasons: string[] = [];

  // 1. Familiarity
  const is_ct = teacher.class_teacher_of === class_name;
  
  const schedulesStr = typeof window !== 'undefined' ? localStorage.getItem('spms_schedules') : null;
  const schedules = schedulesStr ? JSON.parse(schedulesStr) : [];
  const teacherSchedules = schedules.filter((s: any) => s.teacher_id === teacher.id);
  const teachesClass = teacherSchedules.some((s: any) => s.cell_value === class_name);
  
  if (is_ct || teachesClass) {
    score += settings.weight_familiarity;
    reasons.push(teachesClass ? `Teaches regular class ${class_name}` : `Class Teacher of ${class_name}`);
  }

  // 2. Free periods
  const origFreePeriods = teacherOriginalFreePeriods[teacher.id] || [];
  const orig_free_cnt = origFreePeriods.length;
  const assigned_today_count = currentAssignments.filter(ass => ass.proxy_id === teacher.id).length;
  const rem_free = orig_free_cnt - assigned_today_count;
  score += rem_free * settings.weight_free;
  reasons.push(`Retains ${rem_free} free periods`);

  // 3. History
  const history = teacherHistories[teacher.id] || { daily: 0, weekly: 0, monthly: 0 };
  score -= (
    history.daily * settings.weight_daily +
    history.weekly * settings.weight_weekly +
    history.monthly * settings.weight_monthly
  );
  reasons.push(`Proxies count: ${history.daily} today, ${history.weekly} this week, ${history.monthly} this month`);

  // 4. Consecutive
  const has_consec = currentAssignments.some(ass => ass.proxy_id === teacher.id && Math.abs(ass.period_no - period_no) === 1);
  if (has_consec) {
    score += settings.weight_consecutive;
    reasons.push("Consecutive period penalty applied");
  }

  // 5. Last free
  if (rem_free <= 1) {
    score += settings.weight_last_free;
    reasons.push("Losing last free period penalty applied");
  }

  return {
    score,
    explanation: reasons.join("; ")
  };
}

// Depth-first search solver to match CP-SAT behavior
// Depth-first search solver to match CP-SAT behavior
export function solveAssignments(
  duties: any[],
  teachers: Teacher[],
  absences: Absence[],
  exceptions: Exception[],
  teacherOriginalFreePeriods: Record<number, number[]>,
  teacherHistories: Record<number, { daily: number; weekly: number; monthly: number }>,
  settings: Record<string, any>
): any[] {
  // Define relaxation levels
  const relaxation_levels = [
    { daily_limit: Number(settings.daily_proxy_limit ?? 6), min_free: Number(settings.min_free_periods ?? 0) },
    { daily_limit: Number(settings.daily_proxy_limit ?? 6) + 1, min_free: Math.max(0, Number(settings.min_free_periods ?? 0) - 1) },
    { daily_limit: 8, min_free: 0 }
  ];

  let winningAssignments: any[] = [];
  let winningLevel = relaxation_levels[0];

  // Inner solver function for a specific relaxation level using Heuristic Greedy Matching
  function solveForLevel(level: { daily_limit: number; min_free: number }): any[] {
    const assigned = duties.map(duty => ({
      absent_teacher_id: duty.absent_teacher_id,
      absent_teacher_name: duty.absent_teacher_name,
      period_no: duty.period_no,
      class_name: duty.class_name,
      proxy_id: null as number | null,
      score: null as number | null,
      explanation: "No eligible proxy available."
    }));

    const assignedIndices = new Set<number>();

    while (assignedIndices.size < duties.length) {
      let bestDutyIdx = -1;
      let bestEligibleTeachers: { teacher: Teacher; score: number; explanation: string }[] = [];
      let minEligibleCount = Infinity;

      for (let i = 0; i < duties.length; i++) {
        if (assignedIndices.has(i)) continue;

        const duty = duties[i];
        const period_no = duty.period_no;
        const class_name = duty.class_name;
        const abs_t_id = duty.absent_teacher_id;

        // Find all eligible teachers for this duty under the active level's constraints
        const eligible = teachers.filter(t => {
          if (t.id === abs_t_id) return false;

          // 1. Is not absent during this period
          const isAbsent = absences.some(a => {
            if (a.teacher_id !== t.id) return false;
            if (a.type === 'full_day') return true;
            if (a.type === 'half_day_morning' && period_no <= 4) return true;
            if (a.type === 'half_day_afternoon' && period_no > 4) return true;
            if (a.type === 'custom' && a.start_period && a.end_period && period_no >= a.start_period && period_no <= a.end_period) return true;
            return false;
          });
          if (isAbsent) return false;

          // 2. Is not unavailable (exception) during this period
          const isUnavail = exceptions.some(e => {
            if (e.teacher_id !== t.id) return false;
            if (e.type === 'unavailable') {
              if (!e.start_period || !e.end_period) return true;
              if (period_no >= e.start_period && period_no <= e.end_period) return true;
            }
            return false;
          });
          if (isUnavail) return false;

          // 3. Is free during this period in baseline schedule
          const origFree = teacherOriginalFreePeriods[t.id] || [];
          if (!origFree.includes(period_no)) return false;

          // 4. Is not already assigned to another duty in this period
          const isBusy = duties.some((d, idx) => assignedIndices.has(idx) && assigned[idx].proxy_id === t.id && d.period_no === period_no);
          if (isBusy) return false;

          // 5. Daily limit
          const assignedCount = duties.filter((d, idx) => assignedIndices.has(idx) && assigned[idx].proxy_id === t.id).length;
          if (assignedCount + 1 > level.daily_limit) return false;

          // 6. Min free periods
          const orig_free_cnt = origFree.length;
          if (orig_free_cnt - (assignedCount + 1) < level.min_free) return false;

          return true;
        });

        // Compute score for each eligible candidate
        const eligibleWithScores = eligible.map(t => {
          const tempAssignments = duties
            .map((d, idx) => ({
              proxy_id: assignedIndices.has(idx) ? assigned[idx].proxy_id : null,
              period_no: d.period_no
            }))
            .filter(a => a.proxy_id !== null);
          
          tempAssignments.push({ proxy_id: t.id, period_no });

          const { score, explanation } = computeCandidateScoreAndDetails(
            t,
            class_name,
            period_no,
            tempAssignments,
            teacherOriginalFreePeriods,
            teacherHistories,
            settings
          );
          return { teacher: t, score, explanation };
        });

        // Sort descending by score
        eligibleWithScores.sort((a, b) => b.score - a.score);

        const eligibleCount = eligibleWithScores.length;
        if (eligibleCount > 0) {
          // MRV: prioritize duty with fewest eligible proxy options
          if (eligibleCount < minEligibleCount) {
            minEligibleCount = eligibleCount;
            bestDutyIdx = i;
            bestEligibleTeachers = eligibleWithScores;
          } else if (eligibleCount === minEligibleCount) {
            // Tie-breaker: choose duty with the higher score for the best candidate
            if (bestEligibleTeachers.length > 0 && eligibleWithScores[0].score > bestEligibleTeachers[0].score) {
              bestDutyIdx = i;
              bestEligibleTeachers = eligibleWithScores;
            }
          }
        }
      }

      // If we couldn't assign any more duties, break
      if (bestDutyIdx === -1) {
        break;
      }

      // Assign the best candidate to the selected duty
      const bestChoice = bestEligibleTeachers[0];
      assigned[bestDutyIdx] = {
        absent_teacher_id: duties[bestDutyIdx].absent_teacher_id,
        absent_teacher_name: duties[bestDutyIdx].absent_teacher_name,
        period_no: duties[bestDutyIdx].period_no,
        class_name: duties[bestDutyIdx].class_name,
        proxy_id: bestChoice.teacher.id,
        score: bestChoice.score,
        explanation: bestChoice.explanation
      };
      assignedIndices.add(bestDutyIdx);
    }

    return assigned;
  }

  // Run solver through relaxation levels
  for (const level of relaxation_levels) {
    winningLevel = level;
    winningAssignments = solveForLevel(level);

    // If all proxy duties are resolved, we can break early
    const unresolvedCount = winningAssignments.filter(ass => ass.proxy_id === null).length;
    if (unresolvedCount === 0) {
      break;
    }
  }

  // Post-process unresolved assignments to assign the runner-up physically available candidate.
  // This acts as a fallback to ensure we resolve slots when physically possible.
  winningAssignments.forEach(ass => {
    if (ass.proxy_id === null) {
      const p_num = ass.period_no;
      const abs_t_id = ass.absent_teacher_id;
      const candidates: { teacher: Teacher; score: number; explanation: string }[] = [];

      teachers.forEach(t => {
        if (t.id === abs_t_id) return;

        // Physical constraints only:
        const isAbsent = absences.some(a => {
          if (a.teacher_id !== t.id) return false;
          if (a.type === 'full_day') return true;
          if (a.type === 'half_day_morning' && p_num <= 4) return true;
          if (a.type === 'half_day_afternoon' && p_num > 4) return true;
          if (a.type === 'custom' && a.start_period && a.end_period && p_num >= a.start_period && p_num <= a.end_period) return true;
          return false;
        });
        if (isAbsent) return;

        const isUnavail = exceptions.some(e => {
          if (e.teacher_id !== t.id) return false;
          if (e.type === 'unavailable') {
            if (!e.start_period || !e.end_period) return true;
            if (p_num >= e.start_period && p_num <= e.end_period) return true;
          }
          return false;
        });
        if (isUnavail) return;

        const origFree = teacherOriginalFreePeriods[t.id] || [];
        if (!origFree.includes(p_num)) return;

        const isBusy = winningAssignments.some(other => other.proxy_id === t.id && other.period_no === p_num);
        if (isBusy) return;

        // Compute score for candidate
        const tempAssigned = winningAssignments.map(other => ({ proxy_id: other.proxy_id, period_no: other.period_no }));
        const { score, explanation } = computeCandidateScoreAndDetails(
          t,
          ass.class_name,
          p_num,
          tempAssigned,
          teacherOriginalFreePeriods,
          teacherHistories,
          settings
        );

        candidates.push({ teacher: t, score, explanation });
      });

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates[0];
        ass.proxy_id = bestCandidate.teacher.id;
        ass.score = bestCandidate.score;
        ass.explanation = bestCandidate.explanation;
      }
    }
  });

  // Calculate alternatives for each assignment using active winning level limits
  const finalAssignments = winningAssignments.map(ass => {
    const p_num = ass.period_no;
    const alternatives: AlternativeCandidate[] = [];
    
    teachers.forEach(t => {
      if (t.id === ass.absent_teacher_id || (ass.proxy_id && t.id === ass.proxy_id)) return;
      
      // Eligibility checks
      const isAbsent = absences.some(a => {
        if (a.teacher_id !== t.id) return false;
        if (a.type === 'full_day') return true;
        if (a.type === 'half_day_morning' && p_num <= 4) return true;
        if (a.type === 'half_day_afternoon' && p_num > 4) return true;
        if (a.type === 'custom' && a.start_period && a.end_period && p_num >= a.start_period && p_num <= a.end_period) return true;
        return false;
      });
      if (isAbsent) return;
      
      const isUnavail = exceptions.some(e => {
        if (e.teacher_id !== t.id) return false;
        if (e.type === 'unavailable') {
          if (!e.start_period || !e.end_period) return true;
          if (p_num >= e.start_period && p_num <= e.end_period) return true;
        }
        return false;
      });
      if (isUnavail) return;
      
      const origFree = teacherOriginalFreePeriods[t.id] || [];
      if (!origFree.includes(p_num)) return;
      
      // Is busy in this period in the optimal solution
      const isBusyInPeriod = winningAssignments.some(other => other.proxy_id === t.id && other.period_no === p_num);
      if (isBusyInPeriod) return;
      
      const assignedCount = winningAssignments.filter(other => other.proxy_id === t.id).length;
      if (assignedCount + 1 > winningLevel.daily_limit) return;
      
      const orig_free_cnt = origFree.length;
      if (orig_free_cnt - (assignedCount + 1) < winningLevel.min_free) return;
      
      // Score alternative candidate
      const tempAssigned = winningAssignments.map(other => ({ proxy_id: other.proxy_id, period_no: other.period_no }));
      const { score, explanation } = computeCandidateScoreAndDetails(
        t,
        ass.class_name,
        p_num,
        tempAssigned,
        teacherOriginalFreePeriods,
        teacherHistories,
        settings
      );
      
      alternatives.push({
        teacher_id: t.id,
        name: t.name,
        score,
        explanation
      });
    });
    
    // Sort descending by score
    alternatives.sort((a, b) => b.score - a.score);
    const topAlternatives = alternatives.slice(0, 3);

    let finalProxyId = ass.proxy_id;
    let finalScore = ass.score;
    let finalExplanation = ass.explanation;

    // Safeguard: if unresolved but alternatives exist, fill it with the first alternative (Rank 2)
    if (!finalProxyId && topAlternatives.length > 0) {
      const bestAlternative = topAlternatives.shift()!;
      finalProxyId = bestAlternative.teacher_id;
      finalScore = bestAlternative.score;
      finalExplanation = bestAlternative.explanation;
      // Mutate winningAssignments so subsequent iterations see this teacher as busy
      ass.proxy_id = finalProxyId;
      ass.score = finalScore;
      ass.explanation = finalExplanation;
    }
    
    return {
      ...ass,
      proxy_id: finalProxyId,
      score: finalScore,
      explanation: finalExplanation,
      assigned_proxy_id: finalProxyId,
      assigned_proxy_name: teachers.find(t => t.id === finalProxyId)?.name || null,
      alternatives: topAlternatives
    };
  });
  
  return finalAssignments;
}

// Compute Jain's Fairness Index locally
export function calculateLocalFairness(
  teachers: Teacher[],
  absences: Absence[],
  proxyAssignments: ProxyAssignment[],
  selectedDate: string
): number {
  try {
    const parts = selectedDate.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day_name = days[dt.getDay()];
    
    const absentIds = absences.filter(a => a.date === selectedDate).map(a => a.teacher_id);
    const presentTeachers = teachers.filter(t => !absentIds.includes(t.id));
    if (presentTeachers.length === 0) return 1.0;
    
    const schedulesStr = localStorage.getItem('spms_schedules');
    const schedules = schedulesStr ? JSON.parse(schedulesStr) : [];
    
    const proxiesByTeacher: Record<number, number> = {};
    proxyAssignments.forEach(a => {
      if (a.date === selectedDate && a.assigned_proxy_id) {
        proxiesByTeacher[a.assigned_proxy_id] = (proxiesByTeacher[a.assigned_proxy_id] || 0) + 1;
      }
    });
    
    const netFrees: number[] = [];
    presentTeachers.forEach(t => {
      const baseFree = schedules.filter((s: any) => 
        s.teacher_id === t.id && 
        s.day === day_name && 
        (s.cell_value === null || s.cell_value === "" || s.cell_value === "-")
      ).length;
      
      const assigned = proxiesByTeacher[t.id] || 0;
      netFrees.push(Math.max(0, baseFree - assigned));
    });
    
    const n = netFrees.length;
    if (n === 0) return 1.0;
    const sumX = netFrees.reduce((a, b) => a + b, 0);
    const sumX2 = netFrees.reduce((a, b) => a + b * b, 0);
    if (sumX2 === 0) return 1.0;
    return (sumX * sumX) / (n * sumX2);
  } catch (err) {
    return 1.0;
  }
}
