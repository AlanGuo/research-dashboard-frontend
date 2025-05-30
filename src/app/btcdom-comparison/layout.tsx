import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BTCDOM策略对比',
  description: '对比自制BTCDOM策略与币安BTCDOM合约的表现',
}

export default function BtcDomComparisonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}