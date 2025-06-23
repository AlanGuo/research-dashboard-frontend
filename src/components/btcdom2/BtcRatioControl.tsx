import React, { useState, useCallback, useRef, memo } from 'react';
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
const BtcRatioControl = memo<BtcRatioControlProps>(({
  value,
  onValueChange,
  disabled = false
}) => {
  // 本地显示状态（百分比形式）- 完全独立
  const [displayValue, setDisplayValue] = useState<number>(value * 100);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalValueRef = useRef<number>(value);
  
  // 标记是否是内部变化（用户输入导致的）
  const isInternalChangeRef = useRef<boolean>(false);
  
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
    
    // 标记这是内部变化
    isInternalChangeRef.current = true;
    
    // 立即更新显示值
    setDisplayValue(clampedValue);
    
    // 真正的防抖：清除所有之前的定时器，重新开始计时
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      console.log('IsolatedBtcRatio: 清除防抖定时器，重新计时');
    }

    // 设置新的防抖定时器 - 只有这个定时器完成才会触发回调
    debounceTimerRef.current = setTimeout(() => {
      console.time('IsolatedBtcRatio-onValueChange');
      
      console.log('IsolatedBtcRatio: 输入停止，发送最终值给父组件', decimalValue);
      
      // 只有值真正变化时才通知父组件
      if (Math.abs(decimalValue - lastExternalValueRef.current) > 0.001) {
        onValueChange(decimalValue);
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
      isInternalChange: isInternalChangeRef.current
    });
    
    // 检查是否是真正的外部值变化
    const isExternalChange = Math.abs(value - lastExternalValueRef.current) > 0.001;
    
    // 如果是内部变化导致的更新，只更新 ref，不同步显示值
    if (isInternalChangeRef.current && isExternalChange) {
      lastExternalValueRef.current = value; // 更新外部值引用
      isInternalChangeRef.current = false; // 重置标记
      console.log('IsolatedBtcRatio: 内部变化导致的外部值更新，跳过同步');
      return;
    }
    
    // 处理真正的外部值变化（非用户输入导致的）
    if (isExternalChange && !isInternalChangeRef.current) {
      console.log('IsolatedBtcRatio: 外部值变化，更新显示值', newDisplayValue);
      setDisplayValue(newDisplayValue);
      lastExternalValueRef.current = value;
    }
  }, [value, displayValue]);

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
});

BtcRatioControl.displayName = 'BtcRatioControl';

export default BtcRatioControl;
