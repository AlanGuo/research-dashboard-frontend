// BTCDOM2.0策略相关类型定义

// 仓位分配策略枚举
export enum PositionAllocationStrategy {
  BY_VOLUME = 'BY_VOLUME',           // 按成交量比例分配
  BY_COMPOSITE_SCORE = 'BY_COMPOSITE_SCORE', // 按综合分数分配权重
  EQUAL_ALLOCATION = 'EQUAL_ALLOCATION'      // 平均分配
}

// 策略参数配置
export interface BTCDOM2StrategyParams {
  startDate: string;           // 持仓开始时间 (YYYY-MM-DDTHH:mm)
  endDate: string;             // 持仓结束时间 (YYYY-MM-DDTHH:mm)
  initialCapital: number;      // 初始本金 (USDT)
  btcRatio: number;           // BTC占比 (0-1)
  priceChangeWeight: number;  // 跌幅权重 (0-1)
  volumeWeight: number;       // 成交量权重 (0-1)
  volatilityWeight: number;   // 波动率权重 (0-1)
  fundingRateWeight: number;  // 资金费率权重 (0-1)
  maxShortPositions: number;  // 最多做空标的数量
  spotTradingFeeRate: number; // 现货交易手续费率 (默认0.0008 = 0.08%)
  futuresTradingFeeRate: number; // 期货交易手续费率 (默认0.0002 = 0.02%)
  rebalanceMode?: boolean;    // 是否启用重新平衡模式，默认true
  longBtc: boolean;           // 是否做多BTC (默认true)
  shortAlt: boolean;          // 是否做空ALT (默认true)
  allocationStrategy: PositionAllocationStrategy; // 仓位分配策略
  granularityHours?: number;  // 回测粒度（小时），默认8小时
  optimizeOnly?: boolean;     // 是否为优化模式（跳过图表数据生成以提升性能）
  
  // 温度计规则相关参数
  useTemperatureRule: boolean;  // 是否启用温度计规则
  temperatureSymbol: string;    // 温度计监控的Symbol (默认OTHERS)
  temperatureThreshold: number; // 温度计阈值 (默认60)
  temperatureTimeframe: string; // 温度计时间间隔 (默认1D)
  temperatureData?: TemperatureDataPoint[]; // 温度计原始数据（运行时获取）
}

// 资金费率历史数据项
export interface FundingRateHistoryItem {
  fundingTime: string;        // 资金费率时间
  fundingRate: number;        // 资金费率
  markPrice: number | null;   // 标记价格，可能为null（当API未返回时）
}

// 新API返回的排行榜数据项
export interface RankingItem {
  rank: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  priceChange24h: number;     // 24小时价格变化百分比
  priceAtTime: number;        // 当前价格
  price24hAgo: number;        // 24小时前价格
  volume24h: number;          // 24小时交易量
  quoteVolume24h: number;     // 24小时交易金额
  marketShare: number;        // 市场份额百分比
  volatility24h: number;         // 24小时波动率百分比
  high24h: number;               // 24小时最高价
  low24h: number;                // 24小时最低价
  futureSymbol?: string;         // 对应的期货交易对symbol（如果与现货不同）
  futurePriceAtTime?: number;    // 期货价格（当前时间点）
  fundingRateHistory?: FundingRateHistoryItem[]; // 对应时间段的资金费率历史
  currentFundingRate?: FundingRateHistoryItem[]; // 当期可用的资金费率数组（用于选股评分）
}

// 市场统计数据
export interface MarketStats {
  totalVolume: number;        // 总交易量
  totalQuoteVolume: number;   // 总交易金额
}

// 新API返回的数据点
export interface VolumeBacktestDataPoint {
  timestamp: string;
  hour: number;
  btcPrice: number;           // BTC价格
  btcPriceChange24h: number;  // BTC 24小时价格变化
  btcdomPrice?: number;       // BTCDOM合约价格
  btcdomPriceChange24h?: number; // BTCDOM 24小时价格变化
  rankings: RankingItem[];    // 按跌幅排序的排行榜
  removedSymbols?: RankingItem[]; // 上一期有但本期没有的币种
  marketStats: MarketStats;   // 市场统计
}

// 新API响应结构
export interface VolumeBacktestResponse {
  success: boolean;
  granularityHours: number;   // 时间间隔（小时）
  data: VolumeBacktestDataPoint[];
}

// 做空候选标的评分
export interface ShortCandidate {
  symbol: string;
  rank: number;               // 原始排名
  priceChange24h: number;     // 价格变化
  volume24h: number;          // 交易量
  quoteVolume24h: number;     // 交易金额
  volatility24h: number;      // 波动率
  marketShare: number;        // 市场份额
  priceAtTime?: number;       // 当前时刻现货价格
  futurePriceAtTime?: number; // 期货价格（如果有）
  futureSymbol?: string;      // 对应的期货交易对symbol（如果与现货不同）
  
  // 评分相关
  priceChangeScore: number;   // 跌幅分数
  volumeScore: number;        // 成交量分数
  volatilityScore: number;    // 波动率分数
  fundingRateScore: number;   // 资金费率分数
  totalScore: number;         // 综合分数
  
  eligible: boolean;          // 是否符合做空条件
  reason: string;            // 选择或排除原因
}

// 持仓信息
export interface PositionInfo {
  symbol: string;             // 原始交易对symbol（用于数据查找）
  displaySymbol?: string;     // 显示用的交易对symbol（期货或现货）
  side: 'LONG' | 'SHORT';     // 多头或空头
  amount: number;             // 持仓金额 (USDT)
  quantity: number;           // 持仓数量
  entryPrice: number;         // 持仓均价（加权平均成本价）
  currentPrice: number;       // 当前价格
  periodTradingPrice?: number; // 当期交易价格（用于与实盘对比）
  periodTradingType?: 'buy' | 'sell' | 'hold'; // 当期交易类型
  tradingQuantity?: number;    // 本期实际交易数量（正数表示买入，负数表示卖出，0表示无交易）
  pnl: number;               // 盈亏
  pnlPercent: number;        // 盈亏百分比
  tradingFee: number;        // 当期交易手续费
  fundingFee?: number;       // 当期资金费
  accumulatedFundingFee?: number; // 累计资金费
  priceChange24h?: number;   // 24小时价格变化百分比
  marketShare?: number;       // 市场份额 (用于计算做空比例)
  reason: string;            // 持仓原因
  isNewPosition?: boolean;    // 是否为新增持仓
  isSoldOut?: boolean;        // 是否在当期卖出
  quantityChange?: {          // 数量变化信息
    type: 'new' | 'increase' | 'decrease' | 'same' | 'sold';
    previousQuantity?: number;
    changePercent?: number;
  };
  priceChange?: {             // 价格变化信息
    type: 'new' | 'increase' | 'decrease' | 'same';
    previousPrice?: number;
    changePercent?: number;
  };
  fundingRateHistory?: FundingRateHistoryItem[]; // 资金费率历史
}

// 策略快照 (每个时间点的状态)
export interface StrategySnapshot {
  timestamp: string;
  hour: number;                      // 小时数
  btcPrice: number;                  // BTC价格
  btcPriceChange24h: number;         // BTC 24小时价格变化
  btcdomPrice?: number;              // BTCDOM合约价格
  btcdomPriceChange24h?: number;     // BTCDOM 24小时价格变化
  
  // 持仓信息
  btcPosition: PositionInfo | null;  // BTC现货持仓
  shortPositions: PositionInfo[];    // 做空持仓列表
  soldPositions?: PositionInfo[];    // 当期卖出的持仓列表
  totalValue: number;                // 总资产价值
  totalPnl: number;                  // 总盈亏
  totalPnlPercent: number;           // 总盈亏百分比
  periodPnl: number;                 // 本期盈亏 (相对于上期)
  periodPnlPercent: number;          // 本期收益率 (相对于上期)
  totalTradingFee: number;           // 当期总手续费
  accumulatedTradingFee: number;     // 累计总手续费
  totalFundingFee?: number;          // 当期总资金费
  accumulatedFundingFee?: number;    // 累计总资金费
  
  // 现金余额详情（用于与实盘对比）
  spot_usdt_balance: number;         // 现货USDT余额
  futures_usdt_balance: number;      // 期货USDT余额
  
  // 策略状态
  isActive: boolean;                 // 策略是否持仓
  rebalanceReason: string;           // 再平衡原因
  shortCandidates: ShortCandidate[]; // 做空候选标的详情
  temperatureValue?: number | null;  // 前一天的温度计数值（用于判断是否持仓）
}

// 策略回测结果
export interface BTCDOM2BacktestResult {
  params: BTCDOM2StrategyParams;
  snapshots: StrategySnapshot[];
  performance: BTCDOM2PerformanceMetrics;
  chartData: BTCDOM2ChartData[];
  summary: {
    totalRebalances: number;    // 总再平衡次数
    activeRebalances: number;   // 持仓状态的再平衡次数
    inactiveRebalances: number; // 空仓状态的再平衡次数
    avgShortPositions: number;  // 平均做空标的数量
    granularityHours: number;   // 时间间隔
  };
}

// 性能指标
export interface BTCDOM2PerformanceMetrics {
  totalReturn: number;        // 总收益率
  btcReturn: number;         // BTC做多收益率
  altReturn: number;         // ALT做空收益率
  annualizedReturn: number;   // 年化收益率
  volatility: number;         // 波动率
  sharpeRatio: number;        // 夏普比率
  maxDrawdown: number;        // 最大回撤
  winRate: number;           // 胜率
  avgReturn: number;         // 平均收益率
  bestPeriod: number;        // 最佳收益期
  worstPeriod: number;       // 最差收益期
  calmarRatio: number;       // 卡玛比率
  bestPeriodInfo?: {         // 最佳收益期详情
    return: number;
    timestamp: string;
    period: number;
  };
  worstPeriodInfo?: {        // 最差收益期详情
    return: number;
    timestamp: string;
    period: number;
  };
  bestFundingPeriod?: number;        // 最多资金费期
  worstFundingPeriod?: number;       // 最少资金费期
  bestFundingPeriodInfo?: {          // 最多资金费期详情
    fundingFee: number;
    timestamp: string;
    period: number;
  };
  worstFundingPeriodInfo?: {         // 最少资金费期详情
    fundingFee: number;
    timestamp: string;
    period: number;
  };
  maxDrawdownInfo?: {                // 最大回撤详情
    drawdown: number;                // 最大回撤值
    startTimestamp: string;          // 回撤开始时间（峰值）
    endTimestamp: string;            // 回撤结束时间（谷底）
    startPeriod: number;             // 回撤开始期数
    endPeriod: number;               // 回撤结束期数
    duration: number;                // 持续期数
  };
  // 盈亏金额分解
  pnlBreakdown: {
    totalPnlAmount: number;      // 总盈亏金额
    btcPnlAmount: number;        // BTC做多盈亏金额
    altPnlAmount: number;        // ALT做空盈亏金额
    tradingFeeAmount: number;    // 手续费金额（负数）
    fundingFeeAmount: number;    // 资金费率金额
    // 收益率（基于初始资本）
    totalPnlRate: number;        // 总盈亏收益率
    btcPnlRate: number;          // BTC做多收益率
    altPnlRate: number;          // ALT做空收益率
    tradingFeeRate: number;      // 手续费收益率
    fundingFeeRate: number;      // 资金费率收益率
  };
}

// 图表数据点
export interface BTCDOM2ChartData {
  timestamp: string;
  hour: number;              // 小时数
  totalValue: number;        // 总资产价值
  totalReturn: number;       // 累计收益率
  btcReturn: number;         // BTC收益率 (新增)
  btcValue: number;         // BTC部分价值
  shortValue: number;       // 做空部分价值
  cashValue: number;        // 现金部分价值
  drawdown: number;         // 回撤
  isActive: boolean;        // 策略是否持仓
  btcPrice: number;         // BTC价格
  btcdomPrice?: number;     // BTCDOM合约价格
  liveReturn?: number;      // 实盘收益率 (可选)
}

// 实盘表现数据类型
export interface LivePerformanceData {
  _id: string;
  timestamp: string;
  position_pnl: number;
  btc_pnl: number;
  futures_pnl: number;
  total_fees_usdt: number;
  total_funding_fee_usdt: number;
  total_pnl: number;
  total_return_rate: number;
  total_trades: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
  positions_count: number;
  market_data_timestamp: string;
  execution_id: string;
}

// 实盘统计信息
export interface LivePerformanceStats {
  totalRecords: number;
  dateRange: {
    _id: null;
    earliest: string | null;
    latest: string | null;
  };
  performanceSummary: {
    totalPnl: number;
    totalReturnRate?: number;
    totalTrades: number;
    totalFees?: number;
    totalFundingFees?: number;
  };
}

// API响应类型
export interface BTCDOM2ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

// 策略状态
export interface BTCDOM2StrategyStatus {
  isRunning: boolean;
  lastRebalance: string;
  nextRebalance: string;
  dataAvailability: {
    volumeRanking: boolean;
    priceData: boolean;
    volatilityData: boolean;
  };
  errors: string[];
  warnings: string[];
}

// 前端计算用的策略引擎配置
export interface StrategyConfig {
  params: BTCDOM2StrategyParams;
  granularityHours: number;
}

// 做空标的筛选结果
export interface ShortSelectionResult {
  selectedCandidates: ShortCandidate[];
  rejectedCandidates: ShortCandidate[];
  totalCandidates: number;
  selectionReason: string;
}

// 温度计原始数据点
export interface TemperatureDataPoint {
  timestamp: string;  // 时间戳 ISO格式
  value: number;      // 温度计数值
}

// 温度计API响应数据
export interface TemperaturePeriodsData {
  symbol: string;
  timeframe: string;
  data: TemperatureDataPoint[];
  totalDataPoints: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// 温度计API响应结构
export interface TemperaturePeriodsResponse {
  success: boolean;
  data?: TemperaturePeriodsData;
  message?: string;
}

// 缓存状态条目
export interface CacheStatusEntry {
  cacheKey: string;
  symbol: string;
  timeframe: string;
  dataPoints: number;
  dateRange: {
    start: string;
    end: string;
  } | null;
  lastUpdated: string;
  memorySizeKB: number;
}

// 缓存状态数据
export interface CacheStatusData {
  cacheStatus: 'not_initialized' | 'active';
  totalEntries: number;
  totalDataPoints?: number;
  totalMemoryKB?: number;
  totalMemoryMB?: number;
  entries: CacheStatusEntry[];
  lastChecked?: string;
  message?: string;
}

// 交易日志条目
export interface TradingLogEntry {
  _id?: string;
  order_id: string;
  action: string;
  error_message: string | null;
  execution_id: string;
  fee: number;
  fee_asset: string;
  fee_usdt_value: number;
  market_data_timestamp: Date | string;
  price: number;
  quantity: number;
  side: string;
  status: string;
  symbol: string;
  target_quantity: number;
  timestamp: string;
}

// 交易日志响应
export interface TradingLogsResponse {
  success: boolean;
  data: TradingLogEntry[];
  count: number;
  query?: {
    startTimestamp?: string;
    endTimestamp?: string;
    marketDataTimestamp?: string;
  };
  error?: string;
  details?: string;
}

// 盈亏差异计算结果
export interface PnlDifferenceCalculation {
  entryPnlDiff?: number;    // 开仓价格差异导致的盈亏
  exitPnlDiff?: number;     // 平仓价格差异导致的盈亏
  totalPnlDiff: number;     // 总盈亏差异
  hasValidData: boolean;    // 是否有有效的计算数据
  calculationNote?: string; // 计算说明
}

// 价格对比数据
export interface PriceComparison {
  symbol: string;
  status: 'holding' | 'closed'; // holding: 持仓中, closed: 已平仓
  position: PositionInfo; // 保存position引用用于判断做空/做多逻辑
  relevantLog?: TradingLogEntry; // 对应的实盘交易日志
  backtest: {
    entryPrice?: number;
    exitPrice?: number;
  };
  live: {
    entryPrice?: number;
    exitPrice?: number;
  };
  differences: {
    entryPriceDiff?: number;
    entryPriceDiffPercent?: number;
    exitPriceDiff?: number;
    exitPriceDiffPercent?: number;
  };
  pnlDifference: PnlDifferenceCalculation; // 盈亏差异计算结果
}


// 全期数盈亏差异汇总统计
export interface TotalPnlDifferenceSummary {
  btcLongPnlDiff: number;       // BTC多头盈亏差异
  altShortPnlDiff: number;      // ALT做空盈亏差异
  totalPnlDiff: number;         // 总盈亏差异
  totalPeriods: number;         // 总期数
  validCalculations: number;    // 有效计算次数
  totalCalculations: number;    // 总计算次数
  periodRange: {                // 期数范围
    startPeriod: number;
    endPeriod: number;
    startTimestamp: string;
    endTimestamp: string;
  };
  breakdown: {                  // 详细分解
    btcLong: {
      entryPnlDiff: number;     // BTC开仓差异
      exitPnlDiff: number;      // BTC平仓差异
      totalTransactions: number; // 交易次数
    };
    altShort: {
      entryPnlDiff: number;     // ALT开仓差异
      exitPnlDiff: number;      // ALT平仓差异
      totalTransactions: number; // 交易次数
    };
  };
}

// 当期盈亏差异汇总统计
export interface CurrentPeriodPnlDifferenceSummary {
  btcLongPnlDiff: number;       // BTC多头盈亏差异
  altShortPnlDiff: number;      // ALT做空盈亏差异
  totalPnlDiff: number;         // 总盈亏差异
  periodNumber: number;         // 期数
  validCalculations: number;    // 有效计算次数
  totalCalculations: number;    // 总计算次数
  periodTimestamp: string;      // 期数时间戳
  breakdown: {                  // 详细分解
    btcLong: {
      entryPnlDiff: number;     // BTC开仓差异
      exitPnlDiff: number;      // BTC平仓差异
      totalTransactions: number; // 交易次数
    };
    altShort: {
      entryPnlDiff: number;     // ALT开仓差异
      exitPnlDiff: number;      // ALT平仓差异
      totalTransactions: number; // 交易次数
    };
  };
}

// 价格对比汇总数据
export interface PriceComparisonSummary {
  marketDataTimestamp: string;
  comparisons: PriceComparison[];
  statistics: {
    totalSymbols: number;
    averageEntryPriceDiff: number;
    averageEntryPriceDiffPercent: number;
    averageExitPriceDiff: number;
    averageExitPriceDiffPercent: number;
  };
}


// 综合差异计算结果
export interface ComprehensiveDifference {
  marketValueDiff: number;      // 市值差异（未实现损益差异）
  executionDiff: number;        // 执行差异（已实现损益差异，仅平仓时）
  totalImpact: number;          // 总影响
  
  // 数量对比
  backtestQuantity: number;     // 回测持仓/交易数量
  realQuantity: number;         // 实盘持仓/交易数量
  quantityDiff: number;         // 数量差异
  quantityDiffPercent: number;  // 数量差异百分比
  
  // 价格对比
  backtestMarketPrice?: number; // 回测市值价格
  realMarketPrice?: number;     // 实盘市值价格
  
  // 计算说明
  calculationType: 'market_value' | 'execution' | 'both' | 'none' | 'simplified';
  calculationNote: string;
  hasValidData: boolean;
}

// 综合价格对比数据
export interface ComprehensivePriceComparison {
  symbol: string;
  position: PositionInfo;
  tradingLog: TradingLogEntry | null;
  difference: ComprehensiveDifference;
  status: 'new_position' | 'holding' | 'partial_close' | 'full_close' | 'add_position';
}

// 综合差异汇总统计
export interface ComprehensiveDifferenceSummary {
  totalMarketValueDiff: number;     // 总市值差异
  totalExecutionDiff: number;       // 总执行差异
  totalImpact: number;              // 总影响
  totalImpactPercent: number;       // 总影响百分比（相对于资产总额）
  
  // 按类型分组统计
  byPositionType: {
    newPositions: number;           // 新开仓数量
    holdingPositions: number;       // 持仓不变数量
    addPositions: number;           // 加仓数量
    partialClosePositions: number;  // 部分平仓数量
    fullClosePositions: number;     // 完全平仓数量
  };
  
  // 按币种分组统计
  byCoinType: {
    btcImpact: number;             // BTC相关影响
    altImpact: number;             // ALT币相关影响
  };
  
  // 数据质量统计
  dataQuality: {
    totalComparisons: number;      // 总对比数量
    validMarketPriceCount: number; // 有效市值价格数量
    quantityMismatchCount: number; // 数量不匹配的对比数量
  };
  
  // 时间信息
  marketDataTimestamp: string;
  calculationTimestamp: string;
}

// BTC持仓信息
export interface BtcPosition {
  symbol: string;
  quantity: number;
  avg_price: number;
  value: number;
  unrealized_pnl: number;
}

// 做空持仓信息
export interface ShortPosition {
  symbol: string;
  quantity: number;
  avg_price: number;
  value: number;
  unrealized_pnl: number;
}

// 持仓信息总览
export interface Positions {
  btc: BtcPosition;
  shorts: ShortPosition[];
  spot_usdt_balance: number;
  futures_usdt_balance: number;
}

// 持仓历史记录
export interface Btcdom2PositionHistory {
  _id?: string;
  timestamp: string;
  market_data_timestamp: Date | string;
  execution_id: string;
  positions: Positions;
}

// 持仓历史API响应
export interface PositionHistoryResponse {
  success: boolean;
  data: Btcdom2PositionHistory | Btcdom2PositionHistory[] | null;
  count?: number;
  query?: {
    marketDataTimestamp?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: number;
  };
  error?: string;
}

// 增强版综合差异计算结果（支持持仓金额和交易金额差异）
export interface EnhancedComprehensiveDifference {
  // 原有字段
  marketValueDiff: number;      // 市值差异（总和）
  executionDiff: number;        // 执行差异（总和）
  totalImpact: number;          // 总影响
  
  // 金额差异分解
  holdingAmountDiff: number;    // 持仓金额差异
  cashBalanceDiff: number;      // 现金余额差异
  
  // 持仓数量对比
  backtestHoldingQuantity: number;     // 回测持仓数量
  realHoldingQuantity: number;         // 实盘持仓数量
  holdingQuantityDiff: number;         // 持仓数量差异
  holdingQuantityDiffPercent: number;  // 持仓数量差异百分比
  
  // 价格对比
  backtestMarketPrice?: number; // 回测市值价格
  realMarketPrice?: number;     // 实盘市值价格
  holdingPriceDiff?: number;    // 持仓价格差异
  holdingPriceDiffPercent?: number; // 持仓价格差异百分比
  
  // 计算说明
  calculationType: 'market_value' | 'execution' | 'both' | 'none' | 'simplified';
  calculationNote: string;
  hasValidData: boolean;
}

// 增强版综合价格对比数据
export interface EnhancedComprehensivePriceComparison {
  symbol: string;
  position: PositionInfo;
  positionHistory: Btcdom2PositionHistory | null;  // 实盘持仓历史数据
  difference: EnhancedComprehensiveDifference;
  status: 'new_position' | 'holding' | 'partial_close' | 'full_close' | 'add_position';
}

// 增强版综合差异汇总统计
export interface EnhancedComprehensiveDifferenceSummary {
  // 总差异（原有）
  totalMarketValueDiff: number;     // 总市值差异
  totalExecutionDiff: number;       // 总执行差异
  totalImpact: number;              // 总影响
  totalImpactPercent: number;       // 总影响百分比（相对于资产总额）
  
  // 新增：金额差异统计
  totalHoldingAmountDiff: number;   // 总持仓金额差异
  totalCashBalanceDiff: number;     // 总现金余额差异
  totalRealHoldingValue: number;    // 实盘持仓价值总计
  totalBacktestHoldingAmount: number; // 回测持仓金额总计
  realSpotBalance: number;          // 实盘现货余额
  realFuturesBalance: number;       // 实盘期货余额
  backtestSpotBalance: number;      // 回测现货余额
  backtestFuturesBalance: number;   // 回测期货余额
  holdingAmountImpactPercent: number; // 持仓金额差异影响百分比
  cashBalanceImpactPercent: number; // 现金余额差异影响百分比
  
  // 按类型分组统计
  byPositionType: {
    newPositions: number;           // 新开仓数量
    holdingPositions: number;       // 持仓不变数量
    addPositions: number;           // 加仓数量
    partialClosePositions: number;  // 部分平仓数量
    fullClosePositions: number;     // 完全平仓数量
  };
  
  // 按币种分组统计
  byCoinType: {
    btcImpact: number;             // BTC相关影响
    altImpact: number;             // ALT币相关影响
  };
  
  // 数据质量统计
  dataQuality: {
    totalComparisons: number;      // 总对比数量
    validMarketPriceCount: number; // 有效市值价格数量
    validPositionHistoryCount: number; // 有效持仓历史数量
    holdingQuantityMismatchCount: number; // 持仓数量不匹配数量
  };
  
  // 时间信息
  marketDataTimestamp: string;
  calculationTimestamp: string;
}