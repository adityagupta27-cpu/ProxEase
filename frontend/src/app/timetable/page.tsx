'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Search, Grid, List as ListIcon, Calendar, User, BookOpen, AlertCircle } from 'lucide-react'

interface TimetableItem {
  id: number
  teacher_id: number
  teacher_name: string
  day: string
  period_no: number
  cell_value: string | null
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const periods = [1, 2, 3, 4, 5, 6, 7, 8]

export default function TimetableExplorer() {
  const { 
    teachers, 
    fetchTeachers,
    selectedDate,
    absences,
    exceptions,
    proxyAssignments,
    fetchAbsences,
    fetchExceptions,
    fetchProxyAssignments
  } = useStore()
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Search parameters
  const [searchTeacher, setSearchTeacher] = useState('')
  const [searchClass, setSearchClass] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  
  const [listResults, setListResults] = useState<TimetableItem[]>([])
  const [gridData, setGridData] = useState<Record<string, Record<string, Record<number, string | null>>>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTeachers()
    fetchExplorerData()
  }, [searchTeacher, searchClass, selectedDay, selectedPeriod])

  useEffect(() => {
    fetchAbsences()
    fetchExceptions()
    fetchProxyAssignments()
  }, [selectedDate])

  const fetchExplorerData = async () => {
    setLoading(true)
    try {
      let data: TimetableItem[] = []
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1'

      try {
        const queryParams = new URLSearchParams()
        if (searchTeacher) queryParams.append('teacher_name', searchTeacher)
        if (searchClass) queryParams.append('class_name', searchClass)
        if (selectedDay) queryParams.append('day', selectedDay)
        if (selectedPeriod) queryParams.append('period_no', selectedPeriod)

        const r = await fetch(`${API_BASE_URL}/timetable/explorer?${queryParams.toString()}`)
        if (!r.ok) throw new Error('Failed to load explorer data')
        data = await r.json()
      } catch (fetchErr) {
        // Local mode fallback
        const teachersStr = localStorage.getItem('spms_teachers')
        const schedulesStr = localStorage.getItem('spms_schedules')
        const localTeachers: any[] = teachersStr ? JSON.parse(teachersStr) : []
        const localSchedules: any[] = schedulesStr ? JSON.parse(schedulesStr) : []

        const mapped: TimetableItem[] = localSchedules.map(s => {
          const teacher = localTeachers.find(t => t.id === s.teacher_id)
          return {
            id: s.id,
            teacher_id: s.teacher_id,
            teacher_name: teacher ? teacher.name : `Teacher ${s.teacher_id}`,
            day: s.day,
            period_no: s.period_no,
            cell_value: s.cell_value
          }
        })

        data = mapped.filter(item => {
          if (searchTeacher && !item.teacher_name.toLowerCase().includes(searchTeacher.toLowerCase())) return false
          if (searchClass && (!item.cell_value || !item.cell_value.toLowerCase().includes(searchClass.toLowerCase()))) return false
          if (selectedDay && item.day !== selectedDay) return false
          if (selectedPeriod && item.period_no !== parseInt(selectedPeriod, 10)) return false
          return true
        })
      }
      
      setListResults(data)

      // Reconstruct grid data for grid view: Teacher -> Day -> Period -> CellValue
      const tempGrid: Record<string, Record<string, Record<number, string | null>>> = {}
      
      // Initialize teachers
      teachers.forEach(t => {
        tempGrid[t.name] = {}
        days.forEach(d => {
          tempGrid[t.name][d] = {}
          periods.forEach(p => {
            tempGrid[t.name][d][p] = null
          })
        })
      })

      // Populate grid data
      data.forEach(item => {
        if (!tempGrid[item.teacher_name]) {
          tempGrid[item.teacher_name] = {}
          days.forEach(d => {
            tempGrid[item.teacher_name][d] = {}
            periods.forEach(p => {
              tempGrid[item.teacher_name][d][p] = null
            })
          })
        }
        if (tempGrid[item.teacher_name][item.day]) {
          tempGrid[item.teacher_name][item.day][item.period_no] = item.cell_value
        }
      })

      setGridData(tempGrid)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Filter grid teachers list by search input
  const filteredGridTeachers = Object.keys(gridData).filter(name => 
    name.toLowerCase().includes(searchTeacher.toLowerCase())
  )

  const getCellBadgeClass = (val: string | null) => {
    if (!val) return 'badge-free font-medium' // Free
    if (val === 'B' || val === '-') return 'badge-special font-bold' // Busy
    return 'badge-class font-semibold' // Teaching Class
  }

  const getCellLiveStatus = (
    teacherName: string,
    dayName: string,
    periodNo: number,
    originalValue: string | null
  ) => {
    if (!selectedDate) {
      const label = originalValue || 'Free'
      return {
        label,
        badgeClass: getCellBadgeClass(originalValue),
        tooltipText: originalValue 
          ? (originalValue === 'B' || originalValue === '-' ? 'Busy / Blocked' : `Teaching Class: ${originalValue}`)
          : 'Free Period'
      }
    }

    const [year, month, day] = selectedDate.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const selectedDayName = daysOfWeek[dateObj.getDay()]

    if (dayName !== selectedDayName) {
      const label = originalValue || 'Free'
      return {
        label,
        badgeClass: getCellBadgeClass(originalValue),
        tooltipText: originalValue 
          ? (originalValue === 'B' || originalValue === '-' ? 'Busy / Blocked' : `Teaching Class: ${originalValue}`)
          : 'Free Period'
      }
    }

    // Check if this teacher is absent in this period
    const teacherAbsence = absences.find(abs => {
      if (!abs.teacher_name || abs.teacher_name.toLowerCase() !== teacherName.toLowerCase()) return false
      if (abs.type === 'full_day') return true
      if (abs.type === 'half_day_morning' && periodNo <= 4) return true
      if (abs.type === 'half_day_afternoon' && periodNo > 4) return true
      if (abs.type === 'custom' && abs.start_period && abs.end_period) {
        return periodNo >= abs.start_period && periodNo <= abs.end_period
      }
      return false
    })

    if (teacherAbsence) {
      const proxy = proxyAssignments.find(p => 
        p.absent_teacher_name && 
        p.absent_teacher_name.toLowerCase() === teacherName.toLowerCase() && 
        p.period_no === periodNo
      )
      const proxyTeacher = proxy?.assigned_proxy_name
      
      const label = 'Absent'
      const badgeClass = 'badge-absent font-semibold line-through cursor-help'
      
      const typeLabel = teacherAbsence.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const tooltipText = `Absent (${typeLabel})${proxyTeacher ? ` - Covered by proxy: ${proxyTeacher} (Class ${proxy.class_name})` : ' - No proxy assigned'}`
      
      return { label, badgeClass, tooltipText }
    }

    // Check if this teacher is covering a class as a proxy in this period
    const proxyDuty = proxyAssignments.find(p => 
      p.assigned_proxy_name && 
      p.assigned_proxy_name.toLowerCase() === teacherName.toLowerCase() && 
      p.period_no === periodNo
    )
    if (proxyDuty) {
      const label = `Proxy: ${proxyDuty.class_name}`
      const badgeClass = 'badge-free font-bold animate-pulse cursor-help border-emerald-500'
      const tooltipText = `Proxy Cover duty for ${proxyDuty.absent_teacher_name || 'Absent Teacher'} (Class: ${proxyDuty.class_name})`
      
      return { label, badgeClass, tooltipText }
    }

    // Check if teacher has an exception in this period
    const teacherException = exceptions.find(exc => {
      if (!exc.teacher_name || exc.teacher_name.toLowerCase() !== teacherName.toLowerCase()) return false
      if (!exc.start_period || !exc.end_period) return true // full day
      return periodNo >= exc.start_period && periodNo <= exc.end_period
    })

    if (teacherException) {
      const label = 'Duty'
      const badgeClass = 'badge-special font-semibold cursor-help'
      const typeLabel = teacherException.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const tooltipText = `Unavailable/On Exception Duty: ${typeLabel}${teacherException.start_period ? ` (Periods ${teacherException.start_period}-${teacherException.end_period})` : ' (Full Day)'}`
      
      return { label, badgeClass, tooltipText }
    }

    // Normal status
    let label = originalValue || 'Free'
    let badgeClass = getCellBadgeClass(originalValue)
    let tooltipText = originalValue 
      ? (originalValue === 'B' || originalValue === '-' ? 'Busy / Blocked' : `Teaching Class: ${originalValue}`)
      : 'Free Period'

    return { label, badgeClass, tooltipText }
  }

  const activeDay = (() => {
    if (!selectedDate) return null
    const [year, month, day] = selectedDate.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return daysOfWeek[dateObj.getDay()]
  })()

  const visibleDays = activeDay && days.includes(activeDay) ? [activeDay] : days

  return (
    <div className="space-y-6">
      {/* Title & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            Timetable Explorer
          </h2>
          <p className="text-slate-200 text-sm mt-1">
            Search, filter, and view weekly schedules of all school teachers.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 w-full sm:w-auto self-start">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow' 
                : 'text-slate-200 hover:text-slate-200'
            }`}
          >
            <Grid className="h-4 w-4" />
            <span>Master Grid</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              viewMode === 'list' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow' 
                : 'text-slate-200 hover:text-slate-200'
            }`}
          >
            <ListIcon className="h-4 w-4" />
            <span>Search List</span>
          </button>
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className="glass-panel rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex flex-col space-y-1">
          <label className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span>Teacher Name</span>
          </label>
          <input
            type="text"
            placeholder="Search teacher..."
            value={searchTeacher}
            onChange={(e) => setSearchTeacher(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center space-x-1">
            <BookOpen className="h-3 w-3" />
            <span>Class Name</span>
          </label>
          <input
            type="text"
            placeholder="e.g. 5, Nursery..."
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Day</span>
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="">All Days</option>
            {days.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs uppercase tracking-wider text-slate-200 font-bold flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Period</span>
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="">All Periods</option>
            {periods.map(p => (
              <option key={p} value={p}>Period {p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Timetable Content */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-200 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-r-2 border-transparent"></div>
            <p className="text-sm font-medium">Fetching timetable records...</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* MASTER GRID VIEW */
          <div className="overflow-x-auto max-w-full">
            <table className={`w-full text-left border-collapse ${visibleDays.length === 1 ? 'min-w-[800px]' : 'min-w-[2800px]'}`}>
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-xs uppercase tracking-wider font-bold text-slate-200">
                  <th className="px-5 py-4 w-48 sticky left-0 bg-slate-950 z-20 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                    Teacher Name
                  </th>
                  {visibleDays.map(d => (
                    <th key={d} colSpan={8} className="px-4 py-4 text-center border-r border-slate-800 bg-indigo-950/10">
                      {d}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-900/40 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-200 font-bold">
                  <th className="px-5 py-2.5 sticky left-0 bg-slate-900 z-20 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                    C.T.
                  </th>
                  {visibleDays.map(d => 
                    periods.map(p => (
                      <th key={`${d}-${p}`} className="px-2 py-2.5 text-center border-r border-slate-800/50 w-[55px]">
                        P{p}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredGridTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={visibleDays.length * 8 + 1} className="px-6 py-10 text-center text-slate-200 text-sm">
                      No matching teacher schedules found.
                    </td>
                  </tr>
                ) : (
                  filteredGridTeachers.map((teacherName) => {
                    const ctClass = teachers.find(t => t.name === teacherName)?.class_teacher_of || '-';
                    return (
                      <tr key={teacherName} className="border-b border-slate-800/60 hover:bg-slate-800/20 text-xs">
                        <td className="px-5 py-3 font-semibold text-slate-200 sticky left-0 bg-slate-900 z-10 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[180px]">{teacherName}</span>
                            <span className="text-xs text-slate-200 font-normal">C.T. {ctClass}</span>
                          </div>
                        </td>
                        {visibleDays.map(d => 
                          periods.map(p => {
                            const val = gridData[teacherName]?.[d]?.[p] ?? null;
                            const { label, badgeClass, tooltipText } = getCellLiveStatus(teacherName, d, p, val);
                            return (
                              <td key={`${d}-${p}`} className="p-1 border-r border-slate-800/40 text-center">
                                <span 
                                  title={tooltipText}
                                  className={`inline-block w-full py-2 px-1.5 rounded-lg border text-center text-xs truncate max-w-[50px] transition-all cursor-default ${badgeClass}`}
                                >
                                  {label}
                                </span>
                              </td>
                            )
                          })
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SEARCH LIST VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-xs uppercase tracking-wider font-bold text-slate-200">
                  <th className="px-6 py-4">Teacher</th>
                  <th className="px-6 py-4">Day</th>
                  <th className="px-6 py-4">Period</th>
                  <th className="px-6 py-4">Status / Class</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {listResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-200">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertCircle className="h-8 w-8 opacity-40" />
                        <p className="text-sm">No timetable periods match the filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  listResults.slice(0, 100).map((r) => {
                    const { label, badgeClass, tooltipText } = getCellLiveStatus(r.teacher_name, r.day, r.period_no, r.cell_value);
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/20 text-xs" title={tooltipText}>
                        <td className="px-6 py-3.5 font-semibold text-slate-200">{r.teacher_name}</td>
                        <td className="px-6 py-3.5 text-slate-300">{r.day}</td>
                        <td className="px-6 py-3.5 font-medium text-indigo-400">Period {r.period_no}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-3 py-1.5 rounded-xl border text-xs ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {listResults.length > 100 && (
              <div className="p-3 text-center text-xs text-slate-200 bg-slate-900/10 border-t border-slate-800">
                Displaying first 100 results. Use filters to narrow down the search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
