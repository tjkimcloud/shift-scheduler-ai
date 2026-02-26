import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-400 rounded-md flex items-center justify-center">
            <span className="text-black font-black text-sm">S</span>
          </div>
          <span className="font-semibold tracking-tight text-lg">Schedio</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link href="/register" className="text-sm bg-emerald-400 text-black font-semibold px-4 py-2 rounded-lg hover:bg-emerald-300 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-8 pt-24 pb-32 max-w-5xl mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/60 mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            AI-powered scheduling for small businesses
          </div>

          <h1 className="text-6xl font-black tracking-tighter leading-none mb-6 max-w-3xl">
            Stop building schedules.<br />
            <span className="text-emerald-400">Start running your business.</span>
          </h1>

          <p className="text-xl text-white/50 max-w-xl mb-10 leading-relaxed">
            Connect your Google Drive, upload availability sheets, and let AI generate 
            optimized weekly schedules in seconds. Built for restaurants, retail, and 
            any business with hourly workers.
          </p>

          <div className="flex items-center gap-4">
            <Link href="/register" className="bg-emerald-400 text-black font-bold px-8 py-4 rounded-xl hover:bg-emerald-300 transition-colors text-lg">
              Start for free
            </Link>
            <Link href="#how-it-works" className="text-white/50 hover:text-white transition-colors flex items-center gap-2 text-lg">
              See how it works →
            </Link>
          </div>

          <p className="mt-4 text-sm text-white/30">
            Free plan includes 3 schedules/month. No credit card required.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-8 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl font-black tracking-tight mb-4">How it works</h2>
        <p className="text-white/50 mb-16 text-lg">Three steps to never manually build a schedule again.</p>

        <div className="grid grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Connect Google Drive",
              desc: "Link your Google Drive and point Schedio to your availability spreadsheets or documents."
            },
            {
              step: "02",
              title: "Ingest availability",
              desc: "Schedio reads your files, understands employee availability, and stores it intelligently."
            },
            {
              step: "03",
              title: "Generate schedule",
              desc: "Click generate. Get a complete, optimized weekly schedule in seconds. Edit and export."
            }
          ].map((item) => (
            <div key={item.step} className="border border-white/10 rounded-2xl p-8 hover:border-emerald-400/30 transition-colors">
              <div className="text-emerald-400 font-black text-4xl mb-4 opacity-50">{item.step}</div>
              <h3 className="font-bold text-xl mb-3">{item.title}</h3>
              <p className="text-white/50 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-8 py-24 max-w-5xl mx-auto">
        <h2 className="text-3xl font-black tracking-tight mb-4">Simple pricing</h2>
        <p className="text-white/50 mb-16 text-lg">Start free. Upgrade when you need more.</p>

        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <div className="border border-white/10 rounded-2xl p-8">
            <div className="text-sm text-white/50 mb-2 font-medium uppercase tracking-wider">Free</div>
            <div className="text-4xl font-black mb-1">$0</div>
            <div className="text-white/30 text-sm mb-8">forever</div>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> 3 schedules per month</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Google Drive integration</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> AI schedule generation</li>
            </ul>
            <Link href="/register" className="mt-8 block text-center border border-white/20 rounded-xl py-3 text-sm font-semibold hover:border-white/40 transition-colors">
              Get started
            </Link>
          </div>

          <div className="border border-emerald-400/50 rounded-2xl p-8 bg-emerald-400/5 relative">
            <div className="absolute top-4 right-4 bg-emerald-400 text-black text-xs font-black px-2 py-1 rounded-full">POPULAR</div>
            <div className="text-sm text-emerald-400 mb-2 font-medium uppercase tracking-wider">Pro</div>
            <div className="text-4xl font-black mb-1">$29</div>
            <div className="text-white/30 text-sm mb-8">per month</div>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Unlimited schedules</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Google Drive integration</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> AI schedule generation</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Schedule history</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Priority support</li>
            </ul>
            <Link href="/register" className="mt-8 block text-center bg-emerald-400 text-black rounded-xl py-3 text-sm font-bold hover:bg-emerald-300 transition-colors">
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t border-white/5 max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-emerald-400 rounded flex items-center justify-center">
            <span className="text-black font-black text-xs">S</span>
          </div>
          <span className="text-white/30 text-sm">Schedio © 2026</span>
        </div>
        <p className="text-white/20 text-sm">AI-powered scheduling for small businesses</p>
      </footer>
    </main>
  )
}