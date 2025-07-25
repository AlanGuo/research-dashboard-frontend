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
  entryPrice: number;         // 开仓价格
  currentPrice: number;       // 当前价格
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
  cashPosition: number;              // 现金持仓 (当无符合条件的做空标的时)
  
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