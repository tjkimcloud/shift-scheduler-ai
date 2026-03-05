'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

const SCHEDULE_DEMO = [
  { name: 'Maria G.', day: 'Mon', start: 9, end: 17, color: '#34d399' },
  { name: 'James W.', day: 'Mon', start: 14, end: 22, color: '#60a5fa' },
  { name: 'Sarah K.', day: 'Tue', start: 8, end: 16, color: '#f472b6' },
  { name: 'David P.', day: 'Tue', start: 16, end: 22, color: '#a78bfa' },
  { name: 'Lisa C.', day: 'Wed', start: 9, end: 17, color: '#fb923c' },
  { name: 'Mike J.', day: 'Wed', start: 12, end: 22, color: '#34d399' },
  { name: 'Maria G.', day: 'Thu', start: 9, end: 17, color: '#34d399' },
  { name: 'Tyler B.', day: 'Thu', start: 6, end: 14, color: '#fbbf24' },
  { name: 'Sarah K.', day: 'Fri', start: 8, end: 16, color: '#f472b6' },
  { name: 'James W.', day: 'Fri', start: 14, end: 22, color: '#60a5fa' },
  { name: 'David P.', day: 'Sat', start: 10, end: 20, color: '#a78bfa' },
  { name: 'Mike J.', day: 'Sat', start: 14, end: 22, color: '#34d399' },
  { name: 'Tyler B.', day: 'Sun', start: 10, end: 18, color: '#fbbf24' },
  { name: 'Lisa C.', day: 'Sun', start: 14, end: 22, color: '#fb923c' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const START_HOUR = 6
const END_HOUR = 23
const TOTAL_HOURS = END_HOUR - START_HOUR

function ScheduleDemo() {
  const [visible, setVisible] = useState<number[]>([])
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    setVisible([])
    const timers: ReturnType<typeof setTimeout>[] = []
    SCHEDULE_DEMO.forEach((_, i) => {
      const t = setTimeout(() => setVisible(v => [...v, i]), i * 150 + 500)
      timers.push(t)
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0d0d0d]" style={{ fontFamily: 'DM Mono, monospace' }}>
      <div className="flex border-b border-white/8">
        <div className="w-16 shrink-0 border-r border-white/5" />
        {DAYS.map(d => (
          <div key={d} className="flex-1 text-center py-2.5 border-r border-white/5 last:border-0">
            <span className="text-xs text-white/30 uppercase tracking-widest">{d}</span>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: 200 }}>
        {[9, 12, 15, 18, 21].map(h => (
          <div key={h} className="absolute left-0 right-0 border-t border-white/4 flex items-center" style={{ top: `${((h - START_HOUR) / TOTAL_HOURS) * 100}%` }}>
            <span className="text-white/15 text-xs w-16 text-right pr-2">{h > 12 ? `${h-12}pm` : h === 12 ? '12pm' : `${h}am`}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex ml-16">
          {DAYS.map(day => (
            <div key={day} className="flex-1 relative border-r border-white/5 last:border-0">
              {SCHEDULE_DEMO.map((shift, i) => {
                if (shift.day !== day) return null
                const top = ((shift.start - START_HOUR) / TOTAL_HOURS) * 100
                const height = ((shift.end - shift.start) / TOTAL_HOURS) * 100
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    className="absolute left-1 right-1 rounded-md px-1.5 py-1 cursor-pointer transition-all duration-200"
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      backgroundColor: shift.color + '25',
                      borderLeft: `2px solid ${shift.color}`,
                      opacity: visible.includes(i) ? 1 : 0,
                      transform: visible.includes(i) ? 'scaleY(1)' : 'scaleY(0)',
                      transformOrigin: 'top',
                      transition: 'opacity 0.3s ease, transform 0.3s ease',
                      boxShadow: hovered === i ? `0 0 12px ${shift.color}40` : 'none',
                      zIndex: hovered === i ? 10 : 1,
                    }}
                  >
                    <p className="text-xs font-medium truncate" style={{ color: shift.color, fontSize: 9 }}>{shift.name}</p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CountUp({ target, duration = 2000 }: { target: number, duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(eased * target))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={ref}>{count.toLocaleString()}</span>
}

export default function Home() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('mousemove', handleMouse)
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('mousemove', handleMouse)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;500;600;700;800&family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap');
        
        :root {
          --green: #34d399;
          --green-dim: #34d39920;
          --bg: #070707;
          --surface: #0f0f0f;
          --border: rgba(255,255,255,0.07);
        }
        
        * { font-family: 'Cabinet Grotesk', sans-serif; box-sizing: border-box; }
        .mono { font-family: 'DM Mono', monospace; }
        .display { font-family: 'Syne', sans-serif; }
        
        body { background: var(--bg); margin: 0; }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        .fade-up-1 { animation: fadeUp 0.7s ease 0.1s both; }
        .fade-up-2 { animation: fadeUp 0.7s ease 0.25s both; }
        .fade-up-3 { animation: fadeUp 0.7s ease 0.4s both; }
        .fade-up-4 { animation: fadeUp 0.7s ease 0.55s both; }
        .fade-up-5 { animation: fadeUp 0.7s ease 0.7s both; }
        
        .shimmer-text {
          background: linear-gradient(90deg, #34d399 0%, #6ee7b7 25%, #34d399 50%, #6ee7b7 75%, #34d399 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        
        .card-hover {
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          border-color: rgba(52, 211, 153, 0.3);
          box-shadow: 0 20px 60px rgba(52, 211, 153, 0.08);
        }
        
        .btn-primary {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.4s ease;
        }
        .btn-primary:hover::before { transform: translateX(100%); }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(52,211,153,0.35); }
        
        .noise-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }
        
        .grid-bg {
          background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        
        .ticker-wrap { overflow: hidden; white-space: nowrap; }
        .ticker { display: inline-block; animation: ticker 20s linear infinite; }
        
        .feature-number {
          font-family: 'Syne', sans-serif;
          font-size: 80px;
          font-weight: 800;
          line-height: 1;
          color: rgba(52, 211, 153, 0.08);
          position: absolute;
          top: -10px;
          right: 16px;
        }

        .plan-popular {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #34d399;
          color: black;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 14px;
          border-radius: 999px;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
      `}</style>

      {/* Cursor glow */}
      <div
        className="fixed pointer-events-none z-50 rounded-full"
        style={{
          width: 600,
          height: 600,
          left: mousePos.x - 300,
          top: mousePos.y - 300,
          background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, rgba(52,211,153,0.06) 30%, transparent 65%)',
          transition: 'left 0.15s ease, top 0.15s ease',
        }}
      />
      <div
        className="fixed pointer-events-none z-50 rounded-full"
        style={{
          width: 120,
          height: 120,
          left: mousePos.x - 60,
          top: mousePos.y - 60,
          background: 'radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 70%)',
          transition: 'left 0.05s ease, top 0.05s ease',
        }}
      />

      <main className="noise-bg min-h-screen bg-[#070707] text-white overflow-x-hidden">
        
        {/* Scanline effect */}
        <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden opacity-20">
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" style={{ animation: 'scan 8s linear infinite' }} />
        </div>

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-sm bg-[#070707]/80 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-400/20">
              <span className="text-black font-black text-sm display">S</span>
            </div>
            <span className="font-bold tracking-tight text-lg display">Schedio</span>
            <span className="mono text-xs text-white/20 ml-1">v1.0</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-white/40 hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-white/40 hover:text-white transition-colors">Pricing</a>
            <a href="#tech" className="text-sm text-white/40 hover:text-white transition-colors">Technology</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/40 hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="btn-primary text-sm bg-emerald-400 text-black font-bold px-5 py-2 rounded-xl">
              Get started free →
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative grid-bg px-8 pt-20 pb-8 max-w-7xl mx-auto">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" style={{ animation: 'glow-pulse 4s ease infinite' }} />
          <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-blue-500/4 rounded-full blur-3xl pointer-events-none" style={{ animation: 'glow-pulse 6s ease infinite 2s' }} />

          <div className="relative max-w-4xl">
            <div className="fade-up-1 inline-flex items-center gap-2 bg-emerald-400/8 border border-emerald-400/20 rounded-full px-4 py-2 text-sm text-emerald-400 mb-8 mono">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              AI-powered staff scheduling — now live
            </div>

            <h1 className="fade-up-2 display text-[clamp(48px,7vw,88px)] font-black leading-[0.95] tracking-tight mb-8">
              Build the perfect<br />
              schedule in{' '}
              <span className="shimmer-text">seconds.</span>
              <br />
              <span className="text-white/20">Not hours.</span>
            </h1>

            <p className="fade-up-3 text-xl text-white/40 max-w-2xl mb-10 leading-relaxed">
              Upload availability sheets to Google Drive. Schedio's AI reads them, 
              learns your team's patterns, and generates optimized weekly schedules — 
              with a drag-and-drop editor and AI chat assistant to fine-tune.
            </p>

            <div className="fade-up-4 flex flex-wrap items-center gap-4 mb-6">
              <Link href="/register" className="btn-primary bg-emerald-400 text-black font-bold px-8 py-4 rounded-xl text-lg">
                Start for free →
              </Link>
              <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-lg group">
                <span className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </span>
                See live demo
              </Link>
            </div>

            <p className="fade-up-5 mono text-sm text-white/20">
              Free plan · No credit card · Up to 5 employees
            </p>
          </div>

          <div className="fade-up-5 mt-16 relative">
            <div className="absolute -top-3 left-6 bg-emerald-400 text-black text-xs font-black px-3 py-1 rounded-full mono z-10">
              LIVE PREVIEW
            </div>
            <div className="absolute -top-3 right-6 flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/40 text-xs px-3 py-1 rounded-full mono z-10">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              AI generating...
            </div>
            <ScheduleDemo />
          </div>
        </section>

        {/* Ticker */}
        <div className="border-y border-white/5 py-3 my-8 ticker-wrap bg-white/2">
          <div className="ticker mono text-sm text-white/20">
            {Array(6).fill('Restaurant Scheduling · Retail Staffing · Hourly Workers · AI-Powered · Google Drive Integration · Drag & Drop Editor · Multi-Location · AWS ECS · PostgreSQL · ').join('')}
          </div>
        </div>

        {/* Stats */}
        <section className="px-8 py-16 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: 95, suffix: '%', label: 'Time saved vs manual scheduling' },
              { value: 20, suffix: '+', label: 'Employees handled per schedule' },
              { value: 7, suffix: 's', label: 'Average generation time' },
              { value: 100, suffix: '%', label: 'Cloud-native on AWS' },
            ].map((stat, i) => (
              <div key={i} className="card-hover border border-white/8 rounded-2xl p-6 bg-white/2 text-center">
                <div className="display text-5xl font-black text-emerald-400 mb-2">
                  <CountUp target={stat.value} />{stat.suffix}
                </div>
                <p className="text-white/40 text-sm leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-8 py-24 max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="mono text-emerald-400 text-sm mb-3">// HOW IT WORKS</p>
            <h2 className="display text-5xl font-black tracking-tight mb-4">Three steps to never<br />build a schedule again.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Connect Google Drive',
                desc: 'Link your Drive and point Schedio to availability spreadsheets, handwritten notes, or any docs your team submits.',
                icon: (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6.28 3l5.72 9.9L6.28 3zm5.72 9.9L7.28 21H16.72l-4.72-8.1zm5.72-9.9L12 12.9 17.72 3H12z"/></svg>)
              },
              {
                step: '02',
                title: 'AI ingests & learns',
                desc: 'Schedio vectorizes your data with OpenAI embeddings stored in pgvector. It learns patterns — who prefers mornings, who closes well.',
                icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
              },
              {
                step: '03',
                title: 'Generate, drag & print',
                desc: 'Get a complete weekly schedule in seconds. Drag shifts to adjust. Chat with AI to tweak. Export to PDF and pin it up.',
                icon: (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>)
              },
            ].map((item, i) => (
              <div key={i} className="card-hover relative border border-white/8 rounded-2xl p-8 bg-white/2 overflow-hidden">
                <span className="feature-number">{item.step}</span>
                <div className="w-12 h-12 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 mb-6">
                  {item.icon}
                </div>
                <h3 className="display font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-white/40 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section className="px-8 py-24 max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="mono text-emerald-400 text-sm mb-3">// FEATURES</p>
            <h2 className="display text-5xl font-black tracking-tight">Everything you need.<br /><span className="text-white/25">Nothing you don't.</span></h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Drag & Drop Calendar', desc: 'Interactive weekly view. Grab shifts and move them. Changes save instantly.', tag: 'NEW' },
              { title: 'AI Chat Assistant', desc: 'Say "move Sarah to Friday" or "add a closer Saturday" — the AI adjusts.', tag: 'AI' },
              { title: 'Google Drive RAG', desc: 'Upload photos of handwritten sheets. Schedio reads and vectorizes everything.', tag: null },
              { title: 'Multi-Location Support', desc: 'Manage multiple locations from one account. Each location gets its own isolated schedule history and RAG data.', tag: 'NEW' },
              { title: 'Pattern Learning', desc: 'The more you use it, the smarter it gets. Historical schedules train the AI per location.', tag: 'AI' },
              { title: 'Multi-tenant SaaS', desc: 'Row-level security means your data is completely isolated from other businesses.', tag: null },
            ].map((f, i) => (
              <div key={i} className="card-hover border border-white/8 rounded-2xl p-6 bg-white/2 group">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-base">{f.title}</h3>
                  {f.tag && (
                    <span className={`mono text-xs px-2 py-0.5 rounded-full font-bold ${f.tag === 'AI' ? 'bg-violet-400/10 text-violet-400 border border-violet-400/20' : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'}`}>
                      {f.tag}
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-8 py-24 max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="mono text-emerald-400 text-sm mb-3">// PRICING</p>
            <h2 className="display text-5xl font-black tracking-tight">Simple pricing.<br /><span className="text-white/25">No surprises.</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl">

            {/* Free */}
            <div className="card-hover border border-white/10 rounded-2xl p-8 bg-white/2">
              <div className="mono text-xs text-white/30 uppercase tracking-widest mb-6">Free Plan</div>
              <div className="display text-6xl font-black mb-1">$0</div>
              <p className="text-white/30 text-sm mono mb-8">forever</p>
              <div className="space-y-3 mb-10">
                {[
                  'Up to 5 employees',
                  '1 location',
                  'Google Drive integration',
                  'AI schedule generation',
                  'Drag & drop editor',
                  'Print & export',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/50">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/register" className="block text-center border border-white/15 rounded-xl py-3.5 text-sm font-bold hover:border-white/30 transition-colors">
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="card-hover relative border border-emerald-400/40 rounded-2xl p-8 bg-emerald-400/4 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
              <div className="plan-popular">MOST POPULAR</div>
              <div className="mono text-xs text-emerald-400 uppercase tracking-widest mb-6 mt-2">Pro Plan</div>
              <div className="display text-6xl font-black mb-1">$29</div>
              <p className="text-white/30 text-sm mono mb-8">per month</p>
              <div className="space-y-3 mb-10">
                {[
                  'Unlimited employees',
                  '1 location',
                  'Everything in Free',
                  'AI chat assistant',
                  'Schedule history & RAG',
                  'Priority support',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/70">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/register" className="btn-primary block text-center bg-emerald-400 text-black font-bold rounded-xl py-3.5 text-sm">
                Start free trial →
              </Link>
            </div>

            {/* Business */}
            <div className="card-hover relative border border-white/10 rounded-2xl p-8 bg-white/2 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="mono text-xs text-white/30 uppercase tracking-widest mb-6">Business Plan</div>
              <div className="display text-6xl font-black mb-1">$79</div>
              <p className="text-white/30 text-sm mono mb-8">per month</p>
              <div className="space-y-3 mb-10">
                {[
                  'Unlimited employees',
                  'Unlimited locations',
                  'Everything in Pro',
                  'Per-location RAG history',
                  'Isolated data per location',
                  'Dedicated support',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/50">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/register" className="block text-center border border-white/15 rounded-xl py-3.5 text-sm font-bold hover:border-white/30 transition-colors">
                Get started →
              </Link>
            </div>

          </div>

          {/* Plan comparison note */}
          <p className="mono text-white/20 text-xs mt-8 max-w-5xl">
            * Multi-location plans keep each location's schedule history and AI data fully isolated — no cross-location data bleed.
          </p>
        </section>

        {/* CTA */}
        <section className="px-8 py-32 max-w-7xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-emerald-500/3 rounded-3xl blur-3xl" />
          <div className="relative">
            <p className="mono text-emerald-400 text-sm mb-6">// GET STARTED</p>
            <h2 className="display text-6xl font-black tracking-tight mb-6">
              Ready to reclaim<br />your Sunday nights?
            </h2>
            <p className="text-white/40 text-xl mb-10 max-w-lg mx-auto">
              Stop spending hours on schedules. Let AI handle it in seconds.
            </p>
            <Link href="/register" className="btn-primary inline-block bg-emerald-400 text-black font-bold px-12 py-5 rounded-2xl text-xl">
              Start for free →
            </Link>
            <p className="mono text-white/20 text-sm mt-4">No credit card required</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 px-8 py-8 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-emerald-400 rounded flex items-center justify-center">
              <span className="text-black font-black text-xs display">S</span>
            </div>
            <span className="font-bold text-sm">Schedio</span>
            <span className="mono text-white/20 text-xs">© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-white/30 text-sm hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="text-white/30 text-sm hover:text-white transition-colors">Register</Link>
            <a href="https://github.com/tjkimcloud/shift-scheduler-ai" target="_blank" rel="noopener noreferrer" className="text-white/30 text-sm hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="mono text-white/15 text-xs">Built on AWS · Deployed with Terraform · Powered by OpenAI</p>
        </footer>
      </main>
    </>
  )
}
