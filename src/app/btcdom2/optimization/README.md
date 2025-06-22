# BTCDOM2 参数优化系统

## 概述

BTCDOM2参数优化系统是一个科学化的量化策略参数调优工具，通过系统性的搜索和机器学习算法，帮助用户找到历史数据上表现最优的策略参数组合。

⚠️ **重要提醒**: 参数优化存在过拟合风险，本系统提供多种验证机制帮助您找到真正可信的参数配置。请务必遵循最佳实践指南。

## 核心特性

### 🎯 多目标优化
- **最大化总收益率**: 追求绝对收益最大化
- **最大化夏普比率**: 平衡收益和风险
- **最小化最大回撤**: 控制最大损失幅度
- **最大化风险调整收益**: 综合考虑收益和回撤

### 🔍 多种优化方法
- **网格搜索**: 全面遍历参数空间，确保不遗漏最优解，适合小参数空间
- **贝叶斯优化**: 智能搜索，快速收敛到最优区域，适合探索性优化
- **混合方法**（推荐）: 先粗搜索后精细优化，平衡速度和效果

### 🛡️ 过拟合防护
- **参数稳健性测试**: 评估参数在微调后的稳定性
- **多时间段验证**: 检验参数在不同市场环境下的表现
- **性能衰减监控**: 跟踪最优参数的时间衰减情况
- **交叉验证机制**: 智能选择多个验证时间段，综合评估参数泛化能力
- **稳定性评分**: 量化评估参数在不同时间段的表现一致性

### 📊 智能分析
- **参数重要性分析**: 识别对策略表现影响最大的参数
- **稳定性评估**: 评估策略在不同参数下的稳定性
- **敏感性分析**: 测试参数微调对结果的影响程度
- **风险评估**: 多维度风险指标分析
- **相关性分析**: 发现参数间的相互影响关系
- **可视化展示**: 直观的结果展示和对比

## 系统架构

```
optimization/
├── types.ts              # 类型定义和接口
├── optimizer.ts          # 核心优化引擎
├── analysis-utils.ts     # 结果分析工具
├── OptimizationPanel.tsx # 主界面组件
├── OptimizationGuide.tsx # 使用指南组件
├── validation-utils.ts   # 验证和防过拟合工具
└── README.md            # 说明文档
```

### 核心组件

#### 1. ParameterOptimizer 类
- 负责执行参数优化任务
- 支持网格搜索、贝叶斯优化、混合优化
- 提供进度回调和任务管理
- 内置过拟合检测机制

#### 2. ValidationUtils 类
- 参数稳健性验证
- 样本外性能测试
- 时间窗口滚动验证
- 敏感性分析工具

#### 3. OptimizationAnalyzer 类
- 结果分析和统计
- 参数重要性评估
- 性能分布分析
- 过拟合风险评估

#### 3. OptimizationPanel 组件
- 用户交互界面
- 参数配置和结果展示
- 集成使用指南

## 参数空间

### 权重参数（总和必须为1）
- **跌幅权重** (priceChangeWeight): 0-1, 建议 0.1-0.7
- **成交量权重** (volumeWeight): 0-1, 建议 0.1-0.5  
- **波动率权重** (volatilityWeight): 0-1, 建议 0-0.3
- **资金费率权重** (fundingRateWeight): 0-1, 建议 0.1-0.6

### 策略参数
- **最多做空数量** (maxShortPositions): 1-50, 建议 5-20
- **仓位分配策略** (allocationStrategy): 3种选择
  - BY_VOLUME: 按成交量比例分配
  - BY_COMPOSITE_SCORE: 按综合分数分配权重
  - EQUAL_ALLOCATION: 平均分配做空资金

### 🎛️ 优化配置参数
- **优化目标** (objective): 
  - maxDrawdown: 最小化最大回撤（推荐稳健型）
  - sharpe: 最大化夏普比率（推荐平衡型）
  - totalReturn: 最大化总收益率（推荐激进型）
  - composite: 综合风险调整收益
- **优化方法** (method): grid | bayesian | hybrid（推荐）
- **仓位策略模式** (allocationStrategyMode): 
  - fixed: 固定单一策略
  - random: 随机测试所有策略

## 🔄 交叉验证功能

### 核心思想

交叉验证功能旨在解决参数优化中的过度拟合问题。通过在多个不同时间段验证参数的表现，确保优化结果具有更好的泛化能力和稳定性。

#### 传统优化问题
- 只在单一时间段（训练期）优化参数
- 容易产生过度拟合，在训练期表现很好但在其他时间段表现差
- 缺乏对策略稳定性的评估

#### 交叉验证解决方案
1. **训练时间段**：用户指定的原始优化时间段
2. **验证时间段**：系统智能选择的2-3个额外时间段
3. **综合评分**：结合训练期和验证期的表现，计算最终得分
4. **稳定性评估**：评估参数在不同时间段的表现一致性

### 🎯 交叉验证特性

#### 1. 灵活的时间段配置
- **验证时间段数量**：可配置1-5个验证时间段
- **时间段长度**：
  - 固定长度：指定固定的天数
  - 随机长度：在指定范围内随机选择长度
- **选择范围**：指定从哪个时间范围内选择验证时间段
- **重叠控制**：可选择是否允许验证时间段与训练时间段重叠

#### 2. 智能评分机制
- **权重配置**：训练期权重 + 验证期权重 = 1
- **综合评分** = 训练期得分 × 训练权重 + 验证期平均得分 × 验证权重
- **一致性指标**：
  - 标准差：衡量各时间段表现的离散程度
  - 性能范围：最好与最差表现的差值
  - 稳定性评分：0-1分值，越高越稳定

#### 3. 结果解读指导
- **综合评分概览**：显示最终综合得分和稳定性评分
- **各时间段详情**：展示每个时间段的详细表现
- **性能对比表**：所有时间段的指标对比
- **智能建议**：基于稳定性评分的参数选择建议

### 🎛️ 交叉验证配置

#### 基础配置
```typescript
import { createDefaultCrossValidationConfig } from './types';

const crossValidationConfig = createDefaultCrossValidationConfig(
  '2023-01-01', // 训练开始日期
  '2023-03-31', // 训练结束日期
  '2022-01-01', // 验证选择范围开始
  '2024-12-31'  // 验证选择范围结束
);
```

#### 自定义配置
```typescript
const customConfig: CrossValidationConfig = {
  enabled: true,
  validationPeriods: 3, // 3个验证时间段
  periodLength: {
    type: 'random',
    randomRange: {
      minDays: 20,
      maxDays: 60
    }
  },
  selectionRange: {
    startDate: '2022-01-01',
    endDate: '2024-12-31',
    allowOverlap: false // 不允许重叠
  },
  scoreWeights: {
    training: 0.7,    // 训练期权重70%
    validation: 0.3   // 验证期权重30%
  }
};
```

#### 配置建议
- **验证时间段数量**：推荐2-3个，平衡验证效果和计算成本
- **时间段长度**：
  - 短期策略：15-30天
  - 中期策略：30-60天
  - 长期策略：60-90天
- **权重配置**：
  - 保守配置：训练0.8，验证0.2（重视训练期表现）
  - 平衡配置：训练0.6，验证0.4（平衡训练和验证）
  - 激进配置：训练0.5，验证0.5（更重视泛化能力）

### 📊 稳定性评分解读

- **> 0.8**：很稳定，具有良好泛化能力，推荐使用
- **0.6-0.8**：较稳定，可接受的参数组合
- **0.4-0.6**：不太稳定，需要谨慎评估
- **< 0.4**：不稳定，可能存在过度拟合，不推荐使用

## 使用方法

### 基础使用

1. **选择优化目标**
   ```typescript
   // 推荐根据风险偏好选择
   objective: 'maxDrawdown'  // 稳健型：最小化回撤
   objective: 'sharpe'       // 平衡型：风险调整收益
   objective: 'totalReturn'  // 激进型：最大化收益
   ```

2. **配置参数范围（重要：范围设置影响过拟合风险）**
   ```typescript
   parameterRange: {
     weights: {
       priceChangeWeight: { min: 0.2, max: 0.6, step: 0.1 }, // 建议范围不要太宽
       volumeWeight: { min: 0.05, max: 0.3, step: 0.05 },
       volatilityWeight: { min: 0.05, max: 0.2, step: 0.05 },
       fundingRateWeight: { min: 0.3, max: 0.7, step: 0.1 }
     },
     maxShortPositions: { min: 5, max: 15, step: 2 }, // 步长适中，避免过度搜索
   }
   ```

3. **选择优化方法**
   ```typescript
   const config = {
     method: 'hybrid',  // 推荐：平衡效率和效果
     maxIterations: 200, // 不宜过多，避免过拟合
     allocationStrategyMode: 'fixed', // 建议先固定策略
   };
   ```

4. **启动优化**
   ```typescript
   const optimizer = new ParameterOptimizer();
   const results = await optimizer.startOptimization(config, parameterRange);
   ```

### 🔄 使用交叉验证（推荐）

#### 1. 配置交叉验证
```typescript
const crossValidationConfig = {
  enabled: true,
  validationPeriods: 2, // 2个验证时间段
  periodLength: {
    type: 'fixed',
    fixedDays: 90  // 与训练期长度相近
  },
  selectionRange: {
    startDate: '2022-01-01',
    endDate: '2024-12-31',
    allowOverlap: false
  },
  scoreWeights: {
    training: 0.6,    // 训练期权重60%
    validation: 0.4   // 验证期权重40%
  }
};
```

#### 2. 启动交叉验证优化
```typescript
const config: OptimizationConfig = {
  baseParams: { /* 基础参数 */ },
  objective: 'sharpe',
  method: 'hybrid',
  crossValidation: crossValidationConfig, // 启用交叉验证
  maxIterations: 150,
  allocationStrategyMode: 'fixed'
};

const results = await optimizer.startOptimization(config, parameterRange);
```

#### 3. 分析交叉验证结果
```typescript
const bestResult = results[0];
if (bestResult.crossValidation) {
  const cv = bestResult.crossValidation;
  
  console.log('综合评分:', cv.compositeScore);
  console.log('稳定性评分:', cv.consistency.stabilityScore);
  console.log('训练期表现:', cv.trainingResult.objectiveValue);
  console.log('验证期表现:', cv.validationResults.map(vr => vr.objectiveValue));
  
  // 判断策略稳定性
  if (cv.consistency.stabilityScore > 0.7) {
    console.log('策略表现稳定，具有良好的泛化能力');
  } else {
    console.log('策略表现不够稳定，可能存在过度拟合风险');
  }
}

// 筛选稳定性高的结果
const stableResults = results.filter(r => 
  r.crossValidation?.consistency.stabilityScore > 0.6
);
```

#### 4. 基于稳定性选择参数
```typescript
// 优先选择稳定性评分高的参数组合
const selectedParams = stableResults.length > 0 
  ? stableResults[0].combination  // 最稳定的参数
  : results[0].combination;       // 如果都不稳定，选择最优的

console.log('推荐参数组合:', selectedParams);
```

### 🔄 防过拟合的验证流程

#### 样本外验证（强烈推荐）
```typescript
// 第一步：在训练期优化参数
const trainingConfig = {
  ...baseConfig,
  baseParams: {
    ...baseParams,
    startDate: '2020-01-01',
    endDate: '2023-12-31'  // 训练期
  }
};

// 第二步：在验证期测试参数
const validationConfig = {
  ...baseConfig,
  baseParams: {
    ...baseParams,
    startDate: '2024-01-01',
    endDate: '2025-06-21'  // 验证期
  }
};
```

#### 参数稳健性测试
```typescript
// 测试参数微调后的表现
const robustnessTest = {
  bestParams: optimizationResults[0].combination,
  perturbationRange: 0.1, // 10%的参数扰动
  testCount: 10          // 测试10种微调组合
};
```

### 高级功能

#### 结果分析与验证
```typescript
// 基础分析
const topResults = results.slice(0, 5); // 只关注前5个结果

// 稳定性检查：前几名结果的参数是否相似？
const parameterConsistency = checkParameterConsistency(topResults);

// 性能分布：检查是否存在异常好的结果
const performanceDistribution = analyzePerformanceDistribution(results);
```

#### 多时间段验证
```typescript
// 将数据分为多个时间段测试
const timeWindows = [
  { start: '2020-01-01', end: '2021-12-31' },
  { start: '2022-01-01', end: '2023-12-31' },
  { start: '2024-01-01', end: '2025-06-21' }
];

// 测试最优参数在各时间段的表现
const crossPeriodValidation = await validateAcrossPeriods(bestParams, timeWindows);
```

#### 导出和追踪
```typescript
// 导出优化结果（只保留前10个）
const jsonData = optimizer.exportResults(task);

// 记录优化历史，避免重复优化同样参数
const optimizationHistory = {
  timestamp: Date.now(),
  config: config,
  bestResult: results[0],
  validationScore: crossPeriodValidation.averagePerformance
};
```

## API 文档

### OptimizationConfig
```typescript
interface OptimizationConfig {
  baseParams: BTCDOM2StrategyParams;  // 基础策略参数
  objective: 'maxDrawdown' | 'sharpe' | 'totalReturn' | 'composite';
  method: 'grid' | 'bayesian' | 'hybrid';
  maxIterations: number;              // 最大迭代次数
  timeLimit?: number;                 // 时间限制（秒）
  allocationStrategyMode: 'fixed' | 'random'; // 仓位策略模式
  fixedAllocationStrategy?: PositionAllocationStrategy; // 固定策略
  crossValidation?: CrossValidationConfig; // 交叉验证配置
}
```

### CrossValidationConfig
```typescript
interface CrossValidationConfig {
  enabled: boolean;                   // 是否启用交叉验证
  validationPeriods: number;          // 验证时间段数量（1-5）
  periodLength: {                     // 验证时间段长度配置
    type: 'fixed' | 'random';
    fixedDays?: number;              // 固定天数
    randomRange?: {                  // 随机范围
      minDays: number;
      maxDays: number;
    };
  };
  selectionRange: {                   // 验证时间段选择范围
    startDate: string;               // 可选择的开始日期
    endDate: string;                 // 可选择的结束日期
    allowOverlap: boolean;           // 是否允许与训练期重叠
  };
  scoreWeights: {                     // 评分权重
    training: number;                // 训练期权重
    validation: number;              // 验证期权重
  };
}
```

### OptimizationResult
```typescript
interface OptimizationResult {
  combination: ParameterCombination;   // 参数组合
  metrics: {                          // 性能指标（精简版）
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
    winRate: number;
  };
  objectiveValue: number;             // 目标函数值
  executionTime: number;              // 执行时间（毫秒）
  crossValidation?: CrossValidationResult; // 交叉验证结果
}
```

### CrossValidationResult
```typescript
interface CrossValidationResult {
  compositeScore: number;             // 综合评分
  trainingResult: {                   // 训练期结果
    period: { startDate: string; endDate: string };
    objectiveValue: number;
    metrics: PerformanceMetrics;
  };
  validationResults: Array<{          // 验证期结果
    period: { startDate: string; endDate: string };
    objectiveValue: number;
    metrics: PerformanceMetrics;
  }>;
  consistency: {                      // 一致性指标
    standardDeviation: number;        // 标准差
    performanceRange: number;         // 性能范围
    stabilityScore: number;           // 稳定性评分（0-1）
    coefficientOfVariation: number;   // 变异系数
  };
}
```

### ParameterRange
```typescript
interface ParameterRange {
  weights: {
    priceChangeWeight: { min: number; max: number; step: number };
    volumeWeight: { min: number; max: number; step: number };
    volatilityWeight: { min: number; max: number; step: number };
    fundingRateWeight: { min: number; max: number; step: number };
  };
  maxShortPositions: { min: number; max: number; step: number };
  allocationStrategy?: PositionAllocationStrategy[]; // 可选策略列表
}
```

## 🎯 寻找可信参数的最佳实践

### ✅ 强烈推荐的做法

1. **� 优先使用交叉验证**（最重要）
   - 启用交叉验证功能，自动在多个时间段验证参数稳定性
   - 选择稳定性评分 > 0.7 的参数组合
   - 关注综合评分，而非单一时间段的极值表现
   - 设置合理的权重比例（建议训练期0.6，验证期0.4）

2. **�📊 时间分割验证**（传统方法）
   - 用70%历史数据优化，20%数据验证，10%数据最终测试
   - 确保验证期和测试期的表现不明显低于训练期
   - 如果验证期表现大幅下降，说明过拟合严重

3. **🎛️ 保守的参数范围**
   - 权重范围不要设置过宽（如0.1-0.9），建议控制在合理区间
   - 优先使用较大的步长，避免过度精细搜索
   - 同时优化的参数不宜超过4个

4. **📈 关注稳定性而非极值**
   - 优先选择稳定性评分高的参数组合，而非收益率最高的
   - 避免选择参数组合与其他结果差异巨大的"异常值"
   - 重视夏普比率和最大回撤，而非单纯追求收益率

5. **🔄 多次验证**
   - 在不同时间段重复验证最优参数
   - 测试参数的微调版本（±10%）是否依然有效
   - 观察参数在不同市场环境下的适应性

6. **📝 建立优化日志**
   - 记录每次优化的配置和结果
   - 跟踪交叉验证的稳定性评分变化
   - 避免在短期内对同一数据集反复优化
   - 定期评估历史最优参数的当前表现

### ❌ 必须避免的误区

1. **🚫 数据窥探偏差**
   - 不要根据优化结果反复调整参数范围
   - 不要在看到"不满意"的结果后立即重新优化
   - 不要基于单一时间段的异常表现做决策

2. **🚫 过度拟合陷阱**
   - 避免在同一数据集上进行10次以上的优化
   - 不要追求训练期99%以上的完美表现
   - 不要同时优化超过5个参数

3. **🚫 选择性偏差**
   - 不要只关注收益率最高的结果
   - 不要忽视最大回撤和风险指标
   - 不要基于单一指标做出选择

4. **🚫 静态思维**
   - 不要期望一套参数永远有效
   - 不要忽视市场环境的变化
   - 不要长期使用未验证的参数

### 🏆 推荐的验证流程

#### 第一阶段：保守优化（建议配置）
```typescript
const conservativeConfig = {
  objective: 'maxDrawdown',     // 先关注风险控制
  method: 'hybrid',            // 平衡效率和效果
  maxIterations: 100,          // 适中的迭代次数
  allocationStrategyMode: 'fixed', // 固定策略减少变量
};

const conservativeRange = {
  weights: {
    priceChangeWeight: { min: 0.2, max: 0.5, step: 0.1 },
    volumeWeight: { min: 0.1, max: 0.3, step: 0.1 },
    volatilityWeight: { min: 0.05, max: 0.15, step: 0.05 },
    fundingRateWeight: { min: 0.3, max: 0.6, step: 0.1 }
  },
  maxShortPositions: { min: 5, max: 15, step: 5 }
};
```

#### 第二阶段：样本外验证
```typescript
// 用最优参数在不同时间段测试
const validationPeriods = [
  { start: '2023-01-01', end: '2023-12-31' },
  { start: '2024-01-01', end: '2024-12-31' },
  { start: '2025-01-01', end: '2025-06-21' }
];
```

#### 第三阶段：稳健性确认
```typescript
// 测试参数微调版本
const robustnesTests = generateParameterVariations(bestParams, 0.1); // ±10%
```

## 性能和限制

### ⚡ 性能考虑
- **网格搜索**: 时间复杂度 O(n^k)，适合小参数空间（建议总组合数<1000）
- **贝叶斯优化**: 适合中等参数空间，收敛速度快但可能陷入局部最优
- **混合方法**: 推荐使用，先粗后细，平衡效率和覆盖面
- **内存使用**: 系统只保留前10个最优结果，自动清理以节省内存

### 🔒 系统限制
- **参数约束**: 四个权重参数总和必须为1（误差容忍0.001）
- **搜索范围**: 过大的参数空间会显著增加计算时间和过拟合风险
- **数据依赖**: 结果质量高度依赖历史数据的代表性和充分性
- **并发限制**: 最多3个并发请求，避免服务器过载
- **环境限制**: 优化功能仅在开发环境下可用

### ⚠️ 过拟合风险评估
- **高风险信号**: 训练期表现异常优秀（如年化收益>200%），验证期大幅下降
- **中风险信号**: 最优参数与其他结果差异巨大，参数分布不连续
- **低风险信号**: 前几名结果参数相似，多时间段表现稳定

## 扩展和维护

### 添加新的优化目标
```typescript
// 在 types.ts 中添加新目标
export enum OptimizationObjective {
  // 现有目标...
  MAXIMIZE_WIN_RATE = 'MAXIMIZE_WIN_RATE',
}

// 在 optimizer.ts 中实现计算逻辑
private calculateObjectiveValue(result: BTCDOM2BacktestResult, objective: OptimizationObjective): number {
  switch (objective) {
    case OptimizationObjective.MAXIMIZE_WIN_RATE:
      return result.performance.winRate || 0;
    // ...
  }
}
```

### 添加新的优化算法
```typescript
// 继承或扩展 ParameterOptimizer 类
class AdvancedOptimizer extends ParameterOptimizer {
  async executeGeneticAlgorithm(task: OptimizationTask) {
    // 实现遗传算法
  }
}
```

### 自定义分析指标
```typescript
// 扩展 OptimizationAnalyzer 类
export class CustomAnalyzer extends OptimizationAnalyzer {
  static analyzeCustomMetric(results: OptimizationResult[]) {
    // 实现自定义分析
  }
}
```

## 故障排除

### 常见问题

1. **❓ 优化结果差异很大，哪个可信？**
   - **优先使用交叉验证**：选择稳定性评分 > 0.7 的参数组合
   - 关注综合评分，而非单一训练期的极值表现
   - 如果都不稳定，选择前5名中参数相对稳定的组合
   - 进行样本外验证，选择验证期表现不错的参数

2. **❓ 如何判断是否过拟合？**
   - **交叉验证指标**：稳定性评分 < 0.4，验证期表现与训练期差异巨大
   - 训练期表现异常优秀，但验证期大幅下降
   - 最优参数与常识差异巨大（如某权重为0或1）
   - 参数微调后表现大幅恶化

3. **❓ 交叉验证结果显示不稳定怎么办？**
   - 调整参数搜索范围，避免过于激进的参数设置
   - 增加验证期权重（如调整为训练0.5，验证0.5）
   - 增加验证时间段数量，获得更全面的评估
   - 选择稳定性评分相对较高的参数组合
   - 考虑使用更保守的优化目标（如最小化回撤）

4. **❓ 交叉验证会显著增加计算时间吗？**
   - 是的，会增加 N+1 倍计算时间（N为验证时间段数量）
   - 建议先用较小参数范围测试，确定大致区间后再完整验证
   - 可以先用2个验证时间段，平衡效果和效率
   - 使用混合优化方法，先粗搜索后精细验证

5. **❓ 如何设置交叉验证的权重？**
   - **保守型**：训练0.8，验证0.2（重视训练期表现）
   - **平衡型**：训练0.6，验证0.4（推荐，平衡两者）
   - **激进型**：训练0.5，验证0.5（更重视泛化能力）
   - 新策略建议从平衡型开始

6. **❓ 优化出的参数在实际中表现不佳**
   - 检查交叉验证的稳定性评分，可能存在过拟合
   - 可能存在数据窥探偏差，应减少优化频率
   - 市场环境可能已发生变化，需要重新评估
   - 考虑使用更保守的参数范围重新优化

7. **❓ 应该多久重新优化一次？**
   - 建议每3-6个月评估一次参数有效性
   - 定期检查当前参数的稳定性评分变化
   - 市场出现重大变化时可考虑重新优化
   - 避免因短期表现不佳而频繁调整

## 更新日志

### v1.2.0 (Current)
- ✅ 实现基础参数优化功能（网格搜索、贝叶斯优化、混合方法）
- ✅ 支持多种优化目标（收益率、夏普比率、最大回撤等）
- ✅ 提供实时进度监控和结果分析
- ✅ 内置过拟合检测和防护机制
- ✅ 集成使用指南和最佳实践
- ✅ **新增交叉验证功能** - 智能多时间段验证，有效防止过拟合
- ✅ **稳定性评分系统** - 量化评估参数在不同时间段的表现一致性
- ✅ **综合评分机制** - 结合训练期和验证期表现的加权评分

### v1.1.0
- ✅ 实现基础参数优化功能
- ✅ 支持多种优化目标和方法
- ✅ 基础过拟合防护机制

### 未来计划
- [ ] 🔄 实现自动时间分割验证框架
- [ ] 📊 添加参数敏感性可视化分析
- [ ] 🤖 集成更多机器学习优化算法（遗传算法、粒子群优化）
- [ ] 📈 支持多策略组合优化
- [ ] ⚡ 实现分布式并行优化
- [ ] 🔍 添加实时过拟合监控和预警
- [ ] 📱 移动端优化界面支持
- [ ] 🧪 交叉验证结果可视化分析
- [ ] 📋 优化历史和参数追踪系统

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 项目Issues
- 开发团队邮箱

---

## ⚠️ 重要免责声明

**参数优化基于历史数据的回测结果，不保证未来表现。**

- 📊 优化结果仅反映历史数据上的表现，不构成投资建议
- 🔄 市场环境持续变化，历史最优参数可能不适用于未来
- ⚖️ 请结合实际市场情况、风险承受能力和资金管理原则使用
- 🧪 建议先用小资金测试，验证参数在实际交易中的有效性
- 🔍 定期监控和评估参数表现，及时调整策略

**过拟合是量化交易中的常见陷阱，请务必遵循本文档的最佳实践指南！**