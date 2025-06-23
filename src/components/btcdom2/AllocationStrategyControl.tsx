'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PositionAllocationStrategy } from '@/types/btcdom2';

interface AllocationStrategyControlProps {
  value: PositionAllocationStrategy;
  onValueChange: (value: PositionAllocationStrategy) => void;
  disabled?: boolean;
}

export function AllocationStrategyControl({
  value,
  onValueChange,
  disabled = false
}: AllocationStrategyControlProps) {
  // 独立的显示状态 - 完全隔离，不受其他参数影响
  const [displayValue, setDisplayValue] = useState<PositionAllocationStrategy>(value);

  // 防抖定时器
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // 初始化显示值（只在挂载时同步一次）
  useEffect(() => {
    setDisplayValue(value);
  }, []); // 只在组件挂载时执行一次

  // 仓位分配策略处理函数 - 完全隔离，不影响其他参数
  const handleValueChange = useCallback((selectedValue: string) => {
    const strategyValue = selectedValue as PositionAllocationStrategy;
    console.log('仓位分配策略显示值变化:', strategyValue);
    
    // 立即更新显示值
    setDisplayValue(strategyValue);
    
    // 清除之前的防抖定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // 设置新的防抖定时器
    const timer = setTimeout(() => {
      console.log('仓位分配策略实际值更新:', strategyValue);
      onValueChange(strategyValue);
    }, 150); // 150ms 防抖，策略选择响应要快一些
    
    setDebounceTimer(timer);
  }, [onValueChange, debounceTimer]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // 获取策略显示名称
  const getStrategyDisplayName = (strategy: PositionAllocationStrategy) => {
    switch (strategy) {
      case PositionAllocationStrategy.BY_VOLUME:
        return "按成交量比例分配";
      case PositionAllocationStrategy.BY_COMPOSITE_SCORE:
        return "按综合分数分配权重";
      case PositionAllocationStrategy.EQUAL_ALLOCATION:
        return "平均分配做空资金";
      default:
        return "未知策略";
    }
  };

  return (
    <div className="space-y-4">
      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">仓位分配策略</h5>
      <div className="space-y-3">
        <Select
          value={displayValue}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full text-left">
            <SelectValue>
              {getStrategyDisplayName(displayValue)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PositionAllocationStrategy.BY_VOLUME}>
              <div className="flex flex-col">
                <span>按成交量比例分配</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">根据币种成交量大小按比例分配资金</span>
              </div>
            </SelectItem>
            <SelectItem value={PositionAllocationStrategy.BY_COMPOSITE_SCORE}>
              <div className="flex flex-col">
                <span>按综合分数分配权重</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">根据跌幅、成交量、波动率、资金费率的综合评分分配资金</span>
              </div>
            </SelectItem>
            <SelectItem value={PositionAllocationStrategy.EQUAL_ALLOCATION}>
              <div className="flex flex-col">
                <span>平均分配做空资金</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">每个选中的币种分配相等的资金</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
