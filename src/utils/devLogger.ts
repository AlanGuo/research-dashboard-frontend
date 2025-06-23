/**
 * 开发环境日志工具
 * 只在开发环境下打印日志，生产环境下不输出
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 开发环境控制台日志包装器
 * 只在开发环境下输出，生产环境下不产生任何输出
 */
export const devConsole = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};

/**
 * 开发环境日志记录器
 * 使用统一的 emoji 格式，便于调试和追踪
 */
export const devLog = {
  /**
   * 渲染日志 - 组件渲染时的状态信息
   */
  render: (componentName: string, data: Record<string, unknown>) => {
    devConsole.log(`🔄 ${componentName} render:`, data);
  },

  /**
   * 外部值同步检查日志
   */
  syncCheck: (componentName: string, paramName: string, data: Record<string, unknown>) => {
    devConsole.log(`📥 ${componentName} ${paramName} 外部值同步检查:`, data);
  },

  /**
   * 外部值变化日志
   */
  syncUpdate: (componentName: string, paramName: string, value: unknown) => {
    devConsole.log(`🔄 ${componentName} ${paramName} 外部值变化，更新显示值:`, value);
  },

  /**
   * 外部值未变化日志
   */
  syncSkip: (componentName: string, paramName: string) => {
    devConsole.log(`⏭️  ${componentName} ${paramName} 外部值未变化，跳过更新`);
  },

  /**
   * 用户操作日志
   */
  userAction: (componentName: string, paramName: string, value: unknown) => {
    devConsole.log(`⌨️  ${componentName} ${paramName} 用户操作:`, value);
  },

  /**
   * 防抖定时器清除日志
   */
  debounceCleared: (paramName: string) => {
    devConsole.log(`⏱️  清除 ${paramName} 防抖定时器`);
  },

  /**
   * 防抖触发日志
   */
  debounceTriggered: (paramName: string, value: unknown) => {
    devConsole.log(`🚀 ${paramName} 防抖触发，处理数值:`, value);
  },

  /**
   * 通知父组件更新日志
   */
  notifyParent: (paramName: string, value: unknown) => {
    devConsole.log(`✅ 通知父组件更新 ${paramName}:`, value);
  },

  /**
   * 权重相关日志
   */
  weight: {
    groupSync: (data: Record<string, unknown>) => {
      devConsole.log('📥 WeightControlGroup 外部值同步检查:', data);
    },
    groupUpdate: (weights: Record<string, unknown>) => {
      devConsole.log('🔄 WeightControlGroup 外部权重变化，更新本地状态:', weights);
    },
    groupSkip: () => {
      devConsole.log('⏭️  WeightControlGroup 外部权重未变化，跳过更新');
    },
    change: (type: string, value: number) => {
      devConsole.log(`⌨️  WeightControlGroup 权重[${type}]变化:`, value);
    },
    debounceCleared: (type: string) => {
      devConsole.log(`⏱️  清除权重[${type}]防抖定时器`);
    },
    debounceTriggered: (type: string, value: number) => {
      devConsole.log(`🚀 权重[${type}]防抖触发，处理数值:`, value);
    }
  }
};

/**
 * 使用说明：
 * 
 * 1. 快速迁移方式：
 *    将组件中的 console.log 替换为 devConsole.log
 *    import { devConsole } from '@/utils/devLogger';
 *    console.log(...) => devConsole.log(...)
 * 
 * 2. 结构化日志方式：
 *    使用 devLog 的结构化方法
 *    import { devLog } from '@/utils/devLogger';
 *    devLog.render('ComponentName', data)
 *    devLog.userAction('ComponentName', 'paramName', value)
 * 
 * 3. 自动替换命令（在组件目录下运行）：
 *    sed -i '' 's/console\.log(/devConsole.log(/g' *.tsx
 *    注意：需要手动添加 import { devConsole } from '@/utils/devLogger';
 */
