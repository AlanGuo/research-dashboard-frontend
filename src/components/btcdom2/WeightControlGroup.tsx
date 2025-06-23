'use client';

import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { WeightControl } from './WeightControl';

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


  // 本地状态管理 - 用于UI响应性
  const [localWeights, setLocalWeights] = useState({
    priceChangeWeight,
    volumeWeight,
    volatilityWeight,
    fundingRateWeight
  });

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInternalChangeRef = useRef(false);

  // 同步外部值变化到本地状态
  useEffect(() => {
    if (!isInternalChangeRef.current) {
      setLocalWeights({
        priceChangeWeight,
        volumeWeight,
        volatilityWeight,
        fundingRateWeight
      });
    }
    isInternalChangeRef.current = false;
  }, [priceChangeWeight, volumeWeight, volatilityWeight, fundingRateWeight]);

  // 防抖的最终值变化处理
  const triggerFinalChange = useCallback((type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {

      onWeightChange(type, value);
      debounceTimerRef.current = null;
    }, 300); // 300ms 防抖延迟
  }, [onWeightChange]);

  // 处理权重变化
  const handleWeightChange = useCallback((type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    isInternalChangeRef.current = true;
    
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