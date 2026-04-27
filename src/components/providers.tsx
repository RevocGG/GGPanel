'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        richColors
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(11, 20, 55, 0.95)',
            border: '1px solid rgba(34, 211, 238, 0.2)',
            color: '#E2E8F0',
          },
        }}
      />
    </QueryClientProvider>
  )
}
