import {
  OptimizationConfig,
  OptimizationResult,
  OptimizationTask,
  OptimizationProgress,
  OptimizationReport,
  ParameterCombination,
  ParameterRange,
  OptimizationObjective,

  ParameterValidationResult
} from './types';
import { PositionAllocationStrategy, BTCDOM2StrategyParams, BTCDOM2BacktestResult } from '@/types/btcdom2';

export class ParameterOptimizer {
  private static readonly MAX_RESULTS_TO_KEEP = 10; // 只保留最优的10个结果
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
  ): Promise<OptimizationResult[]> {
    // 取消之前的任务
    this.cancelOptimization();

    // 创建新的AbortController
    this.abortController = new AbortController();

    // 创建新任务
    this.currentTask = {
      id: this.generateTaskId(),
      config,
      parameterRange,
      status: 'running',
      results: [],
      progress: {
        current: 0,
        total: 0,
        percentage: 0
      },
      startTime: Date.now(),
      endTime: null
    };

    try {
      // 根据方法执行不同的优化策略
      await this.executeOptimization();

      this.currentTask.status = 'completed';
      this.currentTask.endTime = Date.now();

      return this.currentTask.results;
    } catch (error) {
      if (this.currentTask) {
        this.currentTask.status = 'failed';
        this.currentTask.endTime = Date.now();
      }
      throw error;
    }
  }

  /**
   * 取消优化任务
   */
  cancelOptimization() {
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.currentTask) {
      this.currentTask.status = 'cancelled';
      this.currentTask.endTime = Date.now();
    }
  }

  /**
   * 执行优化
   */
  private async executeOptimization() {
    if (!this.currentTask) return;

    const task = this.currentTask;

    switch (task.config.method) {
      case 'grid':
        await this.executeGridSearch(task);
        break;
      case 'bayesian':
        await this.executeBayesianOptimization(task);
        break;
      case 'hybrid':
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
    const allCombinations = this.generateGridCombinations(task.parameterRange);

    console.log(`网格搜索: 总组合 ${allCombinations.length}`);

    task.progress.total = allCombinations.length;
    task.progress.current = 0;

    let validEvaluations = 0;

    for (let i = 0; i < allCombinations.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      const combination = allCombinations[i];

      try {
        const result = await this.evaluateCombination(combination, task.config);

        if (result !== null) {
          this.updateTaskResults(task, result);
          validEvaluations++;
          console.log(`网格搜索: ${validEvaluations}个有效结果, 当前处理: ${i + 1}/${allCombinations.length}`);
        } else {
          console.log(`网格搜索: 跳过无效组合 ${i + 1}, 继续处理`);
        }

        // 更新进度
        task.progress.current = i + 1;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);

        // 通知进度更新
        this.notifyProgress(task);
      } catch (error) {
        console.error(`组合 ${i + 1} 评估失败:`, error);
        // 继续处理下一个组合，但仍然更新进度
        task.progress.current = i + 1;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);
        this.notifyProgress(task);
      }
    }
  }

  /**
   * 执行贝叶斯优化
   */
  private async executeBayesianOptimization(task: OptimizationTask) {
    const maxIterations = task.config.maxIterations || 50;
    const initialSamples = Math.min(10, maxIterations);

    task.progress.total = maxIterations;
    task.progress.current = 0;

    let validEvaluations = 0;

    // 第一阶段：随机采样
    while (validEvaluations < initialSamples) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      const randomCombination = this.generateRandomCombination(task.parameterRange);
      const result = await this.evaluateCombination(randomCombination, task.config);

      if (result !== null) {
        this.updateTaskResults(task, result);
        validEvaluations++;
        console.log(`初始采样: ${validEvaluations}/${initialSamples}, 目标值: ${result.objectiveValue.toFixed(4)}`);

        // 更新进度
        task.progress.current = validEvaluations;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);

        this.notifyProgress(task);
      } else {
        console.log(`初始采样: 跳过无效组合，继续生成`);
      }
    }

    // 第二阶段：基于采集函数的优化
    while (validEvaluations < maxIterations) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      // 简化的采集函数：在最优结果附近进行搜索
      const nextCombination = this.selectNextCombination(task.results, task.parameterRange);
      const result = await this.evaluateCombination(nextCombination, task.config);

      if (result !== null) {
        this.updateTaskResults(task, result);
        validEvaluations++;
        console.log(`贝叶斯优化: ${validEvaluations}/${maxIterations}, 目标值: ${result.objectiveValue.toFixed(4)}`);

        // 更新进度
        task.progress.current = validEvaluations;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);

        this.notifyProgress(task);
      } else {
        console.log(`贝叶斯优化: 跳过无效组合，继续生成`);
      }
    }
  }

  /**
   * 执行混合优化
   */
  private async executeHybridOptimization(task: OptimizationTask) {
    const maxIterations = task.config.maxIterations || 100;
    const phase1Target = Math.floor(maxIterations * 0.3); // 30%用于粗粒度网格搜索
    const phase2Target = maxIterations - phase1Target; // 70%用于精细化搜索

    task.progress.total = maxIterations;
    task.progress.current = 0;

    console.log(`混合优化开始: 阶段1(粗粒度网格): ${phase1Target}次, 阶段2(精细化): ${phase2Target}次`);

    // 第一阶段：粗粒度网格搜索
    const allCoarseCombinations = this.generateCoarseGridCombinations(task.parameterRange, phase1Target * 2);

    console.log(`生成粗粒度网格组合: 总共 ${allCoarseCombinations.length}个`);

    let validEvaluations = 0;
    let combinationIndex = 0;

    // 第一阶段：确保得到足够的有效评估
    while (validEvaluations < phase1Target && combinationIndex < allCoarseCombinations.length) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      const combination = allCoarseCombinations[combinationIndex];
      combinationIndex++;

      try {
        const result = await this.evaluateCombination(combination, task.config);

        if (result !== null) {
          this.updateTaskResults(task, result);
          validEvaluations++;
          console.log(`阶段1组合 ${validEvaluations} 完成，目标值: ${result.objectiveValue.toFixed(4)}`);

          // 更新进度
          task.progress.current = validEvaluations;
          task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);

          this.notifyProgress(task);

          // 每10个组合输出一次状态
          if (validEvaluations % 10 === 0) {
            const bestSoFar = task.results.length > 0 ? task.results[0].objectiveValue : 0;
            console.log(`阶段1进度: ${validEvaluations}/${phase1Target}, 当前最佳: ${bestSoFar.toFixed(4)}`);
          }
        } else {
          console.log(`阶段1: 跳过无效组合 ${combinationIndex}, 继续处理`);
        }
      } catch (error) {
        console.error(`阶段1组合评估失败:`, error);
      }
    }

    // 如果第一阶段没有达到目标，用随机组合补充
    while (validEvaluations < phase1Target) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      const randomCombination = this.generateRandomCombination(task.parameterRange);
      const result = await this.evaluateCombination(randomCombination, task.config);

      if (result !== null) {
        this.updateTaskResults(task, result);
        validEvaluations++;
        console.log(`阶段1补充: ${validEvaluations}/${phase1Target}, 目标值: ${result.objectiveValue.toFixed(4)}`);

        // 更新进度
        task.progress.current = validEvaluations;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);

        this.notifyProgress(task);
      } else {
        console.log(`阶段1补充: 跳过无效随机组合，继续生成`);
      }
    }

    console.log(`阶段1完成，共完成 ${validEvaluations} 个有效评估`);

    // 第二阶段：在最优结果附近进行精细化搜索
    while (validEvaluations < maxIterations) {
      if (this.abortController?.signal.aborted) {
        throw new Error('优化被用户取消');
      }

      const nextCombination = this.selectNextCombination(task.results, task.parameterRange);
      const result = await this.evaluateCombination(nextCombination, task.config);

      if (result !== null) {
        this.updateTaskResults(task, result);
        validEvaluations++;

        // 更新进度
        task.progress.current = validEvaluations;
        task.progress.percentage = Math.round((task.progress.current / task.progress.total) * 100);

        this.notifyProgress(task);

        if ((validEvaluations - phase1Target) % 10 === 0) {
          const bestSoFar = task.results.length > 0 ? task.results[0].objectiveValue : 0;
          console.log(`阶段2进度: ${validEvaluations - phase1Target}/${phase2Target}, 当前最佳: ${bestSoFar.toFixed(4)}`);
        }
      } else {
        console.log(`阶段2跳过无效组合，继续生成`);
      }
    }

    console.log(`混合优化完成，总共完成 ${validEvaluations} 个有效评估`);
  }

  /**
   * 评估参数组合
   * 
   * 内存优化策略：
   * 1. 不保存完整的 BTCDOM2BacktestResult 对象
   * 2. 立即提取必要的性能指标
   * 3. 显式清理对大型数据的引用
   * 4. 只返回精简的 OptimizationResult
   */
  private async evaluateCombination(
    combination: ParameterCombination,
    config: OptimizationConfig
  ): Promise<OptimizationResult | null> {
    const startTime = Date.now();

    // 预验证参数组合，避免无效的API调用
    const validation = this.validateParameters(combination);
    if (validation.errors.length > 0) {
      console.log(`跳过无效参数组合 ${combination.id}:`, validation.errors);
      return null;
    }

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
    console.log('开始调用回测API...');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API响应错误:', errorText);
      return null; // 返回null而不是抛出错误
    }

    const apiResponse = await response.json();
    console.log('API响应结构:', {
      success: apiResponse.success,
      hasData: !!apiResponse.data,
      error: apiResponse.error
    });

    // 检查API响应格式
    if (!apiResponse.success || !apiResponse.data) {
      console.warn(`回测API返回错误，跳过此组合: ${apiResponse.error || '未知错误'}`);
      return null;
    }

    const backtestData = apiResponse.data;
    const executionTime = Date.now() - startTime;

    console.log(`组合 ${combination.id} API调用完成，耗时: ${executionTime}ms`);

    // 立即提取性能指标，不保存完整的回测结果对象
    const performance = backtestData.performance;
    if (!performance) {
      console.warn(`回测结果缺少性能指标，跳过此组合`);
      return null;
    }

    // 计算目标函数值（直接使用性能数据，不创建完整的 backtestResult 对象）
    let objectiveValue: number;
    switch (config.objective) {
      case 'totalReturn':
        objectiveValue = performance.totalReturn;
        break;
      case 'sharpe':
        objectiveValue = performance.sharpeRatio || 0;
        break;
      case 'calmar':
        objectiveValue = performance.calmarRatio || 0;
        break;
      case 'maxDrawdown':
        objectiveValue = performance.maxDrawdown;
        break;
      case 'composite':
        objectiveValue = (performance.sharpeRatio || 0) * 0.4 +
               performance.totalReturn * 0.3 -
               performance.maxDrawdown * 0.3;
        break;
      default:
        objectiveValue = performance.sharpeRatio || 0;
        break;
    }

    // 只保存必要的性能指标
    const essentialMetrics = {
      totalReturn: performance.totalReturn || 0,
      sharpeRatio: performance.sharpeRatio || 0,
      maxDrawdown: performance.maxDrawdown || 0,
      calmarRatio: performance.calmarRatio || 0,
      winRate: performance.winRate || 0,
    };

    // 显式清理对大型数据的引用
    if (backtestData.snapshots) {
      backtestData.snapshots = null;
    }
    if (backtestData.chartData) {
      backtestData.chartData = null;
    }

    return {
      combination,
      metrics: essentialMetrics,
      objectiveValue,
      executionTime
    };
  }

  /**
   * 生成网格搜索的参数组合
   */
  private generateGridCombinations(range: ParameterRange): ParameterCombination[] {
    const combinations: ParameterCombination[] = [];

    // 生成权重组合
    const weightCombinations = this.generateWeightCombinations();

    // 生成其他参数的组合
    const maxShortPositionsValues = this.generateRange(
      range.maxShortPositions.min,
      range.maxShortPositions.max,
      range.maxShortPositions.step || 1
    );

    const maxSinglePositionRatioValues = this.generateRange(
      range.maxSinglePositionRatio.min,
      range.maxSinglePositionRatio.max,
      range.maxSinglePositionRatio.step || 0.05
    );

    const allocationStrategies = range.allocationStrategy || [PositionAllocationStrategy.EQUAL_ALLOCATION];

    let id = 1;

    for (const weights of weightCombinations) {
      for (const maxShortPositions of maxShortPositionsValues) {
        for (const maxSinglePositionRatio of maxSinglePositionRatioValues) {
          for (const allocationStrategy of allocationStrategies) {
            combinations.push({
              id: `combo_${id++}`,
              ...weights,
              maxShortPositions,
              maxSinglePositionRatio,
              allocationStrategy: allocationStrategy as PositionAllocationStrategy
            });
          }
        }
      }
    }

    return combinations;
  }

  /**
   * 生成权重组合
   */
  private generateWeightCombinations() {
    const combinations = [];
    const step = 0.1; // 10%步长

    for (let pc = 0.1; pc <= 0.7; pc += step) {
      for (let vol = 0.1; vol <= 0.5; vol += step) {
        for (let vlt = 0.1; vlt <= 0.4; vlt += step) {
          const funding = 1 - pc - vol - vlt;

          // 检查资金费率权重是否在合理范围内
          if (funding >= 0.1 && funding <= 0.6) {
            // 确保权重总和严格等于1
            const normalizedFunding = 1 - pc - vol - vlt;

            combinations.push({
              priceChangeWeight: Number(pc.toFixed(3)),
              volumeWeight: Number(vol.toFixed(3)),
              volatilityWeight: Number(vlt.toFixed(3)),
              fundingRateWeight: Number(normalizedFunding.toFixed(3))
            });
          }
        }
      }
    }

    return combinations;
  }

  /**
   * 生成粗粒度网格组合
   */
  private generateCoarseGridCombinations(range: ParameterRange, maxCombinations: number): ParameterCombination[] {
    const combinations: ParameterCombination[] = [];

    // 粗粒度权重组合（更大的步长）
    const coarseWeightCombinations = [];
    const step = 0.2; // 20%步长，更粗粒度

    for (let pc = 0.2; pc <= 0.6; pc += step) {
      for (let vol = 0.1; vol <= 0.3; vol += step) {
        for (let vlt = 0.1; vlt <= 0.3; vlt += step) {
          const funding = 1 - pc - vol - vlt;

          if (funding >= 0.2 && funding <= 0.6 && Math.abs(pc + vol + vlt + funding - 1) < 0.001) {
            coarseWeightCombinations.push({
              priceChangeWeight: Number(pc.toFixed(1)),
              volumeWeight: Number(vol.toFixed(1)),
              volatilityWeight: Number(vlt.toFixed(1)),
              fundingRateWeight: Number(funding.toFixed(1))
            });
          }
        }
      }
    }

    // 其他参数的粗粒度值
    const maxShortPositionsValues = [
      range.maxShortPositions.min,
      Math.floor((range.maxShortPositions.min + range.maxShortPositions.max) / 2),
      range.maxShortPositions.max
    ];

    const maxSinglePositionRatioValues = [
      range.maxSinglePositionRatio.min,
      (range.maxSinglePositionRatio.min + range.maxSinglePositionRatio.max) / 2,
      range.maxSinglePositionRatio.max
    ];

    const allocationStrategies = range.allocationStrategy || [PositionAllocationStrategy.EQUAL_ALLOCATION];

    let id = 1;

    // 生成所有组合
    for (const weights of coarseWeightCombinations) {
      for (const maxShortPositions of maxShortPositionsValues) {
        for (const maxSinglePositionRatio of maxSinglePositionRatioValues) {
          for (const allocationStrategy of allocationStrategies) {
            if (combinations.length >= maxCombinations) {
              return combinations;
            }

            combinations.push({
              id: `coarse_${id++}`,
              ...weights,
              maxShortPositions,
              maxSinglePositionRatio,
              allocationStrategy: allocationStrategy as PositionAllocationStrategy
            });
          }
        }
      }
    }

    return combinations;
  }

  /**
   * 生成随机参数组合
   */
  private generateRandomCombination(range: ParameterRange): ParameterCombination {
    // 生成随机权重
    const weights = this.generateRandomWeights();

    // 生成其他随机参数
    const maxShortPositions = Math.floor(
      Math.random() * (range.maxShortPositions.max - range.maxShortPositions.min + 1) +
      range.maxShortPositions.min
    );

    const maxSinglePositionRatio =
      Math.random() * (range.maxSinglePositionRatio.max - range.maxSinglePositionRatio.min) +
      range.maxSinglePositionRatio.min;

    const allocationStrategies = range.allocationStrategy || [PositionAllocationStrategy.EQUAL_ALLOCATION];
    const allocationStrategy = allocationStrategies[
      Math.floor(Math.random() * allocationStrategies.length)
    ];

    return {
      id: `random_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...weights,
      maxShortPositions,
      maxSinglePositionRatio: Number(maxSinglePositionRatio.toFixed(3)),
      allocationStrategy
    };
  }

  /**
   * 生成随机权重
   */
  private generateRandomWeights() {
    // 使用狄利克雷分布生成随机权重
    const alpha = [2, 1.5, 1, 2.5]; // 偏好参数，影响权重分布
    const samples = [];

    // 生成伽马分布样本
    for (let i = 0; i < alpha.length; i++) {
      samples.push(this.generateGammaSample(alpha[i], 1));
    }

    // 归一化
    const sum = samples.reduce((a, b) => a + b, 0);
    const weights = samples.map(s => s / sum);

    // 确保权重在合理范围内
    const minWeight = 0.05;
    const maxWeight = 0.7;

    const adjustedWeights = weights.map(w => {
      if (w < minWeight) return minWeight;
      if (w > maxWeight) return maxWeight;
      return w;
    });

    // 重新归一化，确保总和严格等于1
    const adjustedSum = adjustedWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = adjustedWeights.map(w => w / adjustedSum);

    // 最终检查和调整，确保总和为1
    const finalSum = normalizedWeights.reduce((a, b) => a + b, 0);
    const diff = 1 - finalSum;
    normalizedWeights[0] += diff; // 将差值加到第一个权重上

    return {
      priceChangeWeight: Number(normalizedWeights[0].toFixed(3)),
      volumeWeight: Number(normalizedWeights[1].toFixed(3)),
      volatilityWeight: Number(normalizedWeights[2].toFixed(3)),
      fundingRateWeight: Number(normalizedWeights[3].toFixed(3))
    };
  }

  /**
   * 生成伽马分布样本（简化版）
   */
  private generateGammaSample(alpha: number, beta: number): number {
    // 简化的伽马分布采样
    if (alpha < 1) {
      return this.generateGammaSample(alpha + 1, beta) * Math.pow(Math.random(), 1 / alpha);
    }

    const d = alpha - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this.generateNormalSample();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v / beta;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v / beta;
      }
    }
  }

  /**
   * 生成标准正态分布样本
   */
  private generateNormalSample(): number {
    // Box-Muller变换
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * 在现有结果基础上选择下一个参数组合
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

    // 生成扰动参数
    const perturbedWeights = this.perturbWeights({
      priceChangeWeight: baseCombination.priceChangeWeight,
      volumeWeight: baseCombination.volumeWeight,
      volatilityWeight: baseCombination.volatilityWeight,
      fundingRateWeight: baseCombination.fundingRateWeight
    });

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
        baseCombination.maxSinglePositionRatio + (Math.random() - 0.5) * 0.2
      )
    );

    return {
      id: `perturbed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...perturbedWeights,
      maxShortPositions,
      maxSinglePositionRatio: Number(maxSinglePositionRatio.toFixed(3)),
      allocationStrategy: baseCombination.allocationStrategy
    };
  }

  /**
   * 扰动权重参数
   */
  private perturbWeights(baseWeights: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
  }) {
    // 生成扰动向量
    const perturbation = [
      (Math.random() - 0.5) * 0.2, // ±10%的扰动
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    ];

    // 应用扰动
    let newWeights = [
      baseWeights.priceChangeWeight + perturbation[0],
      baseWeights.volumeWeight + perturbation[1],
      baseWeights.volatilityWeight + perturbation[2],
      baseWeights.fundingRateWeight + perturbation[3]
    ];

    // 确保权重为正
    newWeights = newWeights.map(w => Math.max(0.05, w));

    // 归一化
    const sum = newWeights.reduce((a, b) => a + b, 0);
    newWeights = newWeights.map(w => w / sum);

    // 确保权重在合理范围内
    const maxWeight = 0.7;
    newWeights = newWeights.map(w => Math.min(maxWeight, w));

    // 重新归一化，确保总和严格等于1
    const finalSum = newWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = newWeights.map(w => w / finalSum);

    // 最终检查和调整
    const checkSum = normalizedWeights.reduce((a, b) => a + b, 0);
    const diff = 1 - checkSum;
    normalizedWeights[0] += diff; // 将差值加到第一个权重上

    return {
      priceChangeWeight: Number(normalizedWeights[0].toFixed(3)),
      volumeWeight: Number(normalizedWeights[1].toFixed(3)),
      volatilityWeight: Number(normalizedWeights[2].toFixed(3)),
      fundingRateWeight: Number(normalizedWeights[3].toFixed(3))
    };
  }

  /**
   * 比较两个优化结果
   */
  private compareResults(a: OptimizationResult, b: OptimizationResult): number {
    // 降序排列，目标值越大越好
    return b.objectiveValue - a.objectiveValue;
  }

  /**
   * 生成数值范围
   */
  private generateRange(min: number, max: number, step: number): number[] {
    const range = [];
    for (let i = min; i <= max; i += step) {
      range.push(Number(i.toFixed(3)));
    }
    return range;
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(task: OptimizationTask) {
    if (!this.progressCallback) return;

    // 记录内存使用情况
    this.logMemoryUsage('进度通知');

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
        memoryUsage: task.results.length * 0.05 // 估算内存使用MB
      }
    };

    this.progressCallback(progress);
  }

  /**
   * 估算剩余时间
   */
  private estimateTimeRemaining(task: OptimizationTask): number {
    if (task.progress.current === 0 || !task.startTime) return 0;

    const elapsed = (Date.now() - task.startTime) / 1000; // 秒
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
   * 更新任务结果，实现滚动窗口保存
   */
  private updateTaskResults(task: OptimizationTask, newResult: OptimizationResult | null) {
    if (newResult === null) {
      return; // 跳过无效结果
    }

    task.results.push(newResult);

    // 按目标值排序，保持最优结果在前
    task.results.sort((a, b) => this.compareResults(a, b));

    // 只保留最好的N个结果，立即清理多余的
    if (task.results.length > ParameterOptimizer.MAX_RESULTS_TO_KEEP) {
      const removedResults = task.results.splice(ParameterOptimizer.MAX_RESULTS_TO_KEEP);

      // 开发环境下记录清理情况
      if (process.env.NODE_ENV === 'development') {
        console.log(`清理了 ${removedResults.length} 个次优结果，保留前 ${ParameterOptimizer.MAX_RESULTS_TO_KEEP} 个`);
      }
    }
  }

  /**
   * 记录内存使用情况
   */
  private logMemoryUsage(context: string) {
    if (process.env.NODE_ENV === 'development' && this.currentTask) {
      const resultCount = this.currentTask.results.length;
      const estimatedMemoryMB = resultCount * 0.01; // 每个精简结果约0.01MB（更准确的估算）

      console.log(`[${context}] 内存使用:`, {
        resultCount,
        estimatedMemoryMB: estimatedMemoryMB.toFixed(2) + ' MB',
        maxResults: ParameterOptimizer.MAX_RESULTS_TO_KEEP
      });
    }
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
      ? (task.endTime! - task.startTime) / 1000
      : 0;

    return {
      taskId: task.id,
      summary: {
        bestResult,
        totalCombinations: results.length,
        successfulCombinations: results.length,
        averageExecutionTime,
        totalOptimizationTime
      },
      sensitivityAnalysis: [],
      performanceDistribution: {
        totalReturn: { min: 0, max: 0, mean: 0, std: 0 },
        sharpeRatio: { min: 0, max: 0, mean: 0, std: 0 },
        maxDrawdown: { min: 0, max: 0, mean: 0, std: 0 }
      },
      optimalRegions: []
    };
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
      results: task.results.slice(0, 10), // 只导出前10个结果
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
        status: 'completed',
        progress: {
          current: data.results.length,
          total: data.results.length,
          percentage: 100
        },
        results: data.results || [],
        startTime: data.taskInfo.startTime || Date.now(),
        endTime: data.taskInfo.endTime || Date.now()
      };

      return task;
    } catch (error) {
      throw new Error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取推荐的优化配置
   */
  getRecommendedConfig(): OptimizationConfig {
    return {
      method: 'hybrid',
      objective: 'sharpe',
      maxIterations: 100,
      convergenceThreshold: 0.001,
      parallelEvaluations: 1,
      timeLimit: 3600,
      populationSize: 20,
      crossoverRate: 0.8,
      mutationRate: 0.1,
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
      }
    };
  }

  /**
   * 清理优化器资源
   */
  dispose() {
    this.cancelOptimization();
    this.progressCallback = undefined;

    if (this.currentTask) {
      // 清理所有结果数据
      this.currentTask.results = [];
      this.currentTask = null;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('ParameterOptimizer 资源已清理');
    }
  }
}
