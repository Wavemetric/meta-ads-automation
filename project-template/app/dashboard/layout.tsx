import Link from 'next/link'
import type { ReactNode } from 'react'

type NavLink  = { type: 'link';  href: string; label: string }
type NavGroup = { type: 'group'; label: string; children: { href: string; label: string }[] }

const NAV: (NavLink | NavGroup)[] = [
  { type: 'link', href: '/dashboard', label: '대시보드' },
  {
    type: 'group',
    label: '최적화 기준',
    children: [
      { href: '/dashboard/goals', label: 'CPA 설정' },
      { href: '/dashboard/rules', label: '트리거 설정' },
    ],
  },
  { type: 'link', href: '/dashboard/queue', label: '최적화 실행' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f5f7fa' }}>
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col"
        style={{ background: '#ffffff', borderRight: '1px solid #e5e7eb' }}
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
          {NAV.map(item =>
            item.type === 'link' ? (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-100"
                style={{ color: '#374151' }}
              >
                {item.label}
              </Link>
            ) : (
              <div key={item.label} className="pt-3 pb-1">
                <p
                  className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#9ca3af' }}
                >
                  {item.label}
                </p>
                {item.children.map(child => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="block pl-5 pr-3 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-gray-100"
                    style={{ color: '#6b7280' }}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid #e5e7eb' }}>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
            style={{ background: '#fefce8', border: '1px solid #fde68a' }}
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
