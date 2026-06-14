import { create } from 'zustand'
import * as XLSX from 'xlsx'
import { parseTimetableJS, solveAssignments, calculateLocalFairness } from './localStoreHelper'

export interface Teacher {
  id: number
  name: string
  class_teacher_of: string | null
}

export interface Absence {
  id: number
  teacher_id: number
  teacher_name?: string | null
  date: string
  type: string
  start_period?: number | null
  end_period?: number | null
}

export interface Exception {
  id: number
  teacher_id: number
  teacher_name?: string | null
  date: string
  type: string
  start_period?: number | null
  end_period?: number | null
}

export interface AlternativeCandidate {
  teacher_id: number
  name: string
  score: number
  explanation: string
}

export interface ProxyAssignment {
  id: number
  date: string
  absent_teacher_id: number
  absent_teacher_name: string | null
  period_no: number
  class_name: string
  assigned_proxy_id: number | null
  assigned_proxy_name: string | null
  score: number | null
  explanation: string | null
  alternatives: AlternativeCandidate[]
}

export interface Setting {
  key: string
  value: string
}

export interface AuditLog {
  id: number
  timestamp: string
  user_id: string
  action: string
  details: string
}

export interface DashboardSummary {
  total_teachers: number
  abs_count: number
  proxy_count: number
  pending_count: number
}

export interface AnalyticsSummary {
  daily_history: any[]
  most_utilized: any[]
  least_utilized: any[]
  fairness_index: number
}

interface StoreState {
  teachers: Teacher[]
  absences: Absence[]
  exceptions: Exception[]
  proxyAssignments: ProxyAssignment[]
  settings: Setting[]
  auditLogs: AuditLog[]
  selectedDate: string
  summary: DashboardSummary | null
  analytics: AnalyticsSummary | null
  loading: boolean
  error: string | null
  isLocalMode: boolean
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  
  setSelectedDate: (date: string) => void
  fetchTeachers: () => Promise<void>
  fetchAbsences: () => Promise<void>
  fetchExceptions: () => Promise<void>
  fetchProxyAssignments: () => Promise<void>
  fetchSettings: () => Promise<void>
  fetchAuditLogs: () => Promise<void>
  fetchDashboardSummary: () => Promise<void>
  fetchAnalytics: () => Promise<void>
  
  addAbsence: (teacherId: number, type: string, start?: number | null, end?: number | null) => Promise<void>
  deleteAbsence: (id: number) => Promise<void>
  addException: (teacherId: number, type: string, start?: number | null, end?: number | null) => Promise<void>
  deleteException: (id: number) => Promise<void>
  generateProxies: () => Promise<void>
  reassignProxy: (id: number) => Promise<void>
  updateSetting: (key: string, value: string) => Promise<void>
  uploadTimetable: (file: File) => Promise<any>
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1'

function addAuditLogLocal(action: string, details: string) {
  try {
    const localLogs = localStorage.getItem('spms_audit_logs')
    const logs = localLogs ? JSON.parse(localLogs) : []
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user_id: 'coordinator',
      action,
      details
    }
    logs.unshift(newLog)
    localStorage.setItem('spms_audit_logs', JSON.stringify(logs))
  } catch (err) {}
}

export const useStore = create<StoreState>((set, get) => ({
  teachers: [],
  absences: [],
  exceptions: [],
  proxyAssignments: [],
  settings: (() => {
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('spms_settings')
      if (local) {
        try {
          return JSON.parse(local)
        } catch (e) {}
      }
    }
    const defaults = {
      "daily_proxy_limit": "6",
      "min_free_periods": "0",
      "weight_free": "40",
      "weight_familiarity": "50",
      "weight_daily": "30",
      "weight_weekly": "20",
      "weight_monthly": "10",
      "weight_consecutive": "-30",
      "weight_last_free": "-1000",
      "blocked_symbols": "B,-"
    }
    return Object.entries(defaults).map(([key, value]) => ({ key, value }))
  })(),
  auditLogs: [],
  selectedDate: (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })(),
  summary: null,
  analytics: null,
  loading: false,
  error: null,
  isLocalMode: false,
  isSidebarOpen: false,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  setSelectedDate: (date) => {
    set({ selectedDate: date })
    get().fetchAbsences()
    get().fetchExceptions()
    get().fetchProxyAssignments()
    get().fetchDashboardSummary()
  },

  fetchTeachers: async () => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/teachers`)
      if (!r.ok) throw new Error('Failed to fetch teachers')
      const data = await r.json()
      set({ teachers: data, loading: false, isLocalMode: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localTeachers = localStorage.getItem('spms_teachers')
        set({ 
          teachers: localTeachers ? JSON.parse(localTeachers) : [], 
          isLocalMode: true,
          loading: false 
        })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  fetchAbsences: async () => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/absentees?date=${date}`)
      if (!r.ok) throw new Error('Failed to fetch absences')
      const data = await r.json()
      set({ absences: data, loading: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localAbsences = localStorage.getItem('spms_absences')
        const allAbsences = localAbsences ? JSON.parse(localAbsences) : []
        const filtered = allAbsences.filter((a: any) => a.date === date)
        set({ absences: filtered, isLocalMode: true, loading: false })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  fetchExceptions: async () => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/exceptions?date=${date}`)
      if (!r.ok) throw new Error('Failed to fetch exceptions')
      const data = await r.json()
      set({ exceptions: data, loading: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localExceptions = localStorage.getItem('spms_exceptions')
        const allExceptions = localExceptions ? JSON.parse(localExceptions) : []
        const filtered = allExceptions.filter((e: any) => e.date === date)
        set({ exceptions: filtered, isLocalMode: true, loading: false })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  fetchProxyAssignments: async () => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/proxies/results?date=${date}`)
      if (!r.ok) throw new Error('Failed to fetch proxy assignments')
      const data = await r.json()
      set({ proxyAssignments: data, loading: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localProxies = localStorage.getItem('spms_proxy_assignments')
        const allProxies = localProxies ? JSON.parse(localProxies) : []
        const filtered = allProxies.filter((p: any) => p.date === date)
        set({ proxyAssignments: filtered, isLocalMode: true, loading: false })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/settings`)
      if (!r.ok) throw new Error('Failed to fetch settings')
      const data = await r.json()
      set({ settings: data, loading: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localSettings = localStorage.getItem('spms_settings')
        let data = localSettings ? JSON.parse(localSettings) : []
        if (data.length === 0) {
          const defaults = {
            "daily_proxy_limit": "6",
            "min_free_periods": "0",
            "weight_free": "40",
            "weight_familiarity": "50",
            "weight_daily": "30",
            "weight_weekly": "20",
            "weight_monthly": "10",
            "weight_consecutive": "-30",
            "weight_last_free": "-1000",
            "blocked_symbols": "B,-"
          }
          data = Object.entries(defaults).map(([key, value]) => ({ key, value }))
          localStorage.setItem('spms_settings', JSON.stringify(data))
        } else {
          // Migration check for legacy defaults in localStorage
          let modified = false;
          data = data.map((item: any) => {
            if (item.key === "daily_proxy_limit" && item.value === "2") {
              modified = true;
              return { ...item, value: "6" };
            }
            if (item.key === "min_free_periods" && item.value === "2") {
              modified = true;
              return { ...item, value: "0" };
            }
            return item;
          });
          if (modified) {
            localStorage.setItem('spms_settings', JSON.stringify(data));
          }
        }
        set({ settings: data, isLocalMode: true, loading: false })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  fetchAuditLogs: async () => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/audit-logs?limit=100`)
      if (!r.ok) throw new Error('Failed to fetch audit logs')
      const data = await r.json()
      set({ auditLogs: data, loading: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localLogs = localStorage.getItem('spms_audit_logs')
        const allLogs = localLogs ? JSON.parse(localLogs) : []
        set({ auditLogs: allLogs.slice(0, 100), isLocalMode: true, loading: false })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  fetchDashboardSummary: async () => {
    const date = get().selectedDate
    try {
      const r = await fetch(`${API_BASE_URL}/dashboard/summary?date=${date}`)
      if (r.ok) {
        const data = await r.json()
        set({ summary: data })
      }
    } catch (err: any) {
      const t_count = get().teachers.length
      const abs_count = get().absences.length
      const proxies = get().proxyAssignments
      const proxy_count = proxies.filter(p => p.assigned_proxy_id !== null).length
      const pending_count = proxies.filter(p => p.assigned_proxy_id === null).length
      
      set({
        summary: {
          total_teachers: t_count,
          abs_count: abs_count,
          proxy_count: proxy_count,
          pending_count: pending_count
        }
      })
    }
  },

  fetchAnalytics: async () => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/analytics?date=${date}`)
      if (!r.ok) throw new Error('Failed to fetch analytics')
      const data = await r.json()
      set({ analytics: data, loading: false })
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localProxies = localStorage.getItem('spms_proxy_assignments')
        const allProxies: ProxyAssignment[] = localProxies ? JSON.parse(localProxies) : []
        
        const dailyCounts: Record<string, number> = {}
        allProxies.forEach(p => {
          if (p.assigned_proxy_id) {
            dailyCounts[p.date] = (dailyCounts[p.date] || 0) + 1
          }
        })
        const daily_history = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
        
        const teacherCounts: Record<number, number> = {}
        get().teachers.forEach(t => { teacherCounts[t.id] = 0 })
        allProxies.forEach(p => {
          if (p.assigned_proxy_id) {
            teacherCounts[p.assigned_proxy_id] = (teacherCounts[p.assigned_proxy_id] || 0) + 1
          }
        })
        
        const localAbsences = localStorage.getItem('spms_absences')
        const absences = localAbsences ? JSON.parse(localAbsences) : []
        const absentIds = absences.filter((a: any) => a.date === date).map((a: any) => a.teacher_id)
        const activeTeachers = get().teachers.filter(t => !absentIds.includes(t.id))
        
        const utilizations = activeTeachers.map(t => ({
          teacher_id: t.id,
          name: t.name,
          proxy_count: teacherCounts[t.id] || 0
        }))
        utilizations.sort((a, b) => a.proxy_count - b.proxy_count)
        
        const least_utilized = utilizations.slice(0, 5)
        const most_utilized = [...utilizations].reverse().slice(0, 5)
        
        const distinctDates = [...new Set(allProxies.map(p => p.date))]
        let totalScore = 0
        let dateCount = 0
        distinctDates.forEach(dStr => {
          const dayAbsences = (localStorage.getItem('spms_absences') ? JSON.parse(localStorage.getItem('spms_absences')!) : []).filter((a: any) => a.date === dStr)
          const dayProxies = allProxies.filter(p => p.date === dStr)
          const score = calculateLocalFairness(get().teachers, dayAbsences, dayProxies, dStr)
          totalScore += score
          dateCount++
        })
        
        const fairness_index = dateCount > 0 ? (totalScore / dateCount) : 1.0
        
        set({
          analytics: {
            daily_history,
            most_utilized,
            least_utilized,
            fairness_index: Math.round(fairness_index * 10000) / 10000
          },
          isLocalMode: true,
          loading: false
        })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  addAbsence: async (teacherId, type, start = null, end = null) => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/absentees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, date, type, start_period: start, end_period: end })
      })
      if (!r.ok) {
        const errData = await r.json()
        throw new Error(errData.detail || 'Failed to mark absence')
      }
      set({ loading: false })
      get().fetchAbsences()
      get().fetchDashboardSummary()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localAbsences = localStorage.getItem('spms_absences')
        const absences = localAbsences ? JSON.parse(localAbsences) : []
        const exists = absences.some((a: any) => a.teacher_id === teacherId && a.date === date)
        if (exists) {
          set({ error: 'Teacher already marked absent for this date.', loading: false })
          throw new Error('Teacher already marked absent for this date.')
        }
        const teacherName = get().teachers.find(t => t.id === teacherId)?.name || 'Unknown'
        const newAbs = {
          id: Date.now(),
          teacher_id: teacherId,
          teacher_name: teacherName,
          date,
          type,
          start_period: start,
          end_period: end
        }
        absences.push(newAbs)
        localStorage.setItem('spms_absences', JSON.stringify(absences))
        
        addAuditLogLocal("MARK_ABSENCE", `Marked ${teacherName} absent today (${type}, date: ${date})`)
        
        set({ isLocalMode: true, loading: false })
        get().fetchAbsences()
        get().fetchDashboardSummary()
      } else {
        set({ error: err.message, loading: false })
        throw err
      }
    }
  },

  deleteAbsence: async (id) => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/absentees/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete absence')
      set({ loading: false })
      get().fetchAbsences()
      get().fetchDashboardSummary()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localAbsences = localStorage.getItem('spms_absences')
        const absences = localAbsences ? JSON.parse(localAbsences) : []
        const target = absences.find((a: any) => a.id === id)
        const updated = absences.filter((a: any) => a.id !== id)
        localStorage.setItem('spms_absences', JSON.stringify(updated))
        
        if (target) {
          addAuditLogLocal("REMOVE_ABSENCE", `Removed absence entry for ${target.teacher_name || 'Unknown'} (date: ${target.date})`)
        }
        set({ isLocalMode: true, loading: false })
        get().fetchAbsences()
        get().fetchDashboardSummary()
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  addException: async (teacherId, type, start = null, end = null) => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, date, type, start_period: start, end_period: end })
      })
      if (!r.ok) {
        const errData = await r.json()
        throw new Error(errData.detail || 'Failed to add exception')
      }
      set({ loading: false })
      get().fetchExceptions()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localExceptions = localStorage.getItem('spms_exceptions')
        const exceptions = localExceptions ? JSON.parse(localExceptions) : []
        const teacherName = get().teachers.find(t => t.id === teacherId)?.name || 'Unknown'
        const newExc = {
          id: Date.now(),
          teacher_id: teacherId,
          teacher_name: teacherName,
          date,
          type,
          start_period: start,
          end_period: end
        }
        exceptions.push(newExc)
        localStorage.setItem('spms_exceptions', JSON.stringify(exceptions))
        
        addAuditLogLocal("CREATE_EXCEPTION", `Added exception '${type}' for ${teacherName} on ${date}`)
        
        set({ isLocalMode: true, loading: false })
        get().fetchExceptions()
      } else {
        set({ error: err.message, loading: false })
        throw err
      }
    }
  },

  deleteException: async (id) => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/exceptions/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete exception')
      set({ loading: false })
      get().fetchExceptions()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localExceptions = localStorage.getItem('spms_exceptions')
        const exceptions = localExceptions ? JSON.parse(localExceptions) : []
        const target = exceptions.find((e: any) => e.id === id)
        const updated = exceptions.filter((e: any) => e.id !== id)
        localStorage.setItem('spms_exceptions', JSON.stringify(updated))
        
        if (target) {
          addAuditLogLocal("REMOVE_EXCEPTION", `Removed exception '${target.type}' for ${target.teacher_name || 'Unknown'} on ${target.date}`)
        }
        set({ isLocalMode: true, loading: false })
        get().fetchExceptions()
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  generateProxies: async () => {
    const date = get().selectedDate
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/proxies/generate?date=${date}`, { method: 'POST' })
      if (!r.ok) {
        const errData = await r.json()
        throw new Error(errData.detail || 'Failed to generate proxies')
      }
      const data = await r.json()
      set({ proxyAssignments: data, loading: false })
      get().fetchDashboardSummary()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const parts = date.split('-').map(Number)
        const dt = new Date(parts[0], parts[1] - 1, parts[2])
        const dayName = days[dt.getDay()]
        
        const settingsMap: Record<string, any> = {}
        get().settings.forEach(s => {
          const num = Number(s.value)
          settingsMap[s.key] = isNaN(num) ? s.value : num
        })
        
        const schedulesStr = localStorage.getItem('spms_schedules')
        const schedules = schedulesStr ? JSON.parse(schedulesStr) : []
        
        const duties: any[] = []
        get().absences.forEach(abs => {
          const teacher = get().teachers.find(t => t.id === abs.teacher_id)
          if (!teacher) return
          
          const teacherDaySchedules = schedules.filter((s: any) => s.teacher_id === teacher.id && s.day === dayName)
          teacherDaySchedules.forEach((s: any) => {
            const period_no = s.period_no
            const class_name = s.cell_value
            
            let isAbsentInPeriod = false
            if (abs.type === 'full_day') isAbsentInPeriod = true
            else if (abs.type === 'half_day_morning' && period_no <= 4) isAbsentInPeriod = true
            else if (abs.type === 'half_day_afternoon' && period_no > 4) isAbsentInPeriod = true
            else if (abs.type === 'custom' && abs.start_period && abs.end_period && period_no >= abs.start_period && period_no <= abs.end_period) isAbsentInPeriod = true
            
            if (isAbsentInPeriod && class_name && !["B", "-"].includes(class_name)) {
              duties.push({
                absent_teacher_id: teacher.id,
                absent_teacher_name: teacher.name,
                period_no,
                class_name
              })
            }
          })
        })
        
        const teacherOriginalFreePeriods: Record<number, number[]> = {}
        get().teachers.forEach(t => {
          const freePeriods = schedules.filter((s: any) => 
            s.teacher_id === t.id && 
            s.day === dayName && 
            (s.cell_value === null || s.cell_value === "")
          ).map((s: any) => s.period_no)
          teacherOriginalFreePeriods[t.id] = freePeriods
        })
        
        const allAssignmentsStr = localStorage.getItem('spms_proxy_assignments')
        const allAssignments: ProxyAssignment[] = allAssignmentsStr ? JSON.parse(allAssignmentsStr) : []
        const otherAssignments = allAssignments.filter(a => a.date !== date)
        
        const teacherHistories: Record<number, { daily: number; weekly: number; monthly: number }> = {}
        get().teachers.forEach(t => {
          const daily = otherAssignments.filter(a => a.assigned_proxy_id === t.id && a.date === date).length
          const refDate = new Date(date)
          const weekAgo = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000)
          const weekly = otherAssignments.filter(a => {
            if (a.assigned_proxy_id !== t.id) return false
            const d = new Date(a.date)
            return d >= weekAgo && d <= refDate
          }).length
          
          const monthAgo = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000)
          const monthly = otherAssignments.filter(a => {
            if (a.assigned_proxy_id !== t.id) return false
            const d = new Date(a.date)
            return d >= monthAgo && d <= refDate
          }).length
          
          teacherHistories[t.id] = { daily, weekly, monthly }
        })
        
        const results = solveAssignments(
          duties,
          get().teachers,
          get().absences,
          get().exceptions,
          teacherOriginalFreePeriods,
          teacherHistories,
          settingsMap
        )
        
        const assignmentsWithId: ProxyAssignment[] = results.map((r, index) => ({
          id: Date.now() + index,
          date,
          absent_teacher_id: r.absent_teacher_id,
          absent_teacher_name: r.absent_teacher_name,
          period_no: r.period_no,
          class_name: r.class_name,
          assigned_proxy_id: r.proxy_id,
          assigned_proxy_name: r.assigned_proxy_name,
          score: r.score,
          explanation: r.explanation,
          alternatives: r.alternatives
        }))
        
        const filteredAssignments = allAssignments.filter(a => a.date !== date)
        const newAllAssignments = [...filteredAssignments, ...assignmentsWithId]
        localStorage.setItem('spms_proxy_assignments', JSON.stringify(newAllAssignments))
        
        addAuditLogLocal("GENERATE_PROXIES", `Generated proxy assignments for date: ${date}. Assignments: ${assignmentsWithId.length}`)
        
        set({ proxyAssignments: assignmentsWithId, isLocalMode: true, loading: false })
        get().fetchDashboardSummary()
      } else {
        set({ error: err.message, loading: false })
        throw err
      }
    }
  },

  reassignProxy: async (id) => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/proxies/${id}/reassign`, { method: 'POST' })
      if (!r.ok) throw new Error('Failed to reassign proxy')
      const updated = await r.json()
      
      const current = get().proxyAssignments
      const updatedList = current.map(a => a.id === id ? updated : a)
      set({ proxyAssignments: updatedList, loading: false })
      get().fetchDashboardSummary()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localProxies = localStorage.getItem('spms_proxy_assignments')
        const allProxies: ProxyAssignment[] = localProxies ? JSON.parse(localProxies) : []
        
        const targetIdx = allProxies.findIndex(p => p.id === id)
        if (targetIdx === -1) {
          set({ error: 'Proxy assignment not found.', loading: false })
          return
        }
        
        const target = allProxies[targetIdx]
        const alternatives = target.alternatives || []
        if (alternatives.length === 0) {
          set({ error: 'No alternatives available for reassignment.', loading: false })
          return
        }
        
        const oldProxyName = target.assigned_proxy_name || "None"
        const nextCandidate = alternatives.shift()!
        
        const updatedTarget: ProxyAssignment = {
          ...target,
          assigned_proxy_id: nextCandidate.teacher_id,
          assigned_proxy_name: nextCandidate.name,
          score: nextCandidate.score,
          explanation: nextCandidate.explanation,
          alternatives
        }
        
        allProxies[targetIdx] = updatedTarget
        localStorage.setItem('spms_proxy_assignments', JSON.stringify(allProxies))
        
        addAuditLogLocal("REASSIGN_PROXY", `Reassigned Period ${updatedTarget.period_no} class ${updatedTarget.class_name} for absent ${updatedTarget.absent_teacher_name}. Replaced ${oldProxyName} with ${nextCandidate.name}.`)
        
        const current = get().proxyAssignments
        const updatedList = current.map(a => a.id === id ? updatedTarget : a)
        set({ proxyAssignments: updatedList, isLocalMode: true, loading: false })
        get().fetchDashboardSummary()
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  updateSetting: async (key, value) => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API_BASE_URL}/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })
      if (!r.ok) throw new Error('Failed to update setting')
      set({ loading: false })
      get().fetchSettings()
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        const localSettings = localStorage.getItem('spms_settings')
        const settings: Setting[] = localSettings ? JSON.parse(localSettings) : []
        const updated = settings.map(s => s.key === key ? { ...s, value } : s)
        localStorage.setItem('spms_settings', JSON.stringify(updated))
        
        addAuditLogLocal("UPDATE_SETTINGS", `Updated setting '${key}' to value '${value}'`)
        
        set({ settings: updated, isLocalMode: true, loading: false })
      } else {
        set({ error: err.message, loading: false })
      }
    }
  },

  uploadTimetable: async (file) => {
    set({ loading: true, error: null })
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const r = await fetch(`${API_BASE_URL}/timetable/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await r.json()
      if (!r.ok) {
        throw new Error(data.detail?.report?.errors?.join(', ') || 'Failed to parse timetable')
      }
      set({ loading: false })
      get().fetchTeachers()
      get().fetchDashboardSummary()
      return data
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch') || err.name === 'TypeError' || get().isLocalMode) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = async (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer)
              const workbook = XLSX.read(data, { type: 'array' })
              const firstSheetName = workbook.SheetNames[0]
              const worksheet = workbook.Sheets[firstSheetName]
              const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
              
              const parsed = parseTimetableJS(sheetData)
              
              localStorage.removeItem('spms_teachers')
              localStorage.removeItem('spms_schedules')
              localStorage.removeItem('spms_absences')
              localStorage.removeItem('spms_exceptions')
              localStorage.removeItem('spms_proxy_assignments')
              
              const localTeachers: Teacher[] = []
              const localSchedules: any[] = []
              
              parsed.teachers_data.forEach((tData, index) => {
                const tId = index + 1
                localTeachers.push({
                  id: tId,
                  name: tData.name,
                  class_teacher_of: tData.class_teacher_of
                })
                
                Object.entries(tData.schedule).forEach(([day, periods]: any) => {
                  Object.entries(periods).forEach(([pNumStr, cell_value]) => {
                    const period_no = parseInt(pNumStr, 10)
                    localSchedules.push({
                      id: localSchedules.length + 1,
                      teacher_id: tId,
                      day,
                      period_no,
                      cell_value
                    })
                  })
                })
              })
              
              localStorage.setItem('spms_teachers', JSON.stringify(localTeachers))
              localStorage.setItem('spms_schedules', JSON.stringify(localSchedules))
              
              addAuditLogLocal("UPLOAD_TIMETABLE", `Successfully parsed timetable. Teachers: ${localTeachers.length}, Warnings: 0`)
              
              set({ isLocalMode: true, loading: false })
              get().fetchTeachers()
              get().fetchDashboardSummary()
              resolve({ message: 'Timetable uploaded and parsed successfully', report: parsed.report })
            } catch (pErr: any) {
              set({ error: pErr.message, loading: false })
              reject(pErr)
            }
          }
          reader.onerror = () => {
            set({ error: 'Failed to read file', loading: false })
            reject(new Error('Failed to read file'))
          }
          reader.readAsArrayBuffer(file)
        })
      } else {
        set({ error: err.message, loading: false })
        throw err
      }
    }
  }
}))
