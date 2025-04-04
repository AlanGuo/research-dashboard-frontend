"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // 检查URL中是否有hashtag
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash && hash.length > 1) {
        // 如果有hashtag，重定向到对应的用户页面
        const username = hash.substring(1)
        router.push(`/u/${username}`)
      } else {
        // 如果没有hashtag，重定向到默认用户页面
        router.push('/u/demo')
      }
    }
  }, [router])

  // 显示加载中状态，直到重定向完成
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="w-20 h-20 border-8 border-blue-500 border-t-transparent rounded-full animate-spin mb-6">
        <div className="w-16 h-16 border-8 border-blue-300 border-t-transparent rounded-full animate-spin absolute inset-[8px]"></div>
      </div>
      <p className="text-2xl font-semibold text-blue-600 animate-pulse">正在加载...</p>
    </div>
  )
}
