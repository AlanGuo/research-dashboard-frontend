# BTCDOM2策略优化交叉验证功能

## 概述

交叉验证功能旨在解决参数优化中的过度拟合问题。通过在多个不同时间段验证参数的表现，确保优化结果具有更好的泛化能力和稳定性。

## 核心思想

### 传统优化问题
- 只在单一时间段（训练期）优化参数
- 容易产生过度拟合，在训练期表现很好但在其他时间段表现差
- 缺乏对策略稳定性的评估

### 交叉验证解决方案
1. **训练时间段**：用户指定的原始优化时间段
2. **验证时间段**：系统随机选择的2个额外时间段
3. **综合评分**：结合训练期和验证期的表现，计算最终得分
4. **稳定性评估**：评估参数在不同时间段的表现一致性

## 功能特性

### 1. 灵活的时间段配置
- **验证时间段数量**：可配置1-5个验证时间段
- **时间段长度**：
  - 固定长度：指定固定的天数
  - 随机长度：在指定范围内随机选择长度
- **选择范围**：指定从哪个时间范围内选择验证时间段
- **重叠控制**：可选择是否允许验证时间段与训练时间段重叠

### 2. 智能评分机制
- **权重配置**：训练期权重 + 验证期权重 = 1
- **综合评分** = 训练期得分 × 训练权重 + 验证期平均得分 × 验证权重
- **一致性指标**：
  - 标准差：衡量各时间段表现的离散程度
  - 性能范围：最好与最差表现的差值
  - 稳定性评分：0-1分值，越高越稳定

### 3. 丰富的结果展示
- **综合评分概览**：显示最终综合得分和稳定性评分
- **各时间段详情**：展示每个时间段的详细表现
- **性能对比表**：所有时间段的指标对比
- **结果解读**：智能分析和建议

## 使用方法

### 1. 基础配置

```typescript
import { createDefaultCrossValidationConfig } from './types';

const crossValidationConfig = createDefaultCrossValidationConfig(
  '2023-01-01', // 训练开始日期
  '2023-03-31', // 训练结束日期
  '2022-01-01', // 验证选择范围开始
  '2024-12-31'  // 验证选择范围结束
);
```

### 2. 自定义配置

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

### 3. 优化执行

```typescript
const optimizer = new ParameterOptimizer();

const config: OptimizationConfig = {
  baseParams: { /* 基础参数 */ },
  objective: 'sharpe',
  method: 'grid',
  crossValidation: crossValidationConfig, // 启用交叉验证
  // ... 其他配置
};

const results = await optimizer.startOptimization(config, parameterRange);

// 检查交叉验证结果
const cvResults = results.filter(r => r.crossValidation);
console.log('最佳综合评分:', cvResults[0]?.crossValidation?.compositeScore);
```

### 4. 结果分析

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
```

## 配置建议

### 验证时间段数量
- **推荐值**：2-3个
- **原因**：平衡验证效果和计算成本

### 时间段长度
- **短期策略**：15-30天
- **中期策略**：30-60天
- **长期策略**：60-90天

### 权重配置
- **保守配置**：训练0.8，验证0.2（重视训练期表现）
- **平衡配置**：训练0.6，验证0.4（平衡训练和验证）
- **激进配置**：训练0.5，验证0.5（更重视泛化能力）

### 选择范围
- **建议范围**：至少包含2年以上的历史数据
- **避免偏差**：包含不同市场环境（牛市、熊市、横盘）

## 性能考虑

### 计算复杂度
- 交叉验证会将计算量增加 N+1 倍（N为验证时间段数量）
- 建议在参数范围确定后再启用交叉验证

### 并发优化
- 系统支持并发处理多个时间段
- 可通过 `parallelEvaluations` 参数控制并发数量

### 内存管理
- 优化模式下不生成图表数据，节省内存
- 只保留关键性能指标，避免内存溢出

## 结果解读

### 综合评分
- 结合训练期和验证期的加权平均
- 分数越高表示参数组合越优秀

### 稳定性评分
- 0-1分值，衡量参数在不同时间段的表现一致性
- \> 0.8：很稳定，具有良好泛化能力
- 0.6-0.8：较稳定，可接受的参数组合
- 0.4-0.6：不太稳定，需要谨慎评估
- < 0.4：不稳定，可能存在过度拟合

### 一致性指标
- **标准差**：越小表示各时间段表现越一致
- **性能范围**：最好与最差表现的差距
- **变异系数**：标准差与均值的比值，反映相对稳定性

## 常见问题

### Q: 交叉验证会显著增加计算时间吗？
A: 是的，会增加 N+1 倍的计算时间（N为验证时间段数量）。建议先用较小的参数范围测试，确定大致范围后再进行完整的交叉验证。

### Q: 如何选择合适的验证时间段数量？
A: 通常2-3个验证时间段就足够了。更多的验证时间段会增加计算成本，但带来的额外价值有限。

### Q: 验证时间段应该多长？
A: 建议与训练时间段长度相近，或稍短一些。太短可能不够稳定，太长会增加计算成本。

### Q: 权重如何设置？
A: 如果更关注原始时间段的表现，可以增加训练权重；如果更关注策略的泛化能力，可以增加验证权重。推荐从6:4开始。

### Q: 交叉验证结果显示不稳定怎么办？
A: 可能是参数过度拟合了训练时间段。建议：
1. 调整参数搜索范围，避免过于激进的参数
2. 增加验证时间段的权重
3. 选择稳定性评分较高的参数组合

## 技术实现

### 核心类和接口
- `CrossValidationConfig`：交叉验证配置
- `CrossValidationResult`：交叉验证结果
- `ParameterOptimizer`：优化器主类
- `CrossValidationConfigComponent`：配置界面组件
- `CrossValidationResults`：结果展示组件

### 关键方法
- `generateRandomTimePeriods()`：生成随机验证时间段
- `evaluateCombinationWithCrossValidation()`：交叉验证评估
- `calculateCompositeScore()`：计算综合评分
- `calculateConsistencyMetrics()`：计算一致性指标

### API 集成
- 复用现有的 `/api/btcdom2/optimize` 接口
- 通过 `optimizeOnly=true` 参数优化性能
- 支持多时间段并发调用

## 示例代码

完整的使用示例请参考：
- `examples/cross-validation-example.tsx`：React组件集成示例
- `test-cross-validation.ts`：功能测试脚本

## 更新历史

- v1.0.0：初始版本，支持基础交叉验证功能
- 后续版本将支持更多优化算法和验证策略