# BTCDOM2 性能优化报告

## 性能瓶颈分析

根据性能日志分析，主要瓶颈如下：

### 1. 缓存命中率极低
- **波动率缓存**：0.0% 命中率（完全失效）
- **资金费率缓存**：64.4% 命中率（有优化空间）
- **缓存大小不断增长**：154612 → 154923（缓存策略问题）

### 2. 频繁重复计算
- `selectShortCandidates` 方法被大量重复调用
- 每次耗时0.07-0.26ms，累积成为主要性能瓶颈
- 并行处理开销大于收益（候选者数量通常只有30个左右）

## 优化方案实施

### 1. 缓存机制优化

#### A. 添加候选者选择缓存
```typescript
const CANDIDATE_SELECTION_CACHE = new Map<string, ShortSelectionResult>();
```
- 在 `selectShortCandidates` 入口处检查缓存
- 命中缓存直接返回结果，避免重复计算
- 使用简化的缓存键，提高命中率

#### B. 降低缓存精度
- **波动率缓存键**：从 toFixed(8) 改为 toFixed(4)
- **资金费率缓存键**：从 toFixed(8) 改为 toFixed(6)
- **候选者选择键**：使用前10个排名，降低精度到2位小数

#### C. 改进缓存清理策略
- 减小缓存大小限制：从10000降到5000
- 候选者选择缓存限制：100个，保留最近20个
- 更频繁的清理，避免内存溢出

### 2. 算法优化

#### A. 简化并行处理
- 移除不必要的分块和Promise.all
- 对于小量数据（30个候选者），直接循环比并行处理更高效
- 减少并行处理的调度开销

#### B. 缓存键优化
```typescript
function getCandidateSelectionCacheKey(rankings, btcPriceChange, params) {
  // 只使用前10个排名作为哈希
  const symbolsHash = rankings.slice(0, 10)
    .map(r => `${r.symbol}:${r.priceChange24h.toFixed(2)}:${Math.round(r.volume24h)}:${r.volatility24h.toFixed(2)}`)
    .join('|');
  
  // 降低参数精度
  const paramsHash = `${params.priceChangeWeight.toFixed(2)}:${params.volumeWeight.toFixed(2)}:...`;
  
  return `${btcPriceChange.toFixed(2)}:${paramsHash}:${symbolsHash}`;
}
```

### 3. 性能监控增强

#### A. 扩展缓存统计
- 添加候选者选择缓存的命中率统计
- 分别显示三种缓存的性能指标

#### B. 改进日志输出
```
[CACHE] 波动率: XX%, 资金费率: XX%, 候选者选择: XX%
[CACHE] 缓存大小 - 波动率: XX, 资金费率: XX, 候选者: XX
```

## 预期性能提升

### 1. 缓存命中率提升
- **波动率缓存**：预期从0%提升到60%+
- **资金费率缓存**：预期从64.4%提升到80%+
- **候选者选择缓存**：预期80%+命中率（新增）

### 2. 执行时间减少
- `selectShortCandidates` 方法：预期减少70%+执行时间（缓存命中时）
- 总体回测时间：预期减少30-50%

### 3. 内存使用优化
- 缓存大小控制在合理范围内
- 避免内存溢出和频繁垃圾回收

## 测试建议

### 1. 性能测试
- 运行相同的回测参数多次，观察缓存命中率
- 比较优化前后的总执行时间
- 监控内存使用情况

### 2. 功能测试
- 确保优化后结果与优化前一致
- 测试不同参数组合的缓存效果
- 验证边界条件处理

### 3. 压力测试
- 长时间运行，观察缓存清理效果
- 大量并发请求测试
- 不同数据规模下的性能表现

## 监控指标

在开发环境下，关注以下性能日志：
1. 各种缓存的命中率变化
2. `selectShortCandidates` 的执行时间分布
3. 缓存大小的增长趋势
4. 内存使用情况

通过这些优化，预期可以显著提升BTCDOM2回测的性能，特别是在重复运行相似参数时的响应速度。
