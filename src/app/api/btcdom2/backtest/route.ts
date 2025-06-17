import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';
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

  constructor(params: BTCDOM2StrategyParams) {
    this.params = params;
  }

  // 计算交易手续费
  private calculateTradingFee(amount: number): number {
    return amount * this.params.tradingFeeRate;
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
    
    // 检查是否有可执行的策略
    const hasShortCandidates = selectedCandidates.length > 0;
    const canLongBtc = this.params.longBtc || false;
    const canShortAlt = this.params.shortAlt || false;
    const isActive = (canLongBtc || (canShortAlt && hasShortCandidates));
    
    // 计算当前总价值（如果是第一个快照，则使用初始本金）
    const previousValue = previousSnapshot?.totalValue || this.params.initialCapital;
    
    const soldPositions: PositionInfo[] = [];
    let btcPosition: PositionInfo | null = null;
    let shortPositions: PositionInfo[] = [];
    let cashPosition = 0;
    let totalValue = previousValue;
    let totalTradingFee = 0;
    const accumulatedTradingFee = (previousSnapshot?.accumulatedTradingFee || 0);
    let inactiveReason = '';
    
    if (isActive) {
      // 初始化BTC盈亏
      let btcPnl = 0;
      
      // BTC持仓部分 - 只在选择做多BTC时创建
      if (canLongBtc) {
        const btcAmount = totalValue * this.params.btcRatio;
        const btcQuantity = btcAmount / btcPrice;
        
        // 计算BTC盈亏（基于价格变化和持仓数量）
        let btcTradingFee = 0;
        let btcIsNewPosition = false;
        
        if (previousSnapshot?.btcPosition) {
          // 使用上一期的BTC数量和价格变化来计算盈亏
          const previousBtcQuantity = previousSnapshot.btcPosition.quantity;
          const previousBtcPrice = previousSnapshot.btcPosition.currentPrice;
          btcPnl = previousBtcQuantity * (btcPrice - previousBtcPrice);
          
          // 如果BTC仓位发生变化，计算交易手续费
          const quantityDiff = Math.abs(btcQuantity - previousBtcQuantity);
          if (quantityDiff > 0.0001) { // 避免浮点数精度问题
            btcTradingFee = this.calculateTradingFee(quantityDiff * btcPrice);
            totalTradingFee += btcTradingFee;
          }
        } else {
          // 第一次开仓，计算手续费
          btcTradingFee = this.calculateTradingFee(btcAmount);
          totalTradingFee += btcTradingFee;
          btcIsNewPosition = true;
        }
        
        btcPosition = {
          symbol: 'BTCUSDT',
          side: 'LONG',
          amount: btcAmount,
          quantity: btcQuantity,
          entryPrice: previousSnapshot?.btcPosition?.entryPrice || btcPrice,
          currentPrice: btcPrice,
          pnl: btcPnl, // 第一期为0，后续期基于价格变化计算
          pnlPercent: previousSnapshot?.btcPosition ? btcPnl / previousSnapshot.btcPosition.amount : 0,
          tradingFee: btcTradingFee,
          isNewPosition: btcIsNewPosition,
          reason: 'BTC基础持仓'
        };
      } else if (previousSnapshot?.btcPosition) {
        // 如果之前有BTC持仓但现在不做多BTC，需要平仓
        const sellAmount = previousSnapshot.btcPosition.quantity * btcPrice;
        const sellFee = this.calculateTradingFee(sellAmount);
        totalTradingFee += sellFee;
        
        const finalPnl = previousSnapshot.btcPosition.quantity * (btcPrice - previousSnapshot.btcPosition.currentPrice);
        
        soldPositions.push({
          ...previousSnapshot.btcPosition,
          currentPrice: btcPrice,
          pnl: finalPnl,
          pnlPercent: finalPnl / previousSnapshot.btcPosition.amount,
          tradingFee: sellFee,
          isSoldOut: true,
          isNewPosition: false,
          quantityChange: { type: 'sold' },
          reason: '策略调整：不再做多BTC'
        });
      }
      
      // 处理卖出的持仓（上期有但本期没有的持仓）
      if (previousSnapshot?.shortPositions) {
        for (const prevPosition of previousSnapshot.shortPositions) {
          const stillHeld = selectedCandidates.find(c => c.symbol === prevPosition.symbol);
          if (!stillHeld) {
            // 这个持仓在本期被卖出了
            const currentPrice = rankings.find(r => r.symbol === prevPosition.symbol)?.priceAtTime || prevPosition.currentPrice;
            const sellAmount = prevPosition.quantity * currentPrice;
            const sellFee = this.calculateTradingFee(sellAmount);
            totalTradingFee += sellFee;
            
            // 计算卖出时的最终盈亏
            const priceChangePercent = (currentPrice - prevPosition.currentPrice) / prevPosition.currentPrice;
            const finalPnl = -prevPosition.amount * priceChangePercent;
            
            soldPositions.push({
              ...prevPosition,
              currentPrice,
              pnl: finalPnl,
              pnlPercent: -priceChangePercent,
              tradingFee: sellFee,
              isSoldOut: true,
              isNewPosition: false, // 卖出的持仓不是新增持仓
              quantityChange: { type: 'sold' },
              reason: '持仓被卖出'
            });
          }
        }
      }

      // 做空持仓部分 - 只在选择做空ALT且有候选标的时创建
      if (canShortAlt && hasShortCandidates) {
        const shortAmount = totalValue * (canLongBtc ? (1 - this.params.btcRatio) : 1);
        const totalMarketShare = selectedCandidates.reduce((sum, c) => sum + c.marketShare, 0);
        
        shortPositions = selectedCandidates.map(candidate => {
        const allocation = shortAmount * (candidate.marketShare / totalMarketShare);
        const price = candidate.volume24h > 0 ? candidate.quoteVolume24h / candidate.volume24h : 1;
        const quantity = allocation / price;
        
        // 计算做空盈亏和手续费
        let pnl = 0;
        let pnlPercent = 0;
        let tradingFee = 0;
        let isNewPosition = false;
        
        if (previousSnapshot?.shortPositions) {
          // 从第二期开始，基于价格变化计算盈亏
          const previousShortPosition = previousSnapshot.shortPositions.find(pos => pos.symbol === candidate.symbol);
          if (previousShortPosition) {
            // 做空盈亏：价格下跌时盈利，价格上涨时亏损
            const priceChangePercent = (price - previousShortPosition.currentPrice) / previousShortPosition.currentPrice;
            pnl = -previousShortPosition.amount * priceChangePercent;
            pnlPercent = -priceChangePercent;
            
            // 如果仓位发生变化，计算交易手续费
            const quantityDiff = Math.abs(quantity - previousShortPosition.quantity);
            if (quantityDiff > 0.0001) {
              tradingFee = this.calculateTradingFee(quantityDiff * price);
              totalTradingFee += tradingFee;
            }
          } else {
            // 新增持仓
            tradingFee = this.calculateTradingFee(allocation);
            totalTradingFee += tradingFee;
            isNewPosition = true;
          }
        } else {
          // 第一期，所有持仓都是新增的
          tradingFee = this.calculateTradingFee(allocation);
          totalTradingFee += tradingFee;
          isNewPosition = true;
        }
        
          return {
            symbol: candidate.symbol,
            side: 'SHORT',
            amount: allocation,
            quantity,
            entryPrice: previousSnapshot?.shortPositions?.find(pos => pos.symbol === candidate.symbol)?.entryPrice || price,
            currentPrice: price,
            pnl,
            pnlPercent,
            tradingFee,
            isNewPosition,
            marketShare: candidate.marketShare,
            reason: candidate.reason
          };
        });
      }
      
      // 更新总价值（考虑手续费）
      const btcValueChange = btcPnl;
      const shortValueChange = shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      const soldValueChange = soldPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      totalValue = previousValue + btcValueChange + shortValueChange + soldValueChange - totalTradingFee;
      
    } else {
      // 策略不活跃：无符合条件的标的或策略未启用，持有现金
      
      // 如果之前有做空持仓，现在全部卖出
      if (previousSnapshot?.shortPositions && previousSnapshot.shortPositions.length > 0) {
        for (const prevPosition of previousSnapshot.shortPositions) {
          const currentPrice = rankings.find(r => r.symbol === prevPosition.symbol)?.priceAtTime || prevPosition.currentPrice;
          const sellAmount = prevPosition.quantity * currentPrice;
          const sellFee = this.calculateTradingFee(sellAmount);
          totalTradingFee += sellFee;
          
          // 计算卖出时的最终盈亏
          const priceChangePercent = (currentPrice - prevPosition.currentPrice) / prevPosition.currentPrice;
          const finalPnl = -prevPosition.amount * priceChangePercent;
          
          soldPositions.push({
            ...prevPosition,
            currentPrice,
            pnl: finalPnl,
            pnlPercent: -priceChangePercent,
            tradingFee: sellFee,
            isSoldOut: true,
            isNewPosition: false, // 卖出的持仓不是新增持仓
            quantityChange: { type: 'sold' },
            reason: canShortAlt ? '无符合条件标的，卖出持仓' : '策略调整：不再做空ALT'
          });
        }
      }
      
      // 如果之前有BTC持仓且现在不做多BTC，需要卖出
      if (previousSnapshot?.btcPosition && !canLongBtc) {
        const sellAmount = previousSnapshot.btcPosition.quantity * btcPrice;
        const sellFee = this.calculateTradingFee(sellAmount);
        totalTradingFee += sellFee;
        
        const finalPnl = previousSnapshot.btcPosition.quantity * (btcPrice - previousSnapshot.btcPosition.currentPrice);
        
        soldPositions.push({
          ...previousSnapshot.btcPosition,
          currentPrice: btcPrice,
          pnl: finalPnl,
          pnlPercent: finalPnl / previousSnapshot.btcPosition.amount,
          tradingFee: sellFee,
          isSoldOut: true,
          isNewPosition: false,
          quantityChange: { type: 'sold' },
          reason: '策略调整：不再做多BTC'
        });
      } else if (previousSnapshot?.btcPosition && canLongBtc) {
        // 如果选择做多BTC但没有符合条件的做空标的，继续持有BTC
        const btcAmount = totalValue * this.params.btcRatio;
        const btcQuantity = btcAmount / btcPrice;
        
        const previousBtcPosition = previousSnapshot.btcPosition;
        const btcPnl = previousBtcPosition.quantity * (btcPrice - previousBtcPosition.currentPrice);
        
        // 如果仓位发生变化，计算交易手续费
        let btcTradingFee = 0;
        const quantityDiff = Math.abs(btcQuantity - previousBtcPosition.quantity);
        if (quantityDiff > 0.0001) {
          btcTradingFee = this.calculateTradingFee(quantityDiff * btcPrice);
          totalTradingFee += btcTradingFee;
        }
        
        btcPosition = {
          symbol: 'BTCUSDT',
          side: 'LONG',
          amount: btcAmount,
          quantity: btcQuantity,
          entryPrice: previousBtcPosition.entryPrice,
          currentPrice: btcPrice,
          pnl: btcPnl,
          pnlPercent: btcPnl / previousBtcPosition.amount,
          tradingFee: btcTradingFee,
          isNewPosition: false,
          reason: 'BTC基础持仓'
        };
      }
      
      // 设置空仓原因
      if (!canLongBtc && !canShortAlt) {
        inactiveReason = '策略未启用：未选择做多BTC和做空ALT';
      } else if (!canLongBtc && canShortAlt) {
        inactiveReason = hasShortCandidates ? '策略调整：仅做空ALT' : '无符合做空条件的ALT标的';
      } else if (canLongBtc && !canShortAlt) {
        inactiveReason = '策略调整：仅做多BTC';
      } else {
        inactiveReason = '无符合做空条件的ALT标的，仅持有BTC';
      }
      
      const soldValueChange = soldPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      const btcValueChange = btcPosition ? btcPosition.pnl : 0;
      totalValue = previousValue + btcValueChange + soldValueChange - totalTradingFee;
      cashPosition = totalValue - (btcPosition ? btcPosition.amount : 0);
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
      soldPositions,
      totalValue,
      totalPnl,
      totalPnlPercent,
      totalTradingFee,
      accumulatedTradingFee: accumulatedTradingFee + totalTradingFee,
      cashPosition,
      isActive,
      rebalanceReason: isActive ? selectionReason : inactiveReason,
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
  const initialBtcPrice = snapshots.length > 0 ? snapshots[0].btcPrice : 0;
  
  return snapshots.map(snapshot => {
    const totalReturn = (snapshot.totalValue - params.initialCapital) / params.initialCapital;
    
    // 计算BTC收益率 (相对于初始价格)
    const btcReturn = initialBtcPrice > 0 ? (snapshot.btcPrice - initialBtcPrice) / initialBtcPrice : 0;
    
    // 计算实际市值，包括盈亏
    let btcValue = 0;
    let shortValue = 0;
    
    if (snapshot.btcPosition) {
      // BTC实际市值 = 数量 × 当前价格
      btcValue = snapshot.btcPosition.quantity * snapshot.btcPosition.currentPrice;
    }
    
    if (snapshot.shortPositions && snapshot.shortPositions.length > 0) {
      // 做空部分实际市值 = 初始金额 + 盈亏
      shortValue = snapshot.shortPositions.reduce((sum, pos) => {
        return sum + pos.amount + pos.pnl;
      }, 0);
    }
    
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
      btcReturn, // 新增BTC收益率
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
    const rawParams = await request.json();
    
    // 设置默认值并构建完整参数
    const params: BTCDOM2StrategyParams = {
      ...rawParams,
      longBtc: rawParams.longBtc !== undefined ? rawParams.longBtc : true,
      shortAlt: rawParams.shortAlt !== undefined ? rawParams.shortAlt : true,
    };
    
    // 验证参数
    if (!params.startDate || !params.endDate || params.initialCapital <= 0) {
      return NextResponse.json({
        success: false,
        error: '参数验证失败'
      }, { status: 400 });
    }
    
    // 验证策略选择
    if (!params.longBtc && !params.shortAlt) {
      return NextResponse.json({
        success: false,
        error: '至少需要选择一种策略：做多BTC或做空ALT'
      }, { status: 400 });
    }
    
    // 设置默认手续费率
    if (params.tradingFeeRate === undefined) {
      params.tradingFeeRate = 0.002;
    }
    
    // 调用后端API获取数据
    const startTime = new Date(params.startDate).toISOString();
    const endTime = new Date(params.endDate).toISOString();
    const apiBaseUrl = config.api?.baseUrl;
    const apiUrl = `${apiBaseUrl}/v1/binance/volume-backtest?startTime=${startTime}&endTime=${endTime}`;
    
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
    const strategyEngine = new BTCDOM2StrategyEngine(params);
    
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