'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { ScrollText, Search, ShieldCheck, AlertCircle } from 'lucide-react'

export default function AuditLogsPage() {
  const { auditLogs, fetchAuditLogs, loading } = useStore()
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const filteredLogs = auditLogs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getActionColor = (action: string) => {
    if (action.includes('FAILED')) return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    if (action.startsWith('GENERATE') || action.startsWith('REASSIGN')) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    if (action.startsWith('MARK') || action.startsWith('CREATE')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    return 'text-slate-200 bg-slate-500/10 border-slate-500/20'
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
          System Audit Logs
        </h2>
        <p className="text-slate-200 text-sm mt-1">
          Review administrator actions, automatic generation, and emergency proxy reassignments.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="glass-panel rounded-2xl p-4 flex items-center space-x-3 max-w-xl">
        <Search className="h-4 w-4 text-slate-200" />
        <input
          type="text"
          placeholder="Filter logs by action or details..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent text-sm text-slate-200 outline-none w-full"
        />
      </div>

      {/* Logs Table Container */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading && auditLogs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-200 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-r-2 border-transparent"></div>
            <p className="text-sm font-medium">Fetching system logs...</p>
          </div>
        ) : (
          <div>
            {/* Desktop/Tablet View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-xs uppercase tracking-wider font-bold text-slate-200">
                    <th className="px-6 py-4 w-48">Timestamp</th>
                    <th className="px-6 py-4 w-28">User</th>
                    <th className="px-6 py-4 w-52">Action Type</th>
                    <th className="px-6 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-200">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <AlertCircle className="h-8 w-8 opacity-40" />
                          <p>No matching system audit logs found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-slate-200">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-slate-200 capitalize">
                          {log.user_id}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-bold tracking-tight ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 leading-relaxed text-slate-100 font-medium">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-200">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="h-8 w-8 opacity-40" />
                    <p>No matching system audit logs found.</p>
                  </div>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-slate-400 font-semibold capitalize">
                        By {log.user_id}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-bold tracking-tight ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-100 font-medium">
                      {log.details}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
