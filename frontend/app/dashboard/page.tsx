'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserData {
    email: string
    is_pro: boolean
    schedules_this_month: number
    schedules_remaining: number | string
    max_employees: number
    max_locations: number
}

interface Location {
    id: string
    name: string
}

interface Shift {
    id: string
    employee: string
    day: string
    startHour: number
    endHour: number
    color: string
}

interface ShiftGroup {
    day: string
    startHour: number
    endHour: number
    employees: string[]
}

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

const getWeekDays = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
        const shortDate = `${date.getMonth() + 1}/${date.getDate()}`
        return { full: dayName, display: `${dayName.slice(0, 3)} ${shortDate}`, date: shortDate }
    })
}

const WEEK_DAYS = getWeekDays()
const DAYS = WEEK_DAYS.map(d => d.full)
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

const COLOR_DOTS = [
    'bg-emerald-400',
    'bg-sky-400',
    'bg-violet-400',
    'bg-amber-400',
    'bg-rose-400',
    'bg-cyan-400',
    'bg-fuchsia-400',
    'bg-orange-400',
]

const formatHour = (h: number) => {
    if (h === 12) return '12pm'
    if (h === 0) return '12am'
    return h > 12 ? `${h - 12}pm` : `${h}am`
}

// Group flat shifts array into shift cards by day+startHour+endHour
const groupShifts = (shifts: Shift[]): ShiftGroup[] => {
    const map = new Map<string, ShiftGroup>()
    shifts.forEach(s => {
        const key = `${s.day}|${s.startHour}|${s.endHour}`
        if (!map.has(key)) {
            map.set(key, { day: s.day, startHour: s.startHour, endHour: s.endHour, employees: [] })
        }
        map.get(key)!.employees.push(s.employee)
    })
    return Array.from(map.values()).sort((a, b) => a.startHour - b.startHour)
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
    const [showChat, setShowChat] = useState(false)
    const [showDrive, setShowDrive] = useState(false)
    const [files, setFiles] = useState<{ id: string, name: string, mimeType: string }[]>([])
    const [ingesting, setIngesting] = useState<string | null>(null)
    const [driveConnected, setDriveConnected] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
    const [showLimitModal, setShowLimitModal] = useState(false)
    const [totalEmployees, setTotalEmployees] = useState(0)

    // Drag state: tracks which employee from which group is being dragged
    const [dragging, setDragging] = useState<{ employee: string; fromKey: string } | null>(null)
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)

    // Location state
    const [locations, setLocations] = useState<Location[]>([])
    const [activeLocationId, setActiveLocationId] = useState<string | null>(null)
    const [showNewLocation, setShowNewLocation] = useState(false)
    const [newLocationName, setNewLocationName] = useState('')
    const [creatingLocation, setCreatingLocation] = useState(false)

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

    const loadLocations = async () => {
        const data = await apiCall('/locations')
        if (data?.locations) {
            setLocations(data.locations)
            if (!activeLocationId && data.locations.length > 0) {
                setActiveLocationId(data.locations[0].id)
            }
        }
    }

    const createLocation = async () => {
        if (!newLocationName.trim()) return
        setCreatingLocation(true)
        const data = await apiCall('/locations', 'POST', { name: newLocationName.trim() })
        if (data?.id) {
            setLocations(prev => [...prev, { id: data.id, name: data.name }])
            setActiveLocationId(data.id)
            setNewLocationName('')
            setShowNewLocation(false)
            setMessage(`✅ Location "${data.name}" created!`)
        }
        if (data?.detail) setMessage(`❌ ${data.detail}`)
        setCreatingLocation(false)
    }

    const connectDrive = async () => {
        const data = await apiCall('/drive/auth')
        if (data?.auth_url) window.location.href = data.auth_url
    }

    const loadFiles = async () => {
        const data = await apiCall('/drive/files')
        if (data?.files) {
            setFiles(data.files)
            setDriveConnected(true)
        }
        if (data?.error) {
            setDriveConnected(false)
            setMessage(data.error)
        }
    }

    const ingestFile = async (fileId: string) => {
        setIngesting(fileId)
        const endpoint = activeLocationId
            ? `/drive/ingest/${fileId}?location_id=${activeLocationId}`
            : `/drive/ingest/${fileId}`
        const data = await apiCall(endpoint, 'POST')
        if (data?.message) setMessage(data.message)
        if (data?.error) setMessage(data.error)
        setIngesting(null)
    }

    const parseShifts = (rawShifts: any[]) => {
        const employeeColors: Record<string, string> = {}
        let colorIndex = 0
        return rawShifts.map((s: any) => {
            if (!employeeColors[s.employee]) {
                employeeColors[s.employee] = COLORS[colorIndex % COLORS.length]
                colorIndex++
            }
            return {
                id: `${s.employee}-${s.day}-${s.startHour}`,
                employee: s.employee,
                day: s.day,
                startHour: s.startHour,
                endHour: s.endHour,
                color: employeeColors[s.employee]
            }
        })
    }

    useEffect(() => {
        if (!token) { router.push('/login'); return }
        apiCall('/me').then(data => { if (data) setUser(data) })
        loadLocations()
    }, [])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('connected') === 'google') {
            setMessage('✅ Google Drive connected successfully!')
            setDriveConnected(true)
            setShowDrive(true)
            window.history.replaceState({}, '', '/dashboard')
        }
    }, [])

    useEffect(() => {
        setShifts([])
        setRawSchedule('')
        setChatMessages([])
        setShowChat(false)
        setShowUpgradePrompt(false)
        setShowLimitModal(false)
    }, [activeLocationId])

    const generateSchedule = async () => {
        setLoading(true)
        setShifts([])
        setRawSchedule('')
        setShowUpgradePrompt(false)
        setShowLimitModal(false)
        const endpoint = activeLocationId
            ? `/generate-schedule?location_id=${activeLocationId}`
            : '/generate-schedule'
        const data = await apiCall(endpoint, 'POST')
        if (data?.shifts && data.shifts.length > 0) {
            if (data.employee_limit_hit) {
                setShowLimitModal(true)
                setTotalEmployees(data.total_employees)
                setShowUpgradePrompt(true)
            } else {
                setShowLimitModal(false)
                setShowUpgradePrompt(false)
            }
            setShifts(parseShifts(data.shifts))
            setRawSchedule(data.schedule)
            setActiveTab('calendar')
            setChatMessages([{
                role: 'assistant',
                content: "I've generated your schedule! Drag any employee to a different shift, or ask me to make changes — like \"Move Sarah to Friday\" or \"Add an extra shift on Saturday evening\"."
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

    const finalizeSchedule = async () => {
        if (!rawSchedule) {
            setMessage('⚠️ No schedule to finalize. Generate a schedule first.')
            return
        }
        setFinalizing(true)
        const today = new Date()
        const monday = new Date(today)
        monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1))
        const weekStart = monday.toISOString().split('T')[0]
        const data = await apiCall('/finalize-schedule', 'POST', {
            schedule: rawSchedule,
            location_id: activeLocationId,
            week_start: weekStart
        })
        if (data?.message) setMessage(`✅ ${data.message}`)
        if (data?.detail) setMessage(`❌ ${data.detail}`)
        setFinalizing(false)
    }

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return
        if (showUpgradePrompt) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Upgrade to Pro to access the AI assistant and view your full schedule.' }])
            setChatInput('')
            return
        }
        const userMsg = chatInput.trim()
        setChatInput('')
        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setChatLoading(true)
        try {
            const data = await apiCall('/chat', 'POST', {
                message: userMsg,
                schedule: rawSchedule,
                location_id: activeLocationId,
                client_date: new Date().toISOString().split('T')[0]
            })
            const reply = data?.response || "I couldn't process that request."
            setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
            if (data?.shifts && data.shifts.length > 0) {
                setShifts(parseShifts(data.shifts))
                if (data.schedule) setRawSchedule(data.schedule)
            }
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.' }])
        }
        setChatLoading(false)
    }

    // Drag: start dragging an employee from a specific shift group
    const handleDragStart = (employee: string, groupKey: string) => {
        setDragging({ employee, fromKey: groupKey })
    }

    // Drop: move employee from one shift group to another
    const handleDrop = (toKey: string) => {
        if (!dragging || dragging.fromKey === toKey) {
            setDragging(null)
            setDragOverKey(null)
            return
        }

        const [toDay, toStartStr, toEndStr] = toKey.split('|')
        const toStartHour = parseInt(toStartStr)
        const toEndHour = parseInt(toEndStr)

        setShifts(prev => {
            // Remove employee from old group
            const removed = prev.filter(s =>
                !(s.employee === dragging.employee && `${s.day}|${s.startHour}|${s.endHour}` === dragging.fromKey)
            )
            // Add employee to new group
            const existing = prev.find(s => s.employee === dragging.employee)
            const newShift: Shift = {
                id: `${dragging.employee}-${toDay}-${toStartHour}`,
                employee: dragging.employee,
                day: toDay,
                startHour: toStartHour,
                endHour: toEndHour,
                color: existing?.color || COLORS[0]
            }
            return [...removed, newShift]
        })
        setDragging(null)
        setDragOverKey(null)
    }

    const handlePrint = () => window.print()
    const logout = () => { localStorage.clear(); router.push('/') }

    const employees = [...new Set(shifts.map(s => s.employee))]
    const employeeColorMap: Record<string, string> = {}
    employees.forEach(emp => {
        const shift = shifts.find(s => s.employee === emp)
        if (shift) employeeColorMap[emp] = shift.color
    })

    const activeLocation = locations.find(l => l.id === activeLocationId)
    const canAddLocation = user ? locations.length < (user.max_locations || 1) : false
    const shiftGroups = groupShifts(shifts)

    return (
        <>
            <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@800&family=Outfit:wght@400;500;600;700;800&display=swap');
    * { font-family: 'Outfit', sans-serif; }
    .mono { font-family: 'DM Mono', monospace; }
    .display { font-family: 'Syne', sans-serif; }
    .btn-primary { position: relative; overflow: hidden; transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(52,211,153,0.35); }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .fade-up { animation: fadeUp 0.3s ease forwards; }
    @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 0 8px rgba(52,211,153,0); } }
    .glow-pulse { animation: pulse-glow 2s infinite; }
    .employee-row { cursor: grab; transition: opacity 0.15s, background 0.15s; }
    .employee-row:active { cursor: grabbing; opacity: 0.5; }
    .shift-card { transition: border-color 0.15s, background 0.15s; }
    .shift-card.drag-over { border-color: rgba(52,211,153,0.6) !important; background: rgba(52,211,153,0.05) !important; }
    @media print {
      .no-print { display: none !important; }
      .print-area { break-inside: avoid; }
      body { background: white !important; color: black !important; }
      .shift-card { border: 1px solid #ddd !important; background: white !important; break-inside: avoid; }
      .shift-time { color: #555 !important; }
      .employee-name { color: #000 !important; }
    }
`}</style>

            <main className="min-h-screen bg-[#080808] text-white">
                {/* Nav */}
                <nav className="no-print flex items-center justify-between px-8 py-4 border-b border-white/5 bg-[#080808]/80 backdrop-blur-md sticky top-0 z-50">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-400/20">
                            <span className="text-black font-black text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>S</span>
                        </div>
                        <span className="font-extrabold tracking-tight text-base display">Schedio</span>
                    </Link>
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
                        <button onClick={logout} className="text-sm text-white/30 hover:text-white/70 transition-colors">Sign out</button>
                    </div>
                </nav>

                <div className="max-w-7xl mx-auto px-6 py-8">

                    {/* Location selector */}
                    <div className="no-print mb-6">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-white/30 uppercase tracking-wider font-medium">Location</span>
                            {locations.map(loc => (
                                <button
                                    key={loc.id}
                                    onClick={() => setActiveLocationId(loc.id)}
                                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all border ${activeLocationId === loc.id
                                        ? 'bg-emerald-400/10 border-emerald-400/40 text-emerald-400'
                                        : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'}`}
                                >
                                    {loc.name}
                                </button>
                            ))}
                            {canAddLocation ? (
                                showNewLocation ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            autoFocus
                                            value={newLocationName}
                                            onChange={e => setNewLocationName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && createLocation()}
                                            placeholder="Location name..."
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-400/50 w-44"
                                        />
                                        <button onClick={createLocation} disabled={creatingLocation || !newLocationName.trim()} className="px-3 py-1.5 rounded-xl bg-emerald-400 text-black text-sm font-bold disabled:opacity-40">
                                            {creatingLocation ? '...' : 'Add'}
                                        </button>
                                        <button onClick={() => { setShowNewLocation(false); setNewLocationName('') }} className="text-white/30 hover:text-white/60 text-lg leading-none">✕</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowNewLocation(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-white/15 text-white/30 text-sm hover:border-white/30 hover:text-white/50 transition-all">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        Add location
                                    </button>
                                )
                            ) : (
                                <Link href="/upgrade" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-white/15 text-white/30 text-sm hover:border-emerald-400/30 hover:text-emerald-400/60 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add location — upgrade required
                                </Link>
                            )}
                        </div>
                        {locations.length === 0 && !showNewLocation && (
                            <p className="text-xs text-white/25 mt-2">Create a location to get started — all schedules and history will be scoped to it.</p>
                        )}
                    </div>

                    {/* Header row */}
                    <div className="no-print flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold">{activeLocation ? activeLocation.name : 'Schedule'}</h1>
                            <p className="text-white/40 text-sm mt-0.5">Weekly staff schedule — drag employees between shifts to adjust</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {shifts.length > 0 && (
                                <>
                                    <button onClick={() => setShowChat(!showChat)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" /></svg>
                                        AI Assistant
                                    </button>
                                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        Print
                                    </button>
                                    <button onClick={finalizeSchedule} disabled={finalizing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-400/30 text-emerald-400 text-sm font-medium hover:bg-emerald-400/10 transition-all disabled:opacity-60">
                                        {finalizing ? (
                                            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
                                        ) : (
                                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Finalize Schedule</>
                                        )}
                                    </button>
                                </>
                            )}
                            <button onClick={generateSchedule} disabled={loading || !activeLocationId} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-400 text-black font-bold text-sm hover:bg-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed glow-pulse">
                                {loading ? (
                                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
                                ) : (
                                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{shifts.length > 0 ? 'Regenerate' : 'Generate Schedule'}</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Free plan notice */}
                    {user && !user.is_pro && (
                        <div className="no-print bg-white/3 border border-white/8 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-white/50">Free plan</span>
                                <span className="text-xs text-white/30 mono">Up to {user.max_employees} employees · 1 location</span>
                            </div>
                            <Link href="/upgrade" className="text-sm text-emerald-400 font-medium hover:text-emerald-300">Upgrade for unlimited →</Link>
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
                        <button onClick={() => setShowDrive(!showDrive)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M6.28 3l5.72 9.9L6.28 3zm5.72 9.9L7.28 21H16.72l-4.72-8.1zm5.72-9.9L12 12.9 17.72 3H12z" /></svg>
                                </div>
                                <div className="text-left">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold">Google Drive</p>
                                        {driveConnected && (
                                            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/30">
                                        {activeLocation ? `Files will be ingested into "${activeLocation.name}"` : driveConnected ? 'Load your scheduling files below' : 'Connect Drive to import availability files and historical schedules'}
                                    </p>
                                </div>
                            </div>
                            <svg className={`w-4 h-4 text-white/30 transition-transform ${showDrive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {showDrive && (
                            <div className="px-6 pb-5 border-t border-white/5 pt-4 fade-up">
                                <div className="flex gap-3 mb-4">
                                    {!driveConnected ? (
                                        <button onClick={connectDrive} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6.28 3l5.72 9.9L6.28 3zm5.72 9.9L7.28 21H16.72l-4.72-8.1zm5.72-9.9L12 12.9 17.72 3H12z" /></svg>
                                            Connect Google Drive
                                        </button>
                                    ) : (
                                        <button onClick={connectDrive} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:border-white/20 hover:bg-white/5 transition-all text-white/40">Reconnect</button>
                                    )}
                                    <button onClick={loadFiles} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 transition-all">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        Load files
                                    </button>
                                </div>
                                {!activeLocationId && (
                                    <p className="text-xs text-amber-400/70 mb-3">⚠️ Select or create a location above before ingesting files.</p>
                                )}
                                {files.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-white/30 mb-2 uppercase tracking-wider font-medium">Your files</p>
                                        {files.slice(0, 8).map((file) => (
                                            <div key={file.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/3 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <span className="text-sm text-white/60 truncate max-w-[240px]">{file.name}</span>
                                                </div>
                                                <button onClick={() => ingestFile(file.id)} disabled={ingesting === file.id || !activeLocationId} className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 font-medium ml-4 shrink-0">
                                                    {ingesting === file.id ? 'Ingesting...' : 'Ingest →'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {files.length === 0 && driveConnected && (
                                    <p className="text-xs text-white/30 text-center py-4">No scheduling files found. Click "Load files" to browse your Drive.</p>
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
                            <p className="text-white/20 text-xs">
                                {!activeLocationId ? 'Create a location first, then connect Google Drive and ingest your availability files' : 'Connect Google Drive and ingest your availability files, then click Generate Schedule'}
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-32 fade-up">
                            <div className="w-12 h-12 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin mb-6" />
                            <p className="text-white/40 text-sm">AI is building your schedule...</p>
                        </div>
                    ) : (
                        <div className="flex gap-6">
                            <div className="flex-1 print-area">
                                {/* Tab switcher */}
                                <div className="no-print flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
                                    <button onClick={() => setActiveTab('calendar')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                                        Calendar
                                    </button>
                                    <button
                                        onClick={() => !showUpgradePrompt && setActiveTab('raw')}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'raw' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'} ${showUpgradePrompt ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        Raw text {showUpgradePrompt && '🔒'}
                                    </button>
                                </div>

                                <div className="relative">
                                    {/* Blur overlay */}
                                    {!showLimitModal && showUpgradePrompt && (
                                        <div className="absolute inset-0 z-20 backdrop-blur-md bg-black/60 rounded-2xl flex flex-col items-center justify-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-white font-semibold mb-1">Schedule locked</p>
                                                <p className="text-white/50 text-sm">Your team has {totalEmployees} employees — upgrade to view</p>
                                            </div>
                                            <Link href="/upgrade" className="bg-emerald-400 text-black font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-emerald-300 transition-colors">Upgrade to Pro →</Link>
                                        </div>
                                    )}

                                    {activeTab === 'calendar' ? (
                                        <div className="border border-white/8 rounded-2xl overflow-hidden bg-[#0d0d0d]">
                                            {/* Day header row */}
                                            <div className="grid border-b border-white/8" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                                                {DAYS.map(day => (
                                                    <div key={day} className="py-3 px-3 border-r border-white/5 last:border-0">
                                                        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                                                            {WEEK_DAYS.find(w => w.full === day)?.display || day.slice(0, 3)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Shift cards grid */}
                                            <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                                                {DAYS.map(day => {
                                                    const dayGroups = shiftGroups.filter(g => g.day === day)
                                                    return (
                                                        <div key={day} className="border-r border-white/5 last:border-0 p-2 space-y-2 min-h-[120px]">
                                                            {dayGroups.length === 0 && (
                                                                <div className="text-xs text-white/15 text-center pt-4">—</div>
                                                            )}
                                                            {dayGroups.map(group => {
                                                                const groupKey = `${group.day}|${group.startHour}|${group.endHour}`
                                                                const isDragOver = dragOverKey === groupKey
                                                                return (
                                                                    <div
                                                                        key={groupKey}
                                                                        className={`shift-card rounded-xl border border-white/8 bg-white/3 overflow-hidden ${isDragOver ? 'drag-over' : ''}`}
                                                                        onDragOver={(e) => { e.preventDefault(); setDragOverKey(groupKey) }}
                                                                        onDragLeave={() => setDragOverKey(null)}
                                                                        onDrop={() => handleDrop(groupKey)}
                                                                    >
                                                                        {/* Shift time header */}
                                                                        <div className="px-2.5 py-1.5 border-b border-white/5 bg-white/3">
                                                                            <span className="shift-time text-xs text-white/40 mono font-medium">
                                                                                {formatHour(group.startHour)} – {formatHour(group.endHour)}
                                                                            </span>
                                                                        </div>
                                                                        {/* Employee rows */}
                                                                        <div className="py-1">
                                                                            {group.employees.map(emp => {
                                                                                const colorClass = employeeColorMap[emp] || COLORS[0]
                                                                                const dotClass = COLOR_DOTS[COLORS.indexOf(colorClass)] || 'bg-emerald-400'
                                                                                return (
                                                                                    <div
                                                                                        key={emp}
                                                                                        draggable
                                                                                        onDragStart={() => handleDragStart(emp, groupKey)}
                                                                                        onDragEnd={() => { setDragging(null); setDragOverKey(null) }}
                                                                                        className="employee-row flex items-center gap-2 px-2.5 py-1 rounded-lg mx-1 hover:bg-white/5"
                                                                                    >
                                                                                        {/* Drag handle */}
                                                                                        <svg className="w-3 h-3 text-white/20 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                                                                            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                                                                                            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                                                                                            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                                                                                        </svg>
                                                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                                                                                        <span className="employee-name text-xs text-white/75 leading-tight truncate">{emp}</span>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Legend */}
                                            {employees.length > 0 && (
                                                <div className="border-t border-white/8 px-4 py-3 flex flex-wrap gap-3">
                                                    {employees.map(emp => (
                                                        <div key={emp} className="flex items-center gap-1.5">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${COLOR_DOTS[COLORS.indexOf(employeeColorMap[emp])] || 'bg-emerald-400'}`} />
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
                                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-emerald-400 text-black font-medium rounded-br-sm' : 'bg-white/8 text-white/80 rounded-bl-sm'}`}>
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
                                            <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()} className="w-9 h-9 bg-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-300 transition-colors disabled:opacity-40 shrink-0">
                                                <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Employee limit modal */}
                {showLimitModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 relative">
                            <button onClick={() => setShowLimitModal(false)} className="absolute top-4 right-4 text-white/30 hover:text-white/60 text-xl leading-none">✕</button>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-6">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <h2 className="text-xl font-bold mb-2">Your team has {totalEmployees} employees</h2>
                            <p className="text-white/40 text-sm mb-8 leading-relaxed">
                                Your schedule was generated for all {totalEmployees} employees. Upgrade to Pro to view and manage your full schedule with unlimited employees.
                            </p>
                            <div className="flex flex-col gap-3">
                                <Link href="/upgrade" className="btn-primary block text-center bg-emerald-400 text-black font-bold rounded-xl py-3.5 text-sm">Upgrade to Pro →</Link>
                                <button onClick={() => setShowLimitModal(false)} className="text-white/30 text-sm hover:text-white/50 transition-colors">Maybe later</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    )
}