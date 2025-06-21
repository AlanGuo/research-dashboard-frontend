import { PositionAllocationStrategy } from '@/types/btcdom2';

// 仓位配置策略模式
export type AllocationStrategyMode = 'random' | 'fixed';

// 参数优化配置
export interface OptimizationConfig {
  // 基础参数（不参与优化的固定参数）
  baseParams: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    btcRatio: number;
    spotTradingFeeRate: number;
    futuresTradingFeeRate: number;
    longBtc: boolean;
    shortAlt: boolean;
    granularityHours?: number;
  };
  
  // 优化目标
  objective: OptimizationObjective;
  
  // 优化方法
  method: OptimizationMethod;
  
  // 仓位配置策略模式
  allocationStrategyMode: AllocationStrategyMode;
  
  // 固定的仓位配置策略（当 allocationStrategyMode 为 'fixed' 时使用）
  fixedAllocationStrategy?: PositionAllocationStrategy;
  

  
  // 优化参数
  maxIterations?: number;
  convergenceThreshold?: number;
  parallelEvaluations?: number;
  timeLimit?: number;
  populationSize?: number;
  crossoverRate?: number;
  mutationRate?: number;
}

// 优化目标
export type OptimizationObjective = 'totalReturn' | 'sharpe' | 'calmar' | 'maxDrawdown' | 'composite';

// 优化方法
export type OptimizationMethod = 'grid' | 'bayesian' | 'hybrid';

// 参数范围定义
export interface ParameterRange {
  // 权重参数范围（4个权重总和必须为1）
  weights: {
    priceChangeWeight: { min: number; max: number; step: number; };
    volumeWeight: { min: number; max: number; step: number; };
    volatilityWeight: { min: number; max: number; step: number; };
    fundingRateWeight: { min: number; max: number; step: number; };
  };
  
  // 策略参数范围
  maxShortPositions: { min: number; max: number; step?: number; };
  
  // 配置策略
  allocationStrategy?: PositionAllocationStrategy[];
}

// 优化约束
export interface OptimizationConstraints {
  // 权重约束
  weightConstraints: {
    sumToOne: boolean; // 权重总和必须为1
    minWeight: number; // 单个权重最小值
    maxWeight: number; // 单个权重最大值
  };
  
  // 性能约束
  performanceConstraints?: {
    minTotalReturn?: number;    // 最小总收益率
    maxDrawdown?: number;       // 最大回撤限制
    minSharpeRatio?: number;    // 最小夏普比率
  };
  
  // 搜索约束
  searchConstraints: {
    maxIterations: number;      // 最大迭代次数
    timeoutMinutes: number;     // 超时时间（分钟）
    convergenceThreshold?: number; // 收敛阈值
  };
}

// 参数组合
export interface ParameterCombination {
  id: string;
  priceChangeWeight: number;
  volumeWeight: number;
  volatilityWeight: number;
  fundingRateWeight: number;
  maxShortPositions: number;
  allocationStrategy: PositionAllocationStrategy;
}

// 优化结果
export interface OptimizationResult {
  combination: ParameterCombination;
  // 移除 backtestResult 以节省内存，只保留关键指标
  objectiveValue: number;        // 目标函数值
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    volatility?: number;
    winRate: number;
  };
  executionTime: number;         // 执行时间（毫秒）
}

// 优化任务状态
export type OptimizationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 优化任务
export interface OptimizationTask {
  id: string;
  config: OptimizationConfig;
  parameterRange: ParameterRange;
  status: OptimizationStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: OptimizationResult[];
  startTime: number;
  endTime: number | null;
  error?: string;
}

// 网格搜索配置
export interface GridSearchConfig {
  // 网格密度级别
  gridDensity: 'coarse' | 'medium' | 'fine';
  
  // 并行执行数量
  parallelJobs: number;
  
  // 是否启用早停
  earlyStop: boolean;
  earlyStopPatience?: number;
}

// 贝叶斯优化配置
export interface BayesianOptimizationConfig {
  // 初始随机采样数量
  initialSamples: number;
  
  // 采集函数类型
  acquisitionFunction: 'EI' | 'PI' | 'UCB';
  
  // 高斯过程超参数
  gpHyperparams?: {
    lengthScale?: number;
    variance?: number;
    noise?: number;
  };
  
  // 探索vs利用权衡参数
  explorationWeight: number;
}

// 优化报告
export interface OptimizationReport {
  taskId: string;
  summary: {
    bestResult: OptimizationResult;
    totalCombinations: number;
    successfulCombinations: number;
    averageExecutionTime: number;
    totalOptimizationTime: number;
  };
  
  // 参数敏感性分析
  sensitivityAnalysis: {
    parameterName: string;
    correlation: number;        // 与目标函数的相关性
    importance: number;         // 重要性得分
  }[];
  
  // 性能分布
  performanceDistribution: {
    totalReturn: { min: number; max: number; mean: number; std: number; };
    sharpeRatio: { min: number; max: number; mean: number; std: number; };
    maxDrawdown: { min: number; max: number; mean: number; std: number; };
  };
  
  // 最优参数区域
  optimalRegions: {
    parameterName: string;
    optimalRange: { min: number; max: number; };
    confidence: number;
  }[];
}

// 实时优化进度
export interface OptimizationProgress {
  taskId: string;
  status: OptimizationStatus;
  currentIteration: number;
  totalIterations: number;
  currentBest: OptimizationResult | null;
  recentResults: OptimizationResult[];
  estimatedTimeRemaining: number; // 秒
  resourceUsage: {
    cpuUsage: number;     // CPU使用率 (0-100)
    memoryUsage: number;  // 内存使用量 (MB)
  };
}

// 参数验证结果
export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedParams?: ParameterCombination;
}

// 优化建议
export interface OptimizationRecommendation {
  type: 'parameter_adjustment' | 'strategy_change' | 'constraint_relaxation';
  description: string;
  impact: 'low' | 'medium' | 'high';
  suggestedAction: string;
}