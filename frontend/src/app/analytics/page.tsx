'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts'
import { 
  BarChart3, 
  TrendingUp, 
  Scale, 
  UserCheck, 
  UserMinus,
  RefreshCw
} from 'lucide-react'

export default function Analytics() {
  const { analytics, fetchAnalytics, loading, selectedDate } = useStore()

  useEffect(() => {
    fetchAnalytics()
  }, [selectedDate])

  const getFairnessColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (score >= 0.5) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  }

  const getFairnessDesc = (score: number) => {
    if (score >= 0.8) return 'Excellent distribution. Workload is evenly balanced across staff.'
    if (score >= 0.5) return 'Moderate distribution. A few teachers are taking more proxy duties than others.'
    return 'Imbalanced distribution. Workload is heavily skewed toward a few staff members.'
  }

  // Calculate max proxy count for progress bars
  const maxUtilProxy = analytics?.most_utilized && analytics.most_utilized.length > 0
    ? Math.max(...analytics.most_utilized.map(t => t.proxy_count), 1)
    : 1

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            Analytics & Reports
          </h2>
          <p className="text-slate-200 text-sm mt-1">
            Track proxy workload distribution, staff utilization, and workload balance history.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !analytics ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-200 space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-r-2 border-transparent"></div>
          <p className="text-sm font-medium">Loading analytics summaries...</p>
        </div>
      ) : (
        <>
          {/* Top Panel: Fairness Index & Timeline Chart in a 1:2 layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Workload Balance Index Card */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-6 lg:col-span-1">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Scale className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-200">Workload Balance Index</h3>
                </div>
                <p className="text-xs text-slate-200 leading-normal">
                  Measures substitution duty distribution equality across all active staff. A score of 100% represents a perfectly uniform distribution of assignments.
                </p>
              </div>

              {analytics && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 rounded-2xl border border-slate-800">
                    <span className="text-xs uppercase font-bold text-slate-200 tracking-wider mb-1">
                      Workload Balance Score
                    </span>
                    <span className="text-5xl font-black font-mono tracking-tight text-slate-100 mb-2">
                      {Math.round(analytics.fairness_index * 100)}%
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getFairnessColor(analytics.fairness_index)}`}>
                      {analytics.fairness_index >= 0.8 ? 'Balanced' : analytics.fairness_index >= 0.5 ? 'Moderate' : 'Uneven'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 text-center leading-normal">
                    {getFairnessDesc(analytics.fairness_index)}
                  </p>
                </div>
              )}
            </div>

            {/* Proxy Allocation Timeline Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-6 lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-slate-200">Proxy Allocation Timeline</h3>
              </div>

              <div className="h-[300px] w-full">
                {analytics?.daily_history && analytics.daily_history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.daily_history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'var(--card-bg)', 
                          border: '1px solid var(--card-border)', 
                          borderRadius: '12px' 
                        }}
                        labelClassName="text-slate-200 text-xs font-semibold"
                        itemStyle={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        name="Proxy Assignments"
                        stroke="var(--accent)" 
                        strokeWidth={3} 
                        dot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2, fill: 'var(--background)' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-2 py-12">
                    <BarChart3 className="h-8 w-8 opacity-40 animate-pulse" />
                    <p className="text-xs">No historical timeline data available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
