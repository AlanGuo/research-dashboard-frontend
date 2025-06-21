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

// 性能优化缓存系统（使用字符串键避免精度问题）
const FUNDING_RATE_SCORE_CACHE = new Map<string, number>();
const VOLATILITY_SCORE_CACHE = new Map<string, number>();

// 缓存统计监控
const CACHE_STATS = {
  fundingRateHits: 0,
  fundingRateMisses: 0,
  volatilityHits: 0,
  volatilityMisses: 0,
  lastCleanup: Date.now()
};

// 内存复用的数组池
const ARRAY_POOL = {
  volatilities: [] as number[],
  priceChanges: [] as number[],
  fundingRates: [] as number[],
  tempCandidates: [] as ShortCandidate[]
};

// 缓存清理和统计功能
function cleanupCaches() {
  const now = Date.now();
  const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分钟清理一次
  const MAX_CACHE_SIZE = 10000;

  if (now - CACHE_STATS.lastCleanup > CLEANUP_INTERVAL) {
    // 清理过大的缓存
    if (VOLATILITY_SCORE_CACHE.size > MAX_CACHE_SIZE) {
      const entries = Array.from(VOLATILITY_SCORE_CACHE.entries());
      VOLATILITY_SCORE_CACHE.clear();
      // 保留最近使用的一半
      const recentEntries = entries.slice(-Math.floor(MAX_CACHE_SIZE / 2));
      recentEntries.forEach(([key, value]) => VOLATILITY_SCORE_CACHE.set(key, value));
    }

    if (FUNDING_RATE_SCORE_CACHE.size > MAX_CACHE_SIZE) {
      const entries = Array.from(FUNDING_RATE_SCORE_CACHE.entries());
      FUNDING_RATE_SCORE_CACHE.clear();
      const recentEntries = entries.slice(-Math.floor(MAX_CACHE_SIZE / 2));
      recentEntries.forEach(([key, value]) => FUNDING_RATE_SCORE_CACHE.set(key, value));
    }

    CACHE_STATS.lastCleanup = now;

    // 开发环境下打印缓存统计
    if (process.env.NODE_ENV === 'development') {
      const volatilityTotal = CACHE_STATS.volatilityHits + CACHE_STATS.volatilityMisses;
      const fundingRateTotal = CACHE_STATS.fundingRateHits + CACHE_STATS.fundingRateMisses;
      const volatilityHitRate = volatilityTotal > 0 ? (CACHE_STATS.volatilityHits / volatilityTotal * 100).toFixed(1) : 'N/A';
      const fundingRateHitRate = fundingRateTotal > 0 ? (CACHE_STATS.fundingRateHits / fundingRateTotal * 100).toFixed(1) : 'N/A';
      console.log(`[CACHE] 定期清理 - 波动率缓存命中率: ${volatilityHitRate}%, 资金费率缓存命中率: ${fundingRateHitRate}%`);
    }
  }
}

// 高精度资金费率分数计算（带缓存）
function fastFundingRateScore(fundingRate: number): number {
  // 使用高精度字符串作为键，避免浮点数精度问题
  const key = fundingRate.toFixed(8); // 保留8位小数精度

  if (FUNDING_RATE_SCORE_CACHE.has(key)) {
    CACHE_STATS.fundingRateHits++;
    return FUNDING_RATE_SCORE_CACHE.get(key)!;
  }

  CACHE_STATS.fundingRateMisses++;

  // 原始计算逻辑，确保与未优化版本完全一致
  const fundingRatePercent = fundingRate * 100;
  const score = Math.max(0, Math.min(1, (fundingRatePercent + 2) / 4));

  // 缓存计算结果
  FUNDING_RATE_SCORE_CACHE.set(key, score);
  return score;
}

// 高精度波动率分数计算（带缓存）
function fastVolatilityScore(volatility: number, idealVolatility: number, volatilitySpread: number): number {
  // 使用高精度字符串组合作为键
  const key = `${volatility.toFixed(8)}_${idealVolatility.toFixed(8)}_${volatilitySpread.toFixed(8)}`;

  if (VOLATILITY_SCORE_CACHE.has(key)) {
    CACHE_STATS.volatilityHits++;
    return VOLATILITY_SCORE_CACHE.get(key)!;
  }

  CACHE_STATS.volatilityMisses++;

  // 原始计算逻辑，确保与未优化版本完全一致
  const score = volatilitySpread > 0
    ? Math.exp(-Math.pow(volatility - idealVolatility, 2) / (2 * Math.pow(volatilitySpread, 2)))
    : 1;

  VOLATILITY_SCORE_CACHE.set(key, score);
  return score;
}

// 批量统计计算接口
interface BatchStats {
  filteredRankings: RankingItem[];
  totalCandidates: number;
  volatility: {
    min: number;
    max: number;
    avg: number;
    spread: number;
  };
  priceChange: {
    maxAbsoluteDecline: number;
    hasDeclines: boolean;
    min: number;
    max: number;
  };
}

// 批量统计计算优化
function computeBatchStats(rankings: RankingItem[]): BatchStats {
  const filteredRankings = rankings.filter(item => item.symbol !== 'BTCUSDT');

  // 复用数组，避免重复分配内存
  ARRAY_POOL.volatilities.length = 0;
  ARRAY_POOL.priceChanges.length = 0;
  ARRAY_POOL.fundingRates.length = 0;

  let minVolatility = Infinity;
  let maxVolatility = -Infinity;
  let volSum = 0;
  let volCount = 0;
  let minPriceChange = Infinity;
  let maxPriceChange = -Infinity;
  let maxAbsoluteDecline = 0;
  let hasDeclines = false;

  // 单次遍历计算所有统计数据，避免多次遍历
  for (const item of filteredRankings) {
    const vol = item.volatility24h;
    if (!isNaN(vol) && isFinite(vol)) {
      ARRAY_POOL.volatilities.push(vol);
      minVolatility = Math.min(minVolatility, vol);
      maxVolatility = Math.max(maxVolatility, vol);
      volSum += vol;
      volCount++;
    }

    const priceChange = item.priceChange24h;
    ARRAY_POOL.priceChanges.push(priceChange);
    minPriceChange = Math.min(minPriceChange, priceChange);
    maxPriceChange = Math.max(maxPriceChange, priceChange);

    if (priceChange < 0) {
      hasDeclines = true;
      maxAbsoluteDecline = Math.max(maxAbsoluteDecline, Math.abs(priceChange));
    }

    if (item.fundingRateHistory && item.fundingRateHistory.length > 0) {
      const latestFunding = item.fundingRateHistory[item.fundingRateHistory.length - 1];
      if (latestFunding && !isNaN(latestFunding.fundingRate) && isFinite(latestFunding.fundingRate)) {
        ARRAY_POOL.fundingRates.push(latestFunding.fundingRate);
      }
    }
  }

  return {
    filteredRankings,
    totalCandidates: filteredRankings.length,
    volatility: {
      min: volCount > 0 ? minVolatility : 0,
      max: volCount > 0 ? maxVolatility : 0,
      avg: volCount > 0 ? volSum / volCount : 0,
      spread: 0 // 将在后面计算
    },
    priceChange: {
      maxAbsoluteDecline,
      hasDeclines,
      min: minPriceChange === Infinity ? 0 : minPriceChange,
      max: maxPriceChange === -Infinity ? 0 : maxPriceChange
    }
  };
}









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
  async selectShortCandidates(
    rankings: RankingItem[],
    btcPriceChange: number
  ): Promise<ShortSelectionResult> {
    const startTime = Date.now(); // 性能监控

    // 定期清理缓存
    cleanupCaches();

    // 使用优化的批量统计计算
    const stats = computeBatchStats(rankings);

    // 提前终止：如果没有候选标的，直接返回
    if (stats.totalCandidates === 0) {
      return {
        selectedCandidates: [],
        rejectedCandidates: [],
        selectionReason: '无可用的候选标的',
        totalCandidates: 0
      };
    }

    // 计算波动率spread
    stats.volatility.spread = Math.max((stats.volatility.max - stats.volatility.min) / 4, 0.01);

    let selectedCount = 0;

    // 预计算理想波动率
    const idealVolatility = stats.volatility.avg;
    const volatilitySpread = stats.volatility.spread;

    // 预排序优化：按价格变化预筛选，避免处理明显不符合条件的项
    const preFilteredItems = stats.filteredRankings.filter(item => {
      const priceChange = isNaN(item.priceChange24h) ? 0 : item.priceChange24h;
      return priceChange < btcPriceChange;
    });

    // 如果预筛选后没有符合条件的候选者，快速返回
    if (preFilteredItems.length === 0) {
      const rejectedCandidates = stats.filteredRankings.map(item => ({
        symbol: item.symbol,
        rank: item.rank,
        priceChange24h: isNaN(item.priceChange24h) ? 0 : item.priceChange24h,
        volume24h: item.volume24h,
        quoteVolume24h: item.quoteVolume24h,
        volatility24h: item.volatility24h,
        marketShare: item.marketShare,
        priceAtTime: item.priceAtTime,
        futurePriceAtTime: item.futurePriceAtTime,
        futureSymbol: item.futureSymbol,
        priceChangeScore: 0,
        volumeScore: 0,
        volatilityScore: 0,
        fundingRateScore: 0,
        totalScore: 0,
        eligible: false,
        reason: `涨跌幅 ${item.priceChange24h.toFixed(2)}% 不低于BTC ${btcPriceChange.toFixed(2)}%`
      }));

      return {
        selectedCandidates: [],
        rejectedCandidates,
        totalCandidates: stats.filteredRankings.length,
        selectionReason: '无符合价格条件的候选标的'
      };
    }

    // 复用候选者数组
    ARRAY_POOL.tempCandidates.length = 0;

    // 并行处理候选者评分 - 将数组分块处理以提升性能
    const chunkSize = Math.max(1, Math.ceil(preFilteredItems.length / 8)); // 利用8个并行任务
    const chunks: RankingItem[][] = [];
    
    for (let i = 0; i < preFilteredItems.length; i += chunkSize) {
      chunks.push(preFilteredItems.slice(i, i + chunkSize));
    }

    // 并行处理各个分块
    const candidatePromises = chunks.map(async (chunk) => {
      const chunkCandidates: ShortCandidate[] = [];
      
      for (const item of chunk) {
        const priceChange = isNaN(item.priceChange24h) ? 0 : item.priceChange24h;

        // 计算各项分数（使用优化的计算方法）
        const priceChangeScore = stats.priceChange.hasDeclines
          ? Math.abs(Math.min(priceChange, 0)) / stats.priceChange.maxAbsoluteDecline
          : (stats.priceChange.max > stats.priceChange.min
              ? 1 - (priceChange - stats.priceChange.min) / (stats.priceChange.max - stats.priceChange.min)
              : 1);

        const volumeScore = (stats.totalCandidates - item.rank + 1) / stats.totalCandidates;

        const validVolatility = isNaN(item.volatility24h) || !isFinite(item.volatility24h) ? idealVolatility : item.volatility24h;
        const volatilityScore = fastVolatilityScore(validVolatility, idealVolatility, volatilitySpread);

        let fundingRateScore = 0.5;
        if (item.fundingRateHistory && item.fundingRateHistory.length > 0) {
          const latestFunding = item.fundingRateHistory[item.fundingRateHistory.length - 1];
          if (latestFunding && !isNaN(latestFunding.fundingRate) && isFinite(latestFunding.fundingRate)) {
            fundingRateScore = fastFundingRateScore(latestFunding.fundingRate);
          }
        }

        const totalScore = priceChangeScore * this.params.priceChangeWeight +
                          volumeScore * this.params.volumeWeight +
                          volatilityScore * this.params.volatilityWeight +
                          fundingRateScore * this.params.fundingRateWeight;

        const finalTotalScore = isNaN(totalScore) ? 0 : totalScore;

        // 创建候选者对象
        const candidate: ShortCandidate = {
          symbol: item.symbol,
          rank: item.rank,
          priceChange24h: priceChange,
          volume24h: item.volume24h,
          quoteVolume24h: item.quoteVolume24h,
          volatility24h: item.volatility24h,
          marketShare: item.marketShare,
          priceAtTime: item.priceAtTime,
          futurePriceAtTime: item.futurePriceAtTime,
          futureSymbol: item.futureSymbol,
          priceChangeScore,
          volumeScore,
          volatilityScore,
          fundingRateScore,
          totalScore: finalTotalScore,
          eligible: true,
          reason: `综合评分: ${finalTotalScore.toFixed(3)}`
        };

        // 调试信息：记录分数异常的情况（仅开发环境）
        if (process.env.NODE_ENV === 'development' && (isNaN(totalScore) || isNaN(priceChangeScore) || isNaN(volumeScore) || isNaN(volatilityScore) || isNaN(fundingRateScore))) {
          console.warn(`[DEBUG] 分数异常 ${item.symbol}:`, {
            priceChange: item.priceChange24h,
            volatility: item.volatility24h,
            rank: item.rank,
            scores: { priceChangeScore, volumeScore, volatilityScore, fundingRateScore, totalScore: finalTotalScore }
          });
        }

        chunkCandidates.push(candidate);
      }
      
      return chunkCandidates;
    });

    // 等待所有并行任务完成并合并结果
    const candidateChunks = await Promise.all(candidatePromises);
    const allCandidates = candidateChunks.flat();
    
    // 限制候选者数量以提高效率
    const maxCandidates = this.params.maxShortPositions * 2;
    selectedCount = Math.min(allCandidates.length, maxCandidates);
    
    // 将结果添加到数组池
    ARRAY_POOL.tempCandidates.push(...allCandidates.slice(0, maxCandidates));

    // 在temp数组中排序，避免额外的过滤操作
    ARRAY_POOL.tempCandidates.sort((a, b) => b.totalScore - a.totalScore);

    // 创建最终结果，只复制需要的数量
    const eligibleCandidates = [...ARRAY_POOL.tempCandidates];

    // 添加被拒绝的候选者（价格不符合条件的）
    const rejectedCandidates: ShortCandidate[] = [];
    for (const item of stats.filteredRankings) {
      const priceChange = isNaN(item.priceChange24h) ? 0 : item.priceChange24h;
      if (priceChange >= btcPriceChange) {
        rejectedCandidates.push({
          symbol: item.symbol,
          rank: item.rank,
          priceChange24h: priceChange,
          volume24h: item.volume24h,
          quoteVolume24h: item.quoteVolume24h,
          volatility24h: item.volatility24h,
          marketShare: item.marketShare,
          priceAtTime: item.priceAtTime,
          futurePriceAtTime: item.futurePriceAtTime,
          futureSymbol: item.futureSymbol,
          priceChangeScore: 0,
          volumeScore: 0,
          volatilityScore: 0,
          fundingRateScore: 0,
          totalScore: 0,
          eligible: false,
          reason: `涨跌幅 ${priceChange.toFixed(2)}% 不低于BTC ${btcPriceChange.toFixed(2)}%`
        });
      }
    }

    // 只对符合条件的候选者排序
    eligibleCandidates.sort((a, b) => b.totalScore - a.totalScore);

    const finalSelectedCandidates = eligibleCandidates.slice(0, this.params.maxShortPositions);

    const selectionReason = finalSelectedCandidates.length > 0
      ? `选择了${finalSelectedCandidates.length}个做空标的`
      : '无符合条件的做空标的';

    // 性能监控日志（仅开发环境）
    const executionTime = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development' && executionTime > 20) {
      const volatilityTotal = CACHE_STATS.volatilityHits + CACHE_STATS.volatilityMisses;
      const fundingRateTotal = CACHE_STATS.fundingRateHits + CACHE_STATS.fundingRateMisses;
      const volatilityHitRate = volatilityTotal > 0 ? (CACHE_STATS.volatilityHits / volatilityTotal * 100).toFixed(1) : 'N/A';
      const fundingRateHitRate = fundingRateTotal > 0 ? (CACHE_STATS.fundingRateHits / fundingRateTotal * 100).toFixed(1) : 'N/A';

      console.log(`[PERF] selectShortCandidates 耗时: ${executionTime}ms, 总候选数: ${stats.totalCandidates}, 预筛选后: ${selectedCount}, 最终选择: ${finalSelectedCandidates.length}`);
      console.log(`[CACHE] 波动率缓存命中率: ${volatilityHitRate}%, 资金费率缓存命中率: ${fundingRateHitRate}%`);
      console.log(`[CACHE] 缓存大小 - 波动率: ${VOLATILITY_SCORE_CACHE.size}, 资金费率: ${FUNDING_RATE_SCORE_CACHE.size}`);
    }

    return {
      selectedCandidates: finalSelectedCandidates,
      rejectedCandidates,
      totalCandidates: eligibleCandidates.length + rejectedCandidates.length,
      selectionReason
    };
  }

  // 生成策略快照
  async generateSnapshot(
    dataPoint: VolumeBacktestDataPoint,
    previousSnapshot: StrategySnapshot | null,
    previousData: VolumeBacktestDataPoint | null = null
  ): Promise<StrategySnapshot> {
    const { timestamp, hour, btcPrice, btcPriceChange24h, btcdomPrice, btcdomPriceChange24h, rankings, removedSymbols } = dataPoint;

    // 筛选做空候选标的
    const selectionResult = await this.selectShortCandidates(rankings, btcPriceChange24h);
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
      btcdomPrice,
      btcdomPriceChange24h,
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
      period: i + 1 // 期数从1开始，第i个快照对应第i+1期
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
      btcPrice: snapshot.btcPrice,
      btcdomPrice: snapshot.btcdomPrice
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

    // 检查是否为优化模式（跳过图表数据生成以提升性能）
    const optimizeOnly = rawParams.optimizeOnly === true;

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
      console.log(`[PERF] 开始BTCDOM2回测, startTime: ${startTime}, endTime: ${endTime}, 数据点数: ${data.length}`);
    }

    // 创建策略引擎
    const strategyEngine = new BTCDOM2StrategyEngine(params);

    // 生成策略快照
    const snapshots: StrategySnapshot[] = [];
    let previousSnapshot: StrategySnapshot | null = null;

    for (let index = 0; index < data.length; index++) {
      const dataPoint = data[index];
      const previousData = index > 0 ? data[index - 1] : null;
      const snapshot = await strategyEngine.generateSnapshot(dataPoint, previousSnapshot, previousData);
      snapshots.push(snapshot);
      previousSnapshot = snapshot;

      // 每100个数据点记录一次进度（仅开发环境）
      // if (process.env.NODE_ENV === 'development' && (index + 1) % 100 === 0) {
      //   const progress = ((index + 1) / data.length * 100).toFixed(1);
      //   const elapsed = Date.now() - backtestStartTime;
      // }
    }

    // 计算性能指标
    const performanceStartTime = Date.now();
    const performance = calculatePerformanceMetrics(snapshots, params, granularityHours);

    // 生成图表数据（优化模式下跳过以提升性能）
    const chartData = optimizeOnly ? [] : generateChartData(snapshots, params);

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
