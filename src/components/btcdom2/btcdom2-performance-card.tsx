'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface BTCDOM2PerformanceCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

export function BTCDOM2PerformanceCard({ 
  title, 
  value, 
  icon: Icon, 
  trend = 'neutral',
  description 
}: BTCDOM2PerformanceCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getIconColor = () => {
    switch (trend) {
      case 'positive':
        return 'text-green-500';
      case 'negative':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${getIconColor()}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getTrendColor()}`}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}