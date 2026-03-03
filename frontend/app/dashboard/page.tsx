'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserData {
  email: string
  is_pro: boolean
  schedules_this_month: number
  schedules_remaining: number | string
}

interface Shift {
  id: string
  employee: string
  day: string
  startHour: number
  endHour: number
  color: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6am to 10pm
const COLORS = [
  'bg-emerald-500/80 border-emerald-400',
  'bg-sky-500/80 border-sky-400',
  'bg-violet-500/80 border-violet-400',
  'bg-amber-500/80 border-amber-400',
  'bg-rose-500/80 border-rose-400',
  'bg-cyan-500/80 border-cyan-400',
  'bg-fuchsia-500/80 border-fuchsia-400',
  'bg-orange-500/80 border-orange-400',
]

const HOUR_HEIGHT = 56 // px per hour

function parseScheduleToShifts(scheduleText: string): Shift[] {
  const shifts: Shift[] = []
  const employeeColors: Record<string, string> = {}
  let colorIndex = 0

  const lines = scheduleText.split('\n')
  let currentDay = ''

  for (const line of lines) {
    // Check if line is a day header
    const dayMatch = DAYS.find(d => line.toLowerCase().includes(d.toLowerCase() + ':'))
    if (dayMatch) {
      currentDay = dayMatch
      continue
    }

    if (!currentDay) continue

    // Match times like 8am, 4pm, 11am, 7pm
    const timeMatches = [...line.matchAll(/(\d{1,2})(am|pm)/gi)]
    if (timeMatches.length < 2) continue

    // Match employee name - after the colon
    const nameMatch = line.match(/:\s*([A-Za-z\s]+?)(?:\s*\(|$)/)?.[1]?.trim()
    if (!nameMatch || nameMatch.length < 2) continue

    const parseHour = (match: RegExpMatchArray) => {
      let h = parseInt(match[1])
      const period = match[2].toLowerCase()
      if (period === 'pm' && h !== 12) h += 12
      if (period === 'am' && h === 12) h = 0
      return h
    }

    const startHour = parseHour(timeMatches[0])
    const endHour = parseHour(timeMatches[1])

    if (!employeeColors[nameMatch]) {
      employeeColors[nameMatch] = COLORS[colorIndex % COLORS.length]
      colorIndex++
    }

    if (startHour >= 6 && endHour <= 24 && startHour < endHour) {
      shifts.push({
        id: `${nameMatch}-${currentDay}-${startHour}`,
        employee: nameMatch,
        day: currentDay,
        startHour,
        endHour,
        color: employeeColors[nameMatch],
      })
    }
  }

  return shifts
}

export default function Dashboard() {
  const [user, setUser] = useState<UserData | null>(null)
  const [rawSchedule, setRawSchedule] = useState('')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'calendar' | 'raw'>('calendar')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [showDrive, setShowDrive] = useState(false)
  const [files, setFiles] = useState<{id: string, name: string, mimeType: string}[]>([])
  const [ingesting, setIngesting] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const apiCall = async (endpoint: string, method = 'GET', body?: object) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401) { router.push('/login'); return null }
    return res.json()
  }

  const connectDrive = async () => {
    const data = await apiCall('/drive/auth')
    if (data?.auth_url) {
        window.location.href = data.auth_url
    }
}

  const loadFiles = async () => {
    const data = await apiCall('/drive/files')
    if (data?.files) setFiles(data.files)
    if (data?.error) setMessage(data.error)
  }

  const ingestFile = async (fileId: string) => {
    setIngesting(fileId)
    const data = await apiCall(`/drive/ingest/${fileId}`, 'POST')
    if (data?.message) setMessage(data.message)
    if (data?.error) setMessage(data.error)
    setIngesting(null)
  }

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    apiCall('/me').then(data => { if (data) setUser(data) })
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const generateSchedule = async () => {
    setLoading(true)
    setShifts([])
    setRawSchedule('')
    const data = await apiCall('/generate-schedule', 'POST')
    if (data?.schedule) {
      setRawSchedule(data.schedule)
      const parsed = parseScheduleToShifts(data.schedule)
      setShifts(parsed)
      if (parsed.length > 0) setActiveTab('calendar')
      setChatMessages([{
        role: 'assistant',
        content: "I've generated your schedule! You can drag shifts to adjust them, or ask me to make changes — like \"Move Sarah to Friday\" or \"Add an extra shift on Saturday evening\"."
      }])
      setShowChat(true)
    }
    if (data?.detail) setMessage(data.detail)
    if (user) {
      const updated = await apiCall('/me')
      if (updated) setUser(updated)
    }
    setLoading(false)
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const data = await apiCall('/chat', 'POST', {
        message: userMsg,
        schedule: rawSchedule
      })
      const reply = data?.response || "I couldn't process that request."
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])

      if (data?.schedule) {
        const newShifts = parseScheduleToShifts(data.schedule)
        if (newShifts.length > 2) {
          setShifts(newShifts)
          setRawSchedule(data.schedule)
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.' }])
    }
    setChatLoading(false)
  }

  const handleDragStart = (shiftId: string) => setDragging(shiftId)

  const handleDrop = (day: string, hour: number) => {
    if (!dragging) return
    setShifts(prev => prev.map(s => {
      if (s.id !== dragging) return s
      const duration = s.endHour - s.startHour
      return { ...s, day, startHour: hour, endHour: hour + duration, id: `${s.employee}-${day}-${hour}` }
    }))
    setDragging(null)
  }

  const handlePrint = () => {
    window.print()
  }

  const logout = () => {
    localStorage.clear()
    router.push('/')
  }

  const employees = [...new Set(shifts.map(s => s.employee))]
  const employeeColorMap: Record<string, string> = {}
  employees.forEach((emp, i) => {
    const shift = shifts.find(s => s.employee === emp)
    if (shift) employeeColorMap[emp] = shift.color
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Outfit', sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease forwards; }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 0 8px rgba(52,211,153,0); } }
        .glow-pulse { animation: pulse-glow 2s infinite; }
        .shift-block { cursor: grab; transition: opacity 0.15s, transform 0.15s; }
        .shift-block:active { cursor: grabbing; opacity: 0.7; transform: scale(0.97); }
        .drop-zone { transition: background 0.1s; }
        .drop-zone:hover { background: rgba(255,255,255,0.04); }
        @media print {
          .no-print { display: none !important; }
          .print-area { break-inside: avoid; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      <main className="min-h-screen bg-[#080808] text-white">
        {/* Nav */}
        <nav className="no-print flex items-center justify-between px-8 py-4 border-b border-white/5 bg-[#080808]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-400/20">
              <span className="text-black font-black text-sm">S</span>
            </div>
            <span className="font-bold tracking-tight text-lg">Schedio</span>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-white/30 mono">{user.email}</span>}
            {user && !user.is_pro && (
              <Link href="/upgrade" className="text-sm bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-lg hover:bg-emerald-300 transition-colors">
                Upgrade to Pro
              </Link>
            )}
            {user?.is_pro && (
              <span className="text-xs bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 px-2.5 py-1 rounded-full font-bold mono">PRO</span>
            )}
            <button onClick={logout} className="text-sm text-white/30 hover:text-white/70 transition-colors">
              Sign out
            </button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header row */}
          <div className="no-print flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Schedule</h1>
              <p className="text-white/40 text-sm mt-0.5">Weekly staff schedule — drag shifts to adjust</p>
            </div>
            <div className="flex items-center gap-3">
              {shifts.length > 0 && (
                <>
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" /></svg>
                    AI Assistant
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                  </button>
                </>
              )}
              <button
                onClick={generateSchedule}
                disabled={loading || (user !== null && !user.is_pro && user.schedules_this_month >= 3)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-400 text-black font-bold text-sm hover:bg-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed glow-pulse"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {shifts.length > 0 ? 'Regenerate' : 'Generate Schedule'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Usage bar */}
          {user && !user.is_pro && (
            <div className="no-print bg-white/3 border border-white/8 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <span className="text-sm text-white/50">Free plan</span>
                <div className="flex-1 max-w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(user.schedules_this_month / 3) * 100}%` }} />
                </div>
                <span className="text-sm text-white/40 mono">{user.schedules_this_month}/3</span>
              </div>
              {user.schedules_this_month >= 3 && (
                <Link href="/upgrade" className="text-sm text-emerald-400 font-medium hover:text-emerald-300">Upgrade for unlimited →</Link>
              )}
            </div>
          )}

          {message && (
            <div className="no-print bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 text-sm text-amber-400 mb-6 flex items-center justify-between">
              {message}
              <button onClick={() => setMessage('')} className="opacity-50 hover:opacity-100 ml-4">✕</button>
            </div>
          )}

          {/* Google Drive Panel */}
          <div className="no-print mb-6 border border-white/8 rounded-2xl bg-[#0d0d0d] overflow-hidden">
            <button
              onClick={() => setShowDrive(!showDrive)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M6.28 3l5.72 9.9L6.28 3zm5.72 9.9L7.28 21H16.72l-4.72-8.1zm5.72-9.9L12 12.9 17.72 3H12z"/></svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Google Drive</p>
                  <p className="text-xs text-white/30">Connect Drive to import availability files and historical schedules</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-white/30 transition-transform ${showDrive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {showDrive && (
              <div className="px-6 pb-5 border-t border-white/5 pt-4 fade-up">
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={connectDrive}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6.28 3l5.72 9.9L6.28 3zm5.72 9.9L7.28 21H16.72l-4.72-8.1zm5.72-9.9L12 12.9 17.72 3H12z"/></svg>
                    Connect Google Drive
                  </button>
                  <button
                    onClick={loadFiles}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Load files
                  </button>
                </div>

                {files.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-white/30 mb-2 uppercase tracking-wider font-medium">Your files</p>
                    {files.slice(0, 8).map((file) => (
                      <div key={file.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/3 transition-colors">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <span className="text-sm text-white/60 truncate max-w-[240px]">{file.name}</span>
                        </div>
                        <button
                          onClick={() => ingestFile(file.id)}
                          disabled={ingesting === file.id}
                          className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 font-medium ml-4 shrink-0"
                        >
                          {ingesting === file.id ? 'Ingesting...' : 'Ingest →'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main content */}
          {shifts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-24 fade-up">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-white/30 text-sm mb-2">No schedule yet</p>
              <p className="text-white/20 text-xs">Connect Google Drive and ingest your availability files, then click Generate Schedule</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-32 fade-up">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin mb-6" />
              <p className="text-white/40 text-sm">AI is building your schedule...</p>
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Calendar */}
              <div className="flex-1 print-area">
                {/* Tab bar */}
                <div className="no-print flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
                  <button onClick={() => setActiveTab('calendar')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                    Calendar
                  </button>
                  <button onClick={() => setActiveTab('raw')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'raw' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                    Raw text
                  </button>
                </div>

                {activeTab === 'calendar' ? (
                  <div className="border border-white/8 rounded-2xl overflow-hidden bg-[#0d0d0d]">
                    {/* Day headers */}
                    <div className="grid border-b border-white/8" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
                      <div className="border-r border-white/5" />
                      {DAYS.map(day => (
                        <div key={day} className="py-3 px-2 text-center border-r border-white/5 last:border-0">
                          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{day.slice(0, 3)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Time grid */}
                    <div className="relative" style={{ height: `${HOUR_HEIGHT * 17}px` }}>
                      <div className="grid h-full" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
                        {/* Hour labels */}
                        <div className="border-r border-white/5">
                          {HOURS.map(hour => (
                            <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-white/5 flex items-start justify-end pr-3 pt-1.5">
                              <span className="text-xs text-white/20 mono">
                                {hour === 12 ? '12pm' : hour > 12 ? `${hour-12}pm` : `${hour}am`}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Day columns */}
                        {DAYS.map(day => (
                          <div key={day} className="border-r border-white/5 last:border-0 relative">
                            {HOURS.map(hour => (
                              <div
                                key={hour}
                                className="drop-zone border-b border-white/5"
                                style={{ height: HOUR_HEIGHT }}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                onDrop={() => handleDrop(day, hour)}
                              />
                            ))}
                            {/* Shifts */}
                            {shifts.filter(s => s.day === day).map(shift => (
                              <div
                                key={shift.id}
                                draggable
                                onDragStart={() => handleDragStart(shift.id)}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                onDrop={(e) => { e.stopPropagation(); handleDrop(day, shift.startHour); }}
                                className={`shift-block absolute left-1 right-1 rounded-lg border ${shift.color} px-2 py-1 overflow-hidden`}
                                style={{
                                  top: `${(shift.startHour - 6) * HOUR_HEIGHT + 2}px`,
                                  height: `${(shift.endHour - shift.startHour) * HOUR_HEIGHT - 4}px`,
                                }}
                              >
                                <p className="text-xs font-semibold text-white leading-tight truncate">{shift.employee}</p>
                                <p className="text-xs text-white/60 mono">
                                  {shift.startHour > 12 ? shift.startHour - 12 : shift.startHour}{shift.startHour >= 12 ? 'pm' : 'am'} – {shift.endHour > 12 ? shift.endHour - 12 : shift.endHour}{shift.endHour >= 12 ? 'pm' : 'am'}
                                </p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Legend */}
                    {employees.length > 0 && (
                      <div className="border-t border-white/8 px-4 py-3 flex flex-wrap gap-3">
                        {employees.map(emp => (
                          <div key={emp} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${employeeColorMap[emp]?.split(' ')[0]}`} />
                            <span className="text-xs text-white/50">{emp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-white/8 rounded-2xl p-6 bg-[#0d0d0d]">
                    <pre className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed mono">{rawSchedule}</pre>
                  </div>
                )}
              </div>

              {/* Chat panel */}
              {showChat && (
                <div className="no-print w-80 shrink-0 border border-white/8 rounded-2xl bg-[#0d0d0d] flex flex-col h-[600px] fade-up">
                  <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-semibold">AI Assistant</span>
                    </div>
                    <button onClick={() => setShowChat(false)} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-emerald-400 text-black font-medium rounded-br-sm'
                            : 'bg-white/8 text-white/80 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white/8 rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-3 border-t border-white/8">
                    <div className="flex gap-2">
                      <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                        placeholder="Ask to adjust schedule..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm placeholder-white/20 text-white focus:outline-none focus:border-emerald-400/50 transition-colors"
                      />
                      <button
                        onClick={sendChatMessage}
                        disabled={chatLoading || !chatInput.trim()}
                        className="w-9 h-9 bg-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-300 transition-colors disabled:opacity-40 shrink-0"
                      >
                        <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}