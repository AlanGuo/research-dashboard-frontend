import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/index';
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
  ShortSelectionResult,
  PositionAllocationStrategy
} from '@/types/btcdom2';

// 性能优化缓存系统（使用字符串键避免精度问题）
const FUNDING_RATE_SCORE_CACHE = new Map<string, number>();
const VOLATILITY_SCORE_CACHE = new Map<string, number>();

// 添加候选者结果缓存 - 这是最大的性能瓶颈
const CANDIDATE_SELECTION_CACHE = new Map<string, ShortSelectionResult>();

// 缓存统计监控
const CACHE_STATS = {
  fundingRateHits: 0,
  fundingRateMisses: 0,
  volatilityHits: 0,
  volatilityMisses: 0,
  candidateSelectionHits: 0,
  candidateSelectionMisses: 0,
  lastCleanup: Date.now()
};

// 内存复用的数组池
const ARRAY_POOL = {
  volatilities: [] as number[],
  priceChanges: [] as number[],
  fundingRates: [] as number[],
  tempCandidates: [] as ShortCandidate[]
};

// 生成候选者选择的缓存键
function getCandidateSelectionCacheKey(
  rankings: RankingItem[],
  btcPriceChange: number,
  params: BTCDOM2StrategyParams
): string {
  // 使用关键参数生成缓存键，降低精度提高命中率
  const symbolsHash = rankings
    .slice(0, 10) // 只使用前10个排名作为哈希，减少键的复杂度
    .map(r => `${r.symbol}:${r.priceChange24h.toFixed(2)}:${Math.round(r.volume24h)}:${r.volatility24h.toFixed(2)}`)
    .join('|');
  const paramsHash = `${params.priceChangeWeight.toFixed(2)}:${params.volumeWeight.toFixed(2)}:${params.volatilityWeight.toFixed(2)}:${params.fundingRateWeight.toFixed(2)}:${params.maxShortPositions}`;
  return `${btcPriceChange.toFixed(2)}:${paramsHash}:${symbolsHash}`;
}

// 缓存清理和统计功能
function cleanupCaches() {
  const now = Date.now();
  const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分钟清理一次
  const MAX_CACHE_SIZE = 5000; // 减小缓存大小限制

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

    // 清理候选者选择缓存
    if (CANDIDATE_SELECTION_CACHE.size > 100) {
      const entries = Array.from(CANDIDATE_SELECTION_CACHE.entries());
      CANDIDATE_SELECTION_CACHE.clear();
      // 只保留最近的20个结果
      const recentEntries = entries.slice(-20);
      recentEntries.forEach(([key, value]) => CANDIDATE_SELECTION_CACHE.set(key, value));
    }

    CACHE_STATS.lastCleanup = now;

    // 打印缓存统计
    const volatilityTotal = CACHE_STATS.volatilityHits + CACHE_STATS.volatilityMisses;
    const fundingRateTotal = CACHE_STATS.fundingRateHits + CACHE_STATS.fundingRateMisses;
    const candidateTotal = CACHE_STATS.candidateSelectionHits + CACHE_STATS.candidateSelectionMisses;
    const volatilityHitRate = volatilityTotal > 0 ? (CACHE_STATS.volatilityHits / volatilityTotal * 100).toFixed(1) : 'N/A';
    const fundingRateHitRate = fundingRateTotal > 0 ? (CACHE_STATS.fundingRateHits / fundingRateTotal * 100).toFixed(1) : 'N/A';
    const candidateHitRate = candidateTotal > 0 ? (CACHE_STATS.candidateSelectionHits / candidateTotal * 100).toFixed(1) : 'N/A';
    console.debug(`[CACHE] 定期清理 - 波动率: ${volatilityHitRate}%, 资金费率: ${fundingRateHitRate}%, 候选者选择: ${candidateHitRate}%`);
  }
}

// 高精度资金费率分数计算（带缓存）
function fastFundingRateScore(fundingRate: number): number {
  // 使用适中精度字符串作为键，提高缓存命中率
  const key = fundingRate.toFixed(6); // 保留6位小数精度

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
  // 使用低精度字符串组合作为键，提高缓存命中率
  const key = `${volatility.toFixed(4)}_${idealVolatility.toFixed(4)}_${volatilitySpread.toFixed(4)}`;

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

    if (item.currentFundingRate && item.currentFundingRate.length > 0) {
      // 取最新的一条资金费率记录
      const latestFunding = item.currentFundingRate[item.currentFundingRate.length - 1];
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

  // 私有日志方法 - 根据开关控制日志输出
  private log(message: string, data?: unknown): void {
    if (this.params.enableSnapshotLogs) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  // 检查当前时间是否在温度计超阈值期间内
  private isInTemperatureHighPeriod(timestamp: string): boolean {
    if (!this.params.useTemperatureRule || !this.params.temperatureData) {
      return false;
    }

    const temperatureValue = this.getPreviousTemperatureValue(timestamp);
    if (temperatureValue === null) {
      return false; // 如果没有找到上一期的数据，默认不触发温度计规则
    }

    return temperatureValue > this.params.temperatureThreshold;
  }

  // 获取上一期的温度计数值，用于显示和判断
  private getPreviousTemperatureValue(timestamp: string): number | null {
    if (!this.params.temperatureData) {
      return null;
    }

    const currentTime = new Date(timestamp);
    const timeframe = this.params.temperatureTimeframe || '1D';

    // 根据时间间隔计算上一期的时间
    let previousTime: Date;
    let compareFunction: (dataPointTime: Date, targetTime: Date) => boolean;

    if (timeframe === '8H') {
      // 8小时模式：找上一个8小时的数据点
      previousTime = new Date(currentTime.getTime() - 8 * 60 * 60 * 1000);
      
      // 8H模式下寻找最接近的前一个8小时时间点
      compareFunction = (dataPointTime: Date, targetTime: Date) => {
        const timeDiff = Math.abs(dataPointTime.getTime() - targetTime.getTime());
        return timeDiff <= 4 * 60 * 60 * 1000; // 允许4小时的误差范围
      };
    } else {
      // 1D模式：找前一天的数据点（保持原有逻辑）
      previousTime = new Date(currentTime);
      previousTime.setDate(previousTime.getDate() - 1);

      compareFunction = (dataPointTime: Date, targetTime: Date) => {
        const dataPointDateStr = dataPointTime.toISOString().split('T')[0];
        const targetDateStr = targetTime.toISOString().split('T')[0];
        return dataPointDateStr === targetDateStr;
      };
    }

    // 查找匹配的温度计数据点
    for (const dataPoint of this.params.temperatureData) {
      const dataPointTime = new Date(dataPoint.timestamp);
      
      if (compareFunction(dataPointTime, previousTime)) {
        return dataPoint.value;
      }
    }

    // 如果没有找到上一期的数据，返回null
    return null;
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

        if (totalScore > 0) {
          candidates.forEach(candidate => {
            const validScore = candidate.totalScore || 0;
            const allocation = validTotalAmount * (validScore / totalScore);
            allocations.push(isNaN(allocation) ? 0 : allocation);
          });
        } else {
          // 如果总分数为0，平均分配
          const equalAmount = validTotalAmount / Math.max(candidates.length, 1);
          candidates.forEach(() => {
            allocations.push(equalAmount);
          });
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
    // 生成缓存键
    const cacheKey = getCandidateSelectionCacheKey(rankings, btcPriceChange, this.params);

    // 检查缓存
    const cachedResult = CANDIDATE_SELECTION_CACHE.get(cacheKey);
    if (cachedResult) {
      CACHE_STATS.candidateSelectionHits++;
      return cachedResult;
    }
    CACHE_STATS.candidateSelectionMisses++;

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

    // 直接处理候选者评分 - 对于小量数据，直接处理比并行处理更高效
    const allCandidates: ShortCandidate[] = [];

    for (const item of preFilteredItems) {
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
      if (item.currentFundingRate && item.currentFundingRate.length > 0) {
        // 取最新的一条资金费率记录
        const latestFunding = item.currentFundingRate[item.currentFundingRate.length - 1];
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

      // 调试信息：记录分数异常的情况
      if (isNaN(totalScore) || isNaN(priceChangeScore) || isNaN(volumeScore) || isNaN(volatilityScore) || isNaN(fundingRateScore)) {
        console.warn(`[DEBUG] 分数异常 ${item.symbol}:`, {
          priceChange: item.priceChange24h,
          volatility: item.volatility24h,
          rank: item.rank,
          scores: { priceChangeScore, volumeScore, volatilityScore, fundingRateScore, totalScore: finalTotalScore }
        });
      }

      allCandidates.push(candidate);
    }

    // 限制候选者数量以提高效率
    const maxCandidates = this.params.maxShortPositions * 2;

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

    const result = {
      selectedCandidates: finalSelectedCandidates,
      rejectedCandidates,
      totalCandidates: eligibleCandidates.length + rejectedCandidates.length,
      selectionReason
    };

    // 将结果存入缓存
    CANDIDATE_SELECTION_CACHE.set(cacheKey, result);

    return result;
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

    // 检查温度计规则
    const isInTemperatureHigh = this.isInTemperatureHighPeriod(timestamp);
    let temperatureRuleReason = '';

    if (isInTemperatureHigh) {
      temperatureRuleReason = `温度计高于${this.params.temperatureThreshold}，禁止持有空头仓位`;
    }

    // 检查是否有可执行的策略
    const hasShortCandidates = selectedCandidates.length > 0;
    // 温度计高于阈值时，不能做空ALT
    const canShortAlt = !isInTemperatureHigh; // 始终做空ALT，除非温度计高温
    
    // 分离BTC和ALT的活跃状态：
    // - BTC做多：始终活跃（不受温度计影响）
    // - ALT做空：受温度计和候选标的影响
    const btcActive = this.params.longBtc; // BTC做多始终活跃
    const altActive = canShortAlt && hasShortCandidates && this.params.shortAlt; // ALT做空受温度计控制
    
    // 策略总体活跃状态：ALT活跃算策略活跃
    const isActive = altActive;

    // 计算当前总价值（如果是第一个快照，则使用初始本金）
    const previousValue = previousSnapshot?.totalValue || this.params.initialCapital;

    const soldPositions: PositionInfo[] = [];
    let btcSoldPosition: PositionInfo | null = null; // BTC专用的卖出持仓记录
    let btcPosition: PositionInfo | null = null;
    const shortPositions: PositionInfo[] = [];
    let account_usdt_balance = 0; // 统一账户余额
    let totalValue = previousValue;
    let totalTradingFee = 0;
    let totalFundingFee = 0;
    let btcSaleRevenue = 0; // BTC现货卖出收入
    let btcPurchaseExpense = 0; // BTC现货买入支出
    const accumulatedTradingFee = (previousSnapshot?.accumulatedTradingFee || 0);
    const accumulatedFundingFee = (previousSnapshot?.accumulatedFundingFee || 0);
    
    // 如果因为温度计规则导致不能做空，记录原因
    let inactiveReason = '';
    if (isInTemperatureHigh && this.params.shortAlt) {
      inactiveReason = temperatureRuleReason;
    } else if (!altActive && this.params.shortAlt) {
      inactiveReason = '无符合做空条件的ALT标的，ALT空仓状态';
    }

    // === BTC持仓处理（始终活跃，不受温度计影响） ===
    if (btcActive) {
      const btcAmount = totalValue * this.params.btcRatio;
      const btcQuantity = btcAmount / btcPrice;

      // 计算BTC盈亏（基于价格变化和持仓数量）
      let btcPnl = 0;
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
        }
      } else {
        // 第一次开仓，计算手续费
        btcTradingFee = this.calculateTradingFee(btcAmount, true); // BTC现货交易
        btcIsNewPosition = true;
        // 第一次开仓BTC买入支出（不包含手续费， 手续费统一算）
        btcPurchaseExpense = btcAmount;
        
        // BTC初始开仓现金流日志
        this.log(`[BTC初始开仓现金流] 时间: ${timestamp}`, {
          symbol: 'BTCUSDT',
          side: 'LONG',
          action: 'BTC现货初始开仓',
          quantity: btcQuantity,
          currentPrice: btcPrice,
          btcAmount: btcAmount,
          btcTradingFee: btcTradingFee,
          btcPurchaseExpense: btcPurchaseExpense,
          explanation: 'BTC现货初始买入支出，减少现金余额'
        });
      }

      // 确保所有数值都是有效的
      const validBtcAmount = isNaN(btcAmount) || btcAmount <= 0 ? 0 : btcAmount;
      const validBtcQuantity = isNaN(btcQuantity) || btcQuantity <= 0 ? 0 : btcQuantity;
      const validBtcPnl = isNaN(btcPnl) ? 0 : btcPnl;
      const validBtcTradingFee = isNaN(btcTradingFee) ? 0 : btcTradingFee;
      const prevAmount = previousSnapshot?.btcPosition?.value ?? validBtcAmount;
      const previousBtcPrice = previousSnapshot?.btcPosition?.currentPrice;

      totalTradingFee += validBtcTradingFee;

      // 计算加权平均成本价和交易类型
      let newEntryPrice: number;
      let periodTradingType: 'buy' | 'sell' | 'hold';
      let btcTradingQuantity: number;
      let btcQuantityChange: { type: 'new' | 'increase' | 'decrease' | 'same' | 'sold'; previousQuantity?: number; changePercent?: number };
      
      if (previousSnapshot?.btcPosition) {
        const prevQuantity = previousSnapshot.btcPosition.quantity ?? 0;
        const prevEntryPrice = previousSnapshot.btcPosition.entryPrice ?? btcPrice;
        const quantityDiff = validBtcQuantity - prevQuantity;
        btcTradingQuantity = quantityDiff;
        
        if (Math.abs(quantityDiff) < 0.0001) {
          // 数量基本没变，保持原均价
          newEntryPrice = prevEntryPrice;
          periodTradingType = 'hold';
          btcQuantityChange = {
            type: 'same',
            previousQuantity: prevQuantity,
            changePercent: 0
          };
        } else if (quantityDiff > 0) {
          // 加仓，计算加权平均成本价
          newEntryPrice = (prevQuantity * prevEntryPrice + quantityDiff * btcPrice) / validBtcQuantity;
          periodTradingType = 'buy';
          btcQuantityChange = {
            type: 'increase',
            previousQuantity: prevQuantity,
            changePercent: prevQuantity > 0 ? (quantityDiff / prevQuantity) * 100 : 0
          };

          // BTC现货加仓：需要扣除现金购买BTC
          const addValue = quantityDiff * btcPrice; // 加仓投入金额
          const addTradingFee = validBtcTradingFee; // 加仓手续费
          
          // 记录BTC买入支出（不包含手续费， 手续费统一算）
          btcPurchaseExpense = addValue;
          
          // BTC加仓现金流日志
          this.log(`[BTC加仓现金流] 时间: ${timestamp}`, {
            symbol: 'BTCUSDT',
            side: 'LONG',
            action: 'BTC现货加仓',
            addQuantity: quantityDiff,
            currentPrice: btcPrice,
            addValue: addValue,
            addTradingFee: addTradingFee,
            btcPurchaseExpense: btcPurchaseExpense,
            explanation: 'BTC现货买入支出，减少现金余额'
          });
        } else {
          // 减仓，保持原均价（部分卖出不影响剩余持仓的成本价）
          newEntryPrice = prevEntryPrice;
          periodTradingType = 'sell';
          btcQuantityChange = {
            type: 'decrease',
            previousQuantity: prevQuantity,
            changePercent: prevQuantity > 0 ? (quantityDiff / prevQuantity) * 100 : 0
          };

          // BTC现货减仓：记录到btcSoldPositions
          const soldQuantity = Math.abs(quantityDiff); // 卖出的数量（正数）
          const soldValue = soldQuantity * btcPrice; // 实际卖出收入
          const soldTradingFee = validBtcTradingFee; // 减仓手续费
          const soldPnl = soldQuantity * (btcPrice - prevEntryPrice); // BTC减仓盈亏：卖出数量 × (卖出价 - 成本价)
          
          // 记录BTC卖出收入（不包含手续费，手续费后面统一处理）
          btcSaleRevenue = soldValue;
          
          // 记录BTC减仓信息
          btcSoldPosition = {
            symbol: 'BTCUSDT',
            side: 'LONG',
            value: soldValue,
            quantity: soldQuantity,
            entryPrice: prevEntryPrice,
            currentPrice: btcPrice,
            periodTradingPrice: btcPrice,
            periodTradingType: 'sell',
            tradingQuantity: -soldQuantity, // 减仓为负数
            pnl: soldPnl,
            pnlPercent: prevEntryPrice > 0 ? soldPnl / (soldQuantity * prevEntryPrice) : 0,
            tradingFee: soldTradingFee,
            priceChange24h: btcPriceChange24h,
            isSoldOut: false, // 部分减仓
            isNewPosition: false,
            priceChange: {
              type: btcPrice > prevEntryPrice ? 'increase' : btcPrice < prevEntryPrice ? 'decrease' : 'same',
              previousPrice: prevEntryPrice,
              changePercent: prevEntryPrice > 0 ? (btcPrice - prevEntryPrice) / prevEntryPrice : 0
            },
            quantityChange: {
              type: 'sold',
              previousQuantity: prevQuantity,
              changePercent: prevQuantity > 0 ? (quantityDiff / prevQuantity) * 100 : 0
            },
            reason: 'BTC现货减仓已实现盈亏'
          };
          
          // BTC减仓现金流日志
          this.log(`[BTC减仓现金流] 时间: ${timestamp}`, {
            symbol: 'BTCUSDT',
            side: 'LONG',
            action: 'BTC现货减仓',
            soldQuantity: soldQuantity,
            currentPrice: btcPrice,
            soldValue: soldValue,
            soldTradingFee: soldTradingFee,
            soldPnl: soldPnl,
            btcSaleRevenue: btcSaleRevenue,
            explanation: 'BTC现货卖出收入及已实现盈亏'
          });
        }
      } else {
        // 新开仓
        newEntryPrice = btcPrice;
        periodTradingType = 'buy';
        btcTradingQuantity = validBtcQuantity;
        btcQuantityChange = { type: 'new', previousQuantity: 0, changePercent: 0 };
      }
      
      btcPosition = {
        symbol: 'BTCUSDT',
        side: 'LONG',
        value: validBtcAmount,
        quantity: validBtcQuantity,
        entryPrice: newEntryPrice, // 使用加权平均成本价
        currentPrice: btcPrice,
        periodTradingPrice: btcPrice, // 当期交易价格
        periodTradingType: periodTradingType, // 当期交易类型
        tradingQuantity: btcTradingQuantity, // 当期实际交易数量
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
        quantityChange: btcQuantityChange, // 数量变化信息
        reason: 'BTC基础持仓'
      }
    }

    // === 统一ALT持仓管理 ===
    // 创建目标持仓映射：基于策略状态决定目标持仓
    const targetPositions = new Map<string, {
      candidate: ShortCandidate;
      targetAllocation: number;
      targetQuantity: number;
      price: number;
    }>();

    if (altActive) {
      const shortAmount = totalValue * (1 - this.params.btcRatio);
      // 根据分配策略计算仓位分配
      const allocations = this.calculatePositionAllocations(selectedCandidates, shortAmount);

      // 构建目标持仓映射
      selectedCandidates.forEach((candidate, index) => {
        const allocation = allocations[index];
        
        // 价格优先级：期货价格 > 现货价格
        let price = 1; // 默认价格
        if (candidate.futurePriceAtTime && candidate.futurePriceAtTime > 0) {
          price = candidate.futurePriceAtTime;
        } else if (candidate.priceAtTime && candidate.priceAtTime > 0) {
          price = candidate.priceAtTime;
        }

        const targetQuantity = allocation > 0 && price > 0 ? allocation / price : 0;
        
        targetPositions.set(candidate.symbol, {
          candidate,
          targetAllocation: allocation,
          targetQuantity,
          price
        });
      });
    }
    // 如果策略不活跃（温度计高温或无候选标的），目标持仓为空

    // === 预先计算所有上期持仓的资金费率 ===
    if (previousSnapshot?.shortPositions) {
      for (const prevPosition of previousSnapshot.shortPositions) {
        const symbol = prevPosition.symbol;
        const prevRankingItem = previousData?.rankings?.find(r => r.symbol === symbol);
        const previousFundingRateHistory = prevRankingItem?.fundingRateHistory || [];
        
        if (previousFundingRateHistory.length > 0 && prevPosition.quantity > 0) {
          let positionFundingFee = 0;
          
          // 只使用最新的一条资金费率记录（刚刚过去的整点）
          const latestFunding = previousFundingRateHistory[previousFundingRateHistory.length - 1];
          if (latestFunding && !isNaN(latestFunding.fundingRate) && isFinite(latestFunding.fundingRate)) {
            const effectiveMarkPrice = (latestFunding.markPrice && isFinite(latestFunding.markPrice) && latestFunding.markPrice > 0)
              ? latestFunding.markPrice
              : prevPosition.currentPrice;
            const positionValue = prevPosition.quantity * effectiveMarkPrice;
            positionFundingFee = positionValue * latestFunding.fundingRate;
          }
          
          totalFundingFee += positionFundingFee;
        }
      }
    }

    // === 统一处理所有ALT持仓变化 ===
    const processedSymbols = new Set<string>();

    // 第一步：处理已存在的持仓
    if (previousSnapshot?.shortPositions) {
      for (const prevPosition of previousSnapshot.shortPositions) {
        const symbol = prevPosition.symbol;
        processedSymbols.add(symbol);
        
        const targetPosition = targetPositions.get(symbol);
        
        if (!targetPosition) {
          // 完全平仓：不在目标持仓中
          let sellReason: string;
          if (isInTemperatureHigh) {
            sellReason = `温度计规则强制卖出（${this.params.temperatureSymbol}>${this.params.temperatureThreshold})`;
          } else if (!selectedCandidates.find(c => c.symbol === symbol)) {
            sellReason = '持仓卖出';
          } else {
            sellReason = '策略调整：不再做空ALT';
          }

          // 获取当前价格
          let rankingItem = removedSymbols?.find(r => r.symbol === symbol);
          if (!rankingItem) {
            rankingItem = rankings.find(r => r.symbol === symbol);
          }

          const currentPrice = rankingItem?.futurePriceAtTime || rankingItem?.priceAtTime || prevPosition.currentPrice;
          const priceChange24h = rankingItem?.priceChange24h || 0;
          const sellAmount = prevPosition.quantity * currentPrice;
          const sellFee = this.calculateTradingFee(sellAmount, false);
          totalTradingFee += sellFee;

          const priceChangePercent = (currentPrice - prevPosition.currentPrice) / prevPosition.currentPrice;
          const finalPnl = prevPosition.quantity * (prevPosition.entryPrice - currentPrice); // 做空盈亏：数量 × (入场价 - 出场价)

          // 使用预先计算的资金费用
          const soldFundingFee = (prevPosition as typeof prevPosition & { calculatedFundingFee?: number }).calculatedFundingFee || 0;

          soldPositions.push({
            ...prevPosition,
            value: sellAmount, // 使用实际平仓费用
            quantity: prevPosition.quantity ?? 0,
            currentPrice,
            periodTradingPrice: currentPrice,
            periodTradingType: 'buy' as const,
            tradingQuantity: -(prevPosition.quantity ?? 0),
            pnl: isNaN(finalPnl) ? 0 : finalPnl,
            pnlPercent: (prevPosition.quantity * prevPosition.entryPrice) > 0 ? finalPnl / (prevPosition.quantity * prevPosition.entryPrice) : 0,
            tradingFee: isNaN(sellFee) ? 0 : sellFee,
            fundingFee: soldFundingFee,
            priceChange24h: priceChange24h,
            isSoldOut: true,
            isNewPosition: false,
            priceChange: {
              type: currentPrice > prevPosition.currentPrice ? 'increase' : currentPrice < prevPosition.currentPrice ? 'decrease' : 'same',
              previousPrice: prevPosition.currentPrice,
              changePercent: priceChangePercent
            },
            quantityChange: {
              type: 'sold',
              previousQuantity: prevPosition.quantity ?? 0
            },
            fundingRateHistory: previousData?.rankings?.find(r => r.symbol === symbol)?.fundingRateHistory || [],
            reason: sellReason
          });

        } else {
          // 持仓调整：在目标持仓中，需要对比数量变化
          const { candidate, targetQuantity, price } = targetPosition;
          const prevQuantity = prevPosition.quantity ?? 0;
          const quantityDiff = targetQuantity - prevQuantity;

          if (Math.abs(quantityDiff) > 0.0001) {
            // 计算交易手续费
            const tradingFee = this.calculateTradingFee(Math.abs(quantityDiff) * price, false);
            totalTradingFee += tradingFee;

            if (quantityDiff < 0) {
              // 减仓：将减仓部分添加到soldPositions
              const soldQuantity = Math.abs(quantityDiff);
              const soldCost = soldQuantity * prevPosition.entryPrice; // 原始做空成本
              const soldValue = soldQuantity * price; // 平仓买入花费
              const soldPnl = soldQuantity * (prevPosition.entryPrice - price); // 做空盈亏：成本 - 平仓费用
              // 使用已计算的tradingFee，避免重复计算

              soldPositions.push({
                symbol: symbol,
                displaySymbol: candidate.futureSymbol || symbol,
                side: 'SHORT',
                value: soldValue,
                quantity: soldQuantity,
                entryPrice: prevPosition.entryPrice,
                currentPrice: price,
                periodTradingPrice: price,
                periodTradingType: 'buy' as const,
                tradingQuantity: -soldQuantity,
                pnl: isNaN(soldPnl) ? 0 : soldPnl,
                pnlPercent: soldCost > 0 ? soldPnl / soldCost : 0,
                tradingFee: isNaN(tradingFee) ? 0 : tradingFee,
                priceChange24h: candidate.priceChange24h,
                isSoldOut: false,
                isNewPosition: false,
                priceChange: {
                  type: price > prevPosition.entryPrice ? 'increase' : price < prevPosition.entryPrice ? 'decrease' : 'same',
                  previousPrice: prevPosition.entryPrice,
                  changePercent: prevPosition.entryPrice > 0 ? (price - prevPosition.entryPrice) / prevPosition.entryPrice : 0
                },
                quantityChange: { 
                  type: 'decrease', 
                  previousQuantity: prevQuantity, 
                  changePercent: prevQuantity > 0 ? (quantityDiff / prevQuantity) * 100 : 0 
                },
                fundingRateHistory: previousData?.rankings?.find(r => r.symbol === symbol)?.fundingRateHistory || [],
                marketShare: candidate.marketShare,
                reason: 'ALT做空减仓已实现盈亏'
              });
            }
          }

          // 使用预先计算的资金费用
          const fundingFee = (prevPosition as typeof prevPosition & { calculatedFundingFee?: number }).calculatedFundingFee || 0;

          // 计算加权平均成本价和交易类型
          let newEntryPrice: number;
          let periodTradingType: 'buy' | 'sell' | 'hold';
          let shortQuantityChange: { type: 'new' | 'increase' | 'decrease' | 'same' | 'sold'; previousQuantity?: number; changePercent?: number };

          if (Math.abs(quantityDiff) < 0.0001) {
            newEntryPrice = prevPosition.entryPrice ?? price;
            periodTradingType = 'hold';
            shortQuantityChange = { type: 'same', previousQuantity: prevQuantity, changePercent: 0 };
          } else if (quantityDiff > 0) {
            newEntryPrice = (prevQuantity * (prevPosition.entryPrice ?? price) + quantityDiff * price) / targetQuantity;
            periodTradingType = 'sell';
            shortQuantityChange = { type: 'increase', previousQuantity: prevQuantity, changePercent: prevQuantity > 0 ? (quantityDiff / prevQuantity) * 100 : 0 };
          } else {
            newEntryPrice = prevPosition.entryPrice ?? price;
            periodTradingType = 'buy';
            shortQuantityChange = { type: 'decrease', previousQuantity: prevQuantity, changePercent: prevQuantity > 0 ? (quantityDiff / prevQuantity) * 100 : 0 };
          }

          // 修复：在仓位调整后计算剩余持仓的PnL
          // 对于做空：盈亏 = 剩余数量 * (加权平均入场价 - 当前价)
          const pnl = targetQuantity > 0 ? targetQuantity * (newEntryPrice - price) : 0;
          
          // 计算百分比盈亏 
          const validPrevPrice = prevPosition.currentPrice ?? price;
          const priceChangePercent = validPrevPrice > 0 ? (price - validPrevPrice) / validPrevPrice : 0;

          shortPositions.push({
            symbol: symbol,
            displaySymbol: candidate.futureSymbol || symbol,
            side: 'SHORT',
            value: targetPosition.targetAllocation,
            quantity: targetQuantity,
            entryPrice: newEntryPrice,
            currentPrice: price,
            periodTradingPrice: price,
            periodTradingType: periodTradingType,
            tradingQuantity: quantityDiff,
            pnl: isNaN(pnl) ? 0 : pnl,
            pnlPercent: isNaN(-priceChangePercent) ? 0 : -priceChangePercent,
            tradingFee: Math.abs(quantityDiff) > 0.0001 ? this.calculateTradingFee(Math.abs(quantityDiff) * price, false) : 0,
            fundingFee: isNaN(fundingFee) ? 0 : fundingFee,
            priceChange24h: candidate.priceChange24h,
            isNewPosition: false,
            priceChange: {
              type: price > validPrevPrice ? 'increase' : price < validPrevPrice ? 'decrease' : 'same',
              previousPrice: validPrevPrice,
              changePercent: validPrevPrice > 0 ? (price - validPrevPrice) / validPrevPrice : 0
            },
            quantityChange: shortQuantityChange,
            fundingRateHistory: previousData?.rankings?.find(r => r.symbol === symbol)?.fundingRateHistory || [],
            marketShare: candidate.marketShare,
            reason: candidate.reason
          });
        }
      }
    }

    // 第二步：处理新开仓（目标持仓中未被处理的）
    for (const [symbol, targetPosition] of targetPositions) {
      if (!processedSymbols.has(symbol)) {
        const { candidate, targetAllocation, targetQuantity, price } = targetPosition;
        
        // 新开仓
        const tradingFee = this.calculateTradingFee(targetAllocation, false);
        totalTradingFee += tradingFee;

        shortPositions.push({
          symbol: symbol,
          displaySymbol: candidate.futureSymbol || symbol,
          side: 'SHORT',
          value: targetAllocation,
          quantity: targetQuantity,
          entryPrice: price,
          currentPrice: price,
          periodTradingPrice: price,
          periodTradingType: 'sell',
          tradingQuantity: targetQuantity,
          pnl: 0, // 新开仓无盈亏
          pnlPercent: 0,
          tradingFee: isNaN(tradingFee) ? 0 : tradingFee,
          fundingFee: 0, // 新开仓无资金费率
          priceChange24h: candidate.priceChange24h,
          isNewPosition: true,
          priceChange: undefined,
          quantityChange: { type: 'new', previousQuantity: 0, changePercent: 0 },
          fundingRateHistory: [],
          marketShare: candidate.marketShare,
          reason: candidate.reason
        });
      }
    }

    // 注：资金费用已在预先计算阶段累计到totalFundingFee中，此处无需重复累计

    // 设置ALT不活跃时的原因
    if (!altActive) {
      if (!canShortAlt) {
        inactiveReason = temperatureRuleReason; // 温度计高温导致的ALT空仓
      } else if (!hasShortCandidates) {
        inactiveReason = '无符合做空条件的ALT标的，ALT空仓状态';
      } else {
        inactiveReason = '未知原因导致的ALT空仓状态';
      }
    }

    // 计算ALT卖出所产生的现金余额变化
    const altSoldRevenue = soldPositions
      .filter(pos => pos.side === 'SHORT')
      .reduce((sum, pos) => sum + pos.pnl, 0); // 对于做空，pnl就是现金余额的变化
    // ALT仓位变化汇总日志
    const altPositionChanges: Array<{
      action: string;
      symbol: string;
      quantity: number;
      entryPrice: number;
      currentPrice: number;
      pnl: number;
      calculation: string;
      reason: string;
    }> = [];

    // 1. 收集平仓/减仓信息
    soldPositions.filter(pos => pos.side === 'SHORT').forEach(pos => {
      altPositionChanges.push({
        action: pos.isSoldOut ? 'ALT完全平仓' : 'ALT减仓',
        symbol: pos.symbol,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        pnl: pos.pnl,
        calculation: `quantity × (entryPrice - currentPrice) = ${pos.pnl}`,
        reason: pos.reason
      });
    });
    
    // 2. 收集持仓调整信息（包含加仓和新开仓）
    shortPositions.forEach(pos => {
      if (pos.isNewPosition) {
        altPositionChanges.push({
          action: 'ALT新开仓',
          symbol: pos.symbol,
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice,
          pnl: 0,
          calculation: 'quantity × (entryPrice - currentPrice) = 0',
          reason: pos.reason
        });
      } else if (pos.quantityChange?.type === 'increase') {
        altPositionChanges.push({
          action: 'ALT加仓',
          symbol: pos.symbol,
          quantity: pos.tradingQuantity || 0, // 加仓数量
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice,
          pnl: pos.pnl,
          calculation: `quantity × (entryPrice - currentPrice) = ${pos.pnl}`,
          reason: 'ALT加仓调整'
        });
      }
    });

    // 当期ALT仓位变化汇总日志
    if (altPositionChanges.length > 0) {
      this.log(`[ALT仓位变化汇总] 时间: ${timestamp}`, {
        totalChanges: altPositionChanges.length,
        altSoldRevenue: altSoldRevenue,
        positionChanges: altPositionChanges
      });
    }

    // 计算现金余额变化
    let previousAccountBalance;
    if (previousSnapshot?.account_usdt_balance !== undefined) {
      previousAccountBalance = previousSnapshot.account_usdt_balance;
    } else {
      // 初始状态：全部资金都是现金余额，BTC购买费用通过btcPurchaseExpense扣除
      previousAccountBalance = this.params.initialCapital;
    }
    
    // 调试日志：现金余额计算详情
    this.log(`[现金余额计算] 时间: ${timestamp}`, {
      previousAccountBalance: previousAccountBalance,
      btcSaleRevenue: btcSaleRevenue,
      btcPurchaseExpense: btcPurchaseExpense,
      altSoldRevenue: altSoldRevenue,
      totalTradingFee: totalTradingFee,
      totalFundingFee: totalFundingFee,
      explanation: '现金余额 = 上期余额 + BTC卖出收入 - BTC买入支出 + ALT卖出收入 - 手续费'
    });
    
    // 正确的现金余额计算逻辑：
    // 1. BTC卖出：增加现金收入 (+btcSaleRevenue)
    // 2. BTC买入：减少现金支出 (-btcPurchaseExpense)
    // 3. ALT卖出：现金余额变化 (+altSoldRevenue)
    account_usdt_balance = previousAccountBalance + btcSaleRevenue - btcPurchaseExpense + altSoldRevenue;

    // 最终统一扣除费用
    account_usdt_balance = account_usdt_balance - Math.abs(totalTradingFee) - Math.abs(totalFundingFee);
  
    // 新的 totalValue 计算方法：现金 + BTC市值 + 空单浮动盈亏
    const btcValue = btcPosition ? btcPosition.quantity * btcPosition.currentPrice : 0;
    const shortPnl = shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    
    // shortPnl汇总计算日志
    this.log(`[short浮动盈亏汇总] 时间: ${timestamp}`, {
      totalShortPositions: shortPositions.length,
      shortPositionsDetails: shortPositions.map(pos => ({
        symbol: pos.symbol,
        amount: pos.value,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        pnl: pos.pnl,
        pnlPercent: (pos.pnlPercent * 100).toFixed(4) + '%',
        calculation: `quantity × (entryPrice - currentPrice) = ${pos.pnl.toFixed(6)}`
      })),
      totalShortPnl: shortPnl,
      calculation: shortPositions.map(pos => `${pos.symbol}(${pos.pnl.toFixed(6)})`).join(' + ') + ` = ${shortPnl.toFixed(6)}`
    });
    
    // 调试日志：总价值组成部分
    this.log(`[总价值计算] 时间: ${timestamp}`, {
      account_usdt_balance: account_usdt_balance,
      btcValue: btcValue,
      btcQuantity: btcPosition?.quantity || 0,
      btcPrice: btcPrice,
      shortPnl: shortPnl,
      shortPositionsCount: shortPositions.length,
      calculatedTotal: account_usdt_balance + btcValue + shortPnl
    });
    
    totalValue = account_usdt_balance + btcValue + shortPnl;
    const totalPnl = totalValue - this.params.initialCapital;
    const totalPnlPercent = totalPnl / this.params.initialCapital;

    // 计算本期盈亏和本期收益率
    const prevValue = previousSnapshot?.totalValue || this.params.initialCapital;
    const periodPnl = totalValue - prevValue;
    const periodPnlPercent = prevValue > 0 ? periodPnl / prevValue : 0;

    // 获取前一天的温度计数值用于显示
    const previousTemperatureValue = this.getPreviousTemperatureValue(timestamp);

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
      btcSoldPosition,
      totalValue,
      totalPnl,
      totalPnlPercent,
      periodPnl,
      periodPnlPercent,
      totalTradingFee,
      accumulatedTradingFee: accumulatedTradingFee + totalTradingFee,
      totalFundingFee,
      accumulatedFundingFee: accumulatedFundingFee + totalFundingFee,
      account_usdt_balance,
      isActive,
      rebalanceReason: isActive ?
        (isInTemperatureHigh ? `${selectionReason} (${temperatureRuleReason})` : selectionReason) :
        inactiveReason,
      shortCandidates: [...selectedCandidates, ...rejectedCandidates],
      temperatureValue: previousTemperatureValue
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
        totalPnlAmount: 0, btcRealizedPnl: 0, btcUnrealizedPnl: 0, altRealizedPnl: 0, altUnrealizedPnl: 0, tradingFeeAmount: 0, fundingFeeAmount: 0,
        totalPnlRate: 0, btcRealizedPnlRate: 0, btcUnrealizedPnlRate: 0, altRealizedPnlRate: 0, altUnrealizedPnlRate: 0, tradingFeeRate: 0, fundingFeeRate: 0
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
      maxDrawdownInfo: {
        drawdown: 0,
        startTimestamp: snapshots[0].timestamp,
        endTimestamp: snapshots[0].timestamp,
        startPeriod: 1,
        endPeriod: 1,
        duration: 1
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
        btcRealizedPnl: 0,
        btcUnrealizedPnl: 0,
        altRealizedPnl: 0,
        altUnrealizedPnl: 0,
        tradingFeeAmount: firstSnapshot.accumulatedTradingFee,
        fundingFeeAmount: firstSnapshot.accumulatedFundingFee || 0,
        totalPnlRate: firstSnapshot.totalPnl / params.initialCapital,
        btcRealizedPnlRate: 0,
        btcUnrealizedPnlRate: 0,
        altRealizedPnlRate: 0,
        altUnrealizedPnlRate: 0,
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
  let maxDrawdownInfo: {
    drawdown: number;
    startTimestamp: string;
    endTimestamp: string;
    startPeriod: number;
    endPeriod: number;
    duration: number;
  } | undefined;

  // 峰值应该是初始资金和第一个快照总价值中的较大者
  // 如果第一期就亏损，峰值应该是初始资金
  let peak = params.initialCapital;
  let peakIndex = -1; // -1 表示峰值是初始资金，不对应任何快照

  // 如果第一个快照的总价值大于初始资金，则更新峰值
  if (snapshots.length > 0 && snapshots[0].totalValue > params.initialCapital) {
    peak = snapshots[0].totalValue;
    peakIndex = 0;
  }

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];

    // 更新峰值
    if (snapshot.totalValue > peak) {
      peak = snapshot.totalValue;
      peakIndex = i;
    }

    // 计算当前回撤
    const drawdown = (peak - snapshot.totalValue) / peak;

    // 如果当前回撤是最大的，记录回撤期间信息
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownInfo = {
        drawdown,
        // 如果峰值是初始资金(peakIndex = -1)，使用第一个快照的时间戳作为开始时间
        // 如果峰值是某个快照，使用该快照的时间戳
        startTimestamp: peakIndex >= 0 ? snapshots[peakIndex].timestamp : (snapshots.length > 0 ? snapshots[0].timestamp : snapshot.timestamp),
        endTimestamp: snapshot.timestamp,
        // 如果峰值是初始资金，startPeriod为0（表示从初始状态开始）
        // 如果峰值是某个快照，使用该快照的期数
        startPeriod: peakIndex >= 0 ? peakIndex + 1 : 0,
        endPeriod: i + 1,
        duration: peakIndex >= 0 ? (i - peakIndex + 1) : (i + 2) // 从初始状态到当前期数
      };
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

  // 确保 maxDrawdownInfo 始终有值，即使没有回撤
  if (!maxDrawdownInfo && snapshots.length > 0) {
    maxDrawdownInfo = {
      drawdown: maxDrawdown,
      startTimestamp: snapshots[0].timestamp,
      endTimestamp: snapshots[0].timestamp,
      startPeriod: 1,
      endPeriod: 1,
      duration: 1
    };
  }

  // 计算盈亏金额分解
  const totalPnlAmount = finalSnapshot.totalPnl;

  // BTC盈亏分解计算
  let btcRealizedPnl = 0;
  let btcUnrealizedPnl = 0;
  
  if (params.longBtc) {
    // 1. BTC已实现盈亏 - 累计所有历史BTC卖出的盈亏
    for (const snapshot of snapshots) {
      if (snapshot.btcSoldPosition) {
        btcRealizedPnl += snapshot.btcSoldPosition.pnl;
      }
    }
    
    // 2. BTC浮动盈亏 - 当前BTC持仓的未实现盈亏
    if (finalSnapshot.btcPosition) {
      const quantity = finalSnapshot.btcPosition.quantity;
      const currentPrice = finalSnapshot.btcPosition.currentPrice;
      const entryPrice = finalSnapshot.btcPosition.entryPrice;
      btcUnrealizedPnl = quantity * (currentPrice - entryPrice);
    }
    
    // 调试日志
    if (params.enableSnapshotLogs) {
      console.log(`[BTC盈亏分解] 已实现: ${btcRealizedPnl.toFixed(2)}, 浮动: ${btcUnrealizedPnl.toFixed(2)}, 合计: ${(btcRealizedPnl + btcUnrealizedPnl).toFixed(2)}`);
    }
  }

  // ALT盈亏分解计算
  let altRealizedPnl = 0;
  let altUnrealizedPnl = 0;
  
  if (params.shortAlt) {
    // 1. ALT已实现盈亏 - 累计所有历史ALT平仓的盈亏
    for (const snapshot of snapshots) {
      if (snapshot.soldPositions) {
        const altSoldPnl = snapshot.soldPositions
          .filter(pos => pos.side === 'SHORT')
          .reduce((sum, pos) => sum + pos.pnl, 0);
        altRealizedPnl += altSoldPnl;
      }
    }
    
    // 2. ALT浮动盈亏 - 当前ALT做空持仓的未实现盈亏
    altUnrealizedPnl = finalSnapshot.shortPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    
    // 调试日志
    if (params.enableSnapshotLogs) {
      console.log(`[ALT盈亏分解] 已实现: ${altRealizedPnl.toFixed(2)}, 浮动: ${altUnrealizedPnl.toFixed(2)}, 合计: ${(altRealizedPnl + altUnrealizedPnl).toFixed(2)}`);
    }
  }

  // 手续费和资金费率金额
  const tradingFeeAmount = finalSnapshot.accumulatedTradingFee;
  const fundingFeeAmount = finalSnapshot.accumulatedFundingFee || 0;

  // 计算各项收益率（基于初始资本）
  const totalPnlRate = totalPnlAmount / params.initialCapital;
  const btcRealizedPnlRate = btcRealizedPnl / params.initialCapital;
  const btcUnrealizedPnlRate = btcUnrealizedPnl / params.initialCapital;
  const altRealizedPnlRate = altRealizedPnl / params.initialCapital;
  const altUnrealizedPnlRate = altUnrealizedPnl / params.initialCapital;
  const tradingFeeRate = tradingFeeAmount / params.initialCapital;
  const fundingFeeRate = fundingFeeAmount / params.initialCapital;

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
    maxDrawdownInfo,
    pnlBreakdown: {
      totalPnlAmount,
      btcRealizedPnl,
      btcUnrealizedPnl,
      altRealizedPnl,
      altUnrealizedPnl,
      tradingFeeAmount,
      fundingFeeAmount,
      totalPnlRate,
      btcRealizedPnlRate,
      btcUnrealizedPnlRate,
      altRealizedPnlRate,
      altUnrealizedPnlRate,
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
        return sum + pos.value + pos.pnl;
      }, 0);
    }

    const cashValue = snapshot.account_usdt_balance;

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
      // 温度计规则参数默认值
      useTemperatureRule: rawParams.useTemperatureRule !== undefined ? rawParams.useTemperatureRule : false,
      temperatureSymbol: rawParams.temperatureSymbol !== undefined ? rawParams.temperatureSymbol : 'OTHERS',
      temperatureThreshold: rawParams.temperatureThreshold !== undefined ? rawParams.temperatureThreshold : 60,
      temperatureTimeframe: rawParams.temperatureTimeframe !== undefined ? rawParams.temperatureTimeframe : '1D',
      temperatureData: rawParams.temperatureData || [],
      // 日志开关参数
      enableSnapshotLogs: rawParams.enableSnapshotLogs !== undefined ? rawParams.enableSnapshotLogs : false,
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
    const backtestStartTime = performance.now();
    console.debug(`[PERF] 开始BTCDOM2回测, ${startTime} - ${endTime}, BTC占比: ${params.btcRatio}, 起始资金: ${params.initialCapital}, 数据点数: ${data.length}`);

    const snapshotGenerationTimes: number[] = [];

    // 创建策略引擎
    const strategyEngine = new BTCDOM2StrategyEngine(params);

    // 生成策略快照
    const snapshots: StrategySnapshot[] = [];
    let previousSnapshot: StrategySnapshot | null = null;

    for (let index = 0; index < data.length; index++) {
      const dataPoint = data[index];
      const previousData = index > 0 ? data[index - 1] : null;

      const snapshotStart = performance.now();
      const snapshot = await strategyEngine.generateSnapshot(dataPoint, previousSnapshot, previousData);
      const snapshotEnd = performance.now();
      snapshotGenerationTimes.push(snapshotEnd - snapshotStart);

      // 记录空仓状态日志
      if (!snapshot.isActive) {
        const timestamp = new Date(snapshot.timestamp).toISOString();
        const reason = snapshot.rebalanceReason;
        console.debug(`[空仓记录] 时间: ${timestamp}, 原因: ${reason}`);
      }

      snapshots.push(snapshot);
      previousSnapshot = snapshot;
    }

    // 计算性能指标
    const performanceStartTime = performance.now();
    const metrics = calculatePerformanceMetrics(snapshots, params, granularityHours);

    // 生成图表数据（优化模式下跳过以提升性能）
    const chartData = optimizeOnly ? [] : generateChartData(snapshots, params);

    // 计算汇总统计
    const activeRebalances = snapshots.filter(s => s.isActive).length;
    const inactiveRebalances = snapshots.length - activeRebalances;
    const avgShortPositions = snapshots.reduce((sum, s) => sum + s.shortPositions.length, 0) / snapshots.length;

    // 统计空仓原因分布
    const inactiveSnapshots = snapshots.filter(s => !s.isActive);
    const reasonCounts = new Map<string, number>();
    inactiveSnapshots.forEach(snapshot => {
      const reason = snapshot.rebalanceReason;
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });

    if (inactiveRebalances > 0) {
      console.debug(`[空仓汇总] 总空仓次数: ${inactiveRebalances}, 原因分布:`);
      reasonCounts.forEach((count, reason) => {
        const percentage = ((count / inactiveRebalances) * 100).toFixed(1);
        console.debug(`  - ${reason}: ${count}次 (${percentage}%)`);
      });
    }

    // 性能监控总结
    const totalBacktestTime = performance.now() - backtestStartTime;
    const performanceTime = performance.now() - performanceStartTime;
    const avgSnapshotTime = snapshotGenerationTimes.length > 0
      ? snapshotGenerationTimes.reduce((sum, time) => sum + time, 0) / snapshotGenerationTimes.length
      : 0;

    console.debug(`[PERF] BTCDOM2回测完成:`);
    console.debug(`  - 数据处理耗时 (不含快照生成): ${(totalBacktestTime - performanceTime - (avgSnapshotTime * data.length)).toFixed(2)}ms`);
    console.debug(`  - 快照生成总耗时: ${(avgSnapshotTime * data.length).toFixed(2)}ms (平均: ${avgSnapshotTime.toFixed(2)}ms/快照)`);
    console.debug(`  - 性能计算耗时: ${performanceTime.toFixed(2)}ms`);
    console.debug(`  - 总耗时: ${totalBacktestTime.toFixed(2)}ms`);
    console.debug(`  - 平均每个数据点 (含快照): ${(totalBacktestTime / data.length).toFixed(2)}ms`);
    console.debug(`  - 活跃/非活跃再平衡: ${activeRebalances}/${inactiveRebalances}`);

    const result: BTCDOM2BacktestResult = {
      params,
      snapshots,
      performance: metrics,
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
