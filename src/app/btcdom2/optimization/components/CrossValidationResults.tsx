'use client'

import React from 'react';
import { CrossValidationResult } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

interface CrossValidationResultsProps {
  result: CrossValidationResult;
  className?: string;
}

const CrossValidationResults: React.FC<CrossValidationResultsProps> = ({
  result,
  className = ''
}) => {
  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
  };

  const getPerformanceColor = (value: number, type: 'return' | 'sharpe' | 'drawdown'): string => {
    switch (type) {
      case 'return':
        return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
      case 'sharpe':
        if (value > 1) return 'text-green-600 dark:text-green-400';
        if (value > 0) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
      case 'drawdown':
        if (value < 0.05) return 'text-green-600 dark:text-green-400';
        if (value < 0.1) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStabilityBadge = (score: number) => {
    if (score > 0.8) return { label: '很稳定', variant: 'default' as const };
    if (score > 0.6) return { label: '较稳定', variant: 'secondary' as const };
    if (score > 0.4) return { label: '不太稳定', variant: 'outline' as const };
    return { label: '不稳定', variant: 'destructive' as const };
  };

  const allResults = [result.trainingResult, ...result.validationResults];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 综合评分概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">交叉验证综合评分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">综合评分</div>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {formatNumber(result.compositeScore)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">稳定性评分</div>
              <div className="flex items-center space-x-2">
                <div className="text-3xl font-bold">
                  {formatNumber(result.consistency.stabilityScore)}
                </div>
                <Badge variant={getStabilityBadge(result.consistency.stabilityScore).variant}>
                  {getStabilityBadge(result.consistency.stabilityScore).label}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 一致性分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">性能一致性分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">标准差</div>
              <div className="text-lg font-medium">{formatNumber(result.consistency.standardDeviation)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">性能范围</div>
              <div className="text-lg font-medium">{formatNumber(result.consistency.range)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">稳定性得分</div>
              <div className="text-lg font-medium">
                <Badge variant={getStabilityBadge(result.consistency.stabilityScore).variant}>
                  {formatNumber(result.consistency.stabilityScore)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 各时间段详细结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">各时间段表现详情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 训练时间段 */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm text-green-800 dark:text-green-200">
                  {result.trainingResult.period.label}
                </CardTitle>
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-300">
                  {result.trainingResult.period.startDate} ~ {result.trainingResult.period.endDate}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">总收益率</div>
                  <div className={`text-sm font-medium ${getPerformanceColor(result.trainingResult.metrics.totalReturn, 'return')}`}>
                    {formatPercentage(result.trainingResult.metrics.totalReturn)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">夏普比率</div>
                  <div className={`text-sm font-medium ${getPerformanceColor(result.trainingResult.metrics.sharpeRatio, 'sharpe')}`}>
                    {formatNumber(result.trainingResult.metrics.sharpeRatio)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">最大回撤</div>
                  <div className={`text-sm font-medium ${getPerformanceColor(result.trainingResult.metrics.maxDrawdown, 'drawdown')}`}>
                    {formatPercentage(result.trainingResult.metrics.maxDrawdown)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">目标函数值</div>
                  <div className="text-sm font-medium">
                    {formatNumber(result.trainingResult.objectiveValue)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 验证时间段 */}
          {result.validationResults.map((validationResult, index) => (
            <Card key={index} className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm text-blue-800 dark:text-blue-200">
                    {validationResult.period.label}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                    {validationResult.period.startDate} ~ {validationResult.period.endDate}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">总收益率</div>
                    <div className={`text-sm font-medium ${getPerformanceColor(validationResult.metrics.totalReturn, 'return')}`}>
                      {formatPercentage(validationResult.metrics.totalReturn)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">夏普比率</div>
                    <div className={`text-sm font-medium ${getPerformanceColor(validationResult.metrics.sharpeRatio, 'sharpe')}`}>
                      {formatNumber(validationResult.metrics.sharpeRatio)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">最大回撤</div>
                    <div className={`text-sm font-medium ${getPerformanceColor(validationResult.metrics.maxDrawdown, 'drawdown')}`}>
                      {formatPercentage(validationResult.metrics.maxDrawdown)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">目标函数值</div>
                    <div className="text-sm font-medium">
                      {formatNumber(validationResult.objectiveValue)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* 性能统计表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">性能指标对比</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间段</TableHead>
                <TableHead>总收益率</TableHead>
                <TableHead>夏普比率</TableHead>
                <TableHead>卡尔玛比率</TableHead>
                <TableHead>最大回撤</TableHead>
                <TableHead>胜率</TableHead>
                <TableHead>目标函数值</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allResults.map((periodResult, index) => {
                const isTraining = index === 0;
                return (
                  <TableRow key={index} className={isTraining ? 'bg-green-50 dark:bg-green-950/20' : 'bg-blue-50 dark:bg-blue-950/20'}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{periodResult.period.label}</span>
                        {isTraining && <Badge variant="outline" className="text-xs">训练</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className={getPerformanceColor(periodResult.metrics.totalReturn, 'return')}>
                      {formatPercentage(periodResult.metrics.totalReturn)}
                    </TableCell>
                    <TableCell className={getPerformanceColor(periodResult.metrics.sharpeRatio, 'sharpe')}>
                      {formatNumber(periodResult.metrics.sharpeRatio)}
                    </TableCell>
                    <TableCell>
                      {formatNumber(periodResult.metrics.calmarRatio)}
                    </TableCell>
                    <TableCell className={getPerformanceColor(periodResult.metrics.maxDrawdown, 'drawdown')}>
                      {formatPercentage(periodResult.metrics.maxDrawdown)}
                    </TableCell>
                    <TableCell>
                      {formatPercentage(periodResult.metrics.winRate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatNumber(periodResult.objectiveValue)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 建议和解释 */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-3">结果解读</h5>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
            <p>
              <span className="font-medium">综合评分:</span> 根据训练期和验证期的加权平均计算，分数越高表明参数组合越优秀。
            </p>
            <p>
              <span className="font-medium">稳定性评分:</span> 衡量参数在不同时间段的表现一致性，分数越高表明策略越稳定可靠。
            </p>
            
            <Separator className="my-2" />
            
            <p className="font-medium">
              建议: {' '}
              {result.consistency.stabilityScore > 0.7 
                ? '该参数组合在不同时间段表现稳定，具有较好的泛化能力，推荐使用。'
                : result.consistency.stabilityScore > 0.5
                ? '该参数组合表现中等稳定，建议进一步验证或适当调整参数后使用。'
                : '该参数组合表现不够稳定，可能存在过度拟合风险，建议谨慎使用或重新优化参数。'
              }
            </p>
          </div>
        </div>
    </div>
  );
};

export default CrossValidationResults;