'use client'

import { useRef, useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { usePathname } from 'next/navigation'
import { 
  UploadCloud, 
  Calendar, 
  Loader2, 
  Sun, 
  Moon, 
  Menu, 
  Bell, 
  ShieldCheck,
  Server,
  Zap
} from 'lucide-react'

export default function Topbar() {
  const { 
    selectedDate, 
    setSelectedDate, 
    summary, 
    fetchDashboardSummary, 
    uploadTimetable, 
    fetchTeachers,
    loading,
    isSidebarOpen,
    setSidebarOpen,
    isLocalMode
  } = useStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }

  useEffect(() => {
    fetchDashboardSummary()
    fetchTeachers()
  }, [selectedDate])

  // Auto-refresh date when the day rolls over (midnight) or tab regains focus
  // Only auto-updates if the user hasn't manually changed the date this session
  const userChangedDateRef = useRef(false)

  useEffect(() => {
    const getLocalDate = () => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }

    const checkDateFreshness = () => {
      if (userChangedDateRef.current) return
      const today = getLocalDate()
      const current = useStore.getState().selectedDate
      if (current !== today) {
        setSelectedDate(today)
      }
    }

    // Check when tab gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDateFreshness()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also check every 60 seconds in case the tab stays open past midnight
    const interval = setInterval(checkDateFreshness, 60_000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    userChangedDateRef.current = true
    setSelectedDate(e.target.value)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMsg(null)
    try {
      const res = await uploadTimetable(file)
      setMsg({ type: 'success', text: `Timetable loaded! ${res.report.total_teachers} teachers parsed.` })
      setTimeout(() => setMsg(null), 5000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Timetable upload failed.' })
      setTimeout(() => setMsg(null), 7000)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const pathname = usePathname()
  const getPageName = () => {
    const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
    switch (cleanPath) {
      case '/': return 'Generate Proxies'
      case '/dashboard': return 'Dashboard'
      case '/teachers': return 'Staff Directory'
      case '/timetable': return 'Timetable Explorer'
      case '/absentees': return 'Mark Absentees'
      case '/exceptions': return 'Exceptions Management'
      case '/analytics': return 'Analytics & Reports'
      case '/audit-logs': return 'Audit Logs'
      case '/settings': return 'Settings'
      default: return null
    }
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 py-3 sm:px-6 mb-6">
      {/* Left: Mobile hamburger menu & Page breadcrumbs */}
      <div className="flex items-center space-x-3">
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg md:hidden cursor-pointer active:scale-95 transition-all shrink-0"
          title="Open Menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        {/* Dynamic Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 select-none">
          <span className="text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">ProxEase</span>
          {getPageName() && (
            <>
              <span className="text-zinc-700 hidden sm:inline">/</span>
              <span className="text-zinc-200 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg font-bold">
                {getPageName()}
              </span>
            </>
          )}
        </div>
      </div>


      {/* Right: Date, Upload, Theme switcher, Notifications, Avatar */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Date Selector */}
        <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
          <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="bg-transparent border-none text-xs font-semibold text-zinc-200 outline-none p-0 cursor-pointer"
          />
        </div>

        {/* Upload Timetable */}
        <div className="relative flex items-center">
          {msg && (
            <div className={`absolute right-full mr-2 z-45 text-[10px] px-2.5 py-1.5 rounded-lg border max-w-[120px] sm:max-w-xs truncate transition-opacity duration-300 ${
              msg.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {msg.text}
            </div>
          )}

          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleUploadClick}
            disabled={uploading || loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95"
            title="Upload school schedule file"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5 text-indigo-400" />
            )}
            <span className="hidden lg:inline">Upload Timetable</span>
          </button>
        </div>

        {/* Theme Switch */}
        <button
          onClick={toggleTheme}
          className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-855 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer active:scale-95"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-400" />}
        </button>

        {/* Notification Center */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-855 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer active:scale-95 relative"
            title="Notification Center"
          >
            <Bell className="h-3.5 w-3.5" />
            {summary && summary.pending_count > 0 && (
              <span className="absolute top-0.5 right-0.5 block h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-zinc-950 animate-pulse" />
            )}
          </button>
          
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-lg z-50 text-xs text-zinc-300 space-y-2 animate-fade-in">
              <h5 className="font-bold border-b border-zinc-800 pb-1.5 text-zinc-200">Alert Center</h5>
              {summary && summary.pending_count > 0 ? (
                <p className="leading-normal">
                  You have <strong className="text-rose-400">{summary.pending_count} unresolved coverage gaps</strong> for today's proxy schedule. Please run the generation engine.
                </p>
              ) : (
                <p className="text-zinc-500">No active system alerts.</p>
              )}
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-[10px] font-extrabold shadow-sm select-none shrink-0" title="Administrator Account">
          AD
        </div>
      </div>
    </header>
  )
}
