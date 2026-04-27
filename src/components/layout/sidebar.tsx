'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LayoutDashboard, Server, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/cores', label: 'Cores', icon: Server },
]

function NavLink({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: typeof LayoutDashboard; active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 btn-hover',
        active
          ? 'bg-primary/15 text-primary border border-primary/25 glow-primary'
          : 'text-text-muted hover:text-text-base hover:bg-bg-elevated'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
    toast.success('Logged out')
  }

  const sidebar = (
    <aside className="w-64 h-full glass border-r border-border flex flex-col relative">
      {/* Glow line */}
      <div className="absolute right-0 top-0 bottom-0 w-px sidebar-glow-line" />

      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center glow-primary">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-base font-bold neon-text tracking-wide">GGoose</span>
            <p className="text-text-muted text-xs">Management UI</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname === href || pathname.startsWith(href + '/')}
          />
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-150 btn-hover"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex h-screen flex-shrink-0">{sidebar}</div>

      {/* Mobile toggle */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 glass rounded-lg p-2 text-text-muted"
        >
          <Menu className="w-5 h-5" />
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-bg-base/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <button
              className="absolute top-4 right-4 text-text-muted z-60"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute left-0 top-0 h-full">
              {sidebar}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
