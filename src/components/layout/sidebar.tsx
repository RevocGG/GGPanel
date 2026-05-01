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
        'flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest uppercase transition-all duration-100 btn-hover border-l-2',
        active
          ? 'border-primary text-primary bg-primary/8'
          : 'border-transparent text-text-muted hover:text-text-base hover:border-primary/40 hover:bg-bg-elevated'
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
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
    <aside className="w-56 h-full flex flex-col relative" style={{background: '#161210', borderRight: '1px solid rgba(100,60,35,0.5)'}}>
      {/* Glow line */}
      <div className="absolute right-0 top-0 bottom-0 w-px sidebar-glow-line" />

      {/* Logo */}
      <div className="px-4 py-4" style={{borderBottom: '1px solid rgba(100,60,35,0.4)'}}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center" style={{border: '1px solid rgba(196,75,42,0.5)', background: 'rgba(196,75,42,0.08)'}}>
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="text-sm font-bold neon-text tracking-widest uppercase">GGPanel</span>
            <p className="text-text-dim text-xs tracking-wider uppercase" style={{fontSize:'0.55rem'}}>Management UI</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5">
        <p className="section-label px-4 mb-3">Navigation</p>
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
      <div className="p-3" style={{borderTop: '1px solid rgba(100,60,35,0.4)'}}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold tracking-widest uppercase border-l-2 border-transparent text-text-muted hover:text-danger hover:border-danger hover:bg-danger/8 transition-all duration-100 btn-hover"
        >
          <LogOut className="w-3.5 h-3.5" />
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
