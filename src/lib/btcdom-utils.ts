import { 
  BtcDomStrategyData, 
  BtcDomComparisonData, 
  BtcDomPerformanceMetrics,
  ProcessedStrategyRecord,
  KlineData,
  ChartDataPoint,
  BtcDomComparisonParams
} from '@/types/btcdom';

// 重新导出KlineData以便在其他文件中使用
export type { KlineData } from '@/types/btcdom';

// 处理策略数据，以策略记录为主导
export function processStrategyData(rawData: BtcDomStrategyData[]): ProcessedStrategyRecord[] {
  if (!rawData || rawData.length === 0) {
    console.warn('No strategy data provided');
    return [];
  }

  const validRecords: ProcessedStrategyRecord[] = rawData
    .filter(item => {
      // 必须有开仓日期、总盈亏、BTC仓位、BTC初始价格、ALT初始仓位
      // 平仓日期是可选的（持仓中的交易没有平仓日期）
      const hasRequiredFields = 
        item["开仓日期"] &&
        item["总盈亏"] !== null && item["总盈亏"] !== undefined &&
        item["BTC仓位"] !== null && item["BTC仓位"] !== undefined &&
        item["BTC初始价格"] !== null && item["BTC初始价格"] !== undefined &&
        item["ALT初始仓位(U) "] !== null && item["ALT初始仓位(U) "] !== undefined;
      
      if (!hasRequiredFields) {
        console.log('Filtered out invalid item (missing required fields):', item);
      }
      
      return hasRequiredFields;
    })
    .map(item => {
      const openDate = formatDateString(item["开仓日期"]!);
      const closeDate = item["平仓日期"] ? formatDateString(item["平仓日期"]!) : null;
      const totalPnl = Number(item["总盈亏"]);
      const btcPosition = Number(item["BTC仓位"]);
      const btcInitialPrice = Number(item["BTC初始价格"]);
      const altInitialPosition = Number(item["ALT初始仓位(U) "]);
      const isOpenPosition = !closeDate; // 没有平仓日期表示持仓中
      
      // 计算初始金额 = BTC仓位 * BTC初始价格 + ALT初始仓位(U)
      const initialAmount = btcPosition * btcInitialPrice + altInitialPosition;
      
      // 计算策略收益率 = (总盈亏 + 初始金额) / 初始金额
      const strategyReturn = ((totalPnl + initialAmount) / initialAmount - 1) * 100;
      
      console.log(`Strategy record: ${openDate} to ${closeDate || 'OPEN'}, PnL: ${totalPnl}, Initial: ${initialAmount}, Return: ${strategyReturn.toFixed(2)}%${isOpenPosition ? ' [OPEN POSITION]' : ''}`);
      
      return {
        openDate,
        closeDate,
        totalPnl,
        btcPosition,
        btcInitialPrice,
        altInitialPosition,
        initialAmount,
        strategyReturn,
        isOpenPosition
      };
    })
    .sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());

  console.log('Valid strategy records after processing:', validRecords.length);
  return validRecords;
}

// 从K线数据中提取价格数据
export function extractPricesFromKlineData(klineData: KlineData): Map<string, number> {
  console.log('Extracting prices from kline data');
  
  if (!klineData?.candles || klineData.candles.length === 0) {
    console.warn('No kline data provided');
    return new Map();
  }

  const priceMap = new Map<string, number>();
  
  klineData.candles.forEach(candle => {
    const date = new Date(candle.timestamp).toISOString().split('T')[0];
    priceMap.set(date, candle.open);
  });

  return priceMap;
}

// 合并策略数据和币安数据进行对比
export function mergeComparisonData(
  strategyRecords: ProcessedStrategyRecord[],
  binancePriceMap: Map<string, number>,
  latestPrice?: number // 当前价格，用于计算持仓中交易的收益
): BtcDomComparisonData[] {

  if (strategyRecords.length === 0) {
    console.warn('No strategy records to process');
    return [];
  }

  const comparisonData: BtcDomComparisonData[] = strategyRecords.map(record => {
    // 获取币安对应日期的价格
    const binanceOpenPrice = binancePriceMap.get(record.openDate) || null;
    let binanceClosePrice: number | null = null;
    
    // 如果是持仓中的交易，使用当前价格
    if (record.isOpenPosition && latestPrice) {
      binanceClosePrice = latestPrice;
    } else if (record.closeDate) {
      binanceClosePrice = binancePriceMap.get(record.closeDate) || null;
    }
    
    // 计算币安收益率
    let binanceReturn: number | null = null;
    if (binanceOpenPrice && binanceClosePrice) {
      binanceReturn = ((binanceClosePrice - binanceOpenPrice) / binanceOpenPrice) * 100;
    }
    
    // 计算表现差异
    const performanceDiff = binanceReturn !== null ? record.strategyReturn - binanceReturn : null;

    return {
      openDate: record.openDate,
      closeDate: record.closeDate,
      strategyInitialAmount: record.initialAmount,
      strategyTotalPnl: record.totalPnl,
      strategyReturn: record.strategyReturn,
      binanceOpenPrice,
      binanceClosePrice,
      binanceReturn,
      performanceDiff,
      isOpenPosition: record.isOpenPosition
    };
  });

  return comparisonData;
}

// 生成图表数据（累计收益率）
export function generateChartData(comparisonData: BtcDomComparisonData[]): ChartDataPoint[] {

  if (comparisonData.length === 0) {
    return [];
  }

  // 分离已平仓和持仓中的交易
  const closedPositions = comparisonData.filter(record => record.closeDate !== null);
  const openPositions = comparisonData.filter(record => record.closeDate === null);

  // 按照平仓日期排序已平仓的交易
  const sortedClosedData = [...closedPositions].sort((a, b) => 
    new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime()
  );

  let strategyCumReturn = 0;
  let binanceCumReturn = 0;

  // 处理已平仓的交易
  const chartData: ChartDataPoint[] = sortedClosedData.map((record, index) => {
    // 累计策略收益率（复利计算）
    strategyCumReturn = index === 0 
      ? record.strategyReturn
      : (1 + strategyCumReturn / 100) * (1 + record.strategyReturn / 100) * 100 - 100;

    // 累计币安收益率（复利计算）
    if (record.binanceReturn !== null) {
      binanceCumReturn = index === 0 
        ? record.binanceReturn
        : (1 + binanceCumReturn / 100) * (1 + record.binanceReturn / 100) * 100 - 100;
    }

    return {
      date: record.closeDate!, // 已确保不为null
      openDate: record.openDate,
      closeDate: record.closeDate,
      strategyReturn: strategyCumReturn,
      binanceReturn: record.binanceReturn !== null ? binanceCumReturn : null
    };
  });

  // 添加持仓中的交易（使用当前日期）
  if (openPositions.length > 0) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    openPositions.forEach(record => {
      // 对于持仓中的交易，继续累计计算
      strategyCumReturn = chartData.length === 0 && strategyCumReturn === 0
        ? record.strategyReturn
        : (1 + strategyCumReturn / 100) * (1 + record.strategyReturn / 100) * 100 - 100;

      if (record.binanceReturn !== null) {
        binanceCumReturn = chartData.length === 0 && binanceCumReturn === 0
          ? record.binanceReturn
          : (1 + binanceCumReturn / 100) * (1 + record.binanceReturn / 100) * 100 - 100;
      }

      chartData.push({
        date: currentDate, // 使用当前日期显示持仓中的交易
        openDate: record.openDate,
        closeDate: record.closeDate, // null for open positions
        strategyReturn: strategyCumReturn,
        binanceReturn: record.binanceReturn !== null ? binanceCumReturn : null
      });
    });
  }

  return chartData;
}

// 计算性能指标
export function calculatePerformanceMetrics(
  comparisonData: BtcDomComparisonData[],
  isStrategy: boolean = true
): BtcDomPerformanceMetrics {
  
  if (comparisonData.length === 0) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
      avgReturn: 0,
      bestTrade: 0,
      worstTrade: 0
    };
  }

  const returns = comparisonData
    .map(record => isStrategy ? record.strategyReturn : record.binanceReturn)
    .filter(ret => ret !== null) as number[];

  if (returns.length === 0) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
      avgReturn: 0,
      bestTrade: 0,
      worstTrade: 0
    };
  }

  // 基本统计
  const totalTrades = returns.length;
  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / totalTrades;
  const bestTrade = Math.max(...returns);
  const worstTrade = Math.min(...returns);
  const winRate = (returns.filter(ret => ret > 0).length / totalTrades) * 100;

  // 计算总收益率（复利）
  const totalReturn = returns.reduce((cumulative, ret) => 
    (1 + cumulative / 100) * (1 + ret / 100) * 100 - 100, 0
  );

  // 计算年化收益率   
  const firstDate = new Date(comparisonData[0].openDate);
  
  // 对于年化收益率计算，使用最后一个已平仓交易的日期，如果没有则使用当前日期
  const closedPositions = comparisonData.filter(record => record.closeDate !== null);
  const lastDate = closedPositions.length > 0 
    ? new Date(closedPositions[closedPositions.length - 1].closeDate!)
    : new Date(); // 如果都是持仓中，使用当前日期
    
  const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
  const yearsFraction = daysDiff / 365.25;
  const annualizedReturn = yearsFraction > 0 
    ? (Math.pow(1 + totalReturn / 100, 1 / yearsFraction) - 1) * 100
    : totalReturn;

  // 计算波动率
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / totalTrades;
  const volatility = Math.sqrt(variance);

  // 计算夏普比率（假设无风险利率为0）
  const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

  // 计算最大回撤
  let maxDrawdown = 0;
  let cumReturn = 1; // 初始值为1，表示100%

  // 先计算累计收益序列
  const cumulativeReturns: number[] = [1]; // 从1开始
  for (let i = 0; i < returns.length; i++) {
    cumReturn *= (1 + returns[i] / 100);
    cumulativeReturns.push(cumReturn);
  }

  // 计算每个点的回撤
  let runningMax = 1; // 运行中的最大值
  for (let i = 0; i < cumulativeReturns.length; i++) {
    const current = cumulativeReturns[i];
    if (current > runningMax) {
      runningMax = current;
    }
    // 回撤 = (当前值 - 峰值) / 峰值 * 100
    const drawdown = ((current - runningMax) / runningMax) * 100;
    if (drawdown < maxDrawdown) { // 回撤是负值，所以取更小的值
      maxDrawdown = drawdown;
    }
  }

  return {
    totalReturn,
    annualizedReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
    winRate,
    totalTrades,
    avgReturn,
    bestTrade,
    worstTrade
  };
}

// 根据时间范围过滤数据
export function filterDataByTimeRange(
  data: BtcDomComparisonData[],
  params: BtcDomComparisonParams
): BtcDomComparisonData[] {
  
  if (!data || data.length === 0) {
    return [];
  }

  if (params.timeRange === 'ALL') {
    return data;
  }

  const now = new Date();
  let startDate: Date;

  switch (params.timeRange) {
    case '1M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      return data;
  }

  const filtered = data.filter(record => {
    // 对于持仓中的交易，总是包含
    if (record.isOpenPosition) {
      return true;
    }
    // 对于已平仓的交易，检查平仓日期
    if (record.closeDate) {
      return new Date(record.closeDate) >= startDate;
    }
    // 如果没有平仓日期但不是持仓中（理论上不应该发生），使用开仓日期
    return new Date(record.openDate) >= startDate;
  });

  console.log(`Filtered ${data.length} records to ${filtered.length} records`);
  return filtered;
}

// 工具函数：格式化日期字符串
function formatDateString(dateStr: string): string {
  if (!dateStr) return '';
  
  // 如果已经是YYYY-MM-DD格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // 尝试解析其他格式的日期
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  console.warn('Could not parse date string:', dateStr);
  return dateStr;
}

// 工具函数：根据时间范围获取K线数据的天数
export function getBarsFromTimeRange(timeRange: string): number {
  switch (timeRange) {
    case '1M': return 30;
    case '3M': return 90;
    case '6M': return 180;
    case '1Y': return 365;
    case 'ALL': return 1000; // 获取足够多的数据
    default: return 180;
  }
}

// 格式化函数
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.warn('Error formatting date:', dateStr, error);
    return dateStr;
  }
}

export function formatPercentage(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'N/A';
  }
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'N/A';
  }
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'N/A';
  }
  
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(value);
}