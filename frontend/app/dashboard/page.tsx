'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserData {
  email: string
  is_pro: boolean
  schedules_this_month: number
  schedules_remaining: number | string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
}

export default function Dashboard() {
  const [user, setUser] = useState<UserData | null>(null)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [schedule, setSchedule] = useState('')
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const apiCall = async (endpoint: string, method = 'GET') => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method,
      headers: { authorization: `Bearer ${token}` }
    })
    if (res.status === 401) {
      router.push('/login')
      return null
    }
    return res.json()
  }

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    apiCall('/me').then(data => { if (data) setUser(data) })
  }, [])

  const connectDrive = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/drive/auth`
  }

  const loadFiles = async () => {
    const data = await apiCall('/drive/files')
    if (data?.files) setFiles(data.files)
  }

  const ingestFile = async (fileId: string) => {
    setIngesting(fileId)
    const data = await apiCall(`/drive/ingest/${fileId}`, 'POST')
    if (data?.message) setMessage(data.message)
    setIngesting(null)
  }

  const generateSchedule = async () => {
    setLoading(true)
    setSchedule('')
    const data = await apiCall('/generate-schedule', 'POST')
    if (data?.schedule) setSchedule(data.schedule)
    if (data?.detail) setMessage(data.detail)
    if (user) {
      const updated = await apiCall('/me')
      if (updated) setUser(updated)
    }
    setLoading(false)
  }

  const logout = () => {
    localStorage.clear()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-400 rounded-md flex items-center justify-center">
            <span className="text-black font-black text-sm">S</span>
          </div>
          <span className="font-semibold tracking-tight">Schedio</span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-white/30">{user.email}</span>
          )}
          {user && !user.is_pro && (
            <Link href="/upgrade" className="text-sm bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-400/20 transition-colors">
              Upgrade to Pro
            </Link>
          )}
          {user?.is_pro && (
            <span className="text-xs bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 px-2 py-1 rounded-full font-semibold">PRO</span>
          )}
          <button onClick={logout} className="text-sm text-white/30 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Usage bar */}
        {user && !user.is_pro && (
          <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Free plan usage</span>
              <span className="text-sm text-white/40">{user.schedules_this_month} / 3 schedules this month</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${(user.schedules_this_month / 3) * 100}%` }}
              />
            </div>
            {user.schedules_this_month >= 3 && (
              <p className="text-sm text-amber-400 mt-3">You've used all free schedules this month. <Link href="/upgrade" className="underline">Upgrade to Pro</Link> for unlimited.</p>
            )}
          </div>
        )}

        {message && (
          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3 text-sm text-emerald-400 mb-6">
            {message}
            <button onClick={() => setMessage('')} className="ml-2 opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Connect Drive */}
            <div className="border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-1">Google Drive</h2>
              <p className="text-white/40 text-sm mb-5">Connect your Drive to import availability files.</p>
              <div className="space-y-3">
                <button onClick={connectDrive} className="w-full border border-white/10 rounded-xl py-2.5 text-sm font-medium hover:border-white/20 transition-colors flex items-center justify-center gap-2">
                  <span>Connect Google Drive</span>
                </button>
                <button onClick={loadFiles} className="w-full bg-white/5 rounded-xl py-2.5 text-sm font-medium hover:bg-white/10 transition-colors">
                  Load files
                </button>
              </div>
            </div>

            {/* Files */}
            {files.length > 0 && (
              <div className="border border-white/10 rounded-2xl p-6">
                <h2 className="font-bold text-lg mb-4">Your files</h2>
                <div className="space-y-2">
                  {files.slice(0, 8).map((file) => (
                    <div key={file.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-sm text-white/70 truncate max-w-[180px]">{file.name}</span>
                      <button
                        onClick={() => ingestFile(file.id)}
                        disabled={ingesting === file.id}
                        className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 ml-2 shrink-0"
                      >
                        {ingesting === file.id ? 'Ingesting...' : 'Ingest'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Generate */}
            <div className="border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-1">Generate schedule</h2>
              <p className="text-white/40 text-sm mb-5">AI will analyze your availability data and create an optimized weekly schedule.</p>
              <button
                onClick={generateSchedule}
                disabled={loading || (user !== null && !user.is_pro && user.schedules_this_month >= 3)}
                className="w-full bg-emerald-400 text-black font-bold py-3 rounded-xl hover:bg-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate schedule'}
              </button>
            </div>

            {/* Schedule output */}
            {schedule && (
              <div className="border border-emerald-400/20 rounded-2xl p-6 bg-emerald-400/5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">Generated schedule</h2>
                  <button
                    onClick={() => navigator.clipboard.writeText(schedule)}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono">
                  {schedule}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}