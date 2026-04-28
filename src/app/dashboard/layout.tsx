import { Sidebar } from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-base bg-grid">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-5 lg:p-7">
          {children}
        </div>
      </main>
    </div>
  )
}
