'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BtcDomPerformanceMetrics } from '@/types/btcdom';
import { formatPercentage, formatNumber } from '@/lib/btcdom-utils';

interface PerformanceMetricsProps {
  strategyMetrics: BtcDomPerformanceMetrics | null;
  binanceMetrics: BtcDomPerformanceMetrics | null;
  loading: boolean;
}

export function PerformanceMetrics({ strategyMetrics, binanceMetrics, loading }: PerformanceMetricsProps) {
  const getPerformanceBadge = (strategyValue: number | undefined, binanceValue: number | undefined, reverseComparison: boolean = false) => {
    if (strategyValue === undefined || binanceValue === undefined) return null;

    const isStrategyBetter = reverseComparison ? strategyValue < binanceValue : strategyValue > binanceValue;
    return (
      <Badge 
        variant={isStrategyBetter ? "default" : "secondary"} 
        className={`ml-2 text-xs ${
          isStrategyBetter 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        }`}
      >
        {isStrategyBetter ? "策略胜出" : "币安胜出"}
      </Badge>
    );
  };

  const getValueColorClass = (value: number | undefined) => {
    if (value === undefined || value === null) return 'text-foreground';
    const isPositive = value >= 0;
    
    if (isPositive) {
      return 'text-green-600 dark:text-green-400 font-medium';
    } else {
      return 'text-rose-600 dark:text-rose-400 font-medium';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>性能指标对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
            <span className="ml-2 text-muted-foreground">计算性能指标中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!strategyMetrics && !binanceMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>性能指标对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">暂无性能数据</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>性能指标对比</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* 总收益率 */}
          <div className="space-y-3">
            <div className="flex items-center">
              <h4 className="font-semibold text-sm">总收益率</h4>
              {getPerformanceBadge(strategyMetrics?.totalReturn, binanceMetrics?.totalReturn)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">自制策略:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(strategyMetrics?.totalReturn)}`}>
                  {strategyMetrics?.totalReturn !== undefined 
                    ? formatPercentage(strategyMetrics.totalReturn) 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">币安合约:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(binanceMetrics?.totalReturn)}`}>
                  {binanceMetrics?.totalReturn !== undefined 
                    ? formatPercentage(binanceMetrics.totalReturn) 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 夏普比率 */}
          <div className="space-y-3">
            <div className="flex items-center">
              <h4 className="font-semibold text-sm">夏普比率</h4>
              {getPerformanceBadge(strategyMetrics?.sharpeRatio, binanceMetrics?.sharpeRatio)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">自制策略:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(strategyMetrics?.sharpeRatio)}`}>
                  {strategyMetrics?.sharpeRatio !== undefined 
                    ? formatNumber(strategyMetrics.sharpeRatio, 3) 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">币安合约:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(binanceMetrics?.sharpeRatio)}`}>
                  {binanceMetrics?.sharpeRatio !== undefined 
                    ? formatNumber(binanceMetrics.sharpeRatio, 3) 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 最大回撤 */}
          <div className="space-y-3">
            <div className="flex items-center">
              <h4 className="font-semibold text-sm">最大回撤</h4>
              {getPerformanceBadge(binanceMetrics?.maxDrawdown, strategyMetrics?.maxDrawdown, true)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">自制策略:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(strategyMetrics?.maxDrawdown)}`}>
                  {strategyMetrics?.maxDrawdown !== undefined 
                    ? formatPercentage(-Math.abs(strategyMetrics.maxDrawdown)) 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">币安合约:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(binanceMetrics?.maxDrawdown)}`}>
                  {binanceMetrics?.maxDrawdown !== undefined 
                    ? formatPercentage(-Math.abs(binanceMetrics.maxDrawdown)) 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 胜率 */}
          <div className="space-y-3">
            <div className="flex items-center">
              <h4 className="font-semibold text-sm">胜率</h4>
              {getPerformanceBadge(strategyMetrics?.winRate, binanceMetrics?.winRate)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">自制策略:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(strategyMetrics?.winRate)}`}>
                  {strategyMetrics?.winRate !== undefined 
                    ? formatPercentage(strategyMetrics.winRate) 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">币安合约:</span>
                <span className={`text-sm font-semibold ${getValueColorClass(binanceMetrics?.winRate)}`}>
                  {binanceMetrics?.winRate !== undefined 
                    ? formatPercentage(binanceMetrics.winRate) 
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 说明文字 */}
        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground space-y-1">
          <p>• <span className="text-green-600 dark:text-green-400">绿色数字</span>表示有利指标，<span className="text-red-600 dark:text-red-400">红色数字</span>表示不利指标</p>
          <p>• 夏普比率：衡量单位风险的超额收益，数值越高越好</p>
          <p>• 最大回撤：从峰值到谷值的最大跌幅，数值越小越好</p>
        </div>
      </CardContent>
    </Card>
  );
}