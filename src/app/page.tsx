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
    <div className="flex flex-col justify-center items-center py-4 space-y-2 h-[50vh]">
      <div className="h-10 w-10 border-t-2 border-blue-500 rounded-full animate-spin"></div>
      <p className="text-sm text-muted-foreground mt-2">加载数据中...</p>
    </div>
  )
}
