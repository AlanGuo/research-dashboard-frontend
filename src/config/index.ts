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
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Deep merge two objects
 */
function mergeDeep(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
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
  let current: any = config;
  
  for (const part of parts) {
    if (current[part] === undefined) {
      return defaultValue as T;
    }
    current = current[part];
  }
  
  return current as T;
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

export default config;
