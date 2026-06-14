'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { 
  Play, 
  RefreshCcw, 
  HelpCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  UserCheck,
  Zap,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export default function LiveProxyOperationsCenter() {
  const { 
    proxyAssignments, 
    generateProxies, 
    reassignProxy, 
    fetchProxyAssignments, 
    selectedDate,
    loading,
    error,
    summary,
    fetchDashboardSummary
  } = useStore()

  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)

  // Detect if selected date is a Sunday (no school)
  const isSunday = (() => {
    const parts = selectedDate.split('-').map(Number)
    const dt = new Date(parts[0], parts[1] - 1, parts[2])
    return dt.getDay() === 0
  })()

  useEffect(() => {
    fetchProxyAssignments()
    fetchDashboardSummary()
    setGenerationMessage(null)
    setLocalError(null)
  }, [selectedDate])

  const handleGenerate = async () => {
    setLocalError(null)
    setGenerationMessage(null)
    
    if (isSunday) {
      setLocalError('Cannot generate proxies for Sunday — no school schedule exists for Sundays. Please select a weekday (Monday–Saturday).')
      return
    }
    
    try {
      await generateProxies()
      // Check if generation returned zero results
      const currentAssignments = useStore.getState().proxyAssignments
      if (currentAssignments.length === 0) {
        setGenerationMessage('Proxy generation completed, but no substitute assignments were needed. This could mean: no teachers are marked absent for this date, or absent teachers have no scheduled classes on this day.')
      }
    } catch (err: any) {
      setLocalError(err.message || 'Failed to generate proxies. Make sure teachers are marked absent today.')
    }
  }

  const handleReassign = async (id: number) => {
    try {
      await reassignProxy(id)
    } catch (err) {
      console.error(err)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedCardId(expandedCardId === id ? null : id)
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Title Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs uppercase font-bold tracking-widest text-zinc-500">Live Workspace</span>
          </div>
          <h2 className="page-title text-zinc-100 mt-1">
            Generate Proxies
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Globally optimal substitute teacher assignments calculated in real-time.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || isSunday}
          className="w-full sm:w-auto justify-center sm:justify-start flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-md transition-all duration-150 cursor-pointer active:scale-[0.97]"
        >
          {loading ? (
            <>
              <RefreshCcw className="h-4 w-4 animate-spin" />
              <span>Optimizing Schedule...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white shrink-0" />
              <span>Generate Optimal Proxies</span>
            </>
          )}
        </button>
      </div>

      {/* Sunday Warning Banner */}
      {isSunday && (
        <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-xs max-w-4xl">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Today is <strong>Sunday</strong> — no school schedule exists. Please select a weekday (Monday–Saturday) from the date picker to generate proxies.</span>
        </div>
      )}

      {/* Error Message banner */}
      {(error || localError) && (
        <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs max-w-4xl">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{localError || error}</span>
        </div>
      )}

      {/* Info Message banner */}
      {generationMessage && !error && !localError && (
        <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl text-xs max-w-4xl">
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>{generationMessage}</span>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Proxy Assignments List (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title text-base font-bold text-zinc-400 uppercase tracking-wider">Active Proxy List</h3>
            <span className="text-xs text-zinc-500 font-mono">
              {proxyAssignments.length} Assignments generated
            </span>
          </div>

          {loading ? (
            <div className="glass-panel py-24 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500 border-r-2 border-transparent z-10"></div>
                <RefreshCcw className="absolute h-4 w-4 text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-200 text-sm">Solving Constraint Satisfaction Problem...</h4>
                <p className="text-xs text-zinc-500 max-w-xs leading-normal">
                  Optimizing teacher match rules, familiarity preferences, and history penalties.
                </p>
              </div>
            </div>
          ) : proxyAssignments.length === 0 ? (
            <div className="glass-panel p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-600 rounded-2xl">
                <Zap className="h-8 w-8" />
              </div>
              <div className="space-y-1.5 px-6">
                <h4 className="font-bold text-zinc-300 text-sm">No Active Proxies Generated</h4>
                <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                  Generate substitute allocations for today's active absences using the button in the top right. Make sure you have uploaded the timetable and entered absences first.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {proxyAssignments.map((asg) => {
                const isExpanded = expandedCardId === asg.id
                const hasProxy = asg.assigned_proxy_id !== null
                const hasAlternatives = asg.alternatives && asg.alternatives.length > 0

                return (
                  <div 
                    key={asg.id} 
                    className={`glass-panel border transition-all duration-200 ${
                      isExpanded ? 'border-indigo-500/40 bg-zinc-900/40' : 'border-zinc-850 bg-zinc-900/10'
                    }`}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => toggleExpand(asg.id)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="p-2 bg-zinc-900 border border-zinc-800 text-indigo-400 rounded-lg flex flex-col items-center justify-center w-12 h-12 shrink-0">
                          <Clock className="h-3.5 w-3.5 mb-0.5 text-zinc-400" />
                          <span className="text-[10px] font-black font-mono">P{asg.period_no}</span>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-zinc-200 text-sm">
                              Class {asg.class_name}
                            </h4>
                            <span className="badge-absent whitespace-nowrap">
                              Absent: {asg.absent_teacher_name}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-1.5">
                            {hasProxy ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="font-medium text-zinc-300">Substitute: </span>
                                <span className="font-bold text-zinc-200">{asg.assigned_proxy_name}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                <span className="text-rose-400 font-semibold">Unassigned - Gaps present</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReassign(asg.id)
                            }}
                            disabled={!hasAlternatives || loading}
                            className="flex items-center space-x-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 text-zinc-300 hover:text-white border border-zinc-800 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95"
                            title="Cycle to next alternative candidate"
                          >
                            <RefreshCcw className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Reassign</span>
                          </button>

                          {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                        </div>
                      </div>
                    </div>

                    {/* Expand Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-zinc-850 space-y-4 bg-zinc-950/20 rounded-b-xl animate-fade-in">
                        {/* Explanation block */}
                        {hasProxy && (
                          <div className="space-y-1">
                            <h5 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Allocation Explanation</h5>
                            <p className="text-xs text-zinc-300 leading-normal pl-3 border-l-2 border-indigo-500/40">
                              {asg.explanation}
                            </p>
                          </div>
                        )}

                        {/* Alternatives list */}
                        <div className="space-y-2">
                          <h5 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Alternative Candidates</h5>
                          {!hasAlternatives ? (
                            <p className="text-xs text-zinc-500 pl-3">No other eligible substitute teachers available for this slot.</p>
                          ) : (
                            <div className="space-y-2 pl-2">
                              {asg.alternatives.map((alt, index) => (
                                <div 
                                  key={alt.teacher_id} 
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-zinc-900/30 border border-zinc-850 rounded-lg text-xs hover:border-zinc-800"
                                >
                                  <div className="space-y-1">
                                    <span className="font-bold text-zinc-300">Rank {index + 2}: {alt.name}</span>
                                    <p className="text-xs text-zinc-400 leading-normal">{alt.explanation}</p>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleReassign(asg.id)}
                                    className="w-full sm:w-auto px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-indigo-600 text-zinc-300 hover:text-white rounded-md text-xs font-semibold transition-all cursor-pointer"
                                  >
                                    Select
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Quick Action & Guidance Summary (lg:col-span-1) */}
        <div className="space-y-6">
          <div className="glass-panel p-5 space-y-4">
            <h3 className="section-title text-sm font-bold uppercase tracking-wider text-zinc-400">Operation Status</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Solve Success</span>
                <span className="font-semibold text-emerald-400">100%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }} />
              </div>
              
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-zinc-500">Unresolved Gaps</span>
                <span className={`font-semibold ${summary?.pending_count ? 'text-amber-400 animate-pulse' : 'text-zinc-300'}`}>
                  {summary?.pending_count ?? 0} slots
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-zinc-500">Workload Balance</span>
                <span className="font-semibold text-zinc-200">92%</span>
              </div>
            </div>

            <div className="border-t border-zinc-850 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-zinc-300">Quick Checklist</h4>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li className="flex items-center space-x-2">
                  <span className="h-4 w-4 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Select Date from the header.</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-4 w-4 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Mark active absentees for today.</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-4 w-4 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Click Generate Optimal Proxies.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
