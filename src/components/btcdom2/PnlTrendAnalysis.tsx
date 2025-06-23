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
import { TrendingUp, MousePointer } from 'lucide-react';
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
  onJumpToPeriod: (periodNumber: number) => void; // 期数（从1开始）
  initialCapital: number;
}

export const PnlTrendAnalysis: React.FC<PnlTrendAnalysisProps> = ({
  snapshots,
  onJumpToPeriod
}) => {
  const [dataSource, setDataSource] = useState<'totalPnl' | 'periodPnl'>('periodPnl');
  const [minConsecutivePeriods, setMinConsecutivePeriods] = useState(3);

  // 格式化时间（月-日）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
  };

  // 获取年份
  const getYear = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.getUTCFullYear().toString();
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
    // 传递期数（从1开始）- 跳转到连续盈利或亏损段的首期
    onJumpToPeriod(segment.startPeriod);
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

        {/* 横向时间轴 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointer className="w-3 h-3" />
            点击时间段可跳转到对应期数
          </div>

          {trendSegments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              未找到符合条件的连续趋势段（最小{minConsecutivePeriods}期）
            </div>
          ) : (
            <div className="space-y-3">
              {/* 时间段标题 */}
              <div className="text-sm font-medium text-muted-foreground">
                时间段（可横向滚动）：
              </div>

              {/* 横向滚动容器 */}
              <div className="overflow-x-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="relative">
                  {/* 卡片容器 */}
                  <div className="flex gap-2 min-w-max">
                    {trendSegments.map((segment, index) => {
                      // 固定卡片宽度，使其更窄
                      const segmentWidth = 140;

                      return (
                        <Card
                          key={index}
                          className={`
                            cursor-pointer transition-all duration-200 hover:shadow-md flex-shrink-0
                            border-2 hover:scale-[1.02]
                            ${segment.type === 'profit'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                            }
                          `}
                          style={{ width: `${segmentWidth}px` }}
                          onClick={() => handleSegmentClick(segment)}
                        >
                          <CardContent className="p-3">
                            {/* 垂直排列的内容 */}
                            <div className="space-y-2">
                              {/* 时间范围（不包含年份） */}
                              <div className="text-center">
                                <div className="text-xs font-semibold text-foreground">
                                  {(() => {
                                    if (segment.startDate === segment.endDate) {
                                      return formatPeriodTime(segment.startDate);
                                    }
                                    return `${formatPeriodTime(segment.startDate)}~${formatPeriodTime(segment.endDate)}`;
                                  })()}
                                </div>
                              </div>

                              {/* 连续期数 */}
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">
                                  {segment.periods}期
                                </div>
                              </div>

                              {/* 总金额 */}
                              <div className="text-center">
                                <div className={`text-xs font-bold ${
                                  segment.type === 'profit'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {formatAmountWithPercent(segment.totalPnl, snapshots[segment.startIndex])}
                                </div>
                              </div>

                              {/* 平均金额 */}
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">
                                  平均: {formatAmount(segment.avgPnl)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* 年份时间轴（底部） */}
                  <div className="flex gap-4 min-w-max relative">
                    {(() => {
                      // 计算每年第一张卡片的位置
                      const yearMarkers: { year: string; left: number }[] = [];
                      let currentLeft = 0;
                      let lastYear = '';

                      trendSegments.forEach((segment, index) => {
                        const segmentWidth = 140;
                        const gap = index > 0 ? 16 : 0; // 16px = gap-4
                        const startYear = getYear(segment.startDate);

                        // 如果是新的年份，记录位置
                        if (startYear !== lastYear) {
                          yearMarkers.push({
                            year: startYear,
                            left: currentLeft + gap
                          });
                          lastYear = startYear;
                        }

                        currentLeft += gap + segmentWidth;
                      });

                      return yearMarkers.map((marker, index) => (
                        <div
                          key={index}
                          className="absolute bottom-0 flex items-center"
                          style={{
                            left: `${marker.left}px`,
                            height: '20px'
                          }}
                        >
                          <div className="text-xs text-muted-foreground font-medium bg-background/80 px-2 py-1 rounded border">
                            {marker.year}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* 年份快速跳转 */}
              <div>
                <div className="grid grid-cols-auto-fit gap-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))' }}>
                  {(() => {
                    // 获取所有唯一年份
                    const uniqueYears = Array.from(new Set(
                      trendSegments.map(segment => getYear(segment.startDate))
                    )).sort();

                    return uniqueYears.map(year => (
                      <button
                        key={year}
                        className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                                 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30
                                 transition-colors duration-200 text-center"
                        onClick={() => {
                          // 找到该年份第一张卡片的位置并滚动
                          const firstSegmentOfYear = trendSegments.find(segment =>
                            getYear(segment.startDate) === year
                          );
                          if (firstSegmentOfYear) {
                            const segmentIndex = trendSegments.indexOf(firstSegmentOfYear);
                            const segmentWidth = 140;
                            const gap = 16; // gap-4 = 16px
                            const scrollLeft = segmentIndex * (segmentWidth + gap);

                            // 平滑滚动到目标位置
                            const scrollContainer = document.querySelector('.overflow-x-scroll') as HTMLElement;
                            if (scrollContainer) {
                              scrollContainer.scrollTo({
                                left: scrollLeft,
                                behavior: 'smooth'
                              });
                            }
                          }
                        }}
                      >
                        {year}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* 说明文字 */}
              <div className="text-xs text-muted-foreground text-center">
                绿色卡片表示连续盈利期，红色卡片表示连续亏损期
              </div>

            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
