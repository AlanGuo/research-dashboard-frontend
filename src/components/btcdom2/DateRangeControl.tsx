'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { devConsole } from '@/utils/devLogger';

/**
 * 将datetime-local输入的值转换为UTC时间的ISO字符串
 * 用户在datetime-local中输入的时间我们当作UTC时间处理
 */
function convertInputToUTCISO(dateTimeInput: string): string {
  if (!dateTimeInput) return '';

  // 如果输入格式是YYYY-MM-DDTHH:mm，我们直接当作UTC时间处理
  // 添加秒和毫秒部分，然后添加Z表示UTC时间
  if (dateTimeInput.length === 16) {
    return `${dateTimeInput}:00.000Z`;
  }

  // 如果已经是完整的ISO格式，直接返回
  if (dateTimeInput.endsWith('Z') || dateTimeInput.includes('+') || dateTimeInput.includes('-')) {
    return dateTimeInput;
  }

  // 其他情况，尝试解析并转换为UTC
  try {
    const date = new Date(dateTimeInput);
    return date.toISOString();
  } catch (error) {
    console.warn('无法解析日期时间:', dateTimeInput, error);
    return dateTimeInput;
  }
}


/**
 * 将UTC ISO字符串转换为datetime-local输入框的格式
 * 这里我们将UTC时间直接显示为本地时间格式，但用户理解这是UTC时间
 */
function convertUTCISOToInput(isoString: string): string {
  if (!isoString) return '';

  try {
    // 如果已经是YYYY-MM-DDTHH:mm格式，直接返回（避免重复转换）
    if (isoString.length === 16 && isoString.includes('T') && !isoString.endsWith('Z')) {
      return isoString;
    }

    // 如果是完整的ISO格式（带Z或时区信息）
    if (isoString.endsWith('Z') || isoString.includes('+') || (isoString.includes('-') && isoString.length > 16)) {
      const date = new Date(isoString);
      // 获取UTC时间的各个组件
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // 对于YYYY-MM-DDTHH:mm格式（没有时区信息），我们假设它已经是UTC时间
    // 直接解析字符串而不是通过Date对象（避免时区转换）
    if (isoString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      return isoString;
    }

    // 其他情况，尝试解析（但要小心时区问题）
    // 如果没有时区信息，我们强制添加Z来确保按UTC解析
    const isoStringWithZ = isoString.endsWith('Z') ? isoString : `${isoString}Z`;
    const date = new Date(isoStringWithZ);
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.warn('无法解析UTC ISO字符串:', isoString, error);
    return isoString;
  }
}

interface DateRangeControlProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  disabled?: boolean;
}

export const DateRangeControl = memo(function DateRangeControl({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false
}: DateRangeControlProps) {
  // 完全自管理的显示状态，将UTC ISO格式转换为datetime-local格式
  const [displayStartDate, setDisplayStartDate] = useState<string>(convertUTCISOToInput(startDate));
  const [displayEndDate, setDisplayEndDate] = useState<string>(convertUTCISOToInput(endDate));

  // 防抖定时器
  const startDateDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const endDateDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 记录上次外部传入的值，避免循环更新
  const lastStartDateExternalValueRef = useRef<string>(startDate);
  const lastEndDateExternalValueRef = useRef<string>(endDate);

  devConsole.log('🔄 DateRangeControl render:', {
    propsStartDate: startDate,
    propsEndDate: endDate,
    displayStartDate: displayStartDate,
    displayEndDate: displayEndDate,
    lastStartExternal: lastStartDateExternalValueRef.current,
    lastEndExternal: lastEndDateExternalValueRef.current
  });

  // 开始日期处理函数
  const handleStartDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const dateTimeValue = event.target.value;
    devConsole.log('⌨️  开始日期时间输入:', dateTimeValue);

    setDisplayStartDate(dateTimeValue);

    // 清除之前的防抖定时器
    if (startDateDebounceTimerRef.current) {
      clearTimeout(startDateDebounceTimerRef.current);
    }

    // 防抖处理：延迟通知父组件
    startDateDebounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 开始日期时间防抖触发，处理数值:', dateTimeValue);

      // 将输入的时间当作UTC时间处理，转换为ISO格式
      const utcISOString = convertInputToUTCISO(dateTimeValue);
      devConsole.log('🌍 转换为UTC ISO格式:', utcISOString);

      // 更新记录值，避免下次外部值同步时覆盖用户输入
      lastStartDateExternalValueRef.current = utcISOString;
      devConsole.log('✅ 通知父组件更新开始日期时间:', utcISOString);
      onStartDateChange(utcISOString);
    }, 300); // 300ms 防抖
  }, [onStartDateChange]);

  // 结束日期处理函数
  const handleEndDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const dateTimeValue = event.target.value;
    devConsole.log('⌨️  结束日期时间输入:', dateTimeValue);

    setDisplayEndDate(dateTimeValue);

    // 清除之前的防抖定时器
    if (endDateDebounceTimerRef.current) {
      clearTimeout(endDateDebounceTimerRef.current);
    }

    // 防抖处理：延迟通知父组件
    endDateDebounceTimerRef.current = setTimeout(() => {
      devConsole.log('🚀 结束日期时间防抖触发，处理数值:', dateTimeValue);

      // 将输入的时间当作UTC时间处理，转换为ISO格式
      const utcISOString = convertInputToUTCISO(dateTimeValue);
      devConsole.log('🌍 转换为UTC ISO格式:', utcISOString);

      // 更新记录值，避免下次外部值同步时覆盖用户输入
      lastEndDateExternalValueRef.current = utcISOString;
      devConsole.log('✅ 通知父组件更新结束日期时间:', utcISOString);
      onEndDateChange(utcISOString);
    }, 300); // 300ms 防抖
  }, [onEndDateChange]);

  // 只在外部值真正变化时同步（避免用户输入时被覆盖）
  useEffect(() => {
    devConsole.log('📥 开始日期外部值同步检查:', {
      newValue: startDate,
      lastExternal: lastStartDateExternalValueRef.current,
      same: startDate === lastStartDateExternalValueRef.current
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (startDate !== lastStartDateExternalValueRef.current) {
      devConsole.log('🔄 开始日期外部值变化，更新显示值:', startDate);
      setDisplayStartDate(convertUTCISOToInput(startDate));
      lastStartDateExternalValueRef.current = startDate;
    } else {
      devConsole.log('⏭️  开始日期外部值未变化，跳过更新');
    }
  }, [startDate]);

  useEffect(() => {
    devConsole.log('📥 结束日期外部值同步检查:', {
      newValue: endDate,
      lastExternal: lastEndDateExternalValueRef.current,
      same: endDate === lastEndDateExternalValueRef.current
    });
    
    // 只有当外部值与记录值不同时才更新显示值
    if (endDate !== lastEndDateExternalValueRef.current) {
      devConsole.log('🔄 结束日期外部值变化，更新显示值:', endDate);
      setDisplayEndDate(convertUTCISOToInput(endDate));
      lastEndDateExternalValueRef.current = endDate;
    } else {
      devConsole.log('⏭️  结束日期外部值未变化，跳过更新');
    }
  }, [endDate]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (startDateDebounceTimerRef.current) {
        clearTimeout(startDateDebounceTimerRef.current);
      }
      if (endDateDebounceTimerRef.current) {
        clearTimeout(endDateDebounceTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="startDate">
          开始日期
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(UTC)</span>
        </Label>
        <Input
          id="startDate"
          type="datetime-local"
          value={displayStartDate}
          onChange={handleStartDateChange}
          disabled={disabled}
          className="w-full"
          placeholder="选择开始日期时间"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">
          结束日期
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(UTC)</span>
        </Label>
        <Input
          id="endDate"
          type="datetime-local"
          value={displayEndDate}
          onChange={handleEndDateChange}
          disabled={disabled}
          className="w-full"
          placeholder="选择结束日期时间"
        />
      </div>
    </>
  );
});
