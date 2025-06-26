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



// 默认导出配置对象
export default config;
