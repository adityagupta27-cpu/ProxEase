'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Trash2, AlertCircle, PlusCircle, Calendar, AlertOctagon, Clock } from 'lucide-react'

export default function ExceptionsManagement() {
  const { 
    teachers, 
    exceptions, 
    fetchTeachers, 
    fetchExceptions, 
    addException, 
    deleteException, 
    selectedDate 
  } = useStore()

  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [exceptionType, setExceptionType] = useState('unavailable')
  const [startPeriod, setStartPeriod] = useState('1')
  const [endPeriod, setEndPeriod] = useState('8')
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    fetchTeachers()
    fetchExceptions()
  }, [selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSuccessMsg(null)

    if (!selectedTeacherId) {
      setFormError('Please select a teacher.')
      return
    }

    const start = parseInt(startPeriod)
    const end = parseInt(endPeriod)

    if (start > end) {
      setFormError('Start period cannot be greater than end period.')
      return
    }

    try {
      await addException(parseInt(selectedTeacherId), exceptionType, start, end)
      setSuccessMsg('Exception added successfully.')
      setSelectedTeacherId('')
      setExceptionType('unavailable')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setFormError(err.message || 'Failed to create exception.')
    }
  }

  const getExceptionLabel = (type: string, start?: number | null, end?: number | null) => {
    const range = start && end ? `(Periods ${start}-${end})` : ''
    switch (type) {
      case 'unavailable':
        return `Unavailable ${range}`
      case 'ceremonial_duty':
        return `Ceremonial Duty ${range}`
      case 'exam_duty':
        return `Examination Duty ${range}`
      case 'meeting':
        return `Meeting ${range}`
      case 'administrative':
        return `Administrative Work ${range}`
      default:
        return `${type.replace('_', ' ').toUpperCase()} ${range}`
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
          Exceptions Management
        </h2>
        <p className="text-slate-200 text-sm mt-1">
          Add specific duties or unavailable slots for teachers on {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Exception input Form */}
        <div className="glass-panel rounded-2xl p-6 h-fit space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <PlusCircle className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200">Add Exception / Duty</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs">
                {successMsg}
              </div>
            )}

            <div className="flex flex-col space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-200 font-bold">Select Teacher</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="">-- Choose Teacher --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs uppercase tracking-wider text-slate-200 font-bold">Duty / Restriction Type</label>
              <select
                value={exceptionType}
                onChange={(e) => setExceptionType(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="unavailable">Unavailable (Generic)</option>
                <option value="meeting">Meeting</option>
                <option value="ceremonial_duty">Ceremonial Duty</option>
                <option value="exam_duty">Examination Duty</option>
                <option value="administrative">Administrative Work</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-200 font-bold">Start Period</label>
                <select
                  value={startPeriod}
                  onChange={(e) => setStartPeriod(e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-xs uppercase tracking-wider text-slate-200 font-bold">End Period</label>
                <select
                  value={endPeriod}
                  onChange={(e) => setEndPeriod(e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/15 cursor-pointer active:scale-[0.98] transition-all"
            >
              Add Exception
            </button>
          </form>
        </div>

        {/* Exceptions List Table */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <AlertOctagon className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200">Active Exceptions / Duties Today</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider font-bold text-slate-200">
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Exception / Duty Type</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {exceptions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-slate-200 text-xs">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Calendar className="h-8 w-8 opacity-40" />
                        <p>No exceptions added for this date.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  exceptions.map((exc) => (
                    <tr key={exc.id} className="hover:bg-slate-800/10 text-xs">
                      <td className="px-4 py-3.5 font-semibold text-slate-200">{exc.teacher_name}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-200" />
                          <span className="text-slate-300">
                            {getExceptionLabel(exc.type, exc.start_period, exc.end_period)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => deleteException(exc.id)}
                          className="p-1.5 text-slate-200 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
