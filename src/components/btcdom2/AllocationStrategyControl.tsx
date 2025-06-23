'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PositionAllocationStrategy } from '@/types/btcdom2';
import { devConsole } from '@/utils/devLogger';

interface AllocationStrategyControlProps {
  value: PositionAllocationStrategy;
  onValueChange: (value: PositionAllocationStrategy) => void;
  disabled?: boolean;
}

export const AllocationStrategyControl = memo(function AllocationStrategyControl({
  value,
  onValueChange,
  disabled = false
}: AllocationStrategyControlProps) {
  // 完全自管理的显示状态
  const [displayValue, setDisplayValue] = useState<PositionAllocationStrategy>(value);

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 记录上次外部传入的值，避免循环更新
  const lastExternalValueRef = useRef<PositionAllocationStrategy>(value);

  devConsole.log('🔄 AllocationStrategyControl render:', {
    propsValue: value,
    displayValue: displayValue,
    lastExternalValue: lastExternalValueRef.current
  });

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    devConsole.log('📥 AllocationStrategyControl 外部值同步检查:', {
      newValue: value,
      lastExternal: lastExternalValueRef.current
    });
    
    if (value !== lastExternalValueRef.current) {
      devConsole.log('🔄 AllocationStrategyControl 外部值变化，更新显示值:', value);
      setDisplayValue(value);
      lastExternalValueRef.current = value;
    } else {
      devConsole.log('⏭️  AllocationStrategyControl 外部值未变化，跳过更新');
    }
  }, [value]);

  // 防抖的最终值变化处理
  const triggerFinalChange = useCallback((newValue: PositionAllocationStrategy) => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      devConsole.log('⏱️  清除 allocationStrategy 防抖定时器');
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 allocationStrategy 防抖触发，处理数值:', newValue);
      
      // 更新记录值，避免外部值同步时覆盖
      lastExternalValueRef.current = newValue;
      
      devConsole.log('✅ 通知父组件更新 allocationStrategy:', newValue);
      onValueChange(newValue);
      debounceTimerRef.current = null;
    }, 150); // 150ms 防抖延迟
  }, [onValueChange]);

  // 仓位分配策略处理函数
  const handleValueChange = useCallback((selectedValue: string) => {
    const strategyValue = selectedValue as PositionAllocationStrategy;
    devConsole.log('⌨️  AllocationStrategyControl 用户选择策略:', strategyValue);
    
    // 立即更新显示值
    setDisplayValue(strategyValue);
    
    // 防抖触发最终变化
    triggerFinalChange(strategyValue);
  }, [triggerFinalChange]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
});
