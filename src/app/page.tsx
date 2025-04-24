"use client"

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const dashboards = [
    {
      title: '全球流动性指数',
      description: '监控来自各国央行和货币供应的全球流动性数据',
      href: '/gli',
      icon: '📈'
    },
    // 可以在这里添加更多仪表盘
  ]

  return (
    <div className="container mx-auto py-12">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">研究仪表盘</h1>
          <p className="text-muted-foreground">金融市场数据分析与可视化工具</p>
        </div>

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
