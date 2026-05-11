import Link from 'next/link'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/dashboard',           label: 'KPI 모니터링' },
  { href: '/dashboard/products',  label: '제품별 CPA' },
  { href: '/dashboard/queue',     label: '승인 대기' },
  { href: '/dashboard/rules',     label: '규칙 관리' },
  { href: '/dashboard/creatives', label: '소재 성과' },
  { href: '/dashboard/logs',      label: '실행 이력' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f5f7fa' }}>
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col"
        style={{
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#8b5cf6' }}
          >
            Meta Ads
          </p>
          <p
            className="text-base font-bold mt-1"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            자동화 대시보드
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:bg-gray-100"
              style={{
                color: '#6b7280',
              }}
            >
              <span className="nav-item-inner">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid #e5e7eb' }}>
          <p className="text-xs font-semibold" style={{ color: '#9ca3af' }}>
            자동 실행 주기
          </p>
          <div className="space-y-1 text-xs" style={{ color: '#9ca3af' }}>
            <p>00시 — 일일 규칙 우선 실행</p>
            <p>매시 — 시간대별 규칙 실행</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md mt-1"
            style={{
              background: '#fefce8',
              border: '1px solid #fde68a',
            }}
          >
            <span style={{ color: '#eab308', fontSize: '8px', lineHeight: 1 }}>●</span>
            <span className="text-xs font-medium" style={{ color: '#ca8a04' }}>모든 액션 승인 필요</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8" style={{ background: '#f5f7fa' }}>
        {children}
      </main>
    </div>
  )
}
