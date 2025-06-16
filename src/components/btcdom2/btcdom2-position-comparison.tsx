'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  StrategySnapshot,
  PositionInfo
} from '@/types/btcdom2';
import { 
  ArrowRight,
  Plus,
  Minus,
  Equal,
  AlertTriangle
} from 'lucide-react';

interface BTCDOM2PositionComparisonProps {
  snapshots: StrategySnapshot[];
}

interface PositionChange {
  symbol: string;
  type: 'NEW' | 'CLOSED' | 'MODIFIED' | 'UNCHANGED';
  before?: PositionInfo;
  after?: PositionInfo;
  amountChange?: number;
  pnlChange?: number;
}

export function BTCDOM2PositionComparison({ snapshots }: BTCDOM2PositionComparisonProps) {
  const [fromIndex, setFromIndex] = useState<number>(0);
  const [toIndex, setToIndex] = useState<number>(Math.min(1, snapshots.length - 1));

  if (!snapshots || snapshots.length < 2) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">需要至少2个时间点才能进行对比</p>
      </div>
    );
  }

  // 格式化时间显示
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  // 分析持仓变化
  const analyzePositionChanges = (fromSnapshot: StrategySnapshot, toSnapshot: StrategySnapshot): PositionChange[] => {
    const changes: PositionChange[] = [];
    
    // 获取前后所有持仓
    const beforePositions = new Map<string, PositionInfo>();
    const afterPositions = new Map<string, PositionInfo>();
    
    // 添加BTC持仓
    if (fromSnapshot.btcPosition) {
      beforePositions.set('BTC', fromSnapshot.btcPosition);
    }
    if (toSnapshot.btcPosition) {
      afterPositions.set('BTC', toSnapshot.btcPosition);
    }
    
    // 添加做空持仓
    fromSnapshot.shortPositions.forEach(pos => {
      beforePositions.set(pos.symbol, pos);
    });
    toSnapshot.shortPositions.forEach(pos => {
      afterPositions.set(pos.symbol, pos);
    });
    
    // 分析所有符号
    const allSymbols = new Set([...beforePositions.keys(), ...afterPositions.keys()]);
    
    allSymbols.forEach(symbol => {
      const before = beforePositions.get(symbol);
      const after = afterPositions.get(symbol);
      
      if (!before && after) {
        // 新开仓
        changes.push({
          symbol,
          type: 'NEW',
          after,
        });
      } else if (before && !after) {
        // 平仓
        changes.push({
          symbol,
          type: 'CLOSED',
          before,
        });
      } else if (before && after) {
        // 检查是否有变化
        const amountChange = after.amount - before.amount;
        const pnlChange = after.pnl - before.pnl;
        
        if (Math.abs(amountChange) > 0.01 || Math.abs(pnlChange) > 0.01) {
          changes.push({
            symbol,
            type: 'MODIFIED',
            before,
            after,
            amountChange,
            pnlChange,
          });
        } else {
          changes.push({
            symbol,
            type: 'UNCHANGED',
            before,
            after,
          });
        }
      }
    });
    
    return changes.sort((a, b) => {
      // 排序：新开仓 > 修改 > 不变 > 平仓
      const order = { 'NEW': 0, 'MODIFIED': 1, 'UNCHANGED': 2, 'CLOSED': 3 };
      return order[a.type] - order[b.type];
    });
  };

  const fromSnapshot = snapshots[fromIndex];
  const toSnapshot = snapshots[toIndex];
  const positionChanges = analyzePositionChanges(fromSnapshot, toSnapshot);

  // 统计变化
  const changeStats = {
    new: positionChanges.filter(c => c.type === 'NEW').length,
    closed: positionChanges.filter(c => c.type === 'CLOSED').length,
    modified: positionChanges.filter(c => c.type === 'MODIFIED').length,
    unchanged: positionChanges.filter(c => c.type === 'UNCHANGED').length,
  };

  // 获取变化类型图标和颜色
  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'NEW': return <Plus className="w-4 h-4 text-green-600" />;
      case 'CLOSED': return <Minus className="w-4 h-4 text-red-600" />;
      case 'MODIFIED': return <ArrowRight className="w-4 h-4 text-blue-600" />;
      case 'UNCHANGED': return <Equal className="w-4 h-4 text-gray-600" />;
      default: return null;
    }
  };

  const getChangeBadge = (type: string) => {
    switch (type) {
      case 'NEW': return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">新开仓</Badge>;
      case 'CLOSED': return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">已平仓</Badge>;
      case 'MODIFIED': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">已调整</Badge>;
      case 'UNCHANGED': return <Badge variant="outline" className="bg-gray-100 text-gray-600">无变化</Badge>;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>持仓变化对比</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 时间点选择 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">对比起始时间</label>
            <Select value={fromIndex.toString()} onValueChange={(value) => setFromIndex(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    第{index + 1}期 - {formatTimestamp(snapshot.timestamp)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">对比结束时间</label>
            <Select value={toIndex.toString()} onValueChange={(value) => setToIndex(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot, index) => (
                  <SelectItem key={index} value={index.toString()} disabled={index <= fromIndex}>
                    第{index + 1}期 - {formatTimestamp(snapshot.timestamp)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 快速选择按钮 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFromIndex(Math.max(0, toIndex - 1));
            }}
            className="text-xs"
          >
            相邻对比
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFromIndex(0);
              setToIndex(snapshots.length - 1);
            }}
            className="text-xs"
          >
            首末对比
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const mid = Math.floor(snapshots.length / 2);
              setFromIndex(0);
              setToIndex(mid);
            }}
            className="text-xs"
          >
            前半段
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const mid = Math.floor(snapshots.length / 2);
              setFromIndex(mid);
              setToIndex(snapshots.length - 1);
            }}
            className="text-xs"
          >
            后半段
          </Button>
        </div>

        {/* 总体对比信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-500">总资产变化</p>
            <p className={`text-lg font-semibold ${getPnlColor(toSnapshot.totalValue - fromSnapshot.totalValue)}`}>
              {formatCurrency(toSnapshot.totalValue - fromSnapshot.totalValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">收益率变化</p>
            <p className={`text-lg font-semibold ${getPnlColor(toSnapshot.totalPnlPercent - fromSnapshot.totalPnlPercent)}`}>
              {formatPercent(toSnapshot.totalPnlPercent - fromSnapshot.totalPnlPercent)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">BTC价格变化</p>
            <p className={`text-lg font-semibold ${getPnlColor(toSnapshot.btcPrice - fromSnapshot.btcPrice)}`}>
              {formatCurrency(toSnapshot.btcPrice - fromSnapshot.btcPrice)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">做空标的变化</p>
            <p className="text-lg font-semibold">
              {fromSnapshot.shortPositions.length} → {toSnapshot.shortPositions.length}
            </p>
          </div>
        </div>

        {/* 变化统计 */}
        <div className="flex flex-wrap gap-2">
          {changeStats.new > 0 && (
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
              新开仓 {changeStats.new}
            </Badge>
          )}
          {changeStats.closed > 0 && (
            <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
              已平仓 {changeStats.closed}
            </Badge>
          )}
          {changeStats.modified > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
              已调整 {changeStats.modified}
            </Badge>
          )}
          {changeStats.unchanged > 0 && (
            <Badge variant="outline" className="bg-gray-100 text-gray-600">
              无变化 {changeStats.unchanged}
            </Badge>
          )}
        </div>

        {/* 持仓变化详情 */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>资产</TableHead>
                <TableHead>变化类型</TableHead>
                <TableHead className="text-right">变化前金额</TableHead>
                <TableHead className="text-right">变化后金额</TableHead>
                <TableHead className="text-right">金额变化</TableHead>
                <TableHead className="text-right">盈亏变化</TableHead>
                <TableHead>备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positionChanges.map((change, index) => (
                <TableRow key={`${change.symbol}-${index}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(change.type)}
                      <div className="flex items-center gap-2">
                        {change.symbol === 'BTC' ? (
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            ₿
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {change.symbol.slice(0, 2)}
                          </div>
                        )}
                        {change.symbol}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getChangeBadge(change.type)}
                  </TableCell>
                  <TableCell className="text-right">
                    {change.before ? formatCurrency(change.before.amount) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {change.after ? formatCurrency(change.after.amount) : '-'}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${change.amountChange ? getPnlColor(change.amountChange) : ''}`}>
                    {change.amountChange ? (
                      <>
                        {change.amountChange > 0 ? '+' : ''}
                        {formatCurrency(change.amountChange)}
                      </>
                    ) : '-'}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${change.pnlChange ? getPnlColor(change.pnlChange) : ''}`}>
                    {change.pnlChange ? (
                      <>
                        {change.pnlChange > 0 ? '+' : ''}
                        {formatCurrency(change.pnlChange)}
                      </>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="max-w-32">
                    <div className="text-sm text-muted-foreground">
                      {change.type === 'NEW' && change.after?.reason}
                      {change.type === 'CLOSED' && change.before?.reason}
                      {change.type === 'MODIFIED' && change.after?.reason}
                      {change.type === 'UNCHANGED' && '持仓不变'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {positionChanges.length === 0 && (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">所选时间段内无持仓变化</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}