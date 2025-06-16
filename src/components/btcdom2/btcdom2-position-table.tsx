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
  StrategySnapshot
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
}

export function BTCDOM2PositionTable({ snapshot }: BTCDOM2PositionTableProps) {
  if (!snapshot) {
    return (
      <div className="text-center py-8">
        <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">暂无持仓数据</p>
      </div>
    );
  }

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 格式化百分比
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // 获取盈亏颜色
  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600';
    if (pnl < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // 合并所有持仓
  const allPositions = [
    ...(snapshot.btcPosition ? [{ ...snapshot.btcPosition, type: 'BTC' as const }] : []),
    ...snapshot.shortPositions.map(pos => ({ ...pos, type: 'SHORT' as const }))
  ];

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
          <p className="text-sm text-gray-500">收益率</p>
          <p className={`text-lg font-semibold ${getPnlColor(snapshot.totalPnl)}`}>
            {formatPercent(snapshot.totalPnlPercent)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">BTC价格</p>
          <p className="text-lg font-semibold">${snapshot.btcPrice.toLocaleString()}</p>
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
                <TableHead className="text-right">价格</TableHead>
                <TableHead className="text-right">盈亏</TableHead>
                <TableHead className="text-right">收益率</TableHead>
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
                      {position.isNewPosition && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                          <Plus className="w-3 h-3 mr-1" />
                          新增
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={position.side === 'LONG' ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {position.side === 'LONG' ? (
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
                    {formatCurrency(position.amount)}
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
                          {position.quantityChange.type === 'new' && (
                            <div title="新增持仓">
                              <ArrowUp className="w-3 h-3 text-green-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'increase' && (
                            <div title={`增加 ${position.quantityChange.changePercent?.toFixed(2)}%`}>
                              <ArrowUp className="w-3 h-3 text-green-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'decrease' && (
                            <div title={`减少 ${Math.abs(position.quantityChange.changePercent || 0).toFixed(2)}%`}>
                              <ArrowDown className="w-3 h-3 text-red-500" />
                            </div>
                          )}
                          {position.quantityChange.type === 'same' && (
                            <div title="数量无变化">
                              <Minus className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(position.currentPrice)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getPnlColor(position.pnl)}`}>
                    {formatCurrency(position.pnl)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getPnlColor(position.pnl)}`}>
                    {formatPercent(position.pnlPercent)}
                  </TableCell>
                  <TableCell className="max-w-32">
                    <div className="text-sm text-muted-foreground truncate" title={position.reason}>
                      {position.reason}
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
            <CardTitle className="text-sm">做空候选标的评分详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标的</TableHead>
                    <TableHead className="text-right">排名</TableHead>
                    <TableHead className="text-right">24h涨跌</TableHead>
                    <TableHead className="text-right">成交量分数</TableHead>
                    <TableHead className="text-right">涨跌幅分数</TableHead>
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
                      <TableCell className={`text-right ${candidate.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {candidate.priceChange24h.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">{candidate.volumeScore.toFixed(3)}</TableCell>
                      <TableCell className="text-right">{candidate.priceChangeScore.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-medium">{candidate.totalScore.toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge variant={candidate.eligible ? "default" : "secondary"} className="text-xs">
                          {candidate.eligible ? "已选择" : "已排除"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="text-xs text-muted-foreground truncate" title={candidate.reason}>
                          {candidate.reason}
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