import type { ReactNode } from 'react'
import { SidebarNav } from './_nav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto"
        style={{ background: '#0c0c10' }}
      >
        {/* Logo */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#6366f1' }}
          >
            Meta Ads
          </p>
          <p
            className="text-base font-bold mt-1"
            style={{
              background: 'linear-gradient(135deg, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            자동화 대시보드
          </p>
        </div>

        <SidebarNav />

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            <span style={{ color: '#fbbf24', fontSize: '7px', lineHeight: 1 }}>●</span>
            <span className="text-xs font-medium" style={{ color: '#fbbf24' }}>
              모든 액션 승인 필요
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main
        className="flex-1 overflow-auto p-8"
        style={{ background: '#f4f5f7', minHeight: '100vh' }}
      >
        {children}
      </main>
    </div>
  )
}
