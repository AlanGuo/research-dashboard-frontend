/*
 * BTCDOM2 性能优化补丁
 * 这个文件包含立即可应用的性能优化
 */

// 优化1: 移除生产环境的调试日志
const isProduction = process.env.NODE_ENV === 'production';

// 优化2: 预计算常用数学函数
const VOLATILITY_SCORE_CACHE = new Map();
const FUNDING_RATE_SCORE_CACHE = new Map();

// 预计算资金费率分数的查找表
function initFundingRateCache() {
  for (let rate = -0.05; rate <= 0.05; rate += 0.0001) {
    const ratePercent = rate * 100;
    const score = Math.max(0, Math.min(1, (ratePercent + 2) / 4));
    FUNDING_RATE_SCORE_CACHE.set(Math.round(rate * 10000), score);
  }
}

// 优化3: 快速波动率分数计算
function fastVolatilityScore(volatility, idealVolatility, volatilitySpread) {
  const key = `${Math.round(volatility * 10000)}_${Math.round(idealVolatility * 10000)}_${Math.round(volatilitySpread * 10000)}`;
  
  if (VOLATILITY_SCORE_CACHE.has(key)) {
    return VOLATILITY_SCORE_CACHE.get(key);
  }
  
  const score = volatilitySpread > 0 
    ? Math.exp(-Math.pow(volatility - idealVolatility, 2) / (2 * Math.pow(volatilitySpread, 2)))
    : 1;
    
  VOLATILITY_SCORE_CACHE.set(key, score);
  return score;
}

// 优化4: 快速资金费率分数计算
function fastFundingRateScore(fundingRate) {
  const key = Math.round(fundingRate * 10000);
  
  if (FUNDING_RATE_SCORE_CACHE.has(key)) {
    return FUNDING_RATE_SCORE_CACHE.get(key);
  }
  
  const fundingRatePercent = fundingRate * 100;
  const score = Math.max(0, Math.min(1, (fundingRatePercent + 2) / 4));
  FUNDING_RATE_SCORE_CACHE.set(key, score);
  return score;
}

// 优化5: 批量统计计算
function computeBatchStats(rankings) {
  const filteredRankings = rankings.filter(item => item.symbol !== 'BTCUSDT');
  const volatilities = [];
  const priceChanges = [];
  const fundingRates = [];
  
  // 单次遍历收集所有统计数据
  for (const item of filteredRankings) {
    if (!isNaN(item.volatility24h) && isFinite(item.volatility24h)) {
      volatilities.push(item.volatility24h);
    }
    priceChanges.push(item.priceChange24h);
    
    if (item.fundingRateHistory && item.fundingRateHistory.length > 0) {
      const latestFunding = item.fundingRateHistory[item.fundingRateHistory.length - 1];
      if (latestFunding && !isNaN(latestFunding.fundingRate) && isFinite(latestFunding.fundingRate)) {
        fundingRates.push(latestFunding.fundingRate);
      }
    }
  }
  
  return {
    filteredRankings,
    totalCandidates: filteredRankings.length,
    volatility: {
      min: volatilities.length > 0 ? Math.min(...volatilities) : 0,
      max: volatilities.length > 0 ? Math.max(...volatilities) : 0,
      avg: volatilities.length > 0 ? volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length : 0,
      spread: 0 // 将在后面计算
    },
    priceChange: {
      maxAbsoluteDecline: Math.max(...priceChanges.map(p => Math.abs(Math.min(p, 0)))),
      hasDeclines: priceChanges.some(p => p < 0),
      min: Math.min(...priceChanges),
      max: Math.max(...priceChanges)
    }
  };
}

// 优化6: 简化的选择逻辑
function optimizedSelectShortCandidates(
  rankings,
  btcPriceChange,
  params
) {
  const stats = computeBatchStats(rankings);
  stats.volatility.spread = Math.max((stats.volatility.max - stats.volatility.min) / 4, 0.01);
  
  const candidates: any[] = [];
  let selectedCount = 0;
  
  // 预计算理想波动率
  const idealVolatility = stats.volatility.avg;
  const volatilitySpread = stats.volatility.spread;
  
  for (const item of stats.filteredRankings) {
    // 提前检查价格变化条件，如果不符合直接跳过复杂计算
    if (item.priceChange24h >= btcPriceChange) {
      candidates.push({
        symbol: item.symbol,
        rank: item.rank,
        priceChange24h: item.priceChange24h,
        volume24h: item.volume24h,
        quoteVolume24h: item.quoteVolume24h,
        volatility24h: item.volatility24h,
        marketShare: item.marketShare,
        priceAtTime: item.priceAtTime,
        futurePriceAtTime: item.futurePriceAtTime,
        futureSymbol: item.futureSymbol,
        totalScore: 0,
        eligible: false,
        reason: `涨跌幅 ${item.priceChange24h.toFixed(2)}% 不低于BTC ${btcPriceChange.toFixed(2)}%`
      });
      continue;
    }
    
    // 计算各项分数（使用优化的计算方法）
    const priceChangeScore = stats.priceChange.hasDeclines 
      ? Math.abs(Math.min(item.priceChange24h, 0)) / stats.priceChange.maxAbsoluteDecline
      : (stats.priceChange.max > stats.priceChange.min 
          ? 1 - (item.priceChange24h - stats.priceChange.min) / (stats.priceChange.max - stats.priceChange.min)
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
    
    const totalScore = priceChangeScore * params.priceChangeWeight +
                      volumeScore * params.volumeWeight +
                      volatilityScore * params.volatilityWeight +
                      fundingRateScore * params.fundingRateWeight;
    
    candidates.push({
      symbol: item.symbol,
      rank: item.rank,
      priceChange24h: item.priceChange24h,
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
      totalScore: isNaN(totalScore) ? 0 : totalScore,
      eligible: true,
      reason: `综合评分: ${totalScore.toFixed(3)}`
    });
    
    selectedCount++;
    
    // 提前终止：如果已经有足够多的候选者，可以提前排序并选择
    if (selectedCount >= params.maxShortPositions * 3) { // 选择3倍数量再排序，确保质量
      break;
    }
  }
  
  // 分离和排序
  const eligibleCandidates = candidates.filter(c => c.eligible);
  const rejectedCandidates = candidates.filter(c => !c.eligible);
  
  // 只对符合条件的候选者排序
  eligibleCandidates.sort((a, b) => b.totalScore - a.totalScore);
  
  const selectedCandidates = eligibleCandidates.slice(0, params.maxShortPositions);
  
  return {
    selectedCandidates,
    rejectedCandidates,
    selectionReason: selectedCandidates.length > 0 
      ? `选择了${selectedCandidates.length}个做空标的`
      : '无符合条件的做空标的',
    totalCandidates: candidates.length,
    eligibleCount: eligibleCandidates.length
  };
}

// 初始化缓存
initFundingRateCache();

module.exports = {
  optimizedSelectShortCandidates,
  fastVolatilityScore,
  fastFundingRateScore,
  computeBatchStats
};
