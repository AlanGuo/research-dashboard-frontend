import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '全球流动性指数',
  description: '监控来自各国央行和货币供应的全球流动性数据'
};

export default function GliLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
