"use client"

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const dashboards = [
    {
      title: '全球流动性',
      description: '监控来自各国央行和货币供应的全球流动性数据',
      href: '/gli',
      icon: '📈'
    },
    // {
    //   title: 'BTCDOM策略对比',
    //   description: '对比自制BTCDOM策略与币安BTCDOM合约的表现',
    //   href: '/btcdom-comparison',
    //   icon: '₿'
    // },
    {
      title: 'BTCDOM2.0',
      description: '基于成交量排行榜和波动率的动态做空策略',
      href: '/btcdom2',
      icon: '🚀'
    },
    // 可以在这里添加更多仪表盘
  ]

  return (
    <div className="container mx-auto p-6 max-w-[1920px]">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {dashboards.map((dashboard) => (
            <Link href={dashboard.href} key={dashboard.href} className="block group">
              <Card className="h-full transition-all duration-200 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{dashboard.icon}</span>
                    <CardTitle>{dashboard.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{dashboard.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
