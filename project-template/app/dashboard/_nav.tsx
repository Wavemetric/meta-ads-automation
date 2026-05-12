'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink  = { type: 'link';  href: string; label: string; exact?: boolean }
type NavGroup = { type: 'group'; label: string; children: { href: string; label: string }[] }

const NAV: (NavLink | NavGroup)[] = [
  { type: 'link', href: '/dashboard', label: '대시보드', exact: true },
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

export function SidebarNav() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {NAV.map(item =>
        item.type === 'link' ? (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center rounded-lg text-sm font-medium transition-all duration-200"
            style={isActive(item.href, item.exact) ? {
              padding: '10px 12px 10px 10px',
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc',
              borderLeft: '2px solid #6366f1',
            } : {
              padding: '10px 12px 10px 10px',
              color: '#71717a',
              borderLeft: '2px solid transparent',
            }}
          >
            {item.label}
          </Link>
        ) : (
          <div key={item.label} className="pt-4 pb-1">
            <p
              className="mb-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#3f3f46', paddingLeft: '10px' }}
            >
              {item.label}
            </p>
            {item.children.map(child => (
              <Link
                key={child.href}
                href={child.href}
                className="flex items-center rounded-lg text-sm transition-all duration-200"
                style={isActive(child.href) ? {
                  padding: '8px 12px 8px 22px',
                  background: 'rgba(99,102,241,0.15)',
                  color: '#a5b4fc',
                  borderLeft: '2px solid #6366f1',
                } : {
                  padding: '8px 12px 8px 22px',
                  color: '#71717a',
                  borderLeft: '2px solid transparent',
                }}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )
      )}
    </nav>
  )
}
