'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  StrategySnapshot,
  BTCDOM2StrategyParams
} from '@/types/btcdom2';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  AlertTriangle,
  Plus,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface BTCDOM2PositionTableProps {
  snapshot: StrategySnapshot;
  params?: BTCDOM2StrategyParams;
}

export function BTCDOM2PositionTable({ snapshot, params }: BTCDOM2PositionTableProps) {
  if (!snapshot) {
    return (
      <div className="text-center py-8">
        <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">暂无持仓数据</p>
      </div>
    );
  }

  // 格式化金额
  // 格式化货币
  const formatCurrency = (amount: number | null) => {
    const validAmount = amount ?? 0;

    // 对于小于 1 美元的价格，使用更多小数位
    if (Math.abs(validAmount) < 1) {
      // 找到第一个非零小数位，然后显示4位有效数字
      const str = validAmount.toString();
      if (str.includes('e')) {
        // 处理科学计数法
        return `$${validAmount.toFixed(8).replace(/\.?0+$/, '')}`;
      } else {
        // 显示最多8位小数，但去除尾随的0
        return `$${validAmount.toFixed(8).replace(/\.?0+$/, '')}`;
      }
    }

    // 对于大于等于 1 美元的价格，使用标准格式
    return `$${validAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 格式化百分比
  const formatPercent = (value: number | null) => {
    const validValue = value ?? 0;
    return `${(validValue * 100).toFixed(2)}%`;
  };

  // 计算资金费率盈亏
  const calculateFundingPnL = (position: any): number => {
    if (position.side !== 'SHORT') {
      return 0;
    }
    if (position.symbol === "ICXUSDT") {
      console.log(position)
    }
    // 如果已经有计算好的资金费，直接使用
    return position.fundingFee ?? 0;
  };

  // 获取当前资金费率（累加所有历史资金费率）
  const getCurrentFundingRate = (position: any): number => {
    if (!position.fundingRateHistory || position.fundingRateHistory.length === 0) {
      return 0;
    }
    // 累加所有资金费率
    return position.fundingRateHistory.reduce((sum: number, funding: any) => {
      return sum + (funding.fundingRate || 0);
    }, 0);
  };

  // 获取盈亏颜色
  const getPnlColor = (pnl: number | null) => {
    const validPnl = pnl ?? 0;
    if (validPnl > 0) return 'text-green-600';
    if (validPnl < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // 合并所有持仓（包括卖出的持仓），根据策略选择过滤
  const allPositions = [
    // 只在选择做多BTC时显示BTC持仓
    ...(!params || params.longBtc ? (snapshot.btcPosition ? [{ ...snapshot.btcPosition, type: 'BTC' as const }] : []) : []),
    // 只在选择做空ALT时显示做空持仓
    ...(!params || params.shortAlt ? snapshot.shortPositions.map(pos => ({ ...pos, type: 'SHORT' as const })) : []),
    // 卖出的持仓需要根据其原始类型来决定是否显示
    ...(snapshot.soldPositions || [])
      .filter(pos => {
        if (!params) return true;
        // 如果是BTC相关的卖出持仓，只在选择做多BTC时显示
        if (pos.symbol === 'BTC' || pos.side === 'LONG') {
          return params.longBtc;
        }
        // 如果是做空相关的卖出持仓，只在选择做空ALT时显示
        return params.shortAlt;
      })
      .map(pos => ({ ...pos, type: 'SOLD' as const }))
  ];

  // 计算总投资金额用于百分比计算
  const totalInvestedAmount = allPositions.reduce((sum, pos) => {
    // 只计算当前持仓的金额，不包括已卖出的持仓
    if (pos.type !== 'SOLD') {
      return sum + Math.abs(pos.amount);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">总资产</p>
          <p className="text-lg font-semibold">{formatCurrency(snapshot.totalValue)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">总盈亏</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.totalPnl)}`}>
            {formatCurrency(snapshot.totalPnl)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">总收益率</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.totalPnl)}`}>
            {formatPercent(snapshot.totalPnlPercent)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">当期盈亏</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.periodPnl || 0)}`}>
            {formatCurrency(snapshot.periodPnl || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">当期收益率</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.periodPnlPercent || 0)}`}>
            {formatPercent(snapshot.periodPnlPercent || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">当期手续费</p>
          <p className="text-lg font-semibold text-orange-600">
            {formatCurrency(snapshot.totalTradingFee || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">累计手续费</p>
          <p className="text-lg font-semibold text-orange-700">
            {formatCurrency(snapshot.accumulatedTradingFee || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">当期资金费</p>
          <p className="text-lg font-semibold text-purple-600">
            {formatCurrency(snapshot.totalFundingFee || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">累计资金费</p>
          <p className="text-lg font-semibold text-purple-700">
            {formatCurrency(snapshot.accumulatedFundingFee || 0)}
          </p>
        </div>
      </div>

      {/* 持仓列表 */}
      {allPositions.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>资产</TableHead>
                <TableHead>方向</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">手续费</TableHead>
                <TableHead className="text-right">资金费</TableHead>
                <TableHead className="text-right">24H涨跌</TableHead>
                <TableHead className="text-right">价格</TableHead>
                <TableHead className="text-right">本期盈亏</TableHead>
                <TableHead className="text-right">本期收益率</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPositions.map((position, index) => (
                <TableRow key={`${position.symbol}-${index}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {position.type === 'BTC' ? (
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          ₿
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {position.symbol.slice(0, 2)}
                        </div>
                      )}
                      <span>{position.symbol}</span>
                      {position.isNewPosition && !position.isSoldOut && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                          <Plus className="w-3 h-3 mr-1" />
                          新增
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        position.type === 'SOLD' ? "secondary" :
                        position.side === 'LONG' ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      {position.type === 'SOLD' ? (
                        <>
                          <Minus className="w-3 h-3 mr-1" />
                          卖出
                        </>
                      ) : position.side === 'LONG' ? (
                        <>
                          <TrendingUp className="w-3 h-3 mr-1" />
                          做多
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3 h-3 mr-1" />
                          做空
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex flex-col">
                      <span>{formatCurrency(position.amount)}</span>
                      {position.type !== 'SOLD' && totalInvestedAmount > 0 && (
                        <span className="text-xs text-gray-500">
                          ({((Math.abs(position.amount ?? 0) / Math.max(totalInvestedAmount, 1)) * 100).toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>
                        {position.quantity.toLocaleString(undefined, {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4
                        })}
                      </span>
                      {position.quantityChange && (
                        <>
                          {position.quantityChange.type === 'new' && !position.isSoldOut && (
                            <div title="新增持仓">
                              <Plus className="w-3 h-3 text-blue-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'increase' && (
                            <div title={`增加 ${(position.quantityChange.changePercent ?? 0).toFixed(2)}%`}>
                              <ArrowUp className="w-3 h-3 text-green-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'decrease' && (
                            <div title={`减少 ${Math.abs(position.quantityChange.changePercent || 0).toFixed(2)}%`}>
                              <ArrowDown className="w-3 h-3 text-red-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'sold' && (
                            <div title="卖出">
                              <Minus className="w-3 h-3 text-gray-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'same' && (
                            <div title="数量无变化">
                              <Minus className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                        </>
                      )}
                      {position.isNewPosition && !position.quantityChange && !position.isSoldOut && (
                        <div title="新增持仓">
                          <Plus className="w-3 h-3 text-blue-500" />
                        </div>
                      )}
                      {position.isSoldOut && !position.quantityChange && (
                        <div title="卖出">
                          <Minus className="w-3 h-3 text-gray-500" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    {formatCurrency(position.tradingFee || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.side === 'SHORT' ? (
                      <div className="text-right">
                        <div className={`font-medium ${calculateFundingPnL(position) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {calculateFundingPnL(position) === 0 ? 
                            <span className="text-gray-400">$0.00</span> : 
                            formatCurrency(calculateFundingPnL(position))
                          }
                        </div>
                        <div className="text-xs text-gray-500">
                          {position.isNewPosition ? (
                            <div className="flex flex-col">
                              <span className="text-blue-600">新开仓</span>
                              {getCurrentFundingRate(position) !== 0 && (
                                <span className={getCurrentFundingRate(position) > 0 ? 'text-green-600' : 'text-red-600'}>
                                  费率: {(getCurrentFundingRate(position) * 100).toFixed(4)}%
                                </span>
                              )}
                            </div>
                          ) : getCurrentFundingRate(position) !== 0 ? (
                            <span className={getCurrentFundingRate(position) > 0 ? 'text-green-600' : 'text-red-600'}>
                              费率: {(getCurrentFundingRate(position) * 100).toFixed(4)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">无数据</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* 优先使用专门的24H价格变化数据 */}
                    {position.priceChange24h !== undefined ? (
                      <span className={`font-medium ${
                        position.priceChange24h > 0 ? 'text-green-600' : 
                        position.priceChange24h < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {position.priceChange24h > 0 ? '+' : ''}
                        {position.priceChange24h.toFixed(2)}%
                      </span>
                    ) : position.type === 'BTC' && snapshot.btcPriceChange24h !== undefined ? (
                      <span className={`font-medium ${
                        snapshot.btcPriceChange24h > 0 ? 'text-green-600' : 
                        snapshot.btcPriceChange24h < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {snapshot.btcPriceChange24h > 0 ? '+' : ''}
                        {snapshot.btcPriceChange24h.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col">
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(position.currentPrice)}</span>
                      </div>
                      {/* 显示相对于上一期价格的变化率 */}
                      {position.priceChange?.previousPrice && position.priceChange.previousPrice > 0 && position.currentPrice !== position.priceChange.previousPrice ? (
                        <span className={`text-xs ${
                          position.currentPrice > position.priceChange.previousPrice 
                            ? 'text-green-600' 
                            : position.currentPrice < position.priceChange.previousPrice 
                            ? 'text-red-600' 
                            : 'text-gray-500'
                        }`}>
                          ({position.currentPrice > position.priceChange.previousPrice ? '+' : ''}
                          {(((position.currentPrice - position.priceChange.previousPrice) / position.priceChange.previousPrice) * 100).toFixed(2)}%)
                        </span>
                      ) : position.entryPrice && position.entryPrice > 0 && position.currentPrice !== position.entryPrice && !position.isNewPosition ? (
                        <span className={`text-xs ${
                          position.currentPrice > position.entryPrice 
                            ? 'text-green-600' 
                            : position.currentPrice < position.entryPrice 
                            ? 'text-red-600' 
                            : 'text-gray-500'
                        }`}>
                          ({position.currentPrice > position.entryPrice ? '+' : ''}
                          {(((position.currentPrice - position.entryPrice) / position.entryPrice) * 100).toFixed(2)}%)
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getPnlColor(position.pnl)}`}>
                    {formatCurrency(position.pnl)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getPnlColor(position.pnl)}`}>
                    {formatPercent(position.pnlPercent)}
                  </TableCell>
                  <TableCell className="max-w-32">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words" title={position.reason}>
                      {position.reason?.replace(/\(/g, '\n(')}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">当前无持仓</p>
          <p className="text-sm text-muted-foreground mt-1">
            {snapshot.rebalanceReason}
          </p>
        </div>
      )}

      {/* 现金持仓 */}
      {snapshot.cashPosition > 0 && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">现金持仓</span>
            </div>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(snapshot.cashPosition)}
            </span>
          </div>
          <p className="text-sm text-green-700 mt-2">
            {snapshot.rebalanceReason}
          </p>
        </div>
      )}

      {/* 做空候选标的详情 */}
      {snapshot.shortCandidates && snapshot.shortCandidates.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">做空候选标的评分详情(前10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标的</TableHead>
                    <TableHead className="text-right">排名</TableHead>
                    <TableHead className="text-right">24h涨跌</TableHead>
                    <TableHead className="text-right">跌幅分数</TableHead>
                    <TableHead className="text-right">成交量分数</TableHead>
                    <TableHead className="text-right">波动率分数</TableHead>
                    <TableHead className="text-right">综合分数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.shortCandidates.slice(0, 10).map((candidate) => (
                    <TableRow key={candidate.symbol}>
                      <TableCell className="font-medium">{candidate.symbol}</TableCell>
                      <TableCell className="text-right">{candidate.rank}</TableCell>
                      <TableCell className={`text-right ${(candidate.priceChange24h ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(candidate.priceChange24h ?? 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">{(candidate.priceChangeScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{(candidate.volumeScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{(candidate.volatilityScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right font-medium">{(candidate.totalScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge variant={candidate.eligible ? "default" : "secondary"} className="text-xs">
                          {candidate.eligible ? "已选择" : "已排除"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="text-xs text-muted-foreground" title={candidate.reason}>
                          {candidate.eligible ? (
                            <span>已选择</span>
                          ) : (
                            <div className="space-y-1">
                              {candidate.reason?.includes('涨幅过大') && (
                                <div className="text-red-600">24h涨幅过大 ({(candidate.priceChange24h ?? 0).toFixed(2)}%)</div>
                              )}
                              {candidate.reason?.includes('成交量不足') && (
                                <div className="text-orange-600">成交量不足</div>
                              )}
                              {candidate.reason?.includes('波动率过高') && (
                                <div className="text-purple-600">波动率过高</div>
                              )}
                              {candidate.reason?.includes('综合分数不足') && (
                                <div className="text-gray-600">综合分数不足 ({(candidate.totalScore ?? 0).toFixed(3)})</div>
                              )}
                              {candidate.reason?.includes('超出数量限制') && (
                                <div className="text-blue-600">超出最大做空数量</div>
                              )}
                              {candidate.reason && !candidate.reason.includes('涨幅过大') &&
                               !candidate.reason.includes('成交量不足') &&
                               !candidate.reason.includes('波动率过高') &&
                               !candidate.reason.includes('综合分数不足') &&
                               !candidate.reason.includes('超出数量限制') && (
                                <div className="text-gray-600">{candidate.reason}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
