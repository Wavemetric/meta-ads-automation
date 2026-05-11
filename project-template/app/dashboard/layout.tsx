import Link from 'next/link'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/dashboard',            label: 'KPI 모니터링' },
  { href: '/dashboard/queue',      label: '승인 대기' },
  { href: '/dashboard/rules',      label: '규칙 관리' },
  { href: '/dashboard/creatives',  label: '소재 성과' },
  { href: '/dashboard/logs',       label: '실행 이력' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* 사이드바 */}
      <aside className="w-52 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        <div className="px-5 py-6 border-b border-gray-800">
          <p className="text-xs text-gray-400 font-medium tracking-wider uppercase">Meta Ads</p>
          <p className="text-sm font-bold text-white mt-0.5">자동화 대시보드</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-1">자동 규칙 실행 주기</p>
          <p>00시 — 일일 규칙 우선 실행</p>
          <p>매시 — 시간대별 규칙 실행</p>
          <p className="text-yellow-600 mt-1">모든 액션 승인 필요</p>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
