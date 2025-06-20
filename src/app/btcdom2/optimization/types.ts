import { PositionAllocationStrategy, BTCDOM2BacktestResult } from '@/types/btcdom2';

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
  
  // 优化约束
  constraints: OptimizationConstraints;
}

// 优化目标
export enum OptimizationObjective {
  MAXIMIZE_TOTAL_RETURN = 'MAXIMIZE_TOTAL_RETURN',           // 最大化总收益率
  MAXIMIZE_SHARPE_RATIO = 'MAXIMIZE_SHARPE_RATIO',          // 最大化夏普比率
  MAXIMIZE_CALMAR_RATIO = 'MAXIMIZE_CALMAR_RATIO',          // 最大化卡尔玛比率
  MINIMIZE_MAX_DRAWDOWN = 'MINIMIZE_MAX_DRAWDOWN',          // 最小化最大回撤
  MAXIMIZE_RISK_ADJUSTED_RETURN = 'MAXIMIZE_RISK_ADJUSTED_RETURN' // 最大化风险调整收益
}

// 优化方法
export enum OptimizationMethod {
  GRID_SEARCH = 'GRID_SEARCH',           // 网格搜索
  BAYESIAN_OPTIMIZATION = 'BAYESIAN_OPTIMIZATION', // 贝叶斯优化
  HYBRID = 'HYBRID'                      // 混合方法（先网格后贝叶斯）
}

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
  maxShortPositions: { min: number; max: number; step: number; };
  maxSinglePositionRatio: { min: number; max: number; step: number; };
  
  // 仓位分配策略（离散选择）
  allocationStrategies: PositionAllocationStrategy[];
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
  maxSinglePositionRatio: number;
  allocationStrategy: PositionAllocationStrategy;
}

// 优化结果
export interface OptimizationResult {
  combination: ParameterCombination;
  backtestResult: BTCDOM2BacktestResult;
  objectiveValue: number;        // 目标函数值
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    volatility: number;
    winRate: number;
  };
  executionTime: number;         // 执行时间（毫秒）
}

// 优化任务状态
export enum OptimizationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

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
  startTime?: Date;
  endTime?: Date;
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
    cpuUsage: number;
    memoryUsage: number;
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