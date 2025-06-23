import React, { memo, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useParameter } from '@/app/btcdom2/contexts/ParameterContext';

interface WeightControlProps {
  type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate';
  label: string;
  description: string;
}

const WeightControlComponent = ({ type, label, description }: WeightControlProps) => {
  console.log(`WeightControl render: ${type}`);
  
  const { updateWeight, priceChangeWeight, volumeWeight, volatilityWeight, fundingRateWeight } = useParameter();
  const weightMap = useMemo(() => ({
    priceChange: priceChangeWeight,
    volume: volumeWeight,
    volatility: volatilityWeight,
    fundingRate: fundingRateWeight
  }), [priceChangeWeight, volumeWeight, volatilityWeight, fundingRateWeight]);
  
  const value = weightMap[type];

  const handleValueChange = (newValue: number[]) => {
    updateWeight(type, newValue[0]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        <Slider
          value={[value]}
          onValueChange={handleValueChange}
          max={1}
          step={0.01}
          className="flex-1"
        />
        <span className="w-12 text-sm text-right">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

// 使用 memo 包装组件，只在 props 变化时重新渲染
export const OptimizedWeightControl = memo(WeightControlComponent);
