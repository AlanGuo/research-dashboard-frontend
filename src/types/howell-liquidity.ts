// Michael Howell Global Liquidity数据点接口定义
export interface HowellLiquidityDataPoint {
  date: string;                  // 日期，格式为 YYYY-MM-DD 或 YYYY-MM
  globalLiquidity: number;       // 全球流动性（单位：万亿）
  shadowMonetaryBase: number;    // Shadow Monetary Base
  collateralMultiplier: number;  // Collateral Multiplier
  isRevised: boolean;            // 是否为修正后的数据
  
  // 用于图表显示的附加字段
  timestamp?: number;            // 转换后的时间戳
}

// Howell Liquidity API响应接口
export interface HowellLiquidityResponse {
  success: boolean;
  data?: HowellLiquidityDataPoint[];
  error?: string;
  timestamp: string;
  message?: string;
}
