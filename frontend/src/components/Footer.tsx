'use client'

import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { CalendarCheck, Mail, ExternalLink, Calendar, Phone, MapPin } from 'lucide-react'

export default function Footer() {
  const { isLocalMode } = useStore()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full mt-auto pt-10 pb-6 border-t border-slate-800/60 bg-slate-950">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-sm">
        {/* Branding Column */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <CalendarCheck className="h-4 w-4 text-white animate-pulse" />
            </div>
            <span className="font-semibold text-slate-200 tracking-tight">ProxEase Portal</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
            ProxEase. Optimizing school substitute scheduling and workloads with mathematical balance.
          </p>
          {/* Dynamic Status Pill */}
          <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLocalMode ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLocalMode ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-slate-300 font-medium">
              {isLocalMode ? 'Offline Sandbox Mode' : 'Cloud Server Connected'}
            </span>
          </div>
        </div>

        {/* Quick Links Column */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-3 text-xs uppercase tracking-wider">Management</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/timetable" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Timetable Explorer
              </Link>
            </li>
            <li>
              <Link href="/absentees" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200">
                Staff Absences
              </Link>
            </li>
            <li>
              <Link href="/exceptions" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200">
                Active Exceptions
              </Link>
            </li>
            <li>
              <Link href="/settings" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200">
                Solver Weights & Limits
              </Link>
            </li>
          </ul>
        </div>

        {/* System Details Column */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-3 text-xs uppercase tracking-wider">Operations</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/generate" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200">
                Proxy Generation Engine
              </Link>
            </li>
            <li>
              <Link href="/analytics" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200">
                Workload Analytics
              </Link>
            </li>
            <li>
              <Link href="/audit-logs" className="text-slate-400 hover:text-indigo-400 transition-colors duration-200">
                Security Audit Logs
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact & Office Column */}
        <div>
          <h4 className="font-semibold text-slate-200 mb-3 text-xs uppercase tracking-wider">Contact & Office</h4>
          <ul className="space-y-2.5 text-xs text-slate-400">
            <li className="flex items-start space-x-2">
              <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <strong>ProxEase Inc.</strong><br />
                100 Pine St, Suite 1250<br />
                San Francisco, CA 94111
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <Phone className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span>+1 (800) 555-0199</span>
            </li>
            <li className="flex items-center space-x-2">
              <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <a href="mailto:support@proxease.com" className="hover:text-indigo-400 transition-colors">
                support@proxease.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="h-[1px] w-full bg-slate-800/60 mb-4" />

      {/* Bottom Row */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-500">
        <div>
          <span>&copy; {currentYear} ProxEase. All rights reserved.</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            System Version: <span className="text-slate-400 font-mono">v2.4.1</span>
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <a
            href="https://github.com/google-deepmind"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-400 transition-colors duration-200 flex items-center gap-0.5"
          >
            Documentation <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </footer>
  )
}
