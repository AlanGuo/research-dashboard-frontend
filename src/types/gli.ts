// GLI数据点接口定义
export interface GliDataPoint {
  timestamp: number;
  datetime: string;
  
  // 汇率数据
  eurusd?: number;
  cnyusd?: number;
  jpyusd?: number;
  gbpusd?: number;
  cadusd?: number;
  audusd?: number;
  inrusd?: number;
  chfusd?: number;
  rubusd?: number;
  brlusd?: number;
  krwusd?: number;
  mxnusd?: number;
  idrusd?: number;
  zarusd?: number;
  myrusd?: number;
  sekusd?: number;
  nzdusd?: number;
  
  // 央行数据
  fed?: number;
  rrp?: number;
  tga?: number;
  ecb?: number;
  pbc?: number;
  boj?: number;
  other_cb_total?: number;
  
  // M2供应数据
  usa?: number;
  eu?: number;
  china?: number;
  japan?: number;
  other_m2_total?: number;
  
  // 总计
  total: number;
}

// GLI API响应接口
export interface GliResponse {
  success: boolean;
  data?: GliDataPoint[];
  error?: string;
  timestamp?: string;
  params?: GliParams;
  message?: string;
}

// 对比标的类型
export type BenchmarkType = 'none' | 'btcusdt' | 'gold' | 'ndx' | 'spx';

// 时间范围类型
export type TimeRangeType = '1y' | '3y' | '5y' | '10y' | '20y';

// GLI趋势时段定义
export interface TrendPeriod {
  startDate: string;
  endDate: string;
  trend: 'up' | 'down'; // 上升或下降
  label?: string; // 可选标签
  percentChange?: number; // GLI在该时段的百分比变化
}

// GLI参数接口
export interface GliParams {
  // 美元净流动性控制
  unl_active?: boolean;
  // 原始参数
  fed_active?: boolean;
  rrp_active?: boolean;
  tga_active?: boolean;
  // 其他央行
  ecb_active?: boolean;
  pbc_active?: boolean;
  boj_active?: boolean;
  other_active?: boolean;
  // 货币供应
  usa_active?: boolean;
  europe_active?: boolean;
  china_active?: boolean;
  japan_active?: boolean;
  other_m2_active?: boolean;
  // 对比标的
  benchmark?: BenchmarkType;
  // 查询参数
  interval?: string;
  timeRange?: TimeRangeType; // 添加时间范围选项
  limit?: number;
  from?: number;
  // 时间偏移参数，正数表示GLI领先，负数表示GLI滞后
  offset?: number;
  // 是否反转对比标的的Y轴
  invertBenchmarkYAxis?: boolean;
}
