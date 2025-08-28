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
  BTCDOM2StrategyParams,
  BTCDOM2BacktestResult
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
import { PriceComparisonTable } from './PriceComparisonTable';

interface BTCDOM2PositionTableProps {
  snapshot: StrategySnapshot;
  params?: BTCDOM2StrategyParams;
  periodNumber?: number; // 期数
  // totalPeriods removed as it's not used
  backtestResult?: BTCDOM2BacktestResult; // 完整的回测结果，用于获取盈亏分解数据
}

export function BTCDOM2PositionTable({ snapshot, params, periodNumber, backtestResult }: BTCDOM2PositionTableProps) {
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

    // 统一使用2位小数格式
    const formattedValue = `$${validAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 为正数添加 + 号
    return validAmount > 0 ? `+${formattedValue}` : formattedValue;
  };

  // 格式化百分比
  const formatPercent = (value: number | null) => {
    const validValue = value ?? 0;
    const percentValue = (validValue * 100).toFixed(2);
    return validValue > 0 ? `+${percentValue}%` : `${percentValue}%`;
  };

  // 格式化价格（不带正负号前缀）
  const formatPrice = (amount: number | null) => {
    const validAmount = amount ?? 0;
    return `$${validAmount}`;
  };

  // 格式化金额（不带正负号前缀）
  const formatAmount = (amount: number | null) => {
    const validAmount = amount ?? 0;
    return `$${Math.abs(validAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 工具函数：格式化时间（使用UTC+0时区）
  const formatPeriodTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')} ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  // 获取前一天的温度计数值显示和样式
  const getTemperatureDisplayInfo = (): { value: string; isHighTemperature: boolean } => {
    // 直接使用snapshot中的温度计数值（已经是前一天的数值）
    if (snapshot.temperatureValue !== null && snapshot.temperatureValue !== undefined) {
      const isHighTemperature = params?.temperatureThreshold !== undefined 
        ? snapshot.temperatureValue > params.temperatureThreshold 
        : false;
      
      return {
        value: snapshot.temperatureValue.toFixed(2),
        isHighTemperature
      };
    }
    
    return {
      value: "无数据",
      isHighTemperature: false
    };
  };

  // 计算和格式化交易数量
  const calculateTradingQuantity = (position: any) => {
    // 优先使用预计算的 tradingQuantity 字段
    if (position.tradingQuantity !== undefined) {
      const quantity = position.tradingQuantity;
      
      if (quantity === 0) {
        return { quantity: 0, display: '--', color: 'text-gray-400 dark:text-gray-500' };
      }
      
      // 根据持仓方向和交易数量确定显示
      let displayQuantity = quantity;
      // 对于做空，如果 tradingQuantity 为正数（买入/平仓），显示为正数绿色
      // 如果为负数（卖出/开仓），显示为负数红色
      
      const sign = displayQuantity > 0 ? '+' : '';
      const color = displayQuantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
      
      const display = `${sign}${displayQuantity.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      })}`;
      
      return { quantity: displayQuantity, display, color };
    }
    
    // 如果没有 tradingQuantity，回退到原来的计算逻辑
    if (!position.quantityChange && !position.isNewPosition && !position.isSoldOut) {
      return { quantity: 0, display: '--', color: 'text-gray-400 dark:text-gray-500' };
    }

    let tradingQuantity = 0;
    let isPositive = false;
    
    if (position.quantityChange) {
      switch (position.quantityChange.type) {
        case 'new':
          tradingQuantity = position.quantity;
          isPositive = position.side === 'LONG';
          break;
        case 'increase':
          if (position.quantityChange.previousQuantity !== undefined) {
            tradingQuantity = position.quantity - position.quantityChange.previousQuantity;
          } else {
            tradingQuantity = position.quantity;
          }
          isPositive = position.side === 'LONG';
          break;
        case 'decrease':
          if (position.quantityChange.previousQuantity !== undefined) {
            tradingQuantity = position.quantityChange.previousQuantity - position.quantity;
          } else {
            tradingQuantity = position.quantity;
          }
          isPositive = position.side === 'SHORT';
          break;
        case 'sold':
          tradingQuantity = position.quantity;
          isPositive = position.side === 'SHORT';
          break;
        case 'same':
          tradingQuantity = 0;
          break;
        default:
          tradingQuantity = 0;
      }
    } else if (position.isNewPosition) {
      tradingQuantity = position.quantity;
      isPositive = position.side === 'LONG';
    } else if (position.isSoldOut) {
      tradingQuantity = position.quantity;
      isPositive = position.side === 'SHORT';
    }

    if (tradingQuantity === 0) {
      return { quantity: 0, display: '--', color: 'text-gray-400 dark:text-gray-500' };
    }

    const finalQuantity = isPositive ? tradingQuantity : -tradingQuantity;
    const sign = finalQuantity > 0 ? '+' : '';
    const color = finalQuantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    
    const display = `${sign}${finalQuantity.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    })}`;

    return { quantity: finalQuantity, display, color };
  };

  // 计算到当前期数的BTC累计盈亏
  const calculateBtcCumulativePnl = (): { amount: number; rate: number } => {
    if (!backtestResult || !periodNumber) {
      return { amount: 0, rate: 0 };
    }

    const currentIndex = periodNumber - 1; // 转换为数组索引
    let btcCumulativePnl = 0;
    const initialCapital = backtestResult.params.initialCapital;

    // 累计到当前期数的BTC盈亏
    for (let i = 0; i <= currentIndex && i < backtestResult.snapshots.length; i++) {
      const snapshot = backtestResult.snapshots[i];

      // 累计BTC持仓的盈亏
      if (snapshot.btcPosition) {
        btcCumulativePnl += snapshot.btcPosition.pnl || 0;
      }

      // 累计BTC相关的卖出盈亏
      if (snapshot.soldPositions) {
        snapshot.soldPositions.forEach(soldPos => {
          if (soldPos.symbol === 'BTC' || soldPos.side === 'LONG') {
            btcCumulativePnl += soldPos.pnl || 0;
          }
        });
      }
    }

    const btcCumulativeRate = initialCapital > 0 ? (btcCumulativePnl / initialCapital) : 0;

    return {
      amount: btcCumulativePnl,
      rate: btcCumulativeRate
    };
  };

  // 计算到当前期数的做空ALT累计盈亏
  const calculateAltCumulativePnl = (): { amount: number; rate: number } => {
    if (!backtestResult || !periodNumber) {
      return { amount: 0, rate: 0 };
    }

    const currentIndex = periodNumber - 1; // 转换为数组索引
    let altCumulativePnl = 0;
    const initialCapital = backtestResult.params.initialCapital;

    // 累计到当前期数的做空ALT盈亏
    for (let i = 0; i <= currentIndex && i < backtestResult.snapshots.length; i++) {
      const snapshot = backtestResult.snapshots[i];

      // 累计做空持仓的盈亏
      if (snapshot.shortPositions) {
        snapshot.shortPositions.forEach(shortPos => {
          altCumulativePnl += shortPos.pnl || 0;
        });
      }

      // 累计做空相关的卖出盈亏
      if (snapshot.soldPositions) {
        snapshot.soldPositions.forEach(soldPos => {
          if (soldPos.side === 'SHORT') {
            altCumulativePnl += soldPos.pnl || 0;
          }
        });
      }
    }

    const altCumulativeRate = initialCapital > 0 ? (altCumulativePnl / initialCapital) : 0;

    return {
      amount: altCumulativePnl,
      rate: altCumulativeRate
    };
  };

  // 工具函数：格式化金额和百分比的组合显示
  const formatAmountWithPercent = (amount: number, percent: number) => {
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

  // 计算资金费率盈亏
  const calculateFundingPnL = (position: {side: string, fundingFee?: number}): number => {
    if (position.side !== 'SHORT') {
      return 0;
    }
    // 如果已经有计算好的资金费，直接使用
    return position.fundingFee ?? 0;
  };

  // 获取当前资金费率（累加所有历史资金费率）
  const getCurrentFundingRate = (position: {fundingRateHistory?: Array<{fundingRate?: number}>}): number => {
    if (!position.fundingRateHistory || position.fundingRateHistory.length === 0) {
      return 0;
    }
    // 累加所有资金费率
    return position.fundingRateHistory.reduce((sum: number, funding: {fundingRate?: number}) => {
      return sum + (funding.fundingRate || 0);
    }, 0);
  };

  // 获取盈亏颜色
  const getPnlColor = (pnl: number | null) => {
    const validPnl = pnl ?? 0;
    if (validPnl > 0) return 'text-green-600 dark:text-green-400';
    if (validPnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
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
        if (pos.symbol === 'BTCUSDT' || pos.side === 'LONG') {
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
      {/* 时间和期数信息 */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">第 {periodNumber || 1} 期: </span>
            <span className="font-medium text-gray-900 dark:text-white">{formatPeriodTime(snapshot.timestamp)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">总盈亏: </span>
            <span className={`font-medium ${getPnlColor(snapshot.totalPnl)}`}>
              {formatAmountWithPercent(snapshot.totalPnl || 0, (snapshot.totalPnlPercent || 0) * 100)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">BTC累计盈亏: </span>
            {backtestResult ? (
              (() => {
                const btcPnl = calculateBtcCumulativePnl();
                return (
                  <span className={`font-medium ${getPnlColor(btcPnl.amount)}`}>
                    {formatAmountWithPercent(btcPnl.amount, btcPnl.rate * 100)}
                  </span>
                );
              })()
            ) : (
              <span className="font-medium text-gray-400 dark:text-gray-500">--</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">做空ALT累计盈亏: </span>
            {backtestResult ? (
              (() => {
                const altPnl = calculateAltCumulativePnl();
                return (
                  <span className={`font-medium ${getPnlColor(altPnl.amount)}`}>
                    {formatAmountWithPercent(altPnl.amount, altPnl.rate * 100)}
                  </span>
                );
              })()
            ) : (
              <span className="font-medium text-gray-400 dark:text-gray-500">--</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">累计手续费: </span>
            <span className={`font-medium ${getPnlColor(snapshot.accumulatedTradingFee || 0)}`}>
              {formatCurrency(snapshot.accumulatedTradingFee || 0)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">累计资金费: </span>
            <span className={`font-medium ${getPnlColor(snapshot.accumulatedFundingFee || 0)}`}>
              {formatCurrency(snapshot.accumulatedFundingFee || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">总资产</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(snapshot.totalValue)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">当期盈亏</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.periodPnl || 0)}`}>
            {formatAmountWithPercent(snapshot.periodPnl || 0, (snapshot.periodPnlPercent || 0) * 100)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">当期手续费</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.totalTradingFee || 0)}`}>
            {formatCurrency(snapshot.totalTradingFee || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">当期资金费</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.totalFundingFee || 0)}`}>
            {formatCurrency(snapshot.totalFundingFee || 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">做空标的数</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{snapshot.shortPositions.length}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">温度计</p>
          <p className={`text-lg font-semibold ${
            getTemperatureDisplayInfo().isHighTemperature 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-green-600 dark:text-green-400'
          }`}>
            {getTemperatureDisplayInfo().value}
          </p>
        </div>
      </div>

      {/* 持仓列表 */}
      {allPositions.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">资产</TableHead>
                <TableHead className="w-20">方向</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">交易数量</TableHead>
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
                  <TableCell className="font-medium w-28">
                    <div className="flex items-center gap-2">
                      {position.type === 'BTC' ? (
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          ₿
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-gray-500 dark:bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {(position.displaySymbol || position.symbol).slice(0, 2)}
                        </div>
                      )}
                      <span className="truncate">{position.displaySymbol || position.symbol}</span>
                      {position.isNewPosition && !position.isSoldOut && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                          <Plus className="w-3 h-3 mr-1" />
                          新增
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-20">
                    <Badge
                      variant={
                        position.type === 'SOLD' ? "secondary" :
                        position.side === 'LONG' ? "default" : "destructive"
                      }
                      className="text-xs px-2 py-1"
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
                      <span>{formatAmount(position.amount)}</span>
                      {position.type !== 'SOLD' && totalInvestedAmount > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
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
                  <TableCell className="text-right">
                    {(() => {
                      const tradingQuantityInfo = calculateTradingQuantity(position);
                      return (
                        <span className={`font-medium ${tradingQuantityInfo.color}`}>
                          {tradingQuantityInfo.display}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getPnlColor(position.tradingFee || 0)}`}>
                    {formatCurrency(position.tradingFee || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {position.side === 'SHORT' ? (
                      <div className="text-right">
                        <div className={`font-medium ${calculateFundingPnL(position) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {calculateFundingPnL(position) === 0 ?
                            <span className="text-gray-400 dark:text-gray-500">$0.00</span> :
                            formatCurrency(calculateFundingPnL(position))
                          }
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {position.isNewPosition ? (
                            <div className="flex flex-col">
                              <span>新开仓</span>
                              {getCurrentFundingRate(position) !== 0 && (
                                <span className={getCurrentFundingRate(position) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                  费率: {(getCurrentFundingRate(position) * 100).toFixed(2)}%
                                </span>
                              )}
                            </div>
                          ) : getCurrentFundingRate(position) !== 0 ? (
                            <span className={getCurrentFundingRate(position) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              费率: {(getCurrentFundingRate(position) * 100).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">无数据</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* 优先使用专门的24H价格变化数据 */}
                    {position.priceChange24h !== undefined ? (
                      <span className={`font-medium ${
                        position.priceChange24h > 0 ? 'text-green-600 dark:text-green-400' :
                        position.priceChange24h < 0 ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {position.priceChange24h > 0 ? '+' : ''}
                        {position.priceChange24h.toFixed(2)}%
                      </span>
                    ) : position.type === 'BTC' && snapshot.btcPriceChange24h !== undefined ? (
                      <span className={`font-medium ${
                        snapshot.btcPriceChange24h > 0 ? 'text-green-600 dark:text-green-400' :
                        snapshot.btcPriceChange24h < 0 ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {snapshot.btcPriceChange24h > 0 ? '+' : ''}
                        {snapshot.btcPriceChange24h.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col">
                      <div className="flex flex-col items-end">
                        <span>{formatPrice(position.currentPrice)}</span>
                      </div>
                      {/* 显示相对于上一期价格的变化率 */}
                      {position.priceChange?.previousPrice && position.priceChange.previousPrice > 0 && position.currentPrice !== position.priceChange.previousPrice ? (
                        <span className={`text-xs ${
                          position.currentPrice > position.priceChange.previousPrice
                            ? 'text-green-600 dark:text-green-400'
                            : position.currentPrice < position.priceChange.previousPrice
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          ({position.currentPrice > position.priceChange.previousPrice ? '+' : ''}
                          {(((position.currentPrice - position.priceChange.previousPrice) / position.priceChange.previousPrice) * 100).toFixed(2)}%)
                        </span>
                      ) : position.entryPrice && position.entryPrice > 0 && position.currentPrice !== position.entryPrice && !position.isNewPosition ? (
                        <span className={`text-xs ${
                          position.currentPrice > position.entryPrice
                            ? 'text-green-600 dark:text-green-400'
                            : position.currentPrice < position.entryPrice
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
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
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">现金持仓</span>
            </div>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(snapshot.cashPosition)}
            </span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
            {snapshot.rebalanceReason}
          </p>
        </div>
      )}

      {/* 做空候选标的详情 */}
      {false && snapshot.shortCandidates && snapshot.shortCandidates.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              做空候选标的评分详情(前10)
              {/* 温度计规则状态提示 */}
              {snapshot.rebalanceReason?.includes('温度计') && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  温度计规则生效
                </Badge>
              )}
            </CardTitle>
            {/* 温度计规则详细说明 */}
            {snapshot.rebalanceReason?.includes('温度计') && (
              <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  <strong>温度计规则触发:</strong> {snapshot.rebalanceReason}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  虽然存在合格的做空候选标的，但因温度计规则强制清空所有空头仓位
                </p>
              </div>
            )}
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
                    <TableHead className="text-right">资金费率分数</TableHead>
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
                      <TableCell className={`text-right ${(candidate.priceChange24h ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {(candidate.priceChange24h ?? 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">{(candidate.priceChangeScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{(candidate.volumeScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{(candidate.volatilityScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="text-right">{(candidate.fundingRateScore ?? 0.5).toFixed(3)}</TableCell>
                      <TableCell className="text-right font-medium">{(candidate.totalScore ?? 0).toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            snapshot.rebalanceReason?.includes('温度计') ? "destructive" :
                            candidate.eligible ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {snapshot.rebalanceReason?.includes('温度计') ? "温度计禁止" :
                           candidate.eligible ? "已选择" : "已排除"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="text-xs text-muted-foreground" title={candidate.reason}>
                          {snapshot.rebalanceReason?.includes('温度计') ? (
                            <div className="text-orange-600 dark:text-orange-400">
                              温度计规则生效，禁止开空仓
                            </div>
                          ) : candidate.eligible ? (
                            <span>已选择</span>
                          ) : (
                            <div className="space-y-1">
                              {candidate.reason?.includes('涨幅过大') && (
                                <div className="text-red-600 dark:text-red-400">24h涨幅过大 ({(candidate.priceChange24h ?? 0).toFixed(2)}%)</div>
                              )}
                              {candidate.reason?.includes('成交量不足') && (
                                <div className="text-orange-600 dark:text-orange-400">成交量不足</div>
                              )}
                              {candidate.reason?.includes('波动率过高') && (
                                <div className="text-purple-600 dark:text-purple-400">波动率过高</div>
                              )}
                              {candidate.reason?.includes('综合分数不足') && (
                                <div className="text-gray-600 dark:text-gray-400">综合分数不足 ({(candidate.totalScore ?? 0).toFixed(3)})</div>
                              )}
                              {candidate.reason?.includes('超出数量限制') && (
                                <div className="text-blue-600 dark:text-blue-400">超出最大做空数量</div>
                              )}
                              {candidate.reason && !candidate.reason.includes('涨幅过大') &&
                               !candidate.reason.includes('成交量不足') &&
                               !candidate.reason.includes('波动率过高') &&
                               !candidate.reason.includes('综合分数不足') &&
                               !candidate.reason.includes('超出数量限制') && (
                                <div className="text-gray-600 dark:text-gray-400">{candidate.reason}</div>
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

      {/* 价格对比表格 - 仅开发环境可见 */}
      <PriceComparisonTable
        marketDataTimestamp={snapshot.timestamp}
        positions={allPositions}
        backtestResult={backtestResult}
        previousBalance={(() => {
          // 计算上一期的资产总额
          if (!backtestResult || !periodNumber || periodNumber <= 1) {
            return undefined; // 第一期没有上一期，使用默认初始资金
          }
          
          const previousIndex = periodNumber - 2; // 上一期的索引
          if (previousIndex >= 0 && previousIndex < backtestResult.snapshots.length) {
            return backtestResult.snapshots[previousIndex].totalValue;
          }
          
          return undefined;
        })()}
        initialCapital={backtestResult?.params.initialCapital}
      />
    </div>
  );
}
