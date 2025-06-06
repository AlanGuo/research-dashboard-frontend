export interface BtcDomStrategyData {
  [key: string]: string | number | boolean | null | undefined; // 从Notion返回的数据结构
  "总盈亏"?: number;
  "平仓日期"?: string;
  "开仓日期"?: string;
  "ALT浮动盈亏"?: number;
  "BTC初始价格"?: number;
  "资金费率"?: number;
  "ALT初始余额(U)"?: number;
  "ALT初始仓位(U) "?: number;
  "状态"?: string | null;
  "BTC现价"?: number;
  "ALT当前余额(U)"?: number;
  "BTC仓位"?: number;
  "备注"?: string;
  // 兼容旧字段
  date?: string;
  value?: number;
  performance?: number;
}

export interface ProcessedStrategyRecord {
  openDate: string;
  closeDate: string | null; // 持仓中的交易没有平仓日期
  totalPnl: number;
  btcPosition: number;
  btcInitialPrice: number;
  altInitialPosition: number;
  initialAmount: number; // 初始金额 = BTC仓位 * BTC初始价格 + ALT初始仓位(U)
  strategyReturn: number; // 策略收益率 = (总盈亏 + 初始金额) / 初始金额
  isOpenPosition?: boolean; // 是否为持仓中的交易
}

export interface BinanceBtcDomData {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  lastUpdated: string;
  timestamp: string;
}

export interface BtcDomComparisonData {
  openDate: string;  // 开仓日期
  closeDate: string | null;  // 平仓日期，持仓中为null
  
  // 策略数据
  strategyInitialAmount: number;  // 策略初始金额
  strategyTotalPnl: number;       // 策略总盈亏
  strategyReturn: number;         // 策略收益率
  
  // 币安数据
  binanceOpenPrice: number | null;   // 币安开仓价格
  binanceClosePrice: number | null;  // 币安平仓价格
  binanceReturn: number | null;      // 币安收益率
  
  // 对比数据
  performanceDiff: number | null;    // 表现差异 (策略收益率 - 币安收益率)
  
  // 用于图表显示的累计收益率数据
  strategyCumulativeReturn?: number;
  binanceCumulativeReturn?: number;
  
  // 持仓标识
  isOpenPosition?: boolean;  // 是否为持仓中的交易
}

export interface BtcDomResponse {
  success: boolean;
  data?: BtcDomStrategyData[];
  error?: string;
}

export interface BtcDomComparisonParams {
  timeRange: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  startDate?: string;
  endDate?: string;
}

export interface BtcDomPerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  avgReturn: number;
  bestTrade: number;
  worstTrade: number;
}

export interface BtcDomComparisonResult {
  strategy: BtcDomPerformanceMetrics;
  binance: BtcDomPerformanceMetrics;
}

// K线数据接口
export interface KlineCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface KlineData {
  symbol: string;
  interval: string;
  candles: KlineCandle[];
  lastUpdated: string;
}

// 图表显示用的数据接口
export interface ChartDataPoint {
  date: string;
  openDate?: string;
  closeDate?: string | null; // 支持null值用于持仓中的交易
  strategyReturn: number | null;
  binanceReturn: number | null;
}