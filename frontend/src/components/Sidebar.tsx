'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { 
  LayoutDashboard, 
  CalendarDays, 
  UserX, 
  AlertOctagon, 
  RefreshCw, 
  BarChart3, 
  Settings, 
  ScrollText,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  CalendarCheck
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/absentees', label: 'Mark Absentees', icon: UserX },
  { href: '/', label: 'Generate Proxies', icon: Zap },
  { href: '/teachers', label: 'Teachers', icon: Users },
  { href: '/timetable', label: 'Timetable Explorer', icon: CalendarDays },
  { href: '/exceptions', label: 'Exceptions', icon: AlertOctagon },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isSidebarOpen, setSidebarOpen, summary, fetchDashboardSummary, selectedDate } = useStore()
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    fetchDashboardSummary()
  }, [selectedDate])

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Desktop & Mobile Navigation Sidebar */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between p-4 border-r border-zinc-800 bg-zinc-950/95 transition-all duration-300 ease-in-out md:sticky md:h-screen md:top-0 ${
          isSidebarOpen 
            ? 'w-64 translate-x-0' 
            : '-translate-x-full md:translate-x-0'
        } ${
          isCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Header Brand */}
          <div className="flex items-center justify-between px-2 py-3 mb-6 border-b border-zinc-800/80">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2 bg-indigo-600/15 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0">
                <CalendarCheck className="h-5 w-5 animate-pulse" />
              </div>
              <div className={`transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                <h1 className="text-sm font-bold tracking-tight brand-logo-text truncate">
                  ProxEase
                </h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold truncate">
                  Scheduler
                </p>
              </div>
            </div>
            {/* Close Button on Mobile Drawer */}
            <button 
              onClick={closeSidebar}
              className="p-1 text-zinc-400 hover:text-white md:hidden border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group border ${
                    isActive 
                      ? 'bg-zinc-900 text-white border-zinc-800 shadow-sm' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border-transparent'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                    isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                  }`} />
                  <span className={`ml-3 transition-opacity duration-200 truncate ${
                    isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Collapse Toggle & Stats */}
        <div className="pt-4 border-t border-zinc-800/80">
          {/* Collapse Toggle Switch Button for Desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center w-full py-2 bg-zinc-900/40 border border-zinc-800/80 text-zinc-400 hover:text-white rounded-lg text-xs hover:bg-zinc-900 transition-all duration-150 cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4.5 w-4.5" />
            ) : (
              <div className="flex items-center space-x-2">
                <ChevronLeft className="h-4.5 w-4.5" />
                <span className="font-medium">Collapse Menu</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
