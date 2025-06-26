import { getConfigValue } from '@/config/index';
import { BTCDOM2StrategyParams, PositionAllocationStrategy } from '@/types/btcdom2';

/**
 * 获取BTCDOM2策略的默认配置
 * 根据环境自动计算日期范围（精确到小时，使用UTC时间）
 */
export function getBTCDOM2Config(): BTCDOM2StrategyParams {
  const env = process.env.NODE_ENV || 'development';

  // 获取当前UTC时间
  const now = new Date();
  // 将分钟和秒设置为0，保持整点小时
  now.setUTCMinutes(0, 0, 0);

  // 生成UTC ISO格式的endDate，这样后续转换时就不会有时区问题
  const endDate = now.toISOString();

  let startDate: string;
  let maxBacktestDurationDays: number | undefined;

  if (env === 'production') {
    // production: 从当前时间往前半年，最大回测时长1年
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setUTCMonth(now.getUTCMonth() - 6);
    sixMonthsAgo.setUTCMinutes(0, 0, 0); // 确保也是整点小时
    startDate = sixMonthsAgo.toISOString();
    maxBacktestDurationDays = getConfigValue('btcdom2.maxBacktestDurationDays', 365);
  } else {
    // development: 使用配置文件中的startDate，如果没有则使用2020-01-01
    const configStartDate = getConfigValue('btcdom2.startDate', '2020-01-01T00:00:00.000Z');
    startDate = configStartDate;
  }
  
  // 基础配置（从配置文件获取，如果没有则使用默认值）
  const baseConfig: BTCDOM2StrategyParams = {
    startDate,
    endDate,
    initialCapital: getConfigValue('btcdom2.initialCapital', 10000),
    btcRatio: getConfigValue('btcdom2.btcRatio', 0.5),
    priceChangeWeight: getConfigValue('btcdom2.priceChangeWeight', 0.15),
    volumeWeight: getConfigValue('btcdom2.volumeWeight', 0.35),
    volatilityWeight: getConfigValue('btcdom2.volatilityWeight', 0.15),
    fundingRateWeight: getConfigValue('btcdom2.fundingRateWeight', 0.35),
    maxShortPositions: getConfigValue('btcdom2.maxShortPositions', 5),
    spotTradingFeeRate: getConfigValue('btcdom2.spotTradingFeeRate', 0.0008),
    futuresTradingFeeRate: getConfigValue('btcdom2.futuresTradingFeeRate', 0.0002),
    longBtc: getConfigValue('btcdom2.longBtc', true),
    shortAlt: getConfigValue('btcdom2.shortAlt', true),
    allocationStrategy: getConfigValue('btcdom2.allocationStrategy', 'BY_VOLUME') as PositionAllocationStrategy,
    useTemperatureRule: getConfigValue('btcdom2.useTemperatureRule', true),
    temperatureSymbol: getConfigValue('btcdom2.temperatureSymbol', 'OTHERS'),
    temperatureThreshold: getConfigValue('btcdom2.temperatureThreshold', 65),
    ...(maxBacktestDurationDays && { maxBacktestDurationDays })
  };
  
  return baseConfig;
}

/**
 * 验证BTCDOM2策略参数
 * @param params - 策略参数
 * @returns 验证结果
 */
export function validateBTCDOM2Params(params: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const env = process.env.NODE_ENV || 'development';
  
  // 基础参数验证
  if (!params.startDate || !params.endDate) {
    errors.push('开始日期和结束日期不能为空');
  } else if (typeof params.startDate === 'string' && typeof params.endDate === 'string') {
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    
    if (startDate >= endDate) {
      errors.push('开始日期必须早于结束日期');
    }
    
    // production环境的时长限制
    if (env === 'production') {
      const maxDuration = getConfigValue('btcdom2.maxBacktestDurationDays', 365);
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      
      if (durationDays > maxDuration) {
        errors.push(`生产环境回测时长不能超过${maxDuration}天（约${Math.round(maxDuration/365*10)/10}年）`);
      }
    }
  }
  
  // 权重验证
  if (typeof params.priceChangeWeight === 'number' && 
      typeof params.volumeWeight === 'number' &&
      typeof params.volatilityWeight === 'number' &&
      typeof params.fundingRateWeight === 'number') {
    const totalWeight = params.priceChangeWeight + params.volumeWeight + 
                       params.volatilityWeight + params.fundingRateWeight;
    if (Math.abs(totalWeight - 1) > 0.001) {
      errors.push('四个权重之和必须等于1');
    }
  }
  
  // 策略选择验证
  if (typeof params.longBtc === 'boolean' && typeof params.shortAlt === 'boolean') {
    if (!params.longBtc && !params.shortAlt) {
      errors.push('至少需要选择一种策略：做多BTC或做空ALT');
    }
  }
  
  // 数值范围验证
  if (typeof params.initialCapital === 'number' && params.initialCapital <= 0) {
    errors.push('初始本金必须大于0');
  }
  
  if (typeof params.btcRatio === 'number' && (params.btcRatio < 0 || params.btcRatio > 1)) {
    errors.push('BTC占比必须在0-1之间');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 格式化BTCDOM2策略参数为显示用的字符串
 * @param params - 策略参数
 * @returns 格式化后的参数描述
 */
export function formatBTCDOM2Params(params: BTCDOM2StrategyParams): string {
  const lines = [
    `时间范围: ${params.startDate} ~ ${params.endDate}`,
    `初始本金: ${params.initialCapital.toLocaleString()} USDT`,
    `BTC占比: ${(params.btcRatio * 100).toFixed(1)}%`,
    `权重配置: 跌幅${(params.priceChangeWeight * 100).toFixed(1)}% | 成交量${(params.volumeWeight * 100).toFixed(1)}% | 波动率${(params.volatilityWeight * 100).toFixed(1)}% | 资金费率${(params.fundingRateWeight * 100).toFixed(1)}%`,
    `最多做空: ${params.maxShortPositions}个标的`,
    `手续费: 现货${(params.spotTradingFeeRate * 100).toFixed(3)}% | 期货${(params.futuresTradingFeeRate * 100).toFixed(3)}%`,
    `策略: ${params.longBtc ? '做多BTC' : ''}${params.longBtc && params.shortAlt ? ' + ' : ''}${params.shortAlt ? '做空ALT' : ''}`,
    `分配策略: ${params.allocationStrategy}`,
    `温度计规则: ${params.useTemperatureRule ? `启用 (${params.temperatureSymbol} > ${params.temperatureThreshold})` : '禁用'}`
  ];
  
  return lines.join('\n');
}
