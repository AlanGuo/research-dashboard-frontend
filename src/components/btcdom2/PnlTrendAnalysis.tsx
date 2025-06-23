'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  initialCapital: number;
}

export const PnlTrendAnalysis: React.FC<PnlTrendAnalysisProps> = ({
  snapshots,
  onJumpToPeriod,
  initialCapital
}) => {
  const [dataSource, setDataSource] = useState<'totalPnl' | 'periodPnl'>('periodPnl');
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

  // 格式化金额和百分比的组合显示（相对于起始资金总额）
  const formatAmountWithPercent = (amount: number, startSnapshot: StrategySnapshot): string => {
    // 获取起始日的资金总额
    const startTotalValue = startSnapshot.totalValue;
    const percent = (amount / startTotalValue) * 100;
    
    // 对于金额，负号放在$符号前面
    let formattedAmount;
    if (amount > 0) {
      formattedAmount = `+$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (amount < 0) {
      formattedAmount = `-$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      formattedAmount = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // 对于百分比，如果是正数加+号，负数保持-号
    const percentSign = percent > 0 ? '+' : '';
    const formattedPercent = `${percentSign}${percent.toFixed(2)}%`;

    return `${formattedAmount} (${formattedPercent})`;
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
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-4 h-4" />
          盈亏趋势分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 控制面板 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="dataSource" className="text-xs">数据源</Label>
            <Select value={dataSource} onValueChange={(value: 'totalPnl' | 'periodPnl') => setDataSource(value)}>
              <SelectTrigger className="w-full h-8">
                <SelectValue placeholder="选择数据源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totalPnl">总盈亏</SelectItem>
                <SelectItem value="periodPnl">当期盈亏</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="minPeriods" className="text-xs">最小连续期数: {minConsecutivePeriods}</Label>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card className="border-none shadow-none bg-muted/30">
            <CardContent className="p-2">
              <div className="text-xs text-muted-foreground">连续段数</div>
              <div className="text-sm font-semibold">{stats.totalSegments}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-none bg-green-50 dark:bg-green-900/10">
            <CardContent className="p-2">
              <div className="text-xs text-green-600 dark:text-green-400">盈利段数</div>
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">{stats.profitSegments}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-none bg-red-50 dark:bg-red-900/10">
            <CardContent className="p-2">
              <div className="text-xs text-red-600 dark:text-red-400">亏损段数</div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">{stats.lossSegments}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-none bg-blue-50 dark:bg-blue-900/10">
            <CardContent className="p-2">
              <div className="text-xs text-blue-600 dark:text-blue-400">最长连续</div>
              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {Math.max(stats.longestProfitStreak, stats.longestLossStreak)}期
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 时间轴 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointer className="w-3 h-3" />
            点击时间段可跳转到对应期数
          </div>
          
          {trendSegments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              未找到符合条件的连续趋势段（最小{minConsecutivePeriods}期）
            </div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
              {trendSegments.map((segment, index) => (
                <Card
                  key={index}
                  className={`
                    cursor-pointer transition-all duration-200 hover:shadow-sm border
                    ${segment.type === 'profit' 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                    }
                  `}
                  onClick={() => handleSegmentClick(segment)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {segment.type === 'profit' ? (
                          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={`font-medium text-sm ${
                            segment.type === 'profit' 
                              ? 'text-green-700 dark:text-green-400' 
                              : 'text-red-700 dark:text-red-400'
                          }`}>
                            连续{segment.type === 'profit' ? '盈利' : '亏损'} {segment.periods} 期
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            第{segment.startPeriod}期 ~ 第{segment.endPeriod}期
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-semibold text-sm ${
                          segment.type === 'profit' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {dataSource === 'totalPnl' ? '累计' : '总计'}: {formatAmountWithPercent(segment.totalPnl, snapshots[segment.startIndex])}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          平均: {formatAmount(segment.avgPnl)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {formatPeriodTime(segment.startDate)} ~ {formatPeriodTime(segment.endDate)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};