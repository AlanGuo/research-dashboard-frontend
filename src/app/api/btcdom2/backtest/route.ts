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
  FundingRateHistoryItem,
  ShortSelectionResult,
  PositionAllocationStrategy
} from '@/types/btcdom2';

// 策略引擎类
class BTCDOM2StrategyEngine {
  private params: BTCDOM2StrategyParams;

  constructor(params: BTCDOM2StrategyParams) {
    this.params = params;
  }

  // 计算交易手续费（返回负数，因为是扣除的费用）
  private calculateTradingFee(amount: number, isSpotTrading: boolean = true): number {
    const feeRate = isSpotTrading ? this.params.spotTradingFeeRate : this.params.futuresTradingFeeRate;
    return -(amount * feeRate);
  }

  // 计算仓位分配
  private calculatePositionAllocations(candidates: ShortCandidate[], totalAmount: number): number[] {
    const allocations: number[] = [];

    // 确保输入参数有效
    const validTotalAmount = isNaN(totalAmount) || totalAmount <= 0 ? 0 : totalAmount;

    switch (this.params.allocationStrategy) {
      case PositionAllocationStrategy.BY_VOLUME:
        // 按成交量比例分配（现有逻辑）
        const totalMarketShare = candidates.reduce((sum, c) => sum + (c.marketShare || 0), 0);
        if (totalMarketShare > 0) {
          candidates.forEach(candidate => {
            const validMarketShare = candidate.marketShare || 0;
            const allocation = validTotalAmount * (validMarketShare / totalMarketShare);
            allocations.push(isNaN(allocation) ? 0 : allocation);
          });
        } else {
          // 如果总市场份额为0，平均分配
          const equalAmount = validTotalAmount / Math.max(candidates.length, 1);
          candidates.forEach(() => {
            allocations.push(equalAmount);
          });
        }
        break;

      case PositionAllocationStrategy.BY_COMPOSITE_SCORE:
        // 按综合分数分配权重
        const totalScore = candidates.reduce((sum, c) => sum + (c.totalScore || 0), 0);
        const maxSingleAllocation = validTotalAmount * this.params.maxSinglePositionRatio;

        if (totalScore > 0) {
          candidates.forEach(candidate => {
            const validScore = candidate.totalScore || 0;
            let allocation = validTotalAmount * (validScore / totalScore);
            // 限制单个币种最大持仓
            allocation = Math.min(allocation, maxSingleAllocation);
            allocations.push(isNaN(allocation) ? 0 : allocation);
          });
        } else {
          // 如果总分数为0，平均分配
          const equalAmount = validTotalAmount / Math.max(candidates.length, 1);
          candidates.forEach(() => {
            allocations.push(equalAmount);
          });
        }

        // 如果有剩余资金（由于单币种限制），按比例重新分配给未达到上限的币种
        const totalAllocated = allocations.reduce((sum, a) => sum + a, 0);
        const remaining = validTotalAmount - totalAllocated;
        if (remaining > 0) {
          const availableForReallocation = candidates.map((candidate, index) => {
            const currentAllocation = allocations[index] || 0;
            const maxPossible = maxSingleAllocation;
            return Math.max(0, maxPossible - currentAllocation);
          });
          const totalAvailable = availableForReallocation.reduce((sum, a) => sum + a, 0);

          if (totalAvailable > 0) {
            availableForReallocation.forEach((available, index) => {
              if (available > 0) {
                const additionalAllocation = remaining * (available / totalAvailable);
                allocations[index] = (allocations[index] || 0) + (isNaN(additionalAllocation) ? 0 : additionalAllocation);
              }
            });
          }
        }
        break;

      case PositionAllocationStrategy.EQUAL_ALLOCATION:
        // 平均分配
        const equalAmount = validTotalAmount / Math.max(candidates.length, 1);
        candidates.forEach(() => {
          allocations.push(isNaN(equalAmount) ? 0 : equalAmount);
        });
        break;

      default:
        // 默认按成交量比例分配
        const defaultTotalMarketShare = candidates.reduce((sum, c) => sum + (c.marketShare || 0), 0);
        if (defaultTotalMarketShare > 0) {
          candidates.forEach(candidate => {
            const validMarketShare = candidate.marketShare || 0;
            const allocation = validTotalAmount * (validMarketShare / defaultTotalMarketShare);
            allocations.push(isNaN(allocation) ? 0 : allocation);
          });
        } else {
          // 如果总市场份额为0，平均分配
          const equalAmount = validTotalAmount / Math.max(candidates.length, 1);
          candidates.forEach(() => {
            allocations.push(equalAmount);
          });
        }
    }

    // 最终确保所有分配值都是有效的数字
    return allocations.map(allocation => isNaN(allocation) || allocation < 0 ? 0 : allocation);
  }

  // 筛选做空候选标的
  selectShortCandidates(
    rankings: RankingItem[],
    btcPriceChange: number
  ): ShortSelectionResult {
    const startTime = Date.now(); // 性能监控
    const allCandidates: ShortCandidate[] = [];

    // 排除BTC本身，处理所有候选标的
    const filteredRankings = rankings.filter(item => item.symbol !== 'BTCUSDT');
    const totalCandidates = filteredRankings.length;

    // 提前终止：如果没有候选标的，直接返回
    if (totalCandidates === 0) {
      return {
        selectedCandidates: [],
        rejectedCandidates: [],
        selectionReason: '无可用的候选标的',
        totalCandidates: 0
      };
    }

    // 分析波动率范围
    // 获取所有波动率数据用于正态分布计算
    const allVolatilities = filteredRankings.map(item => item.volatility24h).filter(vol => !isNaN(vol) && isFinite(vol));
    const minVolatility = allVolatilities.length > 0 ? Math.min(...allVolatilities) : 0;
    const maxVolatility = allVolatilities.length > 0 ? Math.max(...allVolatilities) : 0;
    const avgVolatility = allVolatilities.length > 0 ? allVolatilities.reduce((sum, vol) => sum + vol, 0) / allVolatilities.length : 0;

    // 动态设置理想波动率中心值为平均值，标准差为范围的1/4
    const idealVolatility = avgVolatility;
    const volatilitySpread = Math.max((maxVolatility - minVolatility) / 4, 0.01); // 至少0.01防止除零

    // 预先计算跌幅分数的最大值，避免除零问题
    const maxAbsoluteDecline = Math.max(...filteredRankings.map(r => Math.abs(Math.min(r.priceChange24h, 0))));
    const hasDeclines = maxAbsoluteDecline > 0;

    // 分析资金费率范围用于评分计算
    const allFundingRates: number[] = [];
    filteredRankings.forEach(item => {
      if (item.fundingRateHistory && item.fundingRateHistory.length > 0) {
        // 获取最近的资金费率
        const latestFunding = item.fundingRateHistory[item.fundingRateHistory.length - 1];
        if (latestFunding && !isNaN(latestFunding.fundingRate) && isFinite(latestFunding.fundingRate)) {
          allFundingRates.push(latestFunding.fundingRate);
        }
      }
    });

    const minFundingRate = allFundingRates.length > 0 ? Math.min(...allFundingRates) : 0;
    const maxFundingRate = allFundingRates.length > 0 ? Math.max(...allFundingRates) : 0;
    const fundingRateRange = maxFundingRate - minFundingRate;

    filteredRankings.forEach((item) => {
      const priceChange = isNaN(item.priceChange24h) ? 0 : item.priceChange24h;

      // 计算跌幅分数：跌幅越大分数越高（负值变正值，绝对值越大分数越高）
      let priceChangeScore = 0;
      if (hasDeclines) {
        priceChangeScore = Math.abs(Math.min(priceChange, 0)) / maxAbsoluteDecline;
      } else {
        // 如果没有下跌的币种，按照跌幅相对大小排序（越接近0分数越高）
        const minChange = Math.min(...filteredRankings.map(r => r.priceChange24h));
        const maxChange = Math.max(...filteredRankings.map(r => r.priceChange24h));
        if (maxChange > minChange) {
          priceChangeScore = 1 - (priceChange - minChange) / (maxChange - minChange);
        } else {
          priceChangeScore = 1; // 所有币种涨跌幅相同，给相同分数
        }
      }

      // 计算成交量分数：成交量排名越靠前（数字越小），分数越高
      const volumeScore = (totalCandidates - item.rank + 1) / totalCandidates;

      // 计算波动率分数：使用正态分布，适中得分最高
      let volatilityScore = 0;
      const validVolatility = isNaN(item.volatility24h) || !isFinite(item.volatility24h) ? avgVolatility : item.volatility24h;
      if (volatilitySpread > 0) {
        volatilityScore = Math.exp(-Math.pow(validVolatility - idealVolatility, 2) / (2 * Math.pow(volatilitySpread, 2)));
      } else {
        volatilityScore = 1; // 如果波动率标准差为0，给所有币种相同分数
      }

      // 计算资金费率分数：资金费率为正对空头有利，正的越多越有利
      // -2% 得0分，2% 得满分，线性映射到0-1分数
      let fundingRateScore = 0;
      if (item.fundingRateHistory && item.fundingRateHistory.length > 0) {
        const latestFunding = item.fundingRateHistory[item.fundingRateHistory.length - 1];
        if (latestFunding && !isNaN(latestFunding.fundingRate) && isFinite(latestFunding.fundingRate)) {
          const fundingRatePercent = latestFunding.fundingRate * 100; // 转换为百分比
          // -2% -> 0分, 2% -> 1分, 线性映射
          fundingRateScore = Math.max(0, Math.min(1, (fundingRatePercent + 2) / 4));
        } else {
          fundingRateScore = 0.5; // 无效资金费率，给中等分数
        }
      } else {
        fundingRateScore = 0.5; // 无资金费率历史，给中等分数
      }

      // 计算综合分数，确保所有分数都是有效数字
      const validPriceChangeScore = isNaN(priceChangeScore) ? 0 : priceChangeScore;
      const validVolumeScore = isNaN(volumeScore) ? 0 : volumeScore;
      const validVolatilityScore = isNaN(volatilityScore) ? 0 : volatilityScore;
      const validFundingRateScore = isNaN(fundingRateScore) ? 0.5 : fundingRateScore;

      const totalScore = validPriceChangeScore * this.params.priceChangeWeight +
                        validVolumeScore * this.params.volumeWeight +
                        validVolatilityScore * this.params.volatilityWeight +
                        validFundingRateScore * this.params.fundingRateWeight;

      // 判断是否符合做空条件
      let eligible = true;
      let reason = '';

      if (priceChange >= btcPriceChange) {
        eligible = false;
        reason = `涨跌幅 ${priceChange.toFixed(2)}% 不低于BTC ${btcPriceChange.toFixed(2)}%`;
      } else {
        const finalTotalScore = isNaN(totalScore) ? 0 : totalScore;
        reason = `综合评分: ${finalTotalScore.toFixed(3)} (跌幅: ${validPriceChangeScore.toFixed(3)}, 成交量: ${validVolumeScore.toFixed(3)}, 波动率: ${validVolatilityScore.toFixed(3)}, 资金费率: ${validFundingRateScore.toFixed(3)})`;

        // 调试信息：记录分数异常的情况（仅开发环境）
        if (process.env.NODE_ENV === 'development' && (isNaN(totalScore) || isNaN(validPriceChangeScore) || isNaN(validVolumeScore) || isNaN(validVolatilityScore) || isNaN(validFundingRateScore))) {
          console.warn(`[DEBUG] 分数异常 ${item.symbol}:`, {
            priceChange: item.priceChange24h,
            volatility: item.volatility24h,
            rank: item.rank,
            priceChangeScore: validPriceChangeScore,
            volumeScore: validVolumeScore,
            volatilityScore: validVolatilityScore,
            fundingRateScore: validFundingRateScore,
            totalScore: finalTotalScore,
            maxAbsoluteDecline,
            hasDeclines,
            idealVolatility,
            volatilitySpread,
            fundingRateRange,
            latestFundingRate: item.fundingRateHistory && item.fundingRateHistory.length > 0 ? item.fundingRateHistory[item.fundingRateHistory.length - 1]?.fundingRate : 'N/A'
          });
        }
      }

      allCandidates.push({
        symbol: item.symbol,
        rank: item.rank,
        priceChange24h: priceChange,
        volume24h: item.volume24h,
        quoteVolume24h: item.quoteVolume24h,
        volatility24h: item.volatility24h,
        marketShare: item.marketShare,
        priceAtTime: item.priceAtTime, // 添加当前时刻现货价格
        futurePriceAtTime: item.futurePriceAtTime, // 添加期货价格
        futureSymbol: item.futureSymbol, // 添加期货交易对symbol
        priceChangeScore: validPriceChangeScore,
        volumeScore: validVolumeScore,
        volatilityScore: validVolatilityScore,
        fundingRateScore: validFundingRateScore,
        totalScore: isNaN(totalScore) ? 0 : totalScore,
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

    // 性能监控日志（仅开发环境）
    const executionTime = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development' && executionTime > 50) {
      console.log(`[PERF] selectShortCandidates 耗时: ${executionTime}ms, 候选数: ${totalCandidates}, 符合条件: ${eligibleCandidates.length}`);
    }

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
    previousSnapshot: StrategySnapshot | null,
    previousData: VolumeBacktestDataPoint | null = null
  ): StrategySnapshot {
    const { timestamp, hour, btcPrice, btcPriceChange24h, rankings, removedSymbols } = dataPoint;

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
    let totalFundingFee = 0;
    const accumulatedTradingFee = (previousSnapshot?.accumulatedTradingFee || 0);
    const accumulatedFundingFee = (previousSnapshot?.accumulatedFundingFee || 0);
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
          const previousBtcQuantity = previousSnapshot.btcPosition.quantity ?? 0;
          const previousBtcPrice = previousSnapshot.btcPosition.currentPrice ?? btcPrice;
          btcPnl = previousBtcQuantity * (btcPrice - previousBtcPrice);

          // 如果BTC仓位发生变化，计算交易手续费
          const quantityDiff = Math.abs(btcQuantity - previousBtcQuantity);
          if (quantityDiff > 0.0001) { // 避免浮点数精度问题
            btcTradingFee = this.calculateTradingFee(quantityDiff * btcPrice, true); // BTC现货交易
            totalTradingFee += btcTradingFee;
          }
        } else {
          // 第一次开仓，计算手续费
          btcTradingFee = this.calculateTradingFee(btcAmount, true); // BTC现货交易
          totalTradingFee += btcTradingFee;
          btcIsNewPosition = true;
        }

        // 确保所有数值都是有效的
        const validBtcAmount = isNaN(btcAmount) || btcAmount <= 0 ? 0 : btcAmount;
        const validBtcQuantity = isNaN(btcQuantity) || btcQuantity <= 0 ? 0 : btcQuantity;
        const validBtcPnl = isNaN(btcPnl) ? 0 : btcPnl;
        const validBtcTradingFee = isNaN(btcTradingFee) ? 0 : btcTradingFee;
        const prevAmount = previousSnapshot?.btcPosition?.amount ?? validBtcAmount;
        const previousBtcPrice = previousSnapshot?.btcPosition?.currentPrice;

        btcPosition = {
          symbol: 'BTCUSDT',
          side: 'LONG',
          amount: validBtcAmount,
          quantity: validBtcQuantity,
          entryPrice: previousSnapshot?.btcPosition?.entryPrice || btcPrice,
          currentPrice: btcPrice,
          pnl: validBtcPnl, // 第一期为0，后续期基于价格变化计算
          pnlPercent: prevAmount > 0 ? validBtcPnl / prevAmount : 0,
          tradingFee: validBtcTradingFee,
          priceChange24h: btcPriceChange24h, // 添加24H价格变化
          isNewPosition: btcIsNewPosition,
          priceChange: previousBtcPrice ? {
            type: btcPrice > previousBtcPrice ? 'increase' : btcPrice < previousBtcPrice ? 'decrease' : 'same',
            previousPrice: previousBtcPrice,
            changePercent: previousBtcPrice > 0 ? (btcPrice - previousBtcPrice) / previousBtcPrice : 0
          } : undefined,
          reason: 'BTC基础持仓'
        };
      } else if (previousSnapshot?.btcPosition) {
        // 如果之前有BTC持仓但现在不做多BTC，需要平仓
        const validPrevQuantity = previousSnapshot.btcPosition.quantity ?? 0;
        const validPrevAmount = previousSnapshot.btcPosition.amount ?? 0;
        const validPrevPrice = previousSnapshot.btcPosition.currentPrice ?? btcPrice;

        const sellAmount = validPrevQuantity * btcPrice;
        const sellFee = this.calculateTradingFee(sellAmount, true); // BTC现货交易
        totalTradingFee += sellFee;

        const finalPnl = validPrevQuantity * (btcPrice - validPrevPrice);
        const validFinalPnl = isNaN(finalPnl) ? 0 : finalPnl;
        const validSellFee = isNaN(sellFee) ? 0 : sellFee;

        soldPositions.push({
          ...previousSnapshot.btcPosition,
          amount: validPrevAmount,
          quantity: validPrevQuantity,
          currentPrice: btcPrice,
          pnl: validFinalPnl,
          pnlPercent: validPrevAmount > 0 ? validFinalPnl / validPrevAmount : 0,
          tradingFee: validSellFee,
          priceChange24h: btcPriceChange24h, // 添加BTC的24H价格变化
          isSoldOut: true,
          isNewPosition: false,
          priceChange: {
            type: btcPrice > validPrevPrice ? 'increase' : btcPrice < validPrevPrice ? 'decrease' : 'same',
            previousPrice: validPrevPrice,
            changePercent: validPrevPrice > 0 ? (btcPrice - validPrevPrice) / validPrevPrice : 0
          },
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
            // 优先从removedSymbols中获取数据，如果没有则从rankings中查找
            let rankingItem = removedSymbols?.find(r => r.symbol === prevPosition.symbol);
            if (!rankingItem) {
              rankingItem = rankings.find(r => r.symbol === prevPosition.symbol);
            }

            const currentPrice = rankingItem?.futurePriceAtTime || rankingItem?.priceAtTime || prevPosition.currentPrice;
            const priceChange24h = rankingItem?.priceChange24h || 0;
            const sellAmount = prevPosition.quantity * currentPrice;
            const sellFee = this.calculateTradingFee(sellAmount, false); // ALT期货交易
            totalTradingFee += sellFee;

            // 计算卖出时的最终盈亏
            const priceChangePercent = (currentPrice - prevPosition.currentPrice) / prevPosition.currentPrice;
            const finalPnl = -prevPosition.amount * priceChangePercent;

            // 确保 amount 和 quantity 有有效的数值，避免 null 值
            const validAmount = prevPosition.amount ?? 0;
            const validQuantity = prevPosition.quantity ?? 0;
            const validPnl = isNaN(finalPnl) ? 0 : finalPnl;
            const validTradingFee = isNaN(sellFee) ? 0 : sellFee;

            // 计算卖出持仓的资金费率（如果有）
            // 卖出时结算的是上一期的资金费率，从previousData.rankings获取
            let soldFundingFee = 0;
            const soldRankingItem = previousData?.rankings?.find(r => r.symbol === prevPosition.symbol);
            const soldFundingRateHistory = soldRankingItem?.fundingRateHistory || [];
            if (soldFundingRateHistory.length > 0 && validQuantity > 0) {
              for (const funding of soldFundingRateHistory) {
                // 对于做空头寸：资金费率为负数时支付，为正数时收取
                const positionValue = validQuantity * funding.markPrice;
                soldFundingFee += positionValue * funding.fundingRate;
              }
            }
            totalFundingFee += soldFundingFee;

            soldPositions.push({
              ...prevPosition,
              amount: validAmount,
              quantity: validQuantity,
              currentPrice,
              pnl: validPnl,
              pnlPercent: -priceChangePercent,
              tradingFee: validTradingFee,
              fundingFee: soldFundingFee,
              priceChange24h: priceChange24h, // 使用从removedSymbols或rankings获取的24H价格变化
              isSoldOut: true,
              isNewPosition: false, // 卖出的持仓不是新增持仓
              priceChange: {
                type: currentPrice > prevPosition.currentPrice ? 'increase' : currentPrice < prevPosition.currentPrice ? 'decrease' : 'same',
                previousPrice: prevPosition.currentPrice,
                changePercent: priceChangePercent
              },
              quantityChange: { type: 'sold' },
              fundingRateHistory: soldFundingRateHistory,
              reason: '持仓卖出'
            });
          }
        }
      }

      // 做空持仓部分 - 只在选择做空ALT且有候选标的时创建
      if (canShortAlt && hasShortCandidates) {
        const shortAmount = totalValue * (canLongBtc ? (1 - this.params.btcRatio) : 1);

        // 根据分配策略计算仓位分配
        const allocations = this.calculatePositionAllocations(selectedCandidates, shortAmount);

        shortPositions = selectedCandidates.map((candidate, index) => {
        const allocation = allocations[index];

        // 价格优先级：期货价格 > 现货价格
        let price = 1; // 默认价格

        // 1. 优先使用期货价格（futurePriceAtTime）- 最精确
        if (candidate.futurePriceAtTime && candidate.futurePriceAtTime > 0) {
          price = candidate.futurePriceAtTime;
        }
        // 2. 其次使用当前时刻现货价格（priceAtTime）- 精确的瞬时价格
        else if (candidate.priceAtTime && candidate.priceAtTime > 0) {
          price = candidate.priceAtTime;
        }

        // 确保数量计算的健壮性
        const quantity = allocation > 0 && price > 0 ? allocation / price : 0;

        let pnl = 0;
        let pnlPercent = 0;
        let tradingFee = 0;
        let fundingFee = 0;
        let isNewPosition = false;
        let previousFundingRateHistory: FundingRateHistoryItem[] = [];

        if (previousSnapshot?.shortPositions) {
          // 从第二期开始，基于价格变化计算盈亏
          const previousShortPosition = previousSnapshot.shortPositions.find(pos => pos.symbol === candidate.symbol);
          if (previousShortPosition) {
            // 确保之前的持仓数据有效
            const validPrevAmount = previousShortPosition.amount ?? 0;
            const validPrevPrice = previousShortPosition.currentPrice ?? price;

            // 做空盈亏：价格下跌时盈利，价格上涨时亏损
            const priceChangePercent = validPrevPrice > 0 ? (price - validPrevPrice) / validPrevPrice : 0;
            pnl = validPrevAmount > 0 ? -validPrevAmount * priceChangePercent : 0;
            pnlPercent = -priceChangePercent;

            // 如果仓位发生变化，计算交易手续费
            const validPrevQuantity = previousShortPosition.quantity ?? 0;
            const quantityDiff = Math.abs(quantity - validPrevQuantity);
            if (quantityDiff > 0.0001) {
              tradingFee = this.calculateTradingFee(quantityDiff * price, false); // ALT期货交易
              totalTradingFee += tradingFee;
            }
          } else {
            // 新增持仓
            tradingFee = this.calculateTradingFee(allocation, false); // ALT期货交易
            totalTradingFee += tradingFee;
            isNewPosition = true;
          }
        } else {
          // 第一期，所有持仓都是新增的
          tradingFee = this.calculateTradingFee(allocation, false); // ALT期货交易
          totalTradingFee += tradingFee;
          isNewPosition = true;
        }

        // 计算资金费率盈亏 - 只对非新开仓的持仓计算
        // 新开仓的持仓从下一期开始收取资金费率
        // 对于持仓的position，使用上一期data元素的rankings中的资金费率历史
        if (!isNewPosition && quantity > 0) {
          // 从上一期data元素的rankings中获取资金费率历史
          const prevRankingItem = previousData?.rankings?.find(r => r.symbol === candidate.symbol);
          previousFundingRateHistory = prevRankingItem?.fundingRateHistory || [];

          if (previousFundingRateHistory.length > 0) {
            for (const funding of previousFundingRateHistory) {
              // 对于做空头寸：
              // 资金费率为负数时，空头支付资金费（亏损）
              // 资金费率为正数时，空头收取资金费（盈利）
              // 所以公式是：资金费率盈亏 = 头寸价值 × 资金费率
              const positionValue = quantity * funding.markPrice;
              fundingFee += positionValue * funding.fundingRate;
            }
          }
        }

        // 获取之前的持仓信息用于价格变化计算
        const previousShortPosition = previousSnapshot?.shortPositions?.find(pos => pos.symbol === candidate.symbol);
        const previousPrice = previousShortPosition?.currentPrice;

          return {
            symbol: candidate.symbol,
            displaySymbol: candidate.futureSymbol || candidate.symbol,
            side: 'SHORT',
            amount: allocation,
            quantity,
            entryPrice: previousShortPosition?.entryPrice || price,
            currentPrice: price,
            pnl: isNaN(pnl) ? 0 : pnl,
            pnlPercent: isNaN(pnlPercent) ? 0 : pnlPercent,
            tradingFee: isNaN(tradingFee) ? 0 : tradingFee,
            fundingFee: isNaN(fundingFee) ? 0 : fundingFee,
            priceChange24h: candidate.priceChange24h, // 添加24H价格变化
            isNewPosition,
            priceChange: previousPrice ? {
              type: price > previousPrice ? 'increase' : price < previousPrice ? 'decrease' : 'same',
              previousPrice: previousPrice,
              changePercent: previousPrice > 0 ? (price - previousPrice) / previousPrice : 0
            } : undefined,
            fundingRateHistory: isNewPosition ? [] : previousFundingRateHistory,
            marketShare: candidate.marketShare,
            reason: candidate.reason
          };
        });
      }

      // 计算总资金费率
      totalFundingFee = shortPositions.reduce((sum, pos) => sum + (pos.fundingFee || 0), 0);

      // 更新总价值（考虑手续费和资金费率）
      const btcValueChange = btcPnl;
      const shortValueChange = shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      const soldValueChange = soldPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      totalValue = previousValue + btcValueChange + shortValueChange + soldValueChange + totalTradingFee + totalFundingFee;

    } else {
      // 策略不活跃：无符合条件的标的或策略未启用，持有现金

      // 如果之前有做空持仓，现在全部卖出
      if (previousSnapshot?.shortPositions && previousSnapshot.shortPositions.length > 0) {
        for (const prevPosition of previousSnapshot.shortPositions) {
          // 优先从removedSymbols中获取数据，如果没有则从rankings中查找
          let rankingItem = removedSymbols?.find(r => r.symbol === prevPosition.symbol);
          if (!rankingItem) {
            rankingItem = rankings.find(r => r.symbol === prevPosition.symbol);
          }

          const currentPrice = rankingItem?.futurePriceAtTime || rankingItem?.priceAtTime || prevPosition.currentPrice;
          const priceChange24h = rankingItem?.priceChange24h || 0;
          const sellAmount = prevPosition.quantity * currentPrice;
          const sellFee = this.calculateTradingFee(sellAmount, false); // ALT期货交易
          totalTradingFee += sellFee;

          // 计算卖出时的最终盈亏
          const priceChangePercent = (currentPrice - prevPosition.currentPrice) / prevPosition.currentPrice;
          const finalPnl = -prevPosition.amount * priceChangePercent;

          // 确保 amount 和 quantity 有有效的数值，避免 null 值
          const validAmount = prevPosition.amount ?? 0;
          const validQuantity = prevPosition.quantity ?? 0;
          const validPnl = isNaN(finalPnl) ? 0 : finalPnl;
          const validTradingFee = isNaN(sellFee) ? 0 : sellFee;

          // 计算卖出持仓的资金费率（如果有）
          // 卖出时结算的是上一期的资金费率，从previousData.rankings获取
          let soldFundingFee = 0;
          const soldRankingItem = previousData?.rankings?.find(r => r.symbol === prevPosition.symbol);
          const soldFundingRateHistory = soldRankingItem?.fundingRateHistory || [];
          if (soldFundingRateHistory.length > 0 && validQuantity > 0) {
            for (const funding of soldFundingRateHistory) {
              // 对于做空头寸：资金费率为负数时支付，为正数时收取
              const positionValue = validQuantity * funding.markPrice;
              soldFundingFee += positionValue * funding.fundingRate;
            }
          }
          totalFundingFee += soldFundingFee;

          soldPositions.push({
            ...prevPosition,
            amount: validAmount,
            quantity: validQuantity,
            currentPrice,
            pnl: validPnl,
            pnlPercent: -priceChangePercent,
            tradingFee: validTradingFee,
            fundingFee: soldFundingFee,
            priceChange24h: priceChange24h, // 使用从removedSymbols或rankings获取的24H价格变化
            isSoldOut: true,
            isNewPosition: false, // 卖出的持仓不是新增持仓
            priceChange: {
              type: currentPrice > prevPosition.currentPrice ? 'increase' : currentPrice < prevPosition.currentPrice ? 'decrease' : 'same',
              previousPrice: prevPosition.currentPrice,
              changePercent: priceChangePercent
            },
            quantityChange: { type: 'sold' },
            fundingRateHistory: soldFundingRateHistory,
            reason: canShortAlt ? '无符合条件标的，卖出持仓' : '策略调整：不再做空ALT'
          });
        }
      }

      // 如果之前有BTC持仓且现在不做多BTC，需要卖出
      if (previousSnapshot?.btcPosition && !canLongBtc) {
        const validPrevQuantity = previousSnapshot.btcPosition.quantity ?? 0;
        const validPrevAmount = previousSnapshot.btcPosition.amount ?? 0;
        const validPrevPrice = previousSnapshot.btcPosition.currentPrice ?? btcPrice;

        const sellAmount = validPrevQuantity * btcPrice;
        const sellFee = this.calculateTradingFee(sellAmount, true); // BTC现货交易
        totalTradingFee += sellFee;

        const finalPnl = validPrevQuantity * (btcPrice - validPrevPrice);
        const validFinalPnl = isNaN(finalPnl) ? 0 : finalPnl;
        const validSellFee = isNaN(sellFee) ? 0 : sellFee;

        soldPositions.push({
          ...previousSnapshot.btcPosition,
          amount: validPrevAmount,
          quantity: validPrevQuantity,
          currentPrice: btcPrice,
          pnl: validFinalPnl,
          pnlPercent: validPrevAmount > 0 ? validFinalPnl / validPrevAmount : 0,
          tradingFee: validSellFee,
          priceChange24h: btcPriceChange24h, // 添加BTC的24H价格变化
          isSoldOut: true,
          isNewPosition: false,
          priceChange: {
            type: btcPrice > validPrevPrice ? 'increase' : btcPrice < validPrevPrice ? 'decrease' : 'same',
            previousPrice: validPrevPrice,
            changePercent: validPrevPrice > 0 ? (btcPrice - validPrevPrice) / validPrevPrice : 0
          },
          quantityChange: { type: 'sold' },
          reason: '策略调整：不再做多BTC'
        });
      } else if (previousSnapshot?.btcPosition && canLongBtc) {
        // 如果选择做多BTC但没有符合条件的做空标的，继续持有BTC
        const btcAmount = totalValue * this.params.btcRatio;
        const btcQuantity = btcAmount / btcPrice;

        const previousBtcPosition = previousSnapshot.btcPosition;
        const validPrevBtcQuantity = previousBtcPosition.quantity ?? 0;
        const validPrevBtcPrice = previousBtcPosition.currentPrice ?? btcPrice;
        const btcPnl = validPrevBtcQuantity * (btcPrice - validPrevBtcPrice);

        // 如果仓位发生变化，计算交易手续费
        let btcTradingFee = 0;
        const quantityDiff = Math.abs(btcQuantity - validPrevBtcQuantity);
        if (quantityDiff > 0.0001) {
          btcTradingFee = this.calculateTradingFee(quantityDiff * btcPrice, true); // BTC现货交易
          totalTradingFee += btcTradingFee;
        }

        const validPrevBtcAmount = previousBtcPosition.amount ?? btcAmount;

        btcPosition = {
          symbol: 'BTCUSDT',
          side: 'LONG',
          amount: btcAmount,
          quantity: btcQuantity,
          entryPrice: previousBtcPosition.entryPrice,
          currentPrice: btcPrice,
          pnl: isNaN(btcPnl) ? 0 : btcPnl,
          pnlPercent: validPrevBtcAmount > 0 ? btcPnl / validPrevBtcAmount : 0,
          tradingFee: isNaN(btcTradingFee) ? 0 : btcTradingFee,
          priceChange24h: btcPriceChange24h, // 添加24H价格变化
          isNewPosition: false,
          priceChange: {
            type: btcPrice > validPrevBtcPrice ? 'increase' : btcPrice < validPrevBtcPrice ? 'decrease' : 'same',
            previousPrice: validPrevBtcPrice,
            changePercent: validPrevBtcPrice > 0 ? (btcPrice - validPrevBtcPrice) / validPrevBtcPrice : 0
          },
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
      totalValue = previousValue + btcValueChange + soldValueChange + totalTradingFee + totalFundingFee;
      cashPosition = totalValue - (btcPosition ? btcPosition.amount : 0);
    }

    const totalPnl = totalValue - this.params.initialCapital;
    const totalPnlPercent = totalPnl / this.params.initialCapital;

    // 计算本期盈亏和本期收益率
    const prevValue = previousSnapshot?.totalValue || this.params.initialCapital;
    const periodPnl = totalValue - prevValue;
    const periodPnlPercent = prevValue > 0 ? periodPnl / prevValue : 0;

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
      periodPnl,
      periodPnlPercent,
      totalTradingFee,
      accumulatedTradingFee: accumulatedTradingFee + totalTradingFee,
      totalFundingFee,
      accumulatedFundingFee: accumulatedFundingFee + totalFundingFee,
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
      totalReturn: 0, btcReturn: 0, altReturn: 0, annualizedReturn: 0, volatility: 0, sharpeRatio: 0,
      maxDrawdown: 0, winRate: 0, avgReturn: 0, bestPeriod: 0, worstPeriod: 0, calmarRatio: 0,
      bestFundingPeriod: 0, worstFundingPeriod: 0,
      pnlBreakdown: {
        totalPnlAmount: 0, btcPnlAmount: 0, altPnlAmount: 0, tradingFeeAmount: 0, fundingFeeAmount: 0,
        totalPnlRate: 0, btcPnlRate: 0, altPnlRate: 0, tradingFeeRate: 0, fundingFeeRate: 0
      }
    };
  }

  // 计算期间收益率变化（不是累计收益率）
  const periodReturns: number[] = [];
  const periodInfo: Array<{ return: number; timestamp: string; period: number }> = [];

  for (let i = 1; i < snapshots.length; i++) {
    const prevValue = snapshots[i - 1].totalValue;
    const currentValue = snapshots[i].totalValue;
    const periodReturn = (currentValue - prevValue) / prevValue;
    periodReturns.push(periodReturn);
    periodInfo.push({
      return: periodReturn,
      timestamp: snapshots[i].timestamp,
      period: i
    });
  }

  // 如果只有一个快照，使用总收益率
  if (periodReturns.length === 0) {
    const totalReturn = snapshots[0].totalPnlPercent;
    const firstSnapshot = snapshots[0];
    return {
      totalReturn, btcReturn: 0, altReturn: 0, annualizedReturn: totalReturn, volatility: 0, sharpeRatio: 0,
      maxDrawdown: 0, winRate: totalReturn > 0 ? 1 : 0, avgReturn: totalReturn,
      bestPeriod: totalReturn, worstPeriod: totalReturn, calmarRatio: 0,
      bestPeriodInfo: {
        return: totalReturn,
        timestamp: snapshots[0].timestamp,
        period: 1
      },
      worstPeriodInfo: {
        return: totalReturn,
        timestamp: snapshots[0].timestamp,
        period: 1
      },
      bestFundingPeriod: firstSnapshot.totalFundingFee || 0,
      worstFundingPeriod: firstSnapshot.totalFundingFee || 0,
      bestFundingPeriodInfo: {
        fundingFee: firstSnapshot.totalFundingFee || 0,
        timestamp: snapshots[0].timestamp,
        period: 1
      },
      worstFundingPeriodInfo: {
        fundingFee: firstSnapshot.totalFundingFee || 0,
        timestamp: snapshots[0].timestamp,
        period: 1
      },
      pnlBreakdown: {
        totalPnlAmount: firstSnapshot.totalPnl,
        btcPnlAmount: 0,
        altPnlAmount: 0,
        tradingFeeAmount: firstSnapshot.accumulatedTradingFee,
        fundingFeeAmount: firstSnapshot.accumulatedFundingFee || 0,
        totalPnlRate: firstSnapshot.totalPnl / params.initialCapital,
        btcPnlRate: 0,
        altPnlRate: 0,
        tradingFeeRate: firstSnapshot.accumulatedTradingFee / params.initialCapital,
        fundingFeeRate: (firstSnapshot.accumulatedFundingFee || 0) / params.initialCapital
      }
    };
  }

  const totalReturn = snapshots[snapshots.length - 1].totalPnlPercent;

  // 计算BTC和ALT分别收益率
  const firstSnapshot = snapshots[0];
  const finalSnapshot = snapshots[snapshots.length - 1];

  // BTC收益率：基于BTC价格变化
  const btcReturn = firstSnapshot.btcPrice > 0 ?
    (finalSnapshot.btcPrice - firstSnapshot.btcPrice) / firstSnapshot.btcPrice : 0;

  // ALT收益率：简化计算，基于做空部分的净收益
  let altReturn = 0;
  if (params.shortAlt) {
    // 计算所有做空相关的累计收益（包括当前持仓和已卖出持仓）
    let totalShortPnl = 0;

    // 当前做空持仓的盈亏
    const currentShortPnl = finalSnapshot.shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);

    totalShortPnl += currentShortPnl;

    // 历史卖出做空持仓的累计盈亏（遍历所有快照）
    for (const snapshot of snapshots) {
      if (snapshot.soldPositions) {
        const soldShortPnl = snapshot.soldPositions
          .filter(pos => pos.side === 'SHORT')
          .reduce((sum, pos) => sum + pos.pnl, 0);
        totalShortPnl += soldShortPnl;
      }
    }

    // 估算总的做空投资基数：使用策略分配的做空部分资金
    const shortAllocationRatio = params.longBtc ? (1 - params.btcRatio) : 1;
    const estimatedShortInvestment = params.initialCapital * shortAllocationRatio;

    if (estimatedShortInvestment > 0) {
      altReturn = totalShortPnl / estimatedShortInvestment;
    }
  }

  // 年化收益率
  const totalHours = snapshots.length * granularityHours;
  const years = totalHours / (365 * 24);
  const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

  // 波动率 - 使用期间收益率的标准差
  const avgPeriodReturn = periodReturns.reduce((sum, r) => sum + r, 0) / periodReturns.length;
  const variance = periodReturns.reduce((sum, r) => sum + Math.pow(r - avgPeriodReturn, 2), 0) / periodReturns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(365 * 24 / granularityHours);

  // 夏普比率 - 假设无风险利率为0
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

  // 胜率 - 使用期间收益率
  const positiveReturns = periodReturns.filter((r: number) => r > 0).length;
  const winRate = periodReturns.length > 0 ? positiveReturns / periodReturns.length : 0;

  // 最佳和最差期间收益率
  const bestPeriod = periodReturns.length > 0 ? Math.max(...periodReturns) : 0;
  const worstPeriod = periodReturns.length > 0 ? Math.min(...periodReturns) : 0;

  // 找到最佳和最差收益期的详细信息
  const bestPeriodInfo = periodInfo.find(p => p.return === bestPeriod);
  const worstPeriodInfo = periodInfo.find(p => p.return === worstPeriod);

  // 计算最多和最少资金费期
  const fundingFeeInfo: Array<{ fundingFee: number; timestamp: string; period: number }> = [];

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const currentFundingFee = snapshot.totalFundingFee || 0;
    fundingFeeInfo.push({
      fundingFee: currentFundingFee,
      timestamp: snapshot.timestamp,
      period: i + 1 // 期数从1开始
    });
  }

  // 最多和最少资金费期
  const bestFundingPeriod = fundingFeeInfo.length > 0 ? Math.max(...fundingFeeInfo.map(f => f.fundingFee)) : 0;
  const worstFundingPeriod = fundingFeeInfo.length > 0 ? Math.min(...fundingFeeInfo.map(f => f.fundingFee)) : 0;

  // 找到最多和最少资金费期的详细信息
  const bestFundingPeriodInfo = fundingFeeInfo.find(f => f.fundingFee === bestFundingPeriod);
  const worstFundingPeriodInfo = fundingFeeInfo.find(f => f.fundingFee === worstFundingPeriod);

  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  // 计算盈亏金额分解
  const totalPnlAmount = finalSnapshot.totalPnl;

  // BTC做多盈亏金额 - 累计所有期间的BTC盈亏变化
  let btcPnlAmount = 0;
  if (params.longBtc) {
    // 累计所有快照中BTC相关的盈亏变化
    for (const snapshot of snapshots) {
      if (snapshot.btcPosition) {
        btcPnlAmount += snapshot.btcPosition.pnl;
      }
      // 如果有BTC相关的卖出记录，也要累计
      if (snapshot.soldPositions) {
        const btcSoldPnl = snapshot.soldPositions
          .filter(pos => pos.symbol === 'BTCUSDT' && pos.side === 'LONG')
          .reduce((sum, pos) => sum + pos.pnl, 0);
        btcPnlAmount += btcSoldPnl;
      }
    }
  }

  // ALT做空盈亏金额 - 累计所有期间的ALT做空盈亏变化
  let altPnlAmount = 0;
  if (params.shortAlt) {
    // 累计所有快照中ALT做空相关的盈亏变化
    for (const snapshot of snapshots) {
      // 当前做空持仓的盈亏变化
      if (snapshot.shortPositions) {
        const shortPnl = snapshot.shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
        altPnlAmount += shortPnl;
      }
      // 卖出的做空持仓盈亏
      if (snapshot.soldPositions) {
        const soldShortPnl = snapshot.soldPositions
          .filter(pos => pos.side === 'SHORT')
          .reduce((sum, pos) => sum + pos.pnl, 0);
        altPnlAmount += soldShortPnl;
      }
    }
  }

  // 手续费和资金费率金额
  const tradingFeeAmount = finalSnapshot.accumulatedTradingFee;
  const fundingFeeAmount = finalSnapshot.accumulatedFundingFee || 0;

  // 计算各项收益率（基于初始资本）
  const totalPnlRate = totalPnlAmount / params.initialCapital;
  const btcPnlRate = btcPnlAmount / params.initialCapital;
  const altPnlRate = altPnlAmount / params.initialCapital;
  const tradingFeeRate = tradingFeeAmount / params.initialCapital;
  const fundingFeeRate = fundingFeeAmount / params.initialCapital;

  // 验证盈亏分解是否正确
  const calculatedTotal = btcPnlAmount + altPnlAmount + tradingFeeAmount + fundingFeeAmount;
  const difference = Math.abs(totalPnlAmount - calculatedTotal);

  if (difference > 0.01) { // 如果差额大于1分钱，输出调试信息
    console.warn(`盈亏分解验证失败:`, {
      totalPnlAmount: totalPnlAmount.toFixed(2),
      btcPnlAmount: btcPnlAmount.toFixed(2),
      altPnlAmount: altPnlAmount.toFixed(2),
      tradingFeeAmount: tradingFeeAmount.toFixed(2),
      fundingFeeAmount: fundingFeeAmount.toFixed(2),
      calculatedTotal: calculatedTotal.toFixed(2),
      difference: difference.toFixed(2)
    });
  }

  return {
    totalReturn,
    btcReturn,
    altReturn,
    annualizedReturn,
    volatility,
    sharpeRatio,
    maxDrawdown: -maxDrawdown,
    winRate,
    avgReturn: avgPeriodReturn, // 使用期间平均收益率
    bestPeriod,
    worstPeriod,
    calmarRatio,
    bestPeriodInfo,
    worstPeriodInfo,
    bestFundingPeriod,
    worstFundingPeriod,
    bestFundingPeriodInfo,
    worstFundingPeriodInfo,
    pnlBreakdown: {
      totalPnlAmount,
      btcPnlAmount,
      altPnlAmount,
      tradingFeeAmount,
      fundingFeeAmount,
      totalPnlRate,
      btcPnlRate,
      altPnlRate,
      tradingFeeRate,
      fundingFeeRate
    }
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
      priceChangeWeight: rawParams.priceChangeWeight !== undefined ? rawParams.priceChangeWeight : 0.4,
      volumeWeight: rawParams.volumeWeight !== undefined ? rawParams.volumeWeight : 0.2,
      volatilityWeight: rawParams.volatilityWeight !== undefined ? rawParams.volatilityWeight : 0.1,
      fundingRateWeight: rawParams.fundingRateWeight !== undefined ? rawParams.fundingRateWeight : 0.3,
      allocationStrategy: rawParams.allocationStrategy !== undefined ? rawParams.allocationStrategy : PositionAllocationStrategy.BY_VOLUME,
      maxSinglePositionRatio: rawParams.maxSinglePositionRatio !== undefined ? rawParams.maxSinglePositionRatio : 0.25,
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

    // 验证权重之和
    const totalWeight = params.priceChangeWeight + params.volumeWeight + params.volatilityWeight + params.fundingRateWeight;
    if (Math.abs(totalWeight - 1) > 0.001) {
      return NextResponse.json({
        success: false,
        error: '跌幅权重、成交量权重、波动率权重和资金费率权重之和必须等于1'
      }, { status: 400 });
    }

    // 设置默认手续费率
    if (params.spotTradingFeeRate === undefined) {
      params.spotTradingFeeRate = 0.0008; // 0.08%
    }
    if (params.futuresTradingFeeRate === undefined) {
      params.futuresTradingFeeRate = 0.0002; // 0.02%
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

    // 性能监控开始
    const backtestStartTime = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF] 开始BTCDOM2回测，数据点数: ${data.length}`);
    }

    // 创建策略引擎
    const strategyEngine = new BTCDOM2StrategyEngine(params);

    // 生成策略快照
    const snapshots: StrategySnapshot[] = [];
    let previousSnapshot: StrategySnapshot | null = null;

    for (let index = 0; index < data.length; index++) {
      const dataPoint = data[index];
      const previousData = index > 0 ? data[index - 1] : null;
      const snapshot = strategyEngine.generateSnapshot(dataPoint, previousSnapshot, previousData);
      snapshots.push(snapshot);
      previousSnapshot = snapshot;
      
      // 每100个数据点记录一次进度（仅开发环境）
      if (process.env.NODE_ENV === 'development' && (index + 1) % 100 === 0) {
        const progress = ((index + 1) / data.length * 100).toFixed(1);
        const elapsed = Date.now() - backtestStartTime;
        console.log(`[PERF] 回测进度: ${progress}% (${index + 1}/${data.length}), 耗时: ${elapsed}ms`);
      }
    }

    // 计算性能指标
    const performanceStartTime = Date.now();
    const performance = calculatePerformanceMetrics(snapshots, params, granularityHours);
    
    // 生成图表数据
    const chartData = generateChartData(snapshots, params);

    // 计算汇总统计
    const activeRebalances = snapshots.filter(s => s.isActive).length;
    const inactiveRebalances = snapshots.length - activeRebalances;
    const avgShortPositions = snapshots.reduce((sum, s) => sum + s.shortPositions.length, 0) / snapshots.length;

    // 性能监控总结
    const totalBacktestTime = Date.now() - backtestStartTime;
    const performanceTime = Date.now() - performanceStartTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF] BTCDOM2回测完成:`);
      console.log(`  - 数据处理耗时: ${totalBacktestTime - performanceTime}ms`);
      console.log(`  - 性能计算耗时: ${performanceTime}ms`);
      console.log(`  - 总耗时: ${totalBacktestTime}ms`);
      console.log(`  - 平均每个数据点: ${(totalBacktestTime / data.length).toFixed(2)}ms`);
      console.log(`  - 活跃/非活跃再平衡: ${activeRebalances}/${inactiveRebalances}`);
    }

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
