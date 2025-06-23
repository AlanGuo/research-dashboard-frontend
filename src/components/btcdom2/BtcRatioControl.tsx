import React, { useState, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BtcRatioControlProps {
  value: number; // 0-1的小数值
  onValueChange: (value: number) => void; // 回调传递0-1的小数值
  disabled?: boolean;
}

/**
 * 完全独立的BTC占比控制组件
 * 专门用于测试性能，不受其他参数影响
 */
const BtcRatioControl: React.FC<BtcRatioControlProps> = ({
  value,
  onValueChange,
  disabled = false
}) => {
  // 本地显示状态（百分比形式）- 完全独立
  const [displayValue, setDisplayValue] = useState<number>(value * 100);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalValueRef = useRef<number>(value);
  const currentInputValueRef = useRef<number>(value); // 记录当前输入的最新值
  
  console.log('BtcRatioControl render:', { 
    value, 
    displayValue,
    lastExternal: lastExternalValueRef.current
  });

  // 真正的防抖处理 - 只在停止输入后触发一次
  const handleChange = useCallback((inputValue: string) => {
    console.time('IsolatedBtcRatio-handleChange');
    
    const numValue = parseFloat(inputValue) || 0;
    const clampedValue = Math.min(Math.max(numValue, 0), 100);
    const decimalValue = clampedValue / 100;
    
    console.log('IsolatedBtcRatio input:', { inputValue, clampedValue, decimalValue });
    
    // 立即更新显示值和记录当前输入值
    setDisplayValue(clampedValue);
    currentInputValueRef.current = decimalValue;
    
    // 真正的防抖：清除所有之前的定时器，重新开始计时
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      console.log('IsolatedBtcRatio: 清除防抖定时器，重新计时');
    }

    // 设置新的防抖定时器 - 只有这个定时器完成才会触发回调
    debounceTimerRef.current = setTimeout(() => {
      console.time('IsolatedBtcRatio-onValueChange');
      
      const latestValue = currentInputValueRef.current;
      console.log('IsolatedBtcRatio: 输入停止，发送最终值给父组件', latestValue);
      
      // 只有值真正变化时才通知父组件
      if (Math.abs(latestValue - lastExternalValueRef.current) > 0.001) {
        lastExternalValueRef.current = latestValue;
        onValueChange(latestValue);
        console.log('IsolatedBtcRatio: 最终值已变化，通知父组件');
      } else {
        console.log('IsolatedBtcRatio: 最终值未变化，跳过通知');
      }
      
      // 清理定时器引用
      debounceTimerRef.current = null;
      console.timeEnd('IsolatedBtcRatio-onValueChange');
    }, 300); // 增加到300ms，确保用户真正停止输入
    
    console.timeEnd('IsolatedBtcRatio-handleChange');
  }, [onValueChange]);

  // 同步外部值变化 - 优化版本
  React.useEffect(() => {
    const newDisplayValue = value * 100;
    
    console.log('IsolatedBtcRatio useEffect:', {
      value,
      newDisplayValue,
      currentDisplayValue: displayValue,
      lastExternal: lastExternalValueRef.current,
      currentInput: currentInputValueRef.current
    });
    
    // 只在外部值真正变化且不同于当前输入值时才更新显示值
    const isExternalChange = Math.abs(value - lastExternalValueRef.current) > 0.001;
    const isDifferentFromInput = Math.abs(value - currentInputValueRef.current) > 0.001;
    
    if (isExternalChange && isDifferentFromInput) {
      console.log('IsolatedBtcRatio: 外部值变化，更新显示值', newDisplayValue);
      setDisplayValue(newDisplayValue);
      lastExternalValueRef.current = value;
      currentInputValueRef.current = value; // 同步当前输入值
    }
  }, [value]); // 只依赖value，不依赖displayValue

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="isolatedBtcRatio">BTC占比</Label>
      <div className="relative">
        <Input
          id="isolatedBtcRatio"
          type="number"
          min="0"
          max="100"
          step="5"
          value={displayValue.toFixed(0)}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="BTC占比(%)"
          className="pr-8"
          disabled={disabled}
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
          %
        </span>
      </div>
    </div>
  );
};

export default BtcRatioControl;
