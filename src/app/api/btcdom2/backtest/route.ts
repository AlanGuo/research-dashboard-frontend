import { NextRequest, NextResponse } from 'next/server';
import { 
  BTCDOM2StrategyParams, 
  BTCDOM2BacktestResult, 
  BTCDOM2ChartData,
  BTCDOM2PerformanceMetrics,
  StrategySnapshot,
  PositionInfo,
  VolumeBacktestResponse,
  VolumeBacktestDataPoint,
  RankingItem,
  ShortCandidate,
  ShortSelectionResult
} from '@/types/btcdom2';

// 策略引擎类
class BTCDOM2StrategyEngine {
  private params: BTCDOM2StrategyParams;
  private granularityHours: number;

  constructor(params: BTCDOM2StrategyParams, granularityHours: number) {
    this.params = params;
    this.granularityHours = granularityHours;
  }

  // 筛选做空候选标的
  selectShortCandidates(
    rankings: RankingItem[], 
    btcPriceChange: number
  ): ShortSelectionResult {
    const allCandidates: ShortCandidate[] = [];
    
    // 排除BTC本身，处理所有候选标的
    const filteredRankings = rankings.filter(item => item.symbol !== 'BTCUSDT');
    const totalCandidates = filteredRankings.length;
    
    filteredRankings.forEach((item) => {
      const priceChange = item.priceChange24h;
      
      // 计算成交量分数：排名越靠前（数字越小），分数越高
      const volumeScore = (totalCandidates - item.rank + 1) / totalCandidates;
      
      // 计算涨跌幅分数：涨跌幅越小（越负），分数越高
      // 将涨跌幅映射到0-1分数，跌幅最大的得1分，涨幅最大的得0分
      const sortedPriceChanges = filteredRankings
        .map(r => r.priceChange24h)
        .sort((a, b) => a - b); // 从小到大排序
      
      const minPriceChange = sortedPriceChanges[0];
      const maxPriceChange = sortedPriceChanges[sortedPriceChanges.length - 1];
      const priceChangeScore = maxPriceChange > minPriceChange 
        ? (maxPriceChange - priceChange) / (maxPriceChange - minPriceChange)
        : 0.5;
      
      // 计算综合分数
      const totalScore = volumeScore * this.params.volumeWeight + 
                        priceChangeScore * this.params.volatilityWeight;
      
      // 判断是否符合做空条件
      let eligible = true;
      let reason = '';
      
      if (priceChange >= btcPriceChange) {
        eligible = false;
        reason = `涨跌幅(${priceChange.toFixed(2)}%)不低于BTC(${btcPriceChange.toFixed(2)}%)`;
      } else if (Math.abs(priceChange) < this.params.priceChangeThreshold) {
        eligible = false;
        reason = `涨跌幅绝对值(${Math.abs(priceChange).toFixed(2)}%)小于阈值(${this.params.priceChangeThreshold}%)`;
      } else {
        reason = `综合评分: ${totalScore.toFixed(3)} (成交量: ${volumeScore.toFixed(3)}, 涨跌幅: ${priceChangeScore.toFixed(3)})`;
      }
      
      allCandidates.push({
        symbol: item.symbol,
        rank: item.rank,
        priceChange24h: priceChange,
        volume24h: item.volume24h,
        quoteVolume24h: item.quoteVolume24h,
        volatility24h: item.volatility24h,
        marketShare: item.marketShare,
        volumeScore,
        priceChangeScore,
        totalScore,
        eligible,
        reason
      });
    });
    
    // 按综合分数排序
    allCandidates.sort((a, b) => b.totalScore - a.totalScore);
    
    // 分离符合条件和不符合条件的候选标的
    const eligibleCandidates = allCandidates.filter(c => c.eligible);
    const rejectedCandidates = allCandidates.filter(c => !c.eligible);
    
    // 选择前N个符合条件的标的
    const selectedCandidates = eligibleCandidates.slice(0, this.params.maxShortPositions);
    
    const selectionReason = selectedCandidates.length > 0 
      ? `选择了${selectedCandidates.length}个做空标的`
      : '无符合条件的做空标的';
    
    return {
      selectedCandidates,
      rejectedCandidates,
      totalCandidates: allCandidates.length,
      selectionReason
    };
  }

  // 生成策略快照
  generateSnapshot(
    dataPoint: VolumeBacktestDataPoint,
    previousSnapshot: StrategySnapshot | null
  ): StrategySnapshot {
    const { timestamp, hour, btcPrice, btcPriceChange24h, rankings } = dataPoint;
    
    // 筛选做空候选标的
    const selectionResult = this.selectShortCandidates(rankings, btcPriceChange24h);
    const { selectedCandidates, rejectedCandidates, selectionReason } = selectionResult;
    
    const isActive = selectedCandidates.length > 0;
    
    // 计算当前总价值（如果是第一个快照，则使用初始本金）
    const previousValue = previousSnapshot?.totalValue || this.params.initialCapital;
    
    let btcPosition: PositionInfo | null = null;
    let shortPositions: PositionInfo[] = [];
    let cashPosition = 0;
    let totalValue = previousValue;
    
    if (isActive) {
      // BTC持仓部分
      const btcAmount = totalValue * this.params.btcRatio;
      const btcQuantity = btcAmount / btcPrice;
      
      // 计算BTC盈亏（基于价格变化和持仓数量）
      let btcPnl = 0;
      if (previousSnapshot?.btcPosition) {
        // 使用上一期的BTC数量和价格变化来计算盈亏
        const previousBtcQuantity = previousSnapshot.btcPosition.quantity;
        const previousBtcPrice = previousSnapshot.btcPosition.currentPrice;
        btcPnl = previousBtcQuantity * (btcPrice - previousBtcPrice);
      }
      
      btcPosition = {
        symbol: 'BTCUSDT',
        side: 'LONG',
        amount: btcAmount,
        quantity: btcQuantity,
        entryPrice: previousSnapshot?.btcPosition?.entryPrice || btcPrice,
        currentPrice: btcPrice,
        pnl: btcPnl,
        pnlPercent: btcPnl / (previousSnapshot?.btcPosition?.amount || btcAmount),
        reason: 'BTC基础持仓'
      };
      
      // 做空持仓部分
      const shortAmount = totalValue * (1 - this.params.btcRatio);
      const totalMarketShare = selectedCandidates.reduce((sum, c) => sum + c.marketShare, 0);
      
      shortPositions = selectedCandidates.map(candidate => {
        const allocation = shortAmount * (candidate.marketShare / totalMarketShare);
        const price = candidate.volume24h > 0 ? candidate.quoteVolume24h / candidate.volume24h : 1;
        const quantity = allocation / price;
        
        // 做空盈亏：价格下跌时盈利
        const pnl = -allocation * (candidate.priceChange24h / 100);
        
        return {
          symbol: candidate.symbol,
          side: 'SHORT',
          amount: allocation,
          quantity,
          entryPrice: price,
          currentPrice: price,
          pnl,
          pnlPercent: -candidate.priceChange24h / 100,
          marketShare: candidate.marketShare,
          reason: candidate.reason
        };
      });
      
      // 更新总价值
      const btcValueChange = btcPnl;
      const shortValueChange = shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      totalValue = previousValue + btcValueChange + shortValueChange;
      
    } else {
      // 无符合条件的标的，持有现金
      cashPosition = totalValue;
    }
    
    const totalPnl = totalValue - this.params.initialCapital;
    const totalPnlPercent = totalPnl / this.params.initialCapital;
    
    return {
      timestamp,
      hour,
      btcPrice,
      btcPriceChange24h,
      btcPosition,
      shortPositions,
      totalValue,
      totalPnl,
      totalPnlPercent,
      cashPosition,
      isActive,
      rebalanceReason: selectionReason,
      shortCandidates: [...selectedCandidates, ...rejectedCandidates]
    };
  }
}

// 计算性能指标
function calculatePerformanceMetrics(
  snapshots: StrategySnapshot[], 
  params: BTCDOM2StrategyParams,
  granularityHours: number
): BTCDOM2PerformanceMetrics {
  if (snapshots.length === 0) {
    return {
      totalReturn: 0, annualizedReturn: 0, volatility: 0, sharpeRatio: 0,
      maxDrawdown: 0, winRate: 0, avgReturn: 0, bestPeriod: 0, worstPeriod: 0, calmarRatio: 0
    };
  }
  
  const returns = snapshots.map(s => s.totalPnlPercent);
  const totalReturn = returns[returns.length - 1] || 0;
  
  // 年化收益率
  const totalHours = snapshots.length * granularityHours;
  const years = totalHours / (365 * 24);
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  
  // 波动率
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(365 * 24 / granularityHours);
  
  // 夏普比率
  const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;
  
  // 最大回撤
  let maxDrawdown = 0;
  let peak = params.initialCapital;
  for (const snapshot of snapshots) {
    if (snapshot.totalValue > peak) {
      peak = snapshot.totalValue;
    }
    const drawdown = (peak - snapshot.totalValue) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  // 胜率
  const positiveReturns = returns.filter(r => r > 0).length;
  const winRate = returns.length > 0 ? positiveReturns / returns.length : 0;
  
  const bestPeriod = Math.max(...returns);
  const worstPeriod = Math.min(...returns);
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  
  return {
    totalReturn,
    annualizedReturn,
    volatility,
    sharpeRatio,
    maxDrawdown: -maxDrawdown,
    winRate,
    avgReturn,
    bestPeriod,
    worstPeriod,
    calmarRatio
  };
}

// 生成图表数据
function generateChartData(snapshots: StrategySnapshot[], params: BTCDOM2StrategyParams): BTCDOM2ChartData[] {
  return snapshots.map(snapshot => {
    const totalReturn = (snapshot.totalValue - params.initialCapital) / params.initialCapital;
    const btcValue = snapshot.btcPosition?.amount || 0;
    const shortValue = snapshot.shortPositions.reduce((sum, pos) => sum + pos.amount, 0);
    const cashValue = snapshot.cashPosition;
    
    // 计算回撤
    const currentIndex = snapshots.indexOf(snapshot);
    const previousSnapshots = snapshots.slice(0, currentIndex + 1);
    const peak = Math.max(...previousSnapshots.map(s => s.totalValue));
    const drawdown = (peak - snapshot.totalValue) / peak;
    
    return {
      timestamp: snapshot.timestamp,
      hour: snapshot.hour,
      totalValue: snapshot.totalValue,
      totalReturn,
      btcValue,
      shortValue,
      cashValue,
      drawdown: -drawdown,
      isActive: snapshot.isActive,
      btcPrice: snapshot.btcPrice
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const params: BTCDOM2StrategyParams = await request.json();
    
    // 验证参数
    if (!params.startDate || !params.endDate || params.initialCapital <= 0) {
      return NextResponse.json({
        success: false,
        error: '参数验证失败'
      }, { status: 400 });
    }
    
    // 调用后端API获取数据
    const startTime = new Date(params.startDate).toISOString();
    const endTime = new Date(params.endDate).toISOString();
    const apiUrl = `http://localhost:4001/v1/binance/volume-backtest?startTime=${startTime}&endTime=${endTime}`;
    
    console.log('调用后端API:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`后端API调用失败: ${response.status} ${response.statusText}`);
    }
    
    const apiResult: VolumeBacktestResponse = await response.json();
    
    if (!apiResult.success || !apiResult.data) {
      throw new Error('后端API返回错误: ' + (apiResult as { error?: string }).error || '未知错误');
    }
    
    const { granularityHours, data } = apiResult;
    
    // 创建策略引擎
    const strategyEngine = new BTCDOM2StrategyEngine(params, granularityHours);
    
    // 生成策略快照
    const snapshots: StrategySnapshot[] = [];
    let previousSnapshot: StrategySnapshot | null = null;
    
    for (const dataPoint of data) {
      const snapshot = strategyEngine.generateSnapshot(dataPoint, previousSnapshot);
      snapshots.push(snapshot);
      previousSnapshot = snapshot;
    }
    
    // 计算性能指标
    const performance = calculatePerformanceMetrics(snapshots, params, granularityHours);
    
    // 生成图表数据
    const chartData = generateChartData(snapshots, params);
    
    // 计算汇总统计
    const activeRebalances = snapshots.filter(s => s.isActive).length;
    const inactiveRebalances = snapshots.length - activeRebalances;
    const avgShortPositions = snapshots.reduce((sum, s) => sum + s.shortPositions.length, 0) / snapshots.length;
    
    const result: BTCDOM2BacktestResult = {
      params,
      snapshots,
      performance,
      chartData,
      summary: {
        totalRebalances: snapshots.length,
        activeRebalances,
        inactiveRebalances,
        avgShortPositions,
        granularityHours
      }
    };
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('BTCDOM2.0 回测错误:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误'
    }, { status: 500 });
  }
}