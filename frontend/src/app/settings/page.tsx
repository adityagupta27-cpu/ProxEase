'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Settings, Save, RefreshCw, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react'

export default function SettingsPage() {
  const { settings, fetchSettings, updateSetting, loading } = useStore()
  
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  // Sync store settings to local state
  useEffect(() => {
    const sMap: Record<string, string> = {}
    settings.forEach(s => {
      sMap[s.key] = s.value
    })
    setLocalSettings(sMap)
  }, [settings])

  const handleInputChange = (key: string, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveSuccess(false)
    
    try {
      // Save all changed settings
      for (const [key, value] of Object.entries(localSettings)) {
        await updateSetting(key, value)
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = async () => {
    const defaults = {
      daily_proxy_limit: "6",
      min_free_periods: "0",
      weight_free: "40",
      weight_familiarity: "50",
      weight_daily: "30",
      weight_weekly: "20",
      weight_monthly: "10",
      weight_consecutive: "-30",
      weight_last_free: "-1000",
      blocked_symbols: "B,-"
    }
    
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(defaults)) {
        await updateSetting(key, value)
      }
      setLocalSettings(defaults)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            System Settings
          </h2>
          <p className="text-slate-200 text-sm mt-1">
            Configure hard constraints, optimization parameters, and scoring weights.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={saving}
          className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs animate-fade-in">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>Settings saved successfully! New weights will be used in the next proxy generation run.</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Limits & General Settings */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-slate-200">Hard Limits & Timetable</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex flex-col space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Daily Proxy Limit</label>
                  <span className="text-[10px] sm:text-xs text-slate-200 font-normal">Max proxies a teacher can take today</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={localSettings.daily_proxy_limit ?? ''}
                  onChange={(e) => handleInputChange('daily_proxy_limit', e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Min Free Periods</label>
                  <span className="text-[10px] sm:text-xs text-slate-200 font-normal">Min free periods a teacher must retain today</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={localSettings.min_free_periods ?? ''}
                  onChange={(e) => handleInputChange('min_free_periods', e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Blocked Cell Symbols</label>
                  <span className="text-[10px] sm:text-xs text-slate-200 font-normal">Comma-separated busy cells</span>
                </div>
                <input
                  type="text"
                  value={localSettings.blocked_symbols ?? ''}
                  onChange={(e) => handleInputChange('blocked_symbols', e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Soft Weights & Scoring */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Settings className="h-5 w-5 text-purple-400" />
              <h3 className="font-bold text-slate-200">Soft Constraint Scoring Weights</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Class Familiarity</label>
                  <input
                    type="number"
                    value={localSettings.weight_familiarity ?? ''}
                    onChange={(e) => handleInputChange('weight_familiarity', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Preserve Free Periods</label>
                  <input
                    type="number"
                    value={localSettings.weight_free ?? ''}
                    onChange={(e) => handleInputChange('weight_free', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold text-xs">Daily Hist Penalty</label>
                  <input
                    type="number"
                    value={localSettings.weight_daily ?? ''}
                    onChange={(e) => handleInputChange('weight_daily', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold text-xs">Weekly Hist Penalty</label>
                  <input
                    type="number"
                    value={localSettings.weight_weekly ?? ''}
                    onChange={(e) => handleInputChange('weight_weekly', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold text-xs">Monthly Hist Penalty</label>
                  <input
                    type="number"
                    value={localSettings.weight_monthly ?? ''}
                    onChange={(e) => handleInputChange('weight_monthly', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Consecutive Penalty</label>
                  <input
                    type="number"
                    value={localSettings.weight_consecutive ?? ''}
                    onChange={(e) => handleInputChange('weight_consecutive', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="uppercase tracking-wider text-slate-200 font-bold">Losing Last Free Period</label>
                  <input
                    type="number"
                    value={localSettings.weight_last_free ?? ''}
                    onChange={(e) => handleInputChange('weight_last_free', e.target.value)}
                    className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer active:scale-95 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  )
}
