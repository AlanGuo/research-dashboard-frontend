'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, TrendingDown, Calendar, MousePointer } from 'lucide-react';
import { StrategySnapshot } from '@/types/btcdom2';

interface PnlTrendSegment {
  type: 'profit' | 'loss';
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  startPeriod: number;
  endPeriod: number;
  totalPnl: number;
  avgPnl: number;
  periods: number;
}

interface PnlTrendAnalysisProps {
  snapshots: StrategySnapshot[];
  onJumpToPeriod: (index: number) => void;
}

export const PnlTrendAnalysis: React.FC<PnlTrendAnalysisProps> = ({
  snapshots,
  onJumpToPeriod
}) => {
  const [dataSource, setDataSource] = useState<'totalPnl' | 'periodPnl'>('totalPnl');
  const [minConsecutivePeriods, setMinConsecutivePeriods] = useState(3);

  // 格式化时间（使用UTC+0时区）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  // 格式化金额
  const formatAmount = (amount: number): string => {
    const sign = amount > 0 ? '+' : '';
    return `${sign}$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 分析盈亏趋势
  const trendSegments = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    const segments: PnlTrendSegment[] = [];
    let currentSegment: Partial<PnlTrendSegment> | null = null;

    snapshots.forEach((snapshot, index) => {
      const pnlValue = dataSource === 'totalPnl' ? snapshot.totalPnl : snapshot.periodPnl;
      const isProfit = pnlValue > 0;
      const segmentType = isProfit ? 'profit' : 'loss';

      if (!currentSegment || currentSegment.type !== segmentType) {
        // 结束当前段并开始新段
        if (currentSegment && (currentSegment as PnlTrendSegment).periods >= minConsecutivePeriods) {
          segments.push(currentSegment as PnlTrendSegment);
        }

        currentSegment = {
          type: segmentType,
          startIndex: index,
          endIndex: index,
          startDate: snapshot.timestamp,
          endDate: snapshot.timestamp,
          startPeriod: index + 1,
          endPeriod: index + 1,
          totalPnl: pnlValue,
          periods: 1
        };
      } else {
        // 继续当前段
        currentSegment.endIndex = index;
        currentSegment.endDate = snapshot.timestamp;
        currentSegment.endPeriod = index + 1;
        currentSegment.totalPnl = (currentSegment.totalPnl || 0) + pnlValue;
        currentSegment.periods = (currentSegment.periods || 0) + 1;
      }
    });

    // 处理最后一段
    if (currentSegment && (currentSegment as PnlTrendSegment).periods >= minConsecutivePeriods) {
      segments.push(currentSegment as PnlTrendSegment);
    }

    // 计算平均盈亏
    segments.forEach(segment => {
      segment.avgPnl = segment.totalPnl / segment.periods;
    });

    return segments;
  }, [snapshots, dataSource, minConsecutivePeriods]);

  // 统计信息
  const stats = useMemo(() => {
    const profitSegments = trendSegments.filter(s => s.type === 'profit');
    const lossSegments = trendSegments.filter(s => s.type === 'loss');

    return {
      totalSegments: trendSegments.length,
      profitSegments: profitSegments.length,
      lossSegments: lossSegments.length,
      longestProfitStreak: profitSegments.length > 0 ? Math.max(...profitSegments.map(s => s.periods)) : 0,
      longestLossStreak: lossSegments.length > 0 ? Math.max(...lossSegments.map(s => s.periods)) : 0,
      totalProfitPeriods: profitSegments.reduce((sum, s) => sum + s.periods, 0),
      totalLossPeriods: lossSegments.reduce((sum, s) => sum + s.periods, 0)
    };
  }, [trendSegments]);

  const handleSegmentClick = (segment: PnlTrendSegment) => {
    onJumpToPeriod(segment.startIndex);
  };

  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          盈亏趋势分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 控制面板 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="dataSource">数据源</Label>
            <select 
              value={dataSource} 
              onChange={(e) => setDataSource(e.target.value as 'totalPnl' | 'periodPnl')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="totalPnl">总盈亏</option>
              <option value="periodPnl">当期盈亏</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minPeriods">最小连续期数: {minConsecutivePeriods}</Label>
            <Slider
              value={[minConsecutivePeriods]}
              onValueChange={([value]) => setMinConsecutivePeriods(value)}
              min={2}
              max={10}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400">连续段数</div>
            <div className="text-lg font-semibold">{stats.totalSegments}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400">盈利段数</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.profitSegments}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <div className="text-sm text-red-600 dark:text-red-400">亏损段数</div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">{stats.lossSegments}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-sm text-blue-600 dark:text-blue-400">最长连续</div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {Math.max(stats.longestProfitStreak, stats.longestLossStreak)}期
            </div>
          </div>
        </div>

        {/* 时间轴 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MousePointer className="w-4 h-4" />
            点击时间段可跳转到对应期数
          </div>
          
          {trendSegments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              未找到符合条件的连续趋势段（最小{minConsecutivePeriods}期）
            </div>
          ) : (
            <div className="space-y-2">
              {trendSegments.map((segment, index) => (
                <div
                  key={index}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md
                    ${segment.type === 'profit' 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                    }
                  `}
                  onClick={() => handleSegmentClick(segment)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {segment.type === 'profit' ? (
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <div className={`font-semibold ${
                          segment.type === 'profit' 
                            ? 'text-green-700 dark:text-green-400' 
                            : 'text-red-700 dark:text-red-400'
                        }`}>
                          连续{segment.type === 'profit' ? '盈利' : '亏损'} {segment.periods} 期
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          第{segment.startPeriod}期 ~ 第{segment.endPeriod}期
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${
                        segment.type === 'profit' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {dataSource === 'totalPnl' ? '累计' : '总计'}: {formatAmount(segment.totalPnl)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        平均: {formatAmount(segment.avgPnl)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {formatPeriodTime(segment.startDate)} ~ {formatPeriodTime(segment.endDate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};