'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  OptimizationConfig, 
  OptimizationResult, 
  OptimizationObjective,
  OptimizationMethod,
  ParameterRange,
  OptimizationProgress 
} from './types';
import { ParameterOptimizer } from './optimizer';
import { PositionAllocationStrategy } from '@/types/btcdom2';
import OptimizationGuide from './OptimizationGuide';

interface OptimizationPanelProps {
  initialConfig?: Partial<OptimizationConfig>;
  onOptimizationComplete?: (results: OptimizationResult[]) => void;
  onBestParametersFound?: (params: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
    maxShortPositions: number;
    maxSinglePositionRatio: number;
    allocationStrategy: PositionAllocationStrategy;
  }) => void;
}

export default function OptimizationPanel({ 
  initialConfig, 
  onOptimizationComplete,
  onBestParametersFound 
}: OptimizationPanelProps) {
  // 优化器实例
  const [optimizer] = useState(() => new ParameterOptimizer());
  
  // 优化配置状态
  const [config, setConfig] = useState<OptimizationConfig>({
    baseParams: {
      startDate: '2025-01-01',
      endDate: '2025-06-18',
      initialCapital: 10000,
      btcRatio: 0.5,
      spotTradingFeeRate: 0.0008,
      futuresTradingFeeRate: 0.0002,
      longBtc: true,
      shortAlt: true,
      granularityHours: 8
    },
    objective: OptimizationObjective.MAXIMIZE_TOTAL_RETURN,
    method: OptimizationMethod.HYBRID,
    constraints: {
      weightConstraints: {
        sumToOne: true,
        minWeight: 0,
        maxWeight: 1
      },
      searchConstraints: {
        maxIterations: 100,
        timeoutMinutes: 60
      }
    },
    ...initialConfig
  });

  // 参数范围配置
  const [parameterRange, setParameterRange] = useState<ParameterRange>({
    weights: {
      priceChangeWeight: { min: 0, max: 1, step: 0.1 },
      volumeWeight: { min: 0, max: 1, step: 0.1 },
      volatilityWeight: { min: 0, max: 1, step: 0.1 },
      fundingRateWeight: { min: 0, max: 1, step: 0.1 }
    },
    maxShortPositions: { min: 5, max: 20, step: 1 },
    maxSinglePositionRatio: { min: 0.1, max: 0.3, step: 0.05 },
    allocationStrategies: [
      PositionAllocationStrategy.BY_VOLUME,
      PositionAllocationStrategy.BY_COMPOSITE_SCORE,
      PositionAllocationStrategy.EQUAL_ALLOCATION
    ]
  });

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

  // 开始优化
  const handleStartOptimization = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setResults([]);
    setProgress(null);

    try {
      const task = await optimizer.startOptimization(config, parameterRange);
      
      if (task.results.length > 0) {
        setResults(task.results);
        onOptimizationComplete?.(task.results);
        
        // 自动应用最优参数
        if (task.results[0] && onBestParametersFound) {
          const bestParams = task.results[0].combination;
          onBestParametersFound({
            priceChangeWeight: bestParams.priceChangeWeight,
            volumeWeight: bestParams.volumeWeight,
            volatilityWeight: bestParams.volatilityWeight,
            fundingRateWeight: bestParams.fundingRateWeight,
            maxShortPositions: bestParams.maxShortPositions,
            maxSinglePositionRatio: bestParams.maxSinglePositionRatio,
            allocationStrategy: bestParams.allocationStrategy
          });
        }
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
        maxSinglePositionRatio: params.maxSinglePositionRatio,
        allocationStrategy: params.allocationStrategy
      });
    }
  }, [onBestParametersFound]);

  // 渲染优化目标选择
  const renderObjectiveSelector = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        优化目标
      </label>
      <select
        value={config.objective}
        onChange={(e) => setConfig(prev => ({ 
          ...prev, 
          objective: e.target.value as OptimizationObjective 
        }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={OptimizationObjective.MAXIMIZE_TOTAL_RETURN}>最大化总收益率</option>
        <option value={OptimizationObjective.MAXIMIZE_SHARPE_RATIO}>最大化夏普比率</option>
        <option value={OptimizationObjective.MAXIMIZE_CALMAR_RATIO}>最大化卡尔玛比率</option>
        <option value={OptimizationObjective.MINIMIZE_MAX_DRAWDOWN}>最小化最大回撤</option>
        <option value={OptimizationObjective.MAXIMIZE_RISK_ADJUSTED_RETURN}>最大化风险调整收益</option>
      </select>
    </div>
  );

  // 渲染优化方法选择
  const renderMethodSelector = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        优化方法
      </label>
      <select
        value={config.method}
        onChange={(e) => setConfig(prev => ({ 
          ...prev, 
          method: e.target.value as OptimizationMethod 
        }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={OptimizationMethod.GRID_SEARCH}>网格搜索</option>
        <option value={OptimizationMethod.BAYESIAN_OPTIMIZATION}>贝叶斯优化</option>
        <option value={OptimizationMethod.HYBRID}>混合方法（推荐）</option>
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {config.method === OptimizationMethod.GRID_SEARCH && '全面搜索所有参数组合，耗时较长但覆盖全面'}
        {config.method === OptimizationMethod.BAYESIAN_OPTIMIZATION && '智能搜索，速度快但可能错过全局最优'}
        {config.method === OptimizationMethod.HYBRID && '先粗搜索再精细优化，平衡速度和效果'}
      </p>
    </div>
  );

  // 渲染参数范围配置
  const renderParameterRanges = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-700">参数搜索范围</h4>
      
      {/* 做空标的数量范围 */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">最多做空标的数量</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="最小值"
            value={parameterRange.maxShortPositions.min}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxShortPositions: { ...prev.maxShortPositions, min: parseInt(e.target.value) || 5 }
            }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <input
            type="number"
            placeholder="最大值"
            value={parameterRange.maxShortPositions.max}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxShortPositions: { ...prev.maxShortPositions, max: parseInt(e.target.value) || 20 }
            }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <input
            type="number"
            placeholder="步长"
            value={parameterRange.maxShortPositions.step}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxShortPositions: { ...prev.maxShortPositions, step: parseInt(e.target.value) || 1 }
            }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* 单币种持仓限制范围 */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">单币种持仓限制</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="最小值"
            value={parameterRange.maxSinglePositionRatio.min}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxSinglePositionRatio: { ...prev.maxSinglePositionRatio, min: parseFloat(e.target.value) || 0.1 }
            }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="最大值"
            value={parameterRange.maxSinglePositionRatio.max}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxSinglePositionRatio: { ...prev.maxSinglePositionRatio, max: parseFloat(e.target.value) || 0.3 }
            }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="步长"
            value={parameterRange.maxSinglePositionRatio.step}
            onChange={(e) => setParameterRange(prev => ({
              ...prev,
              maxSinglePositionRatio: { ...prev.maxSinglePositionRatio, step: parseFloat(e.target.value) || 0.05 }
            }))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* 仓位分配策略选择 */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">包含的分配策略</label>
        <div className="space-y-1">
          {[
            { value: PositionAllocationStrategy.BY_VOLUME, label: '按成交量比例分配' },
            { value: PositionAllocationStrategy.BY_COMPOSITE_SCORE, label: '按综合分数分配' },
            { value: PositionAllocationStrategy.EQUAL_ALLOCATION, label: '平均分配' }
          ].map(strategy => (
            <label key={strategy.value} className="flex items-center">
              <input
                type="checkbox"
                checked={parameterRange.allocationStrategies.includes(strategy.value)}
                onChange={(e) => {
                  setParameterRange(prev => ({
                    ...prev,
                    allocationStrategies: e.target.checked
                      ? [...prev.allocationStrategies, strategy.value]
                      : prev.allocationStrategies.filter(s => s !== strategy.value)
                  }));
                }}
                className="mr-2"
              />
              <span className="text-sm">{strategy.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // 渲染进度显示
  const renderProgress = () => {
    if (!progress || !isRunning) return null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-blue-800">优化进行中...</h4>
          <span className="text-sm text-blue-600">
            {progress.currentIteration}/{progress.totalIterations}
          </span>
        </div>
        
        <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(progress.currentIteration / progress.totalIterations) * 100}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-blue-600">
          <span>预计剩余: {Math.round(progress.estimatedTimeRemaining / 60)}分钟</span>
          {progress.currentBest && (
            <span>当前最优: {progress.currentBest.objectiveValue.toFixed(4)}</span>
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
          <h4 className="font-medium text-gray-700">优化结果（前10名）</h4>
          <span className="text-sm text-gray-500">共找到 {results.length} 个有效组合</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-2 py-1 text-left">排名</th>
                <th className="border border-gray-300 px-2 py-1 text-left">目标值</th>
                <th className="border border-gray-300 px-2 py-1 text-left">总收益率</th>
                <th className="border border-gray-300 px-2 py-1 text-left">最大回撤</th>
                <th className="border border-gray-300 px-2 py-1 text-left">夏普比率</th>
                <th className="border border-gray-300 px-2 py-1 text-left">卡尔玛比率</th>
                <th className="border border-gray-300 px-2 py-1 text-left">跌幅权重</th>
                <th className="border border-gray-300 px-2 py-1 text-left">成交量权重</th>
                <th className="border border-gray-300 px-2 py-1 text-left">波动率权重</th>
                <th className="border border-gray-300 px-2 py-1 text-left">资金费率权重</th>
                <th className="border border-gray-300 px-2 py-1 text-left">做空数量</th>
                <th className="border border-gray-300 px-2 py-1 text-left">持仓限制</th>
                <th className="border border-gray-300 px-2 py-1 text-left">分配策略</th>
                <th className="border border-gray-300 px-2 py-1 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 10).map((result, index) => (
                <tr key={result.combination.id} className={index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                  <td className="border border-gray-300 px-2 py-1">
                    {index + 1}
                    {index === 0 && <span className="ml-1 text-green-600">👑</span>}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 font-mono">
                    {result.objectiveValue.toFixed(4)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <span className={result.metrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {(result.metrics.totalReturn * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <span className="text-red-600">
                      {(result.metrics.maxDrawdown * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {result.metrics.sharpeRatio.toFixed(3)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {result.metrics.calmarRatio.toFixed(3)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {(result.combination.priceChangeWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {(result.combination.volumeWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {(result.combination.volatilityWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {(result.combination.fundingRateWeight * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {result.combination.maxShortPositions}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {(result.combination.maxSinglePositionRatio * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {result.combination.allocationStrategy === PositionAllocationStrategy.BY_VOLUME ? '成交量' :
                     result.combination.allocationStrategy === PositionAllocationStrategy.BY_COMPOSITE_SCORE ? '综合分数' : '平均'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <button
                      onClick={() => handleApplyParameters(result)}
                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">参数优化工具</h3>
        <div className="flex items-center gap-4">
          {/* 标签页切换 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('optimize')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'optimize' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              优化工具
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'guide' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              使用指南
            </button>
          </div>
          
          {activeTab === 'optimize' && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-800"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {renderObjectiveSelector()}
            {renderMethodSelector()}
          </div>

          {/* 高级设置 */}
          {showAdvanced && (
            <div className="border-t pt-4 mb-6">
              <h4 className="font-medium text-gray-700 mb-4">高级设置</h4>
              
              {/* 搜索约束 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">最大迭代次数</label>
                  <input
                    type="number"
                    value={config.constraints.searchConstraints.maxIterations}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      constraints: {
                        ...prev.constraints,
                        searchConstraints: {
                          ...prev.constraints.searchConstraints,
                          maxIterations: parseInt(e.target.value) || 100
                        }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">超时时间（分钟）</label>
                  <input
                    type="number"
                    value={config.constraints.searchConstraints.timeoutMinutes}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      constraints: {
                        ...prev.constraints,
                        searchConstraints: {
                          ...prev.constraints.searchConstraints,
                          timeoutMinutes: parseInt(e.target.value) || 60
                        }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              {renderParameterRanges()}
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleStartOptimization}
              disabled={isRunning}
              className={`px-4 py-2 rounded-md font-medium ${
                isRunning 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRunning ? '优化中...' : '开始优化'}
            </button>
            
            {isRunning && (
              <button
                onClick={handleStopOptimization}
                className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
              >
                停止优化
              </button>
            )}
          </div>

          {/* 进度显示 */}
          {renderProgress()}

          {/* 结果显示 */}
          {renderResults()}

          {/* 说明文字 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-700 mb-2">使用说明：</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 选择优化目标：根据你的投资偏好选择最重要的指标</li>
              <li>• 设置搜索范围：定义各参数的取值范围，范围越大搜索越全面但时间越长</li>
              <li>• 混合方法推荐：先进行粗搜索找到有潜力区域，再精细优化</li>
              <li>• 结果可以直接应用到当前策略，或手动调整后使用</li>
              <li>• 权重系统会自动确保四个权重总和为1</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}