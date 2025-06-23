# 参数隔离测试说明

## 问题描述
修改做空标的数量时，WeightControl 组件会重新渲染，这违背了参数隔离的原则。

## 根本原因
`handleWeightChange` 函数依赖 `params` 对象：
```tsx
const handleWeightChange = useCallback((...) => {
  // ...
}, [params]); // 👈 问题在这里
```

当修改做空标的数量时：
1. `setParams` 更新了 `params` 对象
2. `handleWeightChange` 因为依赖 `params` 而重新创建
3. `WeightControl` 接收到新的 `onValueChange` 函数引用
4. 尽管 `displayParams` 权重值未变，组件还是重新渲染

## 解决方案
修改 `handleWeightChange` 函数，使其不依赖整个 `params` 对象：

```tsx
// 修复前
const handleWeightChange = useCallback((type, value) => {
  const newParams = { ...params, [`${type}Weight`]: value };
  setParams(newParams);
  setDisplayParams(newParams);
}, [params]); // 依赖整个 params 对象

// 修复后
const handleWeightChange = useCallback((type, value) => {
  const weightKey = `${type}Weight` as keyof BTCDOM2StrategyParams;
  
  setParams(prev => ({ ...prev, [weightKey]: value }));
  setDisplayParams(prev => ({ ...prev, [weightKey]: value }));
}, []); // 空依赖数组，避免因其他参数变化而重新创建
```

## 验证方法
1. 打开浏览器开发者工具
2. 在控制台中观察 `WeightControl render:` 日志
3. 修改做空标的数量
4. 确认权重控件不会打印 render 日志

## 其他优化
同时确保所有独立参数处理函数都使用空依赖数组 `[]`，避免相互影响：
- `handleIsolatedInitialCapitalChange`
- `handleIsolatedBtcRatioChange`
- `handleIsolatedMaxShortPositionsChange`
- `handleIsolatedSpotTradingFeeRateChange`
- `handleIsolatedFuturesTradingFeeRateChange`
- `handleIsolatedLongBtcChange`
- `handleIsolatedShortAltChange`
- `handleIsolatedStartDateChange`
- `handleIsolatedEndDateChange`
- `handleIsolatedAllocationStrategyChange`

## 预期效果
修复后，修改任何单个参数都不会导致其他参数的控制组件重新渲染，实现真正的参数隔离。
