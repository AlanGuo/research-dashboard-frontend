import {
  OptimizationConfig,
  OptimizationTask,
  OptimizationResult,
  OptimizationStatus,
  OptimizationObjective,
  OptimizationMethod,
  ParameterRange,
  ParameterCombination,

  OptimizationProgress,
  ParameterValidationResult,
  OptimizationReport
} from './types';
import { PositionAllocationStrategy, BTCDOM2StrategyParams, BTCDOM2BacktestResult } from '@/types/btcdom2';

export class ParameterOptimizer {
  private currentTask: OptimizationTask | null = null;
  private progressCallback?: (progress: OptimizationProgress) => void;
  private abortController?: AbortController;

  /**
   * 设置进度回调函数
   */
  setProgressCallback(callback: (progress: OptimizationProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * 开始优化任务
   */
  async startOptimization(
    config: OptimizationConfig,
    parameterRange: ParameterRange
  ): Promise<OptimizationTask> {
    // 创建新任务
    const task: OptimizationTask = {
      id: this.generateTaskId(),
      config,
      parameterRange,
      status: OptimizationStatus.PENDING,
      progress: { current: 0, total: 0, percentage: 0 },
      results: [],
      startTime: new Date()
    };

    this.currentTask = task;
    this.abortController = new AbortController();

    try {
      task.status = OptimizationStatus.RUNNING;
      await this.executeOptimization(task);
      task.status = OptimizationStatus.COMPLETED;
      task.endTime = new Date();
    } catch (error) {
      task.status = OptimizationStatus.FAILED;
      task.error = error instanceof Error ? error.message : '未知错误';
      task.endTime = new Date();
    }

    return task;
  }

  /**
   * 取消当前优化任务
   */
  cancelOptimization() {
    if (this.currentTask && this.abortController) {
      this.abortController.abort();
      this.currentTask.status = OptimizationStatus.CANCELLED;
      this.currentTask.endTime = new Date();
    }
  }

  /**
   * 执行优化
   */
  private async executeOptimization(task: OptimizationTask) {
    switch (task.config.method) {
      case OptimizationMethod.GRID_SEARCH:
        await this.executeGridSearch(task);
        break;
      case OptimizationMethod.BAYESIAN_OPTIMIZATION:
        await this.executeBayesianOptimization(task);
        break;
      case OptimizationMethod.HYBRID:
        await this.executeHybridOptimization(task);
        break;
      default:
        throw new Error(`不支持的优化方法: ${task.config.method}`);
    }
  }

  /**
   * 执行网格搜索
   */
  private async executeGridSearch(task: OptimizationTask) {
    const combinations = this.generateGridCombinations(task.parameterRange);
    task.progress.total = combinations.length;

    console.log(`开始网格搜索，共 ${combinations.length} 个参数组合`);

    for (let i = 0; i < combinations.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      const combination = combinations[i];
      
      try {
        const result = await this.evaluateCombination(combination, task.config);
        task.results.push(result);
        
        // 按目标值排序，保持最优结果在前
        task.results.sort((a, b) => this.compareResults(a, b, task.config.objective));
        
        // 更新进度
        task.progress.current = i + 1;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);
        
        // 发送进度更新
        this.notifyProgress(task);
        
        console.log(`完成第 ${i + 1}/${combinations.length} 个组合，目标值: ${result.objectiveValue.toFixed(4)}`);
        
        // 添加延迟以避免过度请求
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`参数组合 ${combination.id} 评估失败:`, error);
        // 继续下一个组合
      }
    }
  }

  /**
   * 执行贝叶斯优化（简化版本）
   */
  private async executeBayesianOptimization(task: OptimizationTask) {
    // 这里实现一个简化的贝叶斯优化
    // 在实际项目中，可能需要使用专门的贝叶斯优化库
    
    const maxIterations = task.config.constraints.searchConstraints.maxIterations;
    const initialSamples = Math.min(10, maxIterations * 0.2); // 初始随机采样20%
    
    task.progress.total = maxIterations;
    
    // 阶段1：随机采样初始点
    console.log(`贝叶斯优化：随机采样 ${initialSamples} 个初始点`);
    for (let i = 0; i < initialSamples; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }
      
      const randomCombination = this.generateRandomCombination(task.parameterRange);
      const result = await this.evaluateCombination(randomCombination, task.config);
      task.results.push(result);
      
      task.progress.current = i + 1;
      task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);
      this.notifyProgress(task);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 阶段2：基于已有结果进行智能搜索
    console.log(`贝叶斯优化：智能搜索剩余 ${maxIterations - initialSamples} 个点`);
    for (let i = initialSamples; i < maxIterations; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }
      
      // 简化的采集函数：在最优结果附近进行搜索
      const nextCombination = this.selectNextCombination(task.results, task.parameterRange);
      const result = await this.evaluateCombination(nextCombination, task.config);
      task.results.push(result);
      
      // 排序结果
      task.results.sort((a, b) => this.compareResults(a, b, task.config.objective));
      
      task.progress.current = i + 1;
      task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);
      this.notifyProgress(task);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 执行混合优化
   */
  private async executeHybridOptimization(task: OptimizationTask) {
    // 阶段1：粗糙网格搜索（探索）
    console.log('混合优化阶段1：粗糙网格搜索');
    const coarseGrid = this.generateCoarseGridCombinations(task.parameterRange);
    console.log(`生成了 ${coarseGrid.length} 个粗糙网格组合`);
    
    const phase1Total = Math.min(coarseGrid.length, 50); // 限制第一阶段的搜索数量
    console.log(`阶段1将测试 ${phase1Total} 个组合`);
    
    task.progress.total = phase1Total + task.config.constraints.searchConstraints.maxIterations;
    
    for (let i = 0; i < phase1Total; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }
      
      const combination = coarseGrid[i];
      console.log(`测试组合 ${i + 1}/${phase1Total}:`, combination);
      
      try {
        const result = await this.evaluateCombination(combination, task.config);
        task.results.push(result);
        console.log(`组合 ${i + 1} 完成，目标值: ${result.objectiveValue.toFixed(4)}`);
      } catch (error) {
        console.error(`组合 ${i + 1} 评估失败:`, error);
        // 继续下一个组合而不是中断整个过程
        continue;
      }
      
      task.progress.current = i + 1;
      task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);
      this.notifyProgress(task);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 排序第一阶段结果
    task.results.sort((a, b) => this.compareResults(a, b, task.config.objective));
    
    // 阶段2：在有希望的区域进行精细搜索
    console.log('混合优化阶段2：精细搜索');
    const remainingIterations = task.config.constraints.searchConstraints.maxIterations;
    
    for (let i = 0; i < remainingIterations; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }
      
      const nextCombination = this.selectNextCombination(task.results, task.parameterRange);
      const result = await this.evaluateCombination(nextCombination, task.config);
      task.results.push(result);
      
      task.results.sort((a, b) => this.compareResults(a, b, task.config.objective));
      
      task.progress.current = phase1Total + i + 1;
      task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);
      this.notifyProgress(task);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 评估参数组合
   */
  private async evaluateCombination(
    combination: ParameterCombination,
    config: OptimizationConfig
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    console.log('开始评估组合:', combination.id);
    
    // 构建完整的策略参数
    const strategyParams: BTCDOM2StrategyParams = {
      ...config.baseParams,
      priceChangeWeight: combination.priceChangeWeight,
      volumeWeight: combination.volumeWeight,
      volatilityWeight: combination.volatilityWeight,
      fundingRateWeight: combination.fundingRateWeight,
      maxShortPositions: combination.maxShortPositions,
      maxSinglePositionRatio: combination.maxSinglePositionRatio,
      allocationStrategy: combination.allocationStrategy,
      // 确保必要的字段有默认值
      granularityHours: config.baseParams.granularityHours || 8
    };
    
    console.log('调用回测API，参数:', strategyParams);
    
    // 调用回测API
    const response = await fetch('/api/btcdom2/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategyParams)
    });
    
    console.log('API响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API响应错误:', errorText);
      throw new Error(`回测API调用失败: ${response.statusText}`);
    }
    
    const apiResponse = await response.json();
    console.log('API响应结构:', {
      success: apiResponse.success,
      hasData: !!apiResponse.data,
      error: apiResponse.error
    });
    
    // 检查API响应格式
    if (!apiResponse.success || !apiResponse.data) {
      throw new Error(`回测API返回错误: ${apiResponse.error || '未知错误'}`);
    }
    
    const backtestResult: BTCDOM2BacktestResult = apiResponse.data;
    const executionTime = Date.now() - startTime;
    
    console.log(`组合 ${combination.id} API调用完成，耗时: ${executionTime}ms`);
    
    // 计算目标函数值
    const objectiveValue = this.calculateObjectiveValue(backtestResult, config.objective);
    
    // 计算额外指标
    const metrics = this.calculateMetrics(backtestResult);
    
    return {
      combination,
      backtestResult,
      objectiveValue,
      metrics,
      executionTime
    };
  }

  /**
   * 计算目标函数值
   */
  private calculateObjectiveValue(
    result: BTCDOM2BacktestResult,
    objective: OptimizationObjective
  ): number {
    const performance = result.performance;
    
    switch (objective) {
      case OptimizationObjective.MAXIMIZE_TOTAL_RETURN:
        return performance.totalReturn;
        
      case OptimizationObjective.MAXIMIZE_SHARPE_RATIO:
        return performance.sharpeRatio || 0;
        
      case OptimizationObjective.MAXIMIZE_CALMAR_RATIO:
        return performance.calmarRatio || 0;
        
      case OptimizationObjective.MINIMIZE_MAX_DRAWDOWN:
        return -performance.maxDrawdown; // 负号因为要最小化
        
      case OptimizationObjective.MAXIMIZE_RISK_ADJUSTED_RETURN:
        // 风险调整收益 = 总收益 / 最大回撤
        return performance.maxDrawdown > 0 
          ? performance.totalReturn / performance.maxDrawdown 
          : performance.totalReturn;
          
      default:
        return performance.totalReturn;
    }
  }

  /**
   * 计算额外指标
   */
  private calculateMetrics(result: BTCDOM2BacktestResult) {
    const performance = result.performance;
    
    return {
      totalReturn: performance.totalReturn,
      sharpeRatio: performance.sharpeRatio || 0,
      calmarRatio: performance.calmarRatio || 0,
      maxDrawdown: performance.maxDrawdown,
      volatility: performance.volatility || 0,
      winRate: performance.winRate || 0
    };
  }

  /**
   * 生成网格搜索的参数组合
   */
  private generateGridCombinations(range: ParameterRange): ParameterCombination[] {
    const combinations: ParameterCombination[] = [];
    
    // 生成权重组合（确保总和为1）
    const weightCombinations = this.generateWeightCombinations();
    
    // 生成其他参数组合
    const maxShortPositionsValues = this.generateRange(
      range.maxShortPositions.min,
      range.maxShortPositions.max,
      range.maxShortPositions.step
    );
    
    const maxSinglePositionRatioValues = this.generateRange(
      range.maxSinglePositionRatio.min,
      range.maxSinglePositionRatio.max,
      range.maxSinglePositionRatio.step
    );
    
    // 组合所有参数
    let id = 1;
    for (const weights of weightCombinations) {
      for (const maxShortPositions of maxShortPositionsValues) {
        for (const maxSinglePositionRatio of maxSinglePositionRatioValues) {
          for (const allocationStrategy of range.allocationStrategies) {
            combinations.push({
              id: `grid_${id++}`,
              ...weights,
              maxShortPositions,
              maxSinglePositionRatio,
              allocationStrategy
            });
          }
        }
      }
    }
    
    return combinations;
  }

  /**
   * 生成权重组合（确保总和为1）
   */
  private generateWeightCombinations() {
    const combinations: Array<{
      priceChangeWeight: number;
      volumeWeight: number;
      volatilityWeight: number;
      fundingRateWeight: number;
    }> = [];
    
    const step = 0.1; // 10%步长
    
    for (let pc = 0; pc <= 1; pc += step) {
      for (let vol = 0; vol <= 1 - pc; vol += step) {
        for (let vlt = 0; vlt <= 1 - pc - vol; vlt += step) {
          const fr = 1 - pc - vol - vlt;
          
          // 检查权重是否在有效范围内
          if (fr >= 0 && fr <= 1 && Math.abs(pc + vol + vlt + fr - 1) < 0.001) {
            combinations.push({
              priceChangeWeight: Math.round(pc * 10) / 10,
              volumeWeight: Math.round(vol * 10) / 10,
              volatilityWeight: Math.round(vlt * 10) / 10,
              fundingRateWeight: Math.round(fr * 10) / 10
            });
          }
        }
      }
    }
    
    return combinations;
  }

  /**
   * 生成粗糙网格组合（用于混合优化第一阶段）
   */
  private generateCoarseGridCombinations(range: ParameterRange): ParameterCombination[] {
    // 使用更大的步长生成粗糙网格
    const coarseWeightStep = 0.2; // 20%步长
    const combinations: ParameterCombination[] = [];
    
    console.log('开始生成粗糙网格组合...');
    console.log('参数范围:', range);
    
    let id = 1;
    for (let pc = 0; pc <= 1; pc += coarseWeightStep) {
      for (let vol = 0; vol <= 1 - pc; vol += coarseWeightStep) {
        for (let vlt = 0; vlt <= 1 - pc - vol; vlt += coarseWeightStep) {
          const fr = 1 - pc - vol - vlt;
          
          // 检查权重是否在有效范围内并且总和为1
          if (fr >= 0 && fr <= 1 && Math.abs(pc + vol + vlt + fr - 1) < 0.001) {
            // 只使用中等值的其他参数
            const maxShortPositions = Math.round((range.maxShortPositions.min + range.maxShortPositions.max) / 2);
            const maxSinglePositionRatio = (range.maxSinglePositionRatio.min + range.maxSinglePositionRatio.max) / 2;
            
            for (const allocationStrategy of range.allocationStrategies) {
              const combination = {
                id: `coarse_${id++}`,
                priceChangeWeight: Math.round(pc * 10) / 10,
                volumeWeight: Math.round(vol * 10) / 10,
                volatilityWeight: Math.round(vlt * 10) / 10,
                fundingRateWeight: Math.round(fr * 10) / 10,
                maxShortPositions,
                maxSinglePositionRatio: Math.round(maxSinglePositionRatio * 100) / 100,
                allocationStrategy
              };
              
              // 验证权重总和
              const weightSum = combination.priceChangeWeight + combination.volumeWeight + 
                               combination.volatilityWeight + combination.fundingRateWeight;
              
              // 如果权重总和不等于1，进行微调
              if (Math.abs(weightSum - 1) > 0.001) {
                const diff = 1 - weightSum;
                // 调整资金费率权重（通常最灵活）
                combination.fundingRateWeight = Math.round((combination.fundingRateWeight + diff) * 10) / 10;
                
                // 确保调整后的权重非负
                if (combination.fundingRateWeight < 0) {
                  combination.fundingRateWeight = 0;
                  // 重新计算并分配到最大的权重上
                  const newSum = combination.priceChangeWeight + combination.volumeWeight + combination.volatilityWeight;
                  const remaining = 1 - newSum;
                  const weights = [combination.priceChangeWeight, combination.volumeWeight, combination.volatilityWeight];
                  const maxIndex = weights.indexOf(Math.max(...weights));
                  
                  if (maxIndex === 0) {
                    combination.priceChangeWeight = Math.round((combination.priceChangeWeight + remaining) * 10) / 10;
                  } else if (maxIndex === 1) {
                    combination.volumeWeight = Math.round((combination.volumeWeight + remaining) * 10) / 10;
                  } else {
                    combination.volatilityWeight = Math.round((combination.volatilityWeight + remaining) * 10) / 10;
                  }
                }
              }
              
              combinations.push(combination);
            }
          }
        }
      }
    }
    
    console.log(`粗糙网格生成完成，共 ${combinations.length} 个组合`);
    
    // 验证所有组合的权重总和
    combinations.forEach((combo, index) => {
      const sum = combo.priceChangeWeight + combo.volumeWeight + combo.volatilityWeight + combo.fundingRateWeight;
      if (Math.abs(sum - 1) > 0.001) {
        console.warn(`组合 ${index + 1} 权重总和异常: ${sum}`, combo);
      }
    });
    
    return combinations;
  }

  /**
   * 生成随机参数组合
   */
  private generateRandomCombination(range: ParameterRange): ParameterCombination {
    // 随机生成权重（确保总和为1）
    const weights = this.generateRandomWeights();
    
    // 随机生成其他参数
    const maxShortPositions = Math.round(
      range.maxShortPositions.min + 
      Math.random() * (range.maxShortPositions.max - range.maxShortPositions.min)
    );
    
    const maxSinglePositionRatio = Math.round(
      (range.maxSinglePositionRatio.min + 
       Math.random() * (range.maxSinglePositionRatio.max - range.maxSinglePositionRatio.min)) * 100
    ) / 100;
    
    const allocationStrategy = range.allocationStrategies[
      Math.floor(Math.random() * range.allocationStrategies.length)
    ];
    
    return {
      id: `random_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...weights,
      maxShortPositions,
      maxSinglePositionRatio,
      allocationStrategy
    };
  }

  /**
   * 随机生成权重（总和为1）
   */
  private generateRandomWeights() {
    // 使用Dirichlet分布的简化版本
    const alpha = [1, 1, 1, 1]; // 均匀分布参数
    const samples = alpha.map(() => -Math.log(Math.random()));
    const sum = samples.reduce((a, b) => a + b, 0);
    
    // 先计算原始权重
    const rawWeights = [
      samples[0] / sum,
      samples[1] / sum,
      samples[2] / sum,
      samples[3] / sum
    ];
    
    // 四舍五入到0.1精度
    let roundedWeights = rawWeights.map(w => Math.round(w * 10) / 10);
    
    // 确保权重总和为1
    const currentSum = roundedWeights.reduce((a, b) => a + b, 0);
    const diff = 1 - currentSum;
    
    // 如果有差异，调整最大的权重
    if (Math.abs(diff) > 0.001) {
      const maxIndex = roundedWeights.indexOf(Math.max(...roundedWeights));
      roundedWeights[maxIndex] = Math.round((roundedWeights[maxIndex] + diff) * 10) / 10;
      
      // 确保调整后的权重不为负
      if (roundedWeights[maxIndex] < 0) {
        roundedWeights[maxIndex] = 0;
        // 重新分配权重
        const remaining = 1 - roundedWeights.reduce((sum, w, i) => i === maxIndex ? sum : sum + w, 0);
        const nonZeroCount = roundedWeights.filter((w, i) => i !== maxIndex && w > 0).length;
        if (nonZeroCount > 0) {
          roundedWeights.forEach((w, i) => {
            if (i !== maxIndex && w > 0) {
              roundedWeights[i] = Math.round((remaining / nonZeroCount) * 10) / 10;
            }
          });
        }
      }
    }
    
    return {
      priceChangeWeight: roundedWeights[0],
      volumeWeight: roundedWeights[1],
      volatilityWeight: roundedWeights[2],
      fundingRateWeight: roundedWeights[3]
    };
  }

  /**
   * 选择下一个搜索点（贝叶斯优化的简化采集函数）
   */
  private selectNextCombination(
    existingResults: OptimizationResult[],
    range: ParameterRange
  ): ParameterCombination {
    if (existingResults.length === 0) {
      return this.generateRandomCombination(range);
    }
    
    // 获取前几个最优结果
    const topResults = existingResults.slice(0, Math.min(3, existingResults.length));
    
    // 在最优结果附近进行扰动搜索
    const baseResult = topResults[Math.floor(Math.random() * topResults.length)];
    const baseCombination = baseResult.combination;
    
    // 生成扰动
    const perturbationScale = 0.1; // 10%的扰动幅度
    
    // 扰动权重
    const perturbedWeights = this.perturbWeights(
      {
        priceChangeWeight: baseCombination.priceChangeWeight,
        volumeWeight: baseCombination.volumeWeight,
        volatilityWeight: baseCombination.volatilityWeight,
        fundingRateWeight: baseCombination.fundingRateWeight
      },
      perturbationScale
    );
    
    // 验证权重总和
    const weightSum = perturbedWeights.priceChangeWeight + perturbedWeights.volumeWeight + 
                     perturbedWeights.volatilityWeight + perturbedWeights.fundingRateWeight;
    
    console.log('贝叶斯优化扰动权重:', perturbedWeights, '总和:', weightSum);
    
    // 如果权重总和不为1，重新生成一个随机组合
    if (Math.abs(weightSum - 1) > 0.001) {
      console.warn('权重总和异常，重新生成随机组合');
      return this.generateRandomCombination(range);
    }
    
    // 扰动其他参数
    const maxShortPositions = Math.max(
      range.maxShortPositions.min,
      Math.min(
        range.maxShortPositions.max,
        Math.round(baseCombination.maxShortPositions + (Math.random() - 0.5) * 4)
      )
    );
    
    const maxSinglePositionRatio = Math.max(
      range.maxSinglePositionRatio.min,
      Math.min(
        range.maxSinglePositionRatio.max,
        Math.round((baseCombination.maxSinglePositionRatio + (Math.random() - 0.5) * 0.1) * 100) / 100
      )
    );
    
    // 随机选择配置策略
    const allocationStrategy = Math.random() < 0.7 
      ? baseCombination.allocationStrategy 
      : range.allocationStrategies[Math.floor(Math.random() * range.allocationStrategies.length)];
    
    const finalCombination = {
      id: `bayesian_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...perturbedWeights,
      maxShortPositions,
      maxSinglePositionRatio,
      allocationStrategy
    };
    
    // 最终验证
    const finalSum = finalCombination.priceChangeWeight + finalCombination.volumeWeight + 
                    finalCombination.volatilityWeight + finalCombination.fundingRateWeight;
    console.log('最终组合权重总和:', finalSum, finalCombination);
    
    return finalCombination;
  }

  /**
   * 扰动权重（保持总和为1）
   */
  private perturbWeights(
    weights: {
      priceChangeWeight: number;
      volumeWeight: number;
      volatilityWeight: number;
      fundingRateWeight: number;
    },
    scale: number
  ) {
    // 使用Dirichlet扰动方法，确保权重总和为1
    const baseWeights = [weights.priceChangeWeight, weights.volumeWeight, weights.volatilityWeight, weights.fundingRateWeight];
    
    // 转换为Dirichlet参数（加上小的扰动）
    const alpha = baseWeights.map(w => Math.max(0.1, w * 10 + (Math.random() - 0.5) * scale * 10));
    
    // 生成Dirichlet分布样本
    const samples = alpha.map(a => {
      // 使用Gamma分布近似
      let sample = 0;
      for (let i = 0; i < Math.round(a); i++) {
        sample += -Math.log(Math.random());
      }
      return sample;
    });
    
    const sum = samples.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      // fallback to uniform distribution
      return {
        priceChangeWeight: 0.25,
        volumeWeight: 0.25,
        volatilityWeight: 0.25,
        fundingRateWeight: 0.25
      };
    }
    
    // 标准化并四舍五入
    let normalizedWeights = samples.map(s => Math.round((s / sum) * 10) / 10);
    
    // 确保总和为1的最终调整
    const currentSum = normalizedWeights.reduce((a, b) => a + b, 0);
    const diff = Math.round((1 - currentSum) * 10) / 10;
    
    if (Math.abs(diff) > 0) {
      // 找到最大的权重进行调整
      const maxIndex = normalizedWeights.indexOf(Math.max(...normalizedWeights));
      normalizedWeights[maxIndex] = Math.round((normalizedWeights[maxIndex] + diff) * 10) / 10;
      
      // 确保调整后的权重不为负
      if (normalizedWeights[maxIndex] < 0) {
        normalizedWeights[maxIndex] = 0;
        // 重新分配剩余权重
        const remaining = 1;
        const otherIndices = [0, 1, 2, 3].filter(i => i !== maxIndex);
        const remainingSum = otherIndices.reduce((sum, i) => sum + normalizedWeights[i], 0);
        
        if (remainingSum > 0) {
          otherIndices.forEach(i => {
            normalizedWeights[i] = Math.round((normalizedWeights[i] / remainingSum) * 10) / 10;
          });
        } else {
          // 平均分配给其他权重
          otherIndices.forEach(i => {
            normalizedWeights[i] = Math.round((1 / otherIndices.length) * 10) / 10;
          });
        }
        
        // 最终微调
        const finalSum = normalizedWeights.reduce((a, b) => a + b, 0);
        const finalDiff = Math.round((1 - finalSum) * 10) / 10;
        if (Math.abs(finalDiff) > 0) {
          const adjustIndex = otherIndices[0];
          normalizedWeights[adjustIndex] = Math.round((normalizedWeights[adjustIndex] + finalDiff) * 10) / 10;
        }
      }
    }
    
    return {
      priceChangeWeight: normalizedWeights[0],
      volumeWeight: normalizedWeights[1],
      volatilityWeight: normalizedWeights[2],
      fundingRateWeight: normalizedWeights[3]
    };
  }

  /**
   * 比较两个结果（用于排序）
   */
  private compareResults(
    a: OptimizationResult,
    b: OptimizationResult,
    objective: OptimizationObjective
  ): number {
    // 对于最大化目标，返回 b - a（降序）
    // 对于最小化目标，返回 a - b（升序）
    if (objective === OptimizationObjective.MINIMIZE_MAX_DRAWDOWN) {
      return a.objectiveValue - b.objectiveValue;
    } else {
      return b.objectiveValue - a.objectiveValue;
    }
  }

  /**
   * 生成数值范围
   */
  private generateRange(min: number, max: number, step: number): number[] {
    const values: number[] = [];
    for (let value = min; value <= max; value += step) {
      values.push(Math.round(value * 100) / 100); // 保留两位小数
    }
    return values;
  }

  /**
   * 发送进度通知
   */
  private notifyProgress(task: OptimizationTask) {
    if (!this.progressCallback) return;
    
    const progress: OptimizationProgress = {
      taskId: task.id,
      status: task.status,
      currentIteration: task.progress.current,
      totalIterations: task.progress.total,
      currentBest: task.results.length > 0 ? task.results[0] : null,
      recentResults: task.results.slice(0, 5),
      estimatedTimeRemaining: this.estimateTimeRemaining(task),
      resourceUsage: {
        cpuUsage: 0, // 在前端环境中难以准确测量
        memoryUsage: 0
      }
    };
    
    this.progressCallback(progress);
  }

  /**
   * 估算剩余时间
   */
  private estimateTimeRemaining(task: OptimizationTask): number {
    if (task.progress.current === 0 || !task.startTime) return 0;
    
    const elapsed = (Date.now() - task.startTime.getTime()) / 1000; // 秒
    const averageTimePerIteration = elapsed / task.progress.current;
    const remaining = task.progress.total - task.progress.current;
    
    return Math.round(averageTimePerIteration * remaining);
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 验证参数组合
   */
  validateParameters(combination: ParameterCombination): ParameterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 验证权重总和
    const weightSum = combination.priceChangeWeight + combination.volumeWeight + 
                     combination.volatilityWeight + combination.fundingRateWeight;
    
    if (Math.abs(weightSum - 1) > 0.001) {
      errors.push(`权重总和必须为1，当前为 ${weightSum.toFixed(3)}`);
    }
    
    // 验证权重范围
    const weights = [
      { name: '跌幅权重', value: combination.priceChangeWeight },
      { name: '成交量权重', value: combination.volumeWeight },
      { name: '波动率权重', value: combination.volatilityWeight },
      { name: '资金费率权重', value: combination.fundingRateWeight }
    ];
    
    weights.forEach(weight => {
      if (weight.value < 0 || weight.value > 1) {
        errors.push(`${weight.name}必须在0-1之间，当前为 ${weight.value}`);
      }
    });
    
    // 验证其他参数
    if (combination.maxShortPositions < 1 || combination.maxShortPositions > 50) {
      errors.push(`最多做空标的数量必须在1-50之间，当前为 ${combination.maxShortPositions}`);
    }
    
    if (combination.maxSinglePositionRatio < 0.01 || combination.maxSinglePositionRatio > 1) {
      errors.push(`单币种持仓限制必须在0.01-1之间，当前为 ${combination.maxSinglePositionRatio}`);
    }
    
    // 发出警告
    if (combination.priceChangeWeight < 0.1) {
      warnings.push('跌幅权重过低可能影响做空策略效果');
    }
    
    if (combination.fundingRateWeight < 0.1) {
      warnings.push('资金费率权重过低可能影响做空成本控制');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedParams: errors.length === 0 ? combination : undefined
    };
  }

  /**
   * 生成优化报告
   */
  generateReport(task: OptimizationTask): OptimizationReport {
    if (!task.results || task.results.length === 0) {
      throw new Error('没有可用的优化结果');
    }

    const results = task.results;
    const bestResult = results[0];
    
    // 计算执行时间统计
    const executionTimes = results.map(r => r.executionTime);
    const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const totalOptimizationTime = task.endTime && task.startTime 
      ? (task.endTime.getTime() - task.startTime.getTime()) / 1000 
      : 0;

    // 参数敏感性分析
    const sensitivityAnalysis = this.calculateParameterSensitivity(results);
    
    // 性能分布统计
    const performanceDistribution = this.calculatePerformanceDistribution(results);
    
    // 最优参数区域分析
    const optimalRegions = this.identifyOptimalRegions(results);

    return {
      taskId: task.id,
      summary: {
        bestResult,
        totalCombinations: results.length,
        successfulCombinations: results.length,
        averageExecutionTime,
        totalOptimizationTime
      },
      sensitivityAnalysis,
      performanceDistribution,
      optimalRegions
    };
  }

  /**
   * 计算参数敏感性
   */
  private calculateParameterSensitivity(results: OptimizationResult[]) {
    const parameters = [
      'priceChangeWeight', 'volumeWeight', 'volatilityWeight', 'fundingRateWeight',
      'maxShortPositions', 'maxSinglePositionRatio'
    ];

    return parameters.map(paramName => {
      const values = results.map(r => {
        const combination = r.combination as unknown as Record<string, number>;
        return combination[paramName] || 0;
      });
      const objectives = results.map(r => r.objectiveValue);
      
      const correlation = this.calculateCorrelation(values, objectives);
      const importance = Math.abs(correlation);

      return {
        parameterName: paramName,
        correlation,
        importance
      };
    }).sort((a, b) => b.importance - a.importance);
  }

  /**
   * 计算相关系数
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      denomX += deltaX * deltaX;
      denomY += deltaY * deltaY;
    }

    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 计算性能分布
   */
  private calculatePerformanceDistribution(results: OptimizationResult[]) {
    const totalReturns = results.map(r => r.metrics.totalReturn);
    const sharpeRatios = results.map(r => r.metrics.sharpeRatio);
    const maxDrawdowns = results.map(r => r.metrics.maxDrawdown);

    const calcStats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean,
        std
      };
    };

    return {
      totalReturn: calcStats(totalReturns),
      sharpeRatio: calcStats(sharpeRatios),
      maxDrawdown: calcStats(maxDrawdowns)
    };
  }

  /**
   * 识别最优参数区域
   */
  private identifyOptimalRegions(results: OptimizationResult[]) {
    // 取前20%的最优结果来分析最优区域
    const topResults = results.slice(0, Math.max(1, Math.floor(results.length * 0.2)));
    
    const parameters = [
      { name: 'priceChangeWeight', key: 'priceChangeWeight' },
      { name: 'volumeWeight', key: 'volumeWeight' },
      { name: 'volatilityWeight', key: 'volatilityWeight' },
      { name: 'fundingRateWeight', key: 'fundingRateWeight' },
      { name: 'maxShortPositions', key: 'maxShortPositions' },
      { name: 'maxSinglePositionRatio', key: 'maxSinglePositionRatio' }
    ];

    return parameters.map(param => {
      const values = topResults.map(r => {
        const combination = r.combination as unknown as Record<string, number>;
        return combination[param.key] || 0;
      });

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      const confidence = range === 0 ? 1.0 : Math.max(0.1, 1 - (range / (max + 0.001))); // 简化的置信度计算

      return {
        parameterName: param.name,
        optimalRange: { min, max },
        confidence
      };
    });
  }

  /**
   * 导出优化结果为JSON
   */
  exportResults(task: OptimizationTask): string {
    const exportData = {
      taskInfo: {
        id: task.id,
        status: task.status,
        startTime: task.startTime,
        endTime: task.endTime,
        config: task.config,
        parameterRange: task.parameterRange
      },
      results: task.results.slice(0, 50), // 只导出前50个结果
      summary: {
        totalCombinations: task.results.length,
        bestObjectiveValue: task.results[0]?.objectiveValue || 0,
        bestParameters: task.results[0]?.combination || null
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 从JSON导入优化结果
   */
  importResults(jsonData: string): OptimizationTask {
    try {
      const data = JSON.parse(jsonData);
      
      const task: OptimizationTask = {
        id: data.taskInfo.id || this.generateTaskId(),
        config: data.taskInfo.config,
        parameterRange: data.taskInfo.parameterRange,
        status: OptimizationStatus.COMPLETED,
        progress: { 
          current: data.results.length, 
          total: data.results.length, 
          percentage: 100 
        },
        results: data.results || [],
        startTime: data.taskInfo.startTime ? new Date(data.taskInfo.startTime) : undefined,
        endTime: data.taskInfo.endTime ? new Date(data.taskInfo.endTime) : undefined
      };

      return task;
    } catch (error) {
      throw new Error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取推荐的参数配置
   */
  getRecommendedConfig(): { config: OptimizationConfig; parameterRange: ParameterRange } {
    return {
      config: {
        baseParams: {
          startDate: '2025-01-01',
          endDate: '2025-06-18',
          initialCapital: 10000,
          btcRatio: 0.5,
          spotTradingFeeRate: 0.0008,
          futuresTradingFeeRate: 0.0002,
          longBtc: true,
          shortAlt: true,
          granularityHours: 8
        },
        objective: OptimizationObjective.MAXIMIZE_RISK_ADJUSTED_RETURN,
        method: OptimizationMethod.HYBRID,
        constraints: {
          weightConstraints: {
            sumToOne: true,
            minWeight: 0,
            maxWeight: 0.8
          },
          searchConstraints: {
            maxIterations: 100,
            timeoutMinutes: 30
          }
        }
      },
      parameterRange: {
        weights: {
          priceChangeWeight: { min: 0.1, max: 0.7, step: 0.1 },
          volumeWeight: { min: 0.1, max: 0.5, step: 0.1 },
          volatilityWeight: { min: 0, max: 0.3, step: 0.1 },
          fundingRateWeight: { min: 0.1, max: 0.6, step: 0.1 }
        },
        maxShortPositions: { min: 8, max: 15, step: 1 },
        maxSinglePositionRatio: { min: 0.15, max: 0.25, step: 0.05 },
        allocationStrategies: [
          PositionAllocationStrategy.BY_VOLUME,
          PositionAllocationStrategy.BY_COMPOSITE_SCORE
        ]
      }
    };
  }
}