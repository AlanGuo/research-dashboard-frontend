'use client';

import React, { memo, useCallback } from 'react';
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
  console.log('WeightControlGroup render:', {
    priceChangeWeight,
    volumeWeight,
    volatilityWeight,
    fundingRateWeight
  });

  // 创建稳定的回调函数
  const handlePriceChangeWeight = useCallback((value: number) => {
    onWeightChange('priceChange', value);
  }, [onWeightChange]);

  const handleVolumeWeight = useCallback((value: number) => {
    onWeightChange('volume', value);
  }, [onWeightChange]);

  const handleVolatilityWeight = useCallback((value: number) => {
    onWeightChange('volatility', value);
  }, [onWeightChange]);

  const handleFundingRateWeight = useCallback((value: number) => {
    onWeightChange('fundingRate', value);
  }, [onWeightChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <WeightControl
        label="跌幅权重"
        value={priceChangeWeight}
        onValueChange={handlePriceChangeWeight}
        description="评估价格下跌程度，跌幅越大分数越高"
      />

      <WeightControl
        label="成交量权重"
        value={volumeWeight}
        onValueChange={handleVolumeWeight}
        description="评估交易活跃度和流动性，确保足够流动性"
      />

      <WeightControl
        label="波动率权重"
        value={volatilityWeight}
        onValueChange={handleVolatilityWeight}
        description="评估价格波动稳定性，适中波动率得分最高"
      />

      <WeightControl
        label="资金费率权重"
        value={fundingRateWeight}
        onValueChange={handleFundingRateWeight}
        description="评估做空成本和收益，正费率对做空有利"
      />
    </div>
  );
});