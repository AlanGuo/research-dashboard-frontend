'use client'

import React from 'react';
import { CrossValidationConfig } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';

interface CrossValidationConfigProps {
  config: CrossValidationConfig;
  onChange: (config: CrossValidationConfig) => void;
  className?: string;
}

export const CrossValidationConfigComponent: React.FC<CrossValidationConfigProps> = ({
  config,
  onChange,
  className = ''
}) => {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({
      ...config,
      enabled
    });
  };

  const handleValidationPeriodsChange = (validationPeriods: number) => {
    onChange({
      ...config,
      validationPeriods
    });
  };

  const handlePeriodLengthTypeChange = (type: 'fixed' | 'random') => {
    const newConfig = {
      ...config,
      periodLength: {
        ...config.periodLength,
        type
      }
    };

    // 设置默认值
    if (type === 'fixed' && !newConfig.periodLength.fixedDays) {
      newConfig.periodLength.fixedDays = 30;
    } else if (type === 'random' && !newConfig.periodLength.randomRange) {
      newConfig.periodLength.randomRange = {
        minDays: 30,
        maxDays: 90
      };
    }

    onChange(newConfig);
  };

  const handleFixedDaysChange = (fixedDays: number) => {
    onChange({
      ...config,
      periodLength: {
        ...config.periodLength,
        fixedDays
      }
    });
  };

  const handleRandomRangeChange = (field: 'minDays' | 'maxDays', value: number) => {
    onChange({
      ...config,
      periodLength: {
        ...config.periodLength,
        randomRange: {
          ...config.periodLength.randomRange!,
          [field]: value
        }
      }
    });
  };

  const handleSelectionRangeChange = (field: keyof CrossValidationConfig['selectionRange'], value: string | boolean) => {
    onChange({
      ...config,
      selectionRange: {
        ...config.selectionRange,
        [field]: value
      }
    });
  };

  const handleScoreWeightsChange = (field: 'training' | 'validation', value: number[]) => {
    const newValue = value[0];
    const otherValue = 1 - newValue;
    
    onChange({
      ...config,
      scoreWeights: {
        training: field === 'training' ? newValue : otherValue,
        validation: field === 'validation' ? newValue : otherValue
      }
    });
  };

  const normalizeWeights = () => {
    const total = config.scoreWeights.training + config.scoreWeights.validation;
    if (total > 0) {
      onChange({
        ...config,
        scoreWeights: {
          training: config.scoreWeights.training / total,
          validation: config.scoreWeights.validation / total
        }
      });
    }
  };

  const weightsSum = config.scoreWeights.training + config.scoreWeights.validation;
  const weightsNeedNormalization = Math.abs(weightsSum - 1) > 0.001;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">交叉验证配置</CardTitle>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-cv"
              checked={config.enabled}
              onCheckedChange={handleEnabledChange}
            />
            <Label htmlFor="enable-cv" className="text-sm font-medium">
              启用交叉验证
            </Label>
          </div>
        </div>
      </CardHeader>

      {config.enabled && (
        <CardContent className="space-y-6">
          {/* 验证时间段数量 */}
          <div className="space-y-2">
            <Label htmlFor="validation-periods" className="text-sm font-medium">
              验证时间段数量
            </Label>
            <Input
              id="validation-periods"
              type="number"
              min="1"
              max="5"
              value={config.validationPeriods}
              onChange={(e) => handleValidationPeriodsChange(parseInt(e.target.value) || 1)}
              className="w-32"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              推荐使用2-3个验证时间段，避免过度验证
            </p>
          </div>

          <Separator />

          {/* 时间段长度配置 */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">时间段长度配置</Label>
            
            <Select
              value={config.periodLength.type}
              onValueChange={handlePeriodLengthTypeChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择长度类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">固定长度</SelectItem>
                <SelectItem value="random">随机长度</SelectItem>
              </SelectContent>
            </Select>

            {config.periodLength.type === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="fixed-days" className="text-sm">固定天数</Label>
                <Input
                  id="fixed-days"
                  type="number"
                  min="7"
                  max="365"
                  value={config.periodLength.fixedDays || 30}
                  onChange={(e) => handleFixedDaysChange(parseInt(e.target.value) || 30)}
                  className="w-32"
                />
              </div>
            )}

            {config.periodLength.type === 'random' && config.periodLength.randomRange && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-days" className="text-sm">最少天数</Label>
                  <Input
                    id="min-days"
                    type="number"
                    min="7"
                    max="365"
                    value={config.periodLength.randomRange.minDays}
                    onChange={(e) => handleRandomRangeChange('minDays', parseInt(e.target.value) || 7)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-days" className="text-sm">最多天数</Label>
                  <Input
                    id="max-days"
                    type="number"
                    min="7"
                    max="365"
                    value={config.periodLength.randomRange.maxDays}
                    onChange={(e) => handleRandomRangeChange('maxDays', parseInt(e.target.value) || 60)}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* 时间段选择范围 */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">验证时间段选择范围</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-sm">开始日期</Label>
                <DatePicker
                  date={config.selectionRange.startDate ? new Date(config.selectionRange.startDate + 'T00:00:00') : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      // 使用本地时区格式化日期，避免时区转换问题
                      const year = date.getFullYear();
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      handleSelectionRangeChange('startDate', `${year}-${month}-${day}`);
                    } else {
                      handleSelectionRangeChange('startDate', '');
                    }
                  }}
                  placeholder="选择开始日期"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm">结束日期</Label>
                <DatePicker
                  date={config.selectionRange.endDate ? new Date(config.selectionRange.endDate + 'T00:00:00') : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      // 使用本地时区格式化日期，避免时区转换问题
                      const year = date.getFullYear();
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      handleSelectionRangeChange('endDate', `${year}-${month}-${day}`);
                    } else {
                      handleSelectionRangeChange('endDate', '');
                    }
                  }}
                  placeholder="选择结束日期"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-overlap"
                checked={config.selectionRange.allowOverlap}
                onCheckedChange={(checked) => handleSelectionRangeChange('allowOverlap', checked)}
              />
              <Label htmlFor="allow-overlap" className="text-sm">
                允许与训练时间段重叠
              </Label>
            </div>
          </div>

          <Separator />

          {/* 综合评分权重 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">综合评分权重</Label>
              {weightsNeedNormalization && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={normalizeWeights}
                  className="text-xs"
                >
                  标准化权重 (当前总和: {weightsSum.toFixed(3)})
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">
                  训练权重: {(config.scoreWeights.training * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[config.scoreWeights.training]}
                  onValueChange={(value) => handleScoreWeightsChange('training', value)}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">
                  验证权重: {(config.scoreWeights.validation * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[config.scoreWeights.validation]}
                  onValueChange={(value) => handleScoreWeightsChange('validation', value)}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              训练权重关注原始时间段表现，验证权重关注泛化能力
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default CrossValidationConfigComponent;