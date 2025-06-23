import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 通用的防抖参数Hook
 * 分离显示值和计算值，实现即时UI响应和延迟计算
 */
export function useDebouncedParams<T>(initialValue: T, delay: number = 300) {
  // 显示值：用于UI展示，立即更新
  const [displayValue, setDisplayValue] = useState<T>(initialValue);
  
  // 计算值：用于业务逻辑计算，防抖后更新
  const [computedValue, setComputedValue] = useState<T>(initialValue);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 更新参数的方法
  const updateValue = useCallback((newValue: T) => {
    console.log('useDebouncedParams updateValue:', newValue);
    
    // 立即更新显示值，提供即时UI反馈
    setDisplayValue(newValue);
    
    // 清除之前的防抖定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // 设置新的防抖定时器，延迟更新计算值
    debounceRef.current = setTimeout(() => {
      console.log('useDebouncedParams computedValue updated:', newValue);
      setComputedValue(newValue);
      debounceRef.current = null;
    }, delay);
  }, [delay]);

  // 直接设置计算值（用于外部同步）
  const setComputedValueDirect = useCallback((newValue: T) => {
    setComputedValue(newValue);
    setDisplayValue(newValue);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    displayValue,
    computedValue,
    updateValue,
    setComputedValueDirect
  };
}
