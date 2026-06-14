'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <div className="h-64 flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-r-2 border-transparent"></div>
      <p className="text-xs text-zinc-500 font-medium">Navigating to Generate Proxies...</p>
    </div>
  )
}
