'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  OptimizationConfig,
  OptimizationResult,
  ParameterRange,
  OptimizationProgress,
  AllocationStrategyMode,
  CrossValidationConfig,
  createDefaultCrossValidationConfig
} from './types';
import { ParameterOptimizer } from './optimizer';
import { PositionAllocationStrategy } from '@/types/btcdom2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import OptimizationGuide from './OptimizationGuide';
import { CrossValidationConfigComponent } from './components/CrossValidationConfig';
import CrossValidationResults from './components/CrossValidationResults';

interface OptimizationPanelProps {
  initialConfig?: Partial<OptimizationConfig>;
  onOptimizationComplete?: (results: OptimizationResult[]) => void;
  onBestParametersFound?: (params: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
    maxShortPositions: number;
    allocationStrategy: PositionAllocationStrategy;
  }) => void;
}

export default function OptimizationPanel({
  initialConfig,
  onOptimizationComplete,
  onBestParametersFound
}: OptimizationPanelProps) {
  // 环境检查：只在开发环境下启用
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 优化器实例
  const [optimizer] = useState(() => new ParameterOptimizer());

  // 优化配置状态
  const [config, setConfig] = useState<OptimizationConfig>({
    baseParams: {
      startDate: '2020-01-01',
      endDate: '2025-06-21',
      initialCapital: 10000,
      btcRatio: 0.5,
      spotTradingFeeRate: 0.0008,
      futuresTradingFeeRate: 0.0002,
      longBtc: true,
      shortAlt: true,
      granularityHours: 8
    },
    objective: 'calmar',
    method: 'hybrid',
    allocationStrategyMode: 'random',
    fixedAllocationStrategy: PositionAllocationStrategy.BY_VOLUME,

    maxIterations: 300,
    timeLimit: 3600,
    ...initialConfig
  });

  // 交叉验证配置状态
  const [crossValidationConfig, setCrossValidationConfig] = useState<CrossValidationConfig>(
    createDefaultCrossValidationConfig(
      config.baseParams.startDate,
      config.baseParams.endDate,
      '2020-01-01',
      '2025-06-20'
    )
  );

  // 更新优化配置中的交叉验证设置
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      crossValidation: crossValidationConfig.enabled ? crossValidationConfig : undefined
    }));
  }, [crossValidationConfig]);

  // 参数范围配置
  const [parameterRange, setParameterRange] = useState<ParameterRange>({
    weights: {
      priceChangeWeight: { min: 0, max: 1, step: 0.1 },
      volumeWeight: { min: 0, max: 1, step: 0.1 },
      volatilityWeight: { min: 0, max: 1, step: 0.1 },
      fundingRateWeight: { min: 0, max: 1, step: 0.1 }
    },
    maxShortPositions: { min: 5, max: 20, step: 1 },

    allocationStrategy: [
      PositionAllocationStrategy.BY_VOLUME,
      PositionAllocationStrategy.BY_COMPOSITE_SCORE,
      PositionAllocationStrategy.EQUAL_ALLOCATION
    ]
  });

  // 根据仓位配置策略模式更新参数范围
  useEffect(() => {
    setParameterRange(prev => {
      const newRange = {
        ...prev,
        allocationStrategy: config.allocationStrategyMode === 'random'
          ? [
              PositionAllocationStrategy.BY_VOLUME,
              PositionAllocationStrategy.BY_COMPOSITE_SCORE,
              PositionAllocationStrategy.EQUAL_ALLOCATION
            ]
          : config.fixedAllocationStrategy
            ? [config.fixedAllocationStrategy]
            : [PositionAllocationStrategy.BY_COMPOSITE_SCORE]
      };



      return newRange;
    });
  }, [config.allocationStrategyMode, config.fixedAllocationStrategy]);

  // 任务状态
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<OptimizationResult[]>([]);

  // UI状态
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'optimize' | 'guide'>('optimize');

  // 设置进度回调
  useEffect(() => {
    optimizer.setProgressCallback((progress) => {
      setProgress(progress);
      if (progress.currentBest && progress.recentResults.length > 0) {
        setResults(progress.recentResults);
      }
    });
  }, [optimizer]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      // 取消正在进行的优化
      optimizer.cancelOptimization();
      // 清理优化器资源
      optimizer.dispose();

      if (process.env.NODE_ENV === 'development') {
        console.log('OptimizationPanel 资源已清理');
      }
    };
  }, [optimizer]);

  // 开始优化
  const handleStartOptimization = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setProgress(null);
    setResults([]);

    try {
      const results = await optimizer.startOptimization(config, parameterRange);

      if (results.length > 0) {
        setResults(results);
        onOptimizationComplete?.(results);

        // 自动应用最优参数
        if (results[0] && onBestParametersFound) {
          const bestParams = results[0].combination;
          onBestParametersFound({
            priceChangeWeight: bestParams.priceChangeWeight,
            volumeWeight: bestParams.volumeWeight,
            volatilityWeight: bestParams.volatilityWeight,
            fundingRateWeight: bestParams.fundingRateWeight,
            maxShortPositions: bestParams.maxShortPositions,
            allocationStrategy: bestParams.allocationStrategy
          });
        }

        console.log(`优化完成，获得 ${results.length} 个有效结果`);
      } else {
        console.warn('优化完成，但未获得有效结果。可能所有参数组合都不满足约束条件。');
      }
    } catch (error) {
      console.error('优化过程出错:', error);
    } finally {
      setIsRunning(false);
    }
  }, [config, parameterRange, isRunning, optimizer, onOptimizationComplete, onBestParametersFound]);

  // 停止优化
  const handleStopOptimization = useCallback(() => {
    optimizer.cancelOptimization();
    setIsRunning(false);
  }, [optimizer]);

  // 应用选中的参数
  const handleApplyParameters = useCallback((result: OptimizationResult) => {
    if (onBestParametersFound) {
      const params = result.combination;
      onBestParametersFound({
        priceChangeWeight: params.priceChangeWeight,
        volumeWeight: params.volumeWeight,
        volatilityWeight: params.volatilityWeight,
        fundingRateWeight: params.fundingRateWeight,
        maxShortPositions: params.maxShortPositions,
        allocationStrategy: params.allocationStrategy
      });
    }
  }, [onBestParametersFound]);

  // 渲染优化目标选择
  const renderObjectiveSelector = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        优化目标
      </label>
      <Select
        value={config.objective}
        onValueChange={(value) => setConfig(prev => ({
          ...prev,
          objective: value as 'totalReturn' | 'sharpe' | 'calmar' | 'maxDrawdown' | 'composite'
        }))}
      >
        <SelectTrigger className="w-full text-left">
          <SelectValue>
            {config.objective === 'maxDrawdown' && "最小化最大回撤"}
            {config.objective === 'composite' && "最大化风险调整收益"}
            {config.objective === 'calmar' && "最大化卡玛比率"}
            {config.objective === 'sharpe' && "最大化夏普比率"}
            {config.objective === 'totalReturn' && "最大化总收益率"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="maxDrawdown">
            <div className="flex flex-col">
              <span>最小化最大回撤</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">追求最小的资产损失</span>
            </div>
          </SelectItem>
          <SelectItem value="composite">
            <div className="flex flex-col">
              <span>最大化风险调整收益</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">综合考虑收益率和风险指标</span>
            </div>
          </SelectItem>
          <SelectItem value="calmar">
            <div className="flex flex-col">
              <span>最大化卡玛比率</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">年化收益率与最大回撤的比值</span>
            </div>
          </SelectItem>
          <SelectItem value="sharpe">
            <div className="flex flex-col">
              <span>最大化夏普比率</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">平衡收益与风险，追求最佳风险调整收益</span>
            </div>
          </SelectItem>
          <SelectItem value="totalReturn">
            <div className="flex flex-col">
              <span>最大化总收益率</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">追求最高的总收益率表现</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // 渲染仓位配置策略选择
  const renderAllocationStrategySelector = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        仓位配置策略
      </label>
      <Select
        value={config.allocationStrategyMode}
        onValueChange={(value) => setConfig(prev => ({
          ...prev,
          allocationStrategyMode: value as AllocationStrategyMode
        }))}
      >
        <SelectTrigger className="w-full text-left">
          <SelectValue>
            {config.allocationStrategyMode === 'random' && "随机测试所有策略"}
            {config.allocationStrategyMode === 'fixed' && "固定单一策略"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="random">
            <div className="flex flex-col">
              <span>随机测试所有策略</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">在优化过程中随机选择不同的仓位分配策略</span>
            </div>
          </SelectItem>
          <SelectItem value="fixed">
            <div className="flex flex-col">
              <span>固定单一策略</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">使用固定的仓位分配策略，专注测试其他参数</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* 当选择固定策略时，显示策略选择器 */}
      {config.allocationStrategyMode === 'fixed' && (
        <div className="mt-3">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            固定策略选择
          </label>
          <Select
            value={config.fixedAllocationStrategy || PositionAllocationStrategy.BY_COMPOSITE_SCORE}
            onValueChange={(value) => setConfig(prev => ({
              ...prev,
              fixedAllocationStrategy: value as PositionAllocationStrategy
            }))}
          >
            <SelectTrigger className="w-full text-left">
              <SelectValue>
                {config.fixedAllocationStrategy === PositionAllocationStrategy.BY_VOLUME && "按成交量比例分配"}
                {config.fixedAllocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE && "按综合分数分配"}
                {config.fixedAllocationStrategy === PositionAllocationStrategy.EQUAL_ALLOCATION && "平均分配"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PositionAllocationStrategy.BY_VOLUME}>
                <div className="flex flex-col">
                  <span>按成交量比例分配</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">根据成交量大小分配仓位</span>
                </div>
              </SelectItem>
              <SelectItem value={PositionAllocationStrategy.BY_COMPOSITE_SCORE}>
                <div className="flex flex-col">
                  <span>按综合分数分配</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">根据综合评分分配仓位</span>
                </div>
              </SelectItem>
              <SelectItem value={PositionAllocationStrategy.EQUAL_ALLOCATION}>
                <div className="flex flex-col">
                  <span>平均分配</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">所有标的平均分配仓位</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  // 渲染优化方法选择
  const renderMethodSelector = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        优化方法
      </label>
      <Select
        value={config.method}
        onValueChange={(value) => setConfig(prev => ({
          ...prev,
          method: value as 'grid' | 'bayesian' | 'hybrid'
        }))}
      >
        <SelectTrigger className="w-full text-left">
          <SelectValue>
            {config.method === 'grid' && "网格搜索"}
            {config.method === 'bayesian' && "贝叶斯优化"}
            {config.method === 'hybrid' && "混合方法"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="grid">
            <div className="flex flex-col">
              <span>网格搜索</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">全面搜索所有参数组合，耗时较长但覆盖全面</span>
            </div>
          </SelectItem>
          <SelectItem value="bayesian">
            <div className="flex flex-col">
              <span>贝叶斯优化</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">智能搜索，速度快但可能错过全局最优</span>
            </div>
          </SelectItem>
          <SelectItem value="hybrid">
            <div className="flex flex-col">
              <span>混合方法（推荐）</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">先粗搜索再精细优化，平衡速度和效果</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // 渲染参数范围配置
  const renderParameterRanges = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-700 dark:text-gray-300">参数搜索范围</h4>

      {/* 做空标的数量范围 */}
      <div>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">最多做空标的数量</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="最小值"
            value={parameterRange.maxShortPositions.min}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxShortPositions: { ...prev.maxShortPositions, min: parseInt(e.target.value) || 5 }
            }))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            type="number"
            placeholder="最大值"
            value={parameterRange.maxShortPositions.max}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxShortPositions: { ...prev.maxShortPositions, max: parseInt(e.target.value) || 20 }
            }))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            type="number"
            placeholder="步长"
            value={parameterRange.maxShortPositions.step}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxShortPositions: { ...prev.maxShortPositions, step: parseInt(e.target.value) || 1 }
            }))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>




      {/* 仓位分配策略选择 - 只在随机模式下显示 */}
      {config.allocationStrategyMode === 'random' && (
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">包含的分配策略</label>
          <div className="space-y-1">
            {[
              { value: PositionAllocationStrategy.BY_VOLUME, label: '按成交量比例分配' },
              { value: PositionAllocationStrategy.BY_COMPOSITE_SCORE, label: '按综合分数分配' },
              { value: PositionAllocationStrategy.EQUAL_ALLOCATION, label: '平均分配' }
            ].map(strategy => (
              <label key={strategy.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={parameterRange.allocationStrategy?.includes(strategy.value) || false}
                  onChange={(e) => {
                    setParameterRange(prev => ({
                      ...prev,
                      allocationStrategy: e.target.checked
                        ? [...(prev.allocationStrategy || []), strategy.value]
                        : (prev.allocationStrategy || []).filter(s => s !== strategy.value)
                    }));
                  }}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{strategy.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 固定策略模式下的提示 */}
      {config.allocationStrategyMode === 'fixed' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            当前使用固定策略：<strong>
            {config.fixedAllocationStrategy === PositionAllocationStrategy.BY_VOLUME && "按成交量比例分配"}
            {config.fixedAllocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE && "按综合分数分配"}
            {config.fixedAllocationStrategy === PositionAllocationStrategy.EQUAL_ALLOCATION && "平均分配"}
            </strong>

          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            优化将专注于其他参数的调整，不会变更仓位分配策略

          </p>
        </div>
      )}
    </div>
  );

  // 渲染进度显示
  const renderProgress = () => {
    if (!progress || !isRunning) return null;

    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-blue-800 dark:text-blue-400">优化进行中...</h4>
          <span className="text-sm text-blue-600 dark:text-blue-400">
            {progress.currentIteration}/{progress.totalIterations}
          </span>
        </div>

        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(progress.currentIteration / progress.totalIterations) * 100}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
          <span>预计剩余: {Math.round(progress.estimatedTimeRemaining / 60)}分钟</span>
          {progress.currentBest && (
            <span>当前最优: {
              config.objective === 'maxDrawdown' ?
                `${(Math.abs(progress.currentBest.objectiveValue) * 100).toFixed(2)}%` :
                progress.currentBest.objectiveValue.toFixed(4)
            }</span>
          )}
        </div>
      </div>
    );
  };

  // 渲染结果表格
  const renderResults = () => {
    if (results.length === 0) return null;

    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">优化结果（前10名）</h4>
          <span className="text-sm text-gray-500 dark:text-gray-400">共找到 {results.length} 个有效组合</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">排名</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">目标值</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">总收益率</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">最大回撤</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">夏普比率</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">卡玛比率</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">跌幅权重</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">成交量权重</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">波动率权重</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">资金费率权重</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">做空数量</th>

                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">分配策略</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">交叉验证</th>
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left text-gray-700 dark:text-gray-300">操作</th>

              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {results.slice(0, 10).map((result, index) => (
                <tr key={result.combination.id} className={index === 0 ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {index + 1}
                    {index === 0 && <span className="ml-1 text-green-600 dark:text-green-400">👑</span>}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 font-mono text-gray-900 dark:text-gray-100">
                    {config.objective === 'maxDrawdown' ?
                      `${(Math.abs(result.objectiveValue) * 100).toFixed(2)}%` :
                      result.objectiveValue.toFixed(4)
                    }
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <span className={result.metrics.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {(result.metrics.totalReturn * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <span className="text-red-600 dark:text-red-400">
                      {(result.metrics.maxDrawdown * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {result.metrics.sharpeRatio.toFixed(3)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {result.metrics.calmarRatio.toFixed(3)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {(result.combination.priceChangeWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {(result.combination.volumeWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {(result.combination.volatilityWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {(result.combination.fundingRateWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {result.combination.maxShortPositions}
                  </td>

                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {result.combination.allocationStrategy === PositionAllocationStrategy.BY_VOLUME ? '成交量' :
                     result.combination.allocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE ? '综合分数' : '平均'}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-900 dark:text-gray-100">
                    {result.crossValidation ? (
                      <div className="text-xs">
                        <div className="text-green-600 dark:text-green-400">
                          综合: {result.crossValidation.compositeScore.toFixed(3)}
                        </div>
                        <div className="text-blue-600 dark:text-blue-400">
                          稳定: {result.crossValidation.consistency.stabilityScore.toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">未启用</span>
                    )}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                    <button
                      onClick={() => handleApplyParameters(result)}
                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs rounded"
                    >
                      应用
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 如果不是开发环境，显示受限界面
  if (!isDevelopment) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">🔧</div>
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
            参数优化工具
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            此功能仅在开发环境下可用
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">参数优化工具</h3>
        <div className="flex items-center gap-4">
          {/* 标签页切换 */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('optimize')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'optimize'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              优化工具
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'guide'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              使用指南
            </button>
          </div>

          {activeTab === 'optimize' && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {showAdvanced ? '隐藏高级设置' : '显示高级设置'}
            </button>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'guide' ? (
        <OptimizationGuide />
      ) : (
        <>
          {/* 基础配置 */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderObjectiveSelector()}
              {renderMethodSelector()}
            </div>
            {renderAllocationStrategySelector()}
          </div>

          {/* 高级设置 */}
          {showAdvanced && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-6">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">高级设置</h4>

              {/* 搜索约束 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">最大迭代次数</label>
                  <Input
                    type="number"
                    value={config.maxIterations}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      maxIterations: parseInt(e.target.value)
                    }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">超时时间(分钟)</label>
                  <Input
                    type="number"
                    value={(config.timeLimit || 3600) / 60}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      timeLimit: (parseInt(e.target.value) || 60) * 60
                    }))}
                    className="w-full"
                  />
                </div>
              </div>

              {renderParameterRanges()}

              {/* 交叉验证配置 */}
              <div className="mt-6">
                <CrossValidationConfigComponent
                  config={crossValidationConfig}
                  onChange={setCrossValidationConfig}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleStartOptimization}
              disabled={isRunning}
              className={`px-4 py-2 rounded-md font-medium ${
                isRunning
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800'
              }`}
            >
              {isRunning ? '优化中...' : '开始优化'}
            </button>

            {isRunning && (
              <button
                onClick={handleStopOptimization}
                className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md font-medium hover:bg-red-700 dark:hover:bg-red-800"
              >
                停止优化
              </button>
            )}
          </div>

          {/* 进度显示 */}
          {renderProgress()}

          {/* 结果显示 */}
          {renderResults()}

          {/* 交叉验证结果展示 */}
          {results.length > 0 && results[0]?.crossValidation && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">交叉验证详细结果</h4>
              <CrossValidationResults result={results[0].crossValidation} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
