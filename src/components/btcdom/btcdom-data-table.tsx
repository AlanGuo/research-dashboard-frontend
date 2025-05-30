'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BtcDomComparisonData } from '@/types/btcdom';
import { formatDate, formatNumber, formatPercentage, formatCurrency } from '@/lib/btcdom-utils';

interface BtcDomDataTableProps {
  data: BtcDomComparisonData[];
  loading: boolean;
}

export function BtcDomDataTable({ data, loading }: BtcDomDataTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayData = showAll ? data : data.slice(0, 10);

  const getPerformanceBadge = (performanceDiff: number | null) => {
    if (performanceDiff === null || performanceDiff === undefined) return null;
    
    if (Math.abs(performanceDiff) < 0.01) return null; // 差异小于0.01%不显示
    
    return (
      <Badge 
        variant={performanceDiff > 0 ? "default" : "secondary"} 
        className={`ml-1 text-xs ${
          performanceDiff > 0 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}
      >
        {performanceDiff > 0 ? `+${performanceDiff.toFixed(2)}%` : `${performanceDiff.toFixed(2)}%`}
      </Badge>
    );
  };

  const getReturnColorClass = (returnValue: number | null) => {
    if (returnValue === null || returnValue === undefined) return '';
    return returnValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>策略交易记录详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
            <span className="ml-2 text-muted-foreground">数据加载中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>策略交易记录详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">暂无交易记录</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>策略交易记录详情</span>
          <div className="text-sm text-muted-foreground">
            显示 {displayData.length} / {data.length} 条记录
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">交易期间</th>
                <th className="text-right p-3 font-medium">初始金额</th>
                <th className="text-right p-3 font-medium">策略盈亏</th>
                <th className="text-right p-3 font-medium">策略收益率</th>
                <th className="text-right p-3 font-medium">币安BTCDOM.P开仓价</th>
                <th className="text-right p-3 font-medium">币安BTCDOM.P平仓价</th>
                <th className="text-right p-3 font-medium">币安BTCDOM.P收益率</th>
                <th className="text-center p-3 font-medium">表现差异</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, index) => (
                <tr 
                  key={`${row.openDate}-${row.closeDate}`}
                  className={`border-b hover:bg-muted/30 transition-colors ${
                    index % 2 === 0 ? 'bg-muted/10' : ''
                  }`}
                >
                  <td className="p-3">
                    <div className="text-sm font-medium">{formatDate(row.openDate)} - {formatDate(row.closeDate)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(() => {
                        const days = Math.ceil(
                          (new Date(row.closeDate).getTime() - new Date(row.openDate).getTime()) 
                          / (1000 * 60 * 60 * 24)
                        );
                        return `${days} 天`;
                      })()}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="text-sm font-mono">
                      {formatCurrency(row.strategyInitialAmount)}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className={`text-sm font-mono ${getReturnColorClass(row.strategyTotalPnl)}`}>
                      {row.strategyTotalPnl >= 0 ? '+' : ''}{formatCurrency(row.strategyTotalPnl)}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className={`text-sm font-mono font-medium ${getReturnColorClass(row.strategyReturn)}`}>
                      {row.strategyReturn >= 0 ? '+' : ''}{formatPercentage(row.strategyReturn)}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="text-sm font-mono">
                      {row.binanceOpenPrice !== null 
                        ? formatNumber(row.binanceOpenPrice, 2) 
                        : 'N/A'}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="text-sm font-mono">
                      {row.binanceClosePrice !== null 
                        ? formatNumber(row.binanceClosePrice, 2) 
                        : 'N/A'}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className={`text-sm font-mono font-medium ${getReturnColorClass(row.binanceReturn)}`}>
                      {row.binanceReturn !== null 
                        ? `${row.binanceReturn >= 0 ? '+' : ''}${formatPercentage(row.binanceReturn)}`
                        : 'N/A'}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {getPerformanceBadge(row.performanceDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length > 10 && (
          <div className="mt-4 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? '显示前10条' : '显示全部数据'}
            </Button>
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <p>• <span className="text-green-600 dark:text-green-400">绿色数字</span>表示正收益，<span className="text-red-600 dark:text-red-400">红色数字</span>表示负收益</p>
          <p>• 表现差异显示策略相对于币安合约的超额收益</p>
          <p>• 策略收益率计算：(总盈亏 + 初始金额) / 初始金额</p>
          <p>• 币安收益率计算：(平仓价格 - 开仓价格) / 开仓价格</p>
          <p>• 初始金额 = BTC仓位 × BTC初始价格 + ALT初始仓位(U)</p>
        </div>

        {/* 统计汇总 */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">总交易次数</div>
              <div className="font-semibold text-lg">{data.length}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">策略胜率</div>
              <div className="font-semibold text-lg">
                {((data.filter(d => d.strategyReturn > 0).length / data.length) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">币安胜率</div>
              <div className="font-semibold text-lg">
                {data.filter(d => d.binanceReturn !== null).length > 0
                  ? ((data.filter(d => d.binanceReturn !== null && d.binanceReturn! > 0).length / 
                      data.filter(d => d.binanceReturn !== null).length) * 100).toFixed(1) + '%'
                  : 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">策略优于币安</div>
              <div className="font-semibold text-lg">
                {data.filter(d => d.performanceDiff !== null).length > 0
                  ? ((data.filter(d => d.performanceDiff !== null && d.performanceDiff! > 0).length / 
                      data.filter(d => d.performanceDiff !== null).length) * 100).toFixed(1) + '%'
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}