import defaultConfig from './default.json';
import developmentConfig from './development.json';
import productionConfig from './production.json';
import testConfig from './test.json';

// Define the configuration type
export interface Config {
  app?: {
    name?: string;
    version?: string;
  };
  api?: {
    baseUrl?: string;
  };
  features?: {
    darkMode?: boolean;
    debugMode?: boolean;
    mockData?: boolean;
    analytics?: boolean;
    [key: string]: boolean | string | number | Record<string, unknown> | undefined;
  };
  btcdom2?: {
    startDate?: string;
    endDate?: string;
    initialCapital?: number;
    btcRatio?: number;
    priceChangeWeight?: number;
    volumeWeight?: number;
    volatilityWeight?: number;
    fundingRateWeight?: number;
    maxShortPositions?: number;
    spotTradingFeeRate?: number;
    futuresTradingFeeRate?: number;
    longBtc?: boolean;
    shortAlt?: boolean;
    allocationStrategy?: string;
    useTemperatureRule?: boolean;
    temperatureSymbol?: string;
    temperatureThreshold?: number;
    maxBacktestDurationDays?: number;
    [key: string]: string | number | boolean | undefined;
  };
  [key: string]: string | number | boolean | Record<string, unknown> | undefined;
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] ? RecursivePartial<U>[] :
    T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

/**
 * Deep merge two objects
 */
function mergeDeep<T extends Record<string, unknown>>(target: RecursivePartial<T>, source: RecursivePartial<T>): RecursivePartial<T> {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceKey = key as keyof typeof source;
      const targetKey = key as keyof typeof target;
      
      if (isObject(source[sourceKey])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[sourceKey] });
        } else {
          (output as Record<string, unknown>)[key] = mergeDeep(
            (target[targetKey] as Record<string, unknown>) || {},
            (source[sourceKey] as Record<string, unknown>)
          );
        }
      } else {
        Object.assign(output, { [key]: source[sourceKey] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Get the environment-specific configuration
 */
function getEnvironmentConfig(): Config {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'development':
      return developmentConfig;
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return developmentConfig;
  }
}

/**
 * Get the complete configuration by merging default with environment-specific config
 */
const config: Config = mergeDeep(defaultConfig, getEnvironmentConfig());

/**
 * Get a specific configuration value by path
 * @param path - Dot notation path to the config value (e.g., 'api.baseUrl')
 * @param defaultValue - Default value if path doesn't exist
 */
export function getConfigValue<T>(path: string, defaultValue?: T): T {
  const parts = path.split('.');
  let current: Record<string, unknown> = config as Record<string, unknown>;
  
  for (const part of parts) {
    if (current[part] === undefined) {
      return defaultValue as T;
    }
    current = current[part] as Record<string, unknown>;
  }
  
  return current as unknown as T;
}

/**
 * Get the complete configuration
 */
export function getConfig(): Config {
  return config;
}

/**
 * Manually override configuration (useful for testing)
 * @param overrideConfig - Configuration to merge with current config
 */
export function overrideConfig(overrideConfig: Partial<Config>): void {
  Object.assign(config, mergeDeep(config, overrideConfig));
}

/**
 * 获取BTCDOM2策略的默认配置
 * 根据环境自动计算日期范围
 */
export function getBTCDOM2Config() {
  const env = process.env.NODE_ENV || 'development';
  
  // 获取当前时间
  const now = new Date();
  const endDate = now.toISOString().split('T')[0]; // YYYY-MM-DD格式
  
  let startDate: string;
  let maxBacktestDurationDays: number | undefined;
  
  if (env === 'production') {
    // production: 从当前时间往前半年，最大回测时长1年
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    startDate = sixMonthsAgo.toISOString().split('T')[0];
    maxBacktestDurationDays = getConfigValue('btcdom2.maxBacktestDurationDays', 365);
  } else {
    // development: 使用配置文件中的startDate，如果没有则使用2020-01-01
    startDate = getConfigValue('btcdom2.startDate', '2020-01-01');
  }
  
  // 基础配置（从配置文件获取，如果没有则使用默认值）
  const baseConfig = {
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
    allocationStrategy: getConfigValue('btcdom2.allocationStrategy', 'BY_VOLUME'),
    useTemperatureRule: getConfigValue('btcdom2.useTemperatureRule', true),
    temperatureSymbol: getConfigValue('btcdom2.temperatureSymbol', 'OTHERS'),
    temperatureThreshold: getConfigValue('btcdom2.temperatureThreshold', 65),
    maxBacktestDurationDays
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

// 默认导出配置对象
export default config;
