// BTCDOM2.0策略相关类型定义

// 策略参数配置
export interface BTCDOM2StrategyParams {
  startDate: string;           // 持仓开始时间 (YYYY-MM-DD)
  endDate: string;             // 持仓结束时间 (YYYY-MM-DD)
  initialCapital: number;      // 初始本金 (USDT)
  btcRatio: number;           // BTC占比 (0-1)
  volumeWeight: number;       // 成交量排行榜权重 (0-1)
  volatilityWeight: number;   // 波动率排行榜权重 (0-1)
  priceChangeThreshold: number; // 涨跌幅阈值 (%)
  maxShortPositions: number;  // 最多做空标的数量
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
  volatility24h: number;      // 24小时波动率
  high24h: number;           // 24小时最高价
  low24h: number;            // 24小时最低价
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
  rankings: RankingItem[];    // 按跌幅排序的排行榜
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
  
  // 评分相关
  volumeScore: number;        // 成交量分数
  priceChangeScore: number;   // 涨跌幅分数
  totalScore: number;         // 综合分数
  
  eligible: boolean;          // 是否符合做空条件
  reason: string;            // 选择或排除原因
}

// 持仓信息
export interface PositionInfo {
  symbol: string;
  side: 'LONG' | 'SHORT';     // 多头或空头
  amount: number;             // 持仓金额 (USDT)
  quantity: number;           // 持仓数量
  entryPrice: number;         // 开仓价格
  currentPrice: number;       // 当前价格
  pnl: number;               // 盈亏
  pnlPercent: number;        // 盈亏百分比
  marketShare?: number;       // 市场份额 (用于计算做空比例)
  reason: string;            // 持仓原因
}

// 策略快照 (每个时间点的状态)
export interface StrategySnapshot {
  timestamp: string;
  hour: number;                      // 小时数
  btcPrice: number;                  // BTC价格
  btcPriceChange24h: number;         // BTC 24小时价格变化
  
  // 持仓信息
  btcPosition: PositionInfo | null;  // BTC现货持仓
  shortPositions: PositionInfo[];    // 做空持仓列表
  totalValue: number;                // 总资产价值
  totalPnl: number;                  // 总盈亏
  totalPnlPercent: number;           // 总盈亏百分比
  cashPosition: number;              // 现金持仓 (当无符合条件的做空标的时)
  
  // 策略状态
  isActive: boolean;                 // 策略是否持仓
  rebalanceReason: string;           // 再平衡原因
  shortCandidates: ShortCandidate[]; // 做空候选标的详情
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
  annualizedReturn: number;   // 年化收益率
  volatility: number;         // 波动率
  sharpeRatio: number;        // 夏普比率
  maxDrawdown: number;        // 最大回撤
  winRate: number;           // 胜率
  avgReturn: number;         // 平均收益率
  bestPeriod: number;        // 最佳收益期
  worstPeriod: number;       // 最差收益期
  calmarRatio: number;       // 卡玛比率
}

// 图表数据点
export interface BTCDOM2ChartData {
  timestamp: string;
  hour: number;              // 小时数
  totalValue: number;        // 总资产价值
  totalReturn: number;       // 累计收益率
  btcValue: number;         // BTC部分价值
  shortValue: number;       // 做空部分价值
  cashValue: number;        // 现金部分价值
  drawdown: number;         // 回撤
  isActive: boolean;        // 策略是否持仓
  btcPrice: number;         // BTC价格
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