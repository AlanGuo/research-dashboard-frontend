'use client';

import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { WeightControl } from './WeightControl';
import { devConsole } from '@/utils/devLogger';

interface WeightControlGroupProps {
  priceChangeWeight: number;
  volumeWeight: number;
  volatilityWeight: number;
  fundingRateWeight: number;
  onWeightChange: (type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => void;
}

export const WeightControlGroup = memo(function WeightControlGroup({
  priceChangeWeight,
  volumeWeight,
  volatilityWeight,
  fundingRateWeight,
  onWeightChange
}: WeightControlGroupProps) {
  // 完全自管理的显示状态
  const [localWeights, setLocalWeights] = useState({
    priceChangeWeight,
    volumeWeight,
    volatilityWeight,
    fundingRateWeight
  });

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 记录上次外部传入的值，避免循环更新
  const lastExternalWeightsRef = useRef({
    priceChangeWeight,
    volumeWeight,
    volatilityWeight,
    fundingRateWeight
  });

  devConsole.log('🔄 WeightControlGroup render:', {
    propsWeights: { priceChangeWeight, volumeWeight, volatilityWeight, fundingRateWeight },
    localWeights: localWeights,
    lastExternalWeights: lastExternalWeightsRef.current
  });

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    const newWeights = { priceChangeWeight, volumeWeight, volatilityWeight, fundingRateWeight };
    const lastWeights = lastExternalWeightsRef.current;
    
    devConsole.log('📥 WeightControlGroup 外部值同步检查:', {
      newWeights: newWeights,
      lastWeights: lastWeights
    });
    
    // 检查是否有权重发生了真正的变化
    const hasChanges = 
      Math.abs(newWeights.priceChangeWeight - lastWeights.priceChangeWeight) > 0.001 ||
      Math.abs(newWeights.volumeWeight - lastWeights.volumeWeight) > 0.001 ||
      Math.abs(newWeights.volatilityWeight - lastWeights.volatilityWeight) > 0.001 ||
      Math.abs(newWeights.fundingRateWeight - lastWeights.fundingRateWeight) > 0.001;
    
    if (hasChanges) {
      devConsole.log('🔄 WeightControlGroup 外部权重变化，更新本地状态:', newWeights);
      setLocalWeights(newWeights);
      lastExternalWeightsRef.current = newWeights;
    } else {
      devConsole.log('⏭️  WeightControlGroup 外部权重未变化，跳过更新');
    }
  }, [priceChangeWeight, volumeWeight, volatilityWeight, fundingRateWeight]);

  // 防抖的最终值变化处理
  const triggerFinalChange = useCallback((type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      devConsole.log(`⏱️  清除权重[${type}]防抖定时器`);
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      devConsole.log(`🚀 权重[${type}]防抖触发，处理数值:`, value);
      
      // 更新记录值，避免外部值同步时覆盖
      const weightKey = `${type}Weight` as keyof typeof lastExternalWeightsRef.current;
      lastExternalWeightsRef.current = {
        ...lastExternalWeightsRef.current,
        [weightKey]: value
      };
      
      devConsole.log(`✅ 通知父组件更新权重[${type}]:`, value);
      onWeightChange(type, value);
      debounceTimerRef.current = null;
    }, 300); // 300ms 防抖延迟
  }, [onWeightChange]);

  // 处理权重变化
  const handleWeightChange = useCallback((type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    devConsole.log(`⌨️  WeightControlGroup 权重[${type}]变化:`, value);
    // 立即更新本地状态以保持UI响应性
    setLocalWeights(prev => ({
      ...prev,
      [`${type}Weight`]: value
    }));

    // 防抖触发最终变化
    triggerFinalChange(type, value);
  }, [triggerFinalChange]);

  // 创建稳定的回调函数
  const handlePriceChangeWeight = useCallback((value: number) => {
    handleWeightChange('priceChange', value);
  }, [handleWeightChange]);

  const handleVolumeWeight = useCallback((value: number) => {
    handleWeightChange('volume', value);
  }, [handleWeightChange]);

  const handleVolatilityWeight = useCallback((value: number) => {
    handleWeightChange('volatility', value);
  }, [handleWeightChange]);

  const handleFundingRateWeight = useCallback((value: number) => {
    handleWeightChange('fundingRate', value);
  }, [handleWeightChange]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <WeightControl
        label="跌幅权重"
        value={localWeights.priceChangeWeight}
        onValueChange={handlePriceChangeWeight}
        description="评估价格下跌程度，跌幅越大分数越高"
      />

      <WeightControl
        label="成交量权重"
        value={localWeights.volumeWeight}
        onValueChange={handleVolumeWeight}
        description="评估交易活跃度和流动性，确保足够流动性"
      />

      <WeightControl
        label="波动率权重"
        value={localWeights.volatilityWeight}
        onValueChange={handleVolatilityWeight}
        description="评估价格波动稳定性，适中波动率得分最高"
      />

      <WeightControl
        label="资金费率权重"
        value={localWeights.fundingRateWeight}
        onValueChange={handleFundingRateWeight}
        description="评估做空成本和收益，正费率对做空有利"
      />
    </div>
  );
});