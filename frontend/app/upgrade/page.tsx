'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserData {
    email: string
    is_pro: boolean
    max_employees: number
    max_locations: number
}

export default function Upgrade() {
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState<string | null>(null)
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

    useEffect(() => {
        if (!token) { router.push('/login'); return }
        apiCall('/me').then(data => { if (data) setUser(data) })
    }, [])

    const checkout = async (plan: string) => {
        setLoading(plan)
        const data = await apiCall('/billing/checkout', 'POST', { plan })
        if (data?.checkout_url) {
            window.location.href = data.checkout_url
        } else {
            setLoading(null)
        }
    }

    const plans = [
        {
            id: 'free',
            name: 'Free',
            price: '$0',
            period: 'forever',
            color: 'border-white/10',
            features: [
                'Up to 5 employees',
                '1 location',
                'Google Drive integration',
                'AI schedule generation',
                'Drag & drop editor',
                'Print & export',
            ],
            cta: 'Current plan',
            ctaStyle: 'border border-white/10 text-white/30 cursor-default',
            disabled: true,
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '$29',
            period: 'per month',
            color: 'border-emerald-400/40 bg-emerald-400/4',
            popular: true,
            features: [
                'Unlimited employees',
                '1 location',
                'Everything in Free',
                'AI chat assistant',
                'Schedule history & RAG',
                'Priority support',
            ],
            cta: 'Upgrade to Pro',
            ctaStyle: 'bg-emerald-400 text-black font-bold hover:bg-emerald-300',
            disabled: false,
        },
        {
            id: 'business',
            name: 'Business',
            price: '$79',
            period: 'per month',
            color: 'border-white/10',
            features: [
                'Unlimited employees',
                'Unlimited locations',
                'Everything in Pro',
                'Per-location RAG history',
                'Isolated data per location',
                'Dedicated support',
            ],
            cta: 'Upgrade to Business',
            ctaStyle: 'border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10',
            disabled: false,
        },
    ]

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Outfit', sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }
      `}</style>

            <main className="min-h-screen bg-[#080808] text-white">
                {/* Nav */}
                <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-[#080808]/80 backdrop-blur-md sticky top-0 z-50">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-400/20">
                            <span className="text-black font-black text-sm">S</span>
                        </div>
                        <span className="font-bold tracking-tight text-lg">Schedio</span>
                    </Link>
                    <Link href="/dashboard" className="text-sm text-white/30 hover:text-white transition-colors">
                        ← Back to dashboard
                    </Link>
                </nav>

                <div className="max-w-5xl mx-auto px-6 py-16">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <p className="mono text-emerald-400 text-sm mb-3">// UPGRADE</p>
                        <h1 className="text-5xl font-black tracking-tight mb-4">
                            Choose your plan
                        </h1>
                        <p className="text-white/40 text-lg">
                            {user?.is_pro
                                ? 'You are currently on the Pro plan.'
                                : 'Unlock unlimited employees, locations, and schedule history.'}
                        </p>
                    </div>

                    {/* Plans */}
                    <div className="grid md:grid-cols-3 gap-6">
                        {plans.map((plan) => {
                            const isCurrent =
                                (plan.id === 'free' && !user?.is_pro) ||
                                (plan.id === 'pro' && user?.is_pro && (user?.max_locations || 1) <= 1) ||
                                (plan.id === 'business' && user?.is_pro && (user?.max_locations || 1) > 1)

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative border rounded-2xl p-8 transition-all ${plan.color} ${isCurrent ? 'opacity-60' : ''}`}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-xs font-black px-4 py-1 rounded-full mono whitespace-nowrap">
                                            MOST POPULAR
                                        </div>
                                    )}
                                    {isCurrent && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white/10 text-white/60 text-xs font-black px-4 py-1 rounded-full mono whitespace-nowrap">
                                            CURRENT PLAN
                                        </div>
                                    )}

                                    <div className={`mono text-xs uppercase tracking-widest mb-6 mt-2 ${plan.popular ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {plan.name} Plan
                                    </div>
                                    <div className="text-6xl font-black mb-1">{plan.price}</div>
                                    <p className="text-white/30 text-sm mono mb-8">{plan.period}</p>

                                    <div className="space-y-3 mb-10">
                                        {plan.features.map(f => (
                                            <div key={f} className="flex items-center gap-3 text-sm text-white/60">
                                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {f}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => !isCurrent && !plan.disabled && checkout(plan.id)}
                                        disabled={isCurrent || plan.disabled || loading === plan.id}
                                        className={`w-full py-3.5 rounded-xl text-sm transition-all ${isCurrent ? 'border border-white/10 text-white/20 cursor-default' : plan.ctaStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {loading === plan.id ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Redirecting...
                                            </span>
                                        ) : isCurrent ? 'Current plan' : plan.cta}
                                    </button>
                                </div>
                            )
                        })}
                    </div>

                    {/* Note */}
                    <p className="mono text-white/20 text-xs text-center mt-10">
                        Payments powered by Stripe · Cancel anytime · No hidden fees
                    </p>
                </div>
            </main>
        </>
    )
}
