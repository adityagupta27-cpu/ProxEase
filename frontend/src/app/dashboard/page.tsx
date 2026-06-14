'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { 
  Users, 
  UserMinus, 
  UserCheck, 
  HelpCircle, 
  ArrowRight,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  History,
  AlertOctagon,
  Play
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { 
    summary, 
    auditLogs, 
    fetchDashboardSummary, 
    fetchAuditLogs,
    selectedDate 
  } = useStore()

  useEffect(() => {
    fetchDashboardSummary()
    fetchAuditLogs()
  }, [selectedDate])

  const steps = [
    {
      num: '01',
      title: 'Upload Timetable',
      desc: 'Use the header button to upload the school timetable.xlsx file.',
      link: '/timetable',
      linkText: 'Explore Timetable',
      icon: FileCheck
    },
    {
      num: '02',
      title: 'Mark Absences',
      desc: 'Select absent teachers for full day, half day, or specific periods.',
      link: '/absentees',
      linkText: 'Manage Absentees',
      icon: UserMinus
    },
    {
      num: '03',
      title: 'Add Exceptions',
      desc: 'Enter duties (meetings, ceremonial, exam duty) to exclude teachers.',
      link: '/exceptions',
      linkText: 'Manage Exceptions',
      icon: AlertOctagon
    },
    {
      num: '04',
      title: 'Generate Proxies',
      desc: 'Let OR-Tools optimize assignments globally. Adjust instantly if needed.',
      link: '/',
      linkText: 'Generate Assignments',
      icon: Play
    }
  ]

  // Group audit logs for Today and Older date headers
  const getTimelineLogs = () => {
    if (!auditLogs || auditLogs.length === 0) return { today: [], older: [] }
    const todayLogs: any[] = []
    const olderLogs: any[] = []
    
    const sorted = [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    sorted.slice(0, 10).forEach(log => {
      const logDate = new Date(log.timestamp).toDateString()
      const todayDate = new Date().toDateString()
      if (logDate === todayDate) {
        todayLogs.push(log)
      } else {
        olderLogs.push(log)
      }
    })
    
    return { today: todayLogs, older: olderLogs }
  }

  const { today: todayLogs, older: olderLogs } = getTimelineLogs()

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Capitalized Description Header */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-black">
          Monitor substitute teaching assignments and optimize resource allocation.
        </p>
      </div>

      {/* Stats Cards Grid - Clickable links for deep navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link 
          href="/teachers" 
          className="glass-panel rounded-2xl p-6 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-zinc-800/80"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Total Staff</span>
            <div className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight">
              {summary?.total_teachers ?? 0}
            </div>
          </div>
          <div className="p-3.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl shrink-0">
            <Users className="h-6 w-6" />
          </div>
        </Link>

        <Link 
          href="/absentees" 
          className="glass-panel rounded-2xl p-6 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-zinc-800/80"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Today's Absences</span>
            <div className="text-4xl font-extrabold text-rose-600 dark:text-rose-500 font-mono tracking-tight">
              {summary?.abs_count ?? 0}
            </div>
          </div>
          <div className="p-3.5 bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-2xl shrink-0">
            <UserMinus className="h-6 w-6" />
          </div>
        </Link>

        <Link 
          href="/" 
          className="glass-panel rounded-2xl p-6 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-zinc-800/80"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Proxies Assigned</span>
            <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {summary?.proxy_count ?? 0}
            </div>
          </div>
          <div className="p-3.5 bg-emerald-500/10 text-emerald-500 dark:text-emerald-450 border border-emerald-500/20 rounded-2xl shrink-0">
            <UserCheck className="h-6 w-6" />
          </div>
        </Link>

        <Link 
          href="/" 
          className="glass-panel rounded-2xl p-6 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-zinc-800/80"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Pending Coverage</span>
            <div className={`text-4xl font-extrabold font-mono tracking-tight ${summary?.pending_count ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
              {summary?.pending_count ?? 0}
            </div>
          </div>
          <div className={`p-3.5 border rounded-2xl shrink-0 ${
            summary?.pending_count 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
              : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
          }`}>
            <HelpCircle className="h-6 w-6" />
          </div>
        </Link>
      </div>

      {/* Main Content Grid: System Workflow (2 cols) & Recent Activity (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: System Workflow Guide */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center space-x-2 border-b border-zinc-800/80 pb-3">
            <TrendingUp className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">System Workflow</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {steps.map((s) => {
              const StepIcon = s.icon
              return (
                <div 
                  key={s.num} 
                  className="glass-panel rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:scale-[1.01] transition-all duration-200 border border-zinc-800/80"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {/* Highly readable, bright indigo workflow numbers */}
                      <span className="text-3xl font-black text-indigo-500 dark:text-indigo-400 font-mono tracking-tight select-none">
                        {s.num}
                      </span>
                      <StepIcon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <h4 className="font-bold text-zinc-200">{s.title}</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
                  </div>
                  <Link
                    href={s.link}
                    className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
                  >
                    <span>{s.linkText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Recent Activity Log */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2 border-b border-zinc-800/80 pb-3">
            <History className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Recent Activity</h3>
          </div>

          <div className="glass-panel rounded-2xl p-5 h-[375px] flex flex-col justify-between border border-zinc-800/80">
            <div className="overflow-y-auto space-y-3 pr-1 max-h-[310px]">
              {auditLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-16 space-y-2">
                  <ShieldCheck className="h-8 w-8 opacity-40" />
                  <p className="text-xs">No activity logs recorded yet.</p>
                </div>
              ) : (
                auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-indigo-400 font-black bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        {log.action}
                      </span>
                      <span className="text-zinc-500 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-normal">{log.details}</p>
                  </div>
                ))
              )}
            </div>

            <Link
              href="/audit-logs"
              className="text-xs text-center text-zinc-400 hover:text-zinc-200 hover:underline pt-2 font-medium"
            >
              View All Audit Logs
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
