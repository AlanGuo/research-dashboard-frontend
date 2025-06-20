import { OptimizationResult, ParameterCombination } from './types';
import { PositionAllocationStrategy } from '@/types/btcdom2';

/**
 * 参数优化结果分析工具类
 */
export class OptimizationAnalyzer {
  
  /**
   * 分析参数重要性排名
   */
  static analyzeParameterImportance(results: OptimizationResult[]): ParameterImportanceResult[] {
    if (results.length < 2) return [];

    const parameters = [
      { key: 'priceChangeWeight', name: '跌幅权重' },
      { key: 'volumeWeight', name: '成交量权重' },
      { key: 'volatilityWeight', name: '波动率权重' },
      { key: 'fundingRateWeight', name: '资金费率权重' },
      { key: 'maxShortPositions', name: '最多做空数量' },
      { key: 'maxSinglePositionRatio', name: '单币种限制' }
    ];

    return parameters.map(param => {
      const values = results.map(r => this.getParameterValue(r.combination, param.key));
      const objectives = results.map(r => r.objectiveValue);
      
      const correlation = this.calculateCorrelation(values, objectives);
      const importance = Math.abs(correlation);
      const variability = this.calculateVariability(values);
      
      return {
        parameterKey: param.key,
        parameterName: param.name,
        correlation,
        importance,
        variability,
        optimalRange: this.findOptimalRange(results, param.key),
        recommendations: this.generateParameterRecommendations(param.key, correlation, variability)
      };
    }).sort((a, b) => b.importance - a.importance);
  }

  /**
   * 生成参数热力图数据
   */
  static generateHeatmapData(results: OptimizationResult[], paramX: string, paramY: string): HeatmapDataPoint[] {
    const data: HeatmapDataPoint[] = [];
    
    results.forEach(result => {
      const xValue = this.getParameterValue(result.combination, paramX);
      const yValue = this.getParameterValue(result.combination, paramY);
      
      data.push({
        x: xValue,
        y: yValue,
        value: result.objectiveValue,
        result: result
      });
    });

    return data;
  }

  /**
   * 分析参数组合的聚类
   */
  static analyzeParameterClusters(results: OptimizationResult[], topN: number = 10): ParameterCluster[] {
    const topResults = results.slice(0, topN);
    const clusters: ParameterCluster[] = [];

    // 简化的聚类算法 - 基于权重相似性
    const weightClusters = this.clusterByWeights(topResults);
    
    weightClusters.forEach((cluster, index) => {
      const avgMetrics = this.calculateAverageMetrics(cluster);
      const centroid = this.calculateWeightCentroid(cluster);
      
      clusters.push({
        id: `cluster_${index}`,
        results: cluster,
        centroid,
        averageMetrics: avgMetrics,
        size: cluster.length,
        description: this.generateClusterDescription(centroid)
      });
    });

    return clusters.sort((a, b) => b.averageMetrics.totalReturn - a.averageMetrics.totalReturn);
  }

  /**
   * 生成性能对比图表数据
   */
  static generatePerformanceComparisonData(results: OptimizationResult[]): PerformanceComparisonData {
    return {
      scatterData: results.map((result, index) => ({
        id: result.combination.id,
        x: result.metrics.totalReturn,
        y: result.metrics.maxDrawdown,
        size: result.metrics.sharpeRatio,
        rank: index + 1,
        label: `参数组合 ${index + 1}`,
        result: result
      })),
      
      distributionData: {
        totalReturn: this.generateDistribution(results.map(r => r.metrics.totalReturn)),
        sharpeRatio: this.generateDistribution(results.map(r => r.metrics.sharpeRatio)),
        maxDrawdown: this.generateDistribution(results.map(r => r.metrics.maxDrawdown))
      },
      
      correlationMatrix: this.generateCorrelationMatrix(results)
    };
  }

  /**
   * 分析策略稳定性
   */
  static analyzeStrategyStability(results: OptimizationResult[]): StrategyStabilityAnalysis {
    const topResults = results.slice(0, Math.min(20, results.length));
    
    // 计算性能指标的变异系数
    const returns = topResults.map(r => r.metrics.totalReturn);
    const sharpeRatios = topResults.map(r => r.metrics.sharpeRatio);
    const drawdowns = topResults.map(r => r.metrics.maxDrawdown);
    
    const returnStability = this.calculateStabilityScore(returns);
    const sharpeStability = this.calculateStabilityScore(sharpeRatios);
    const drawdownStability = this.calculateStabilityScore(drawdowns);
    
    // 参数稳定性分析
    const parameterStability = this.analyzeParameterStability(topResults);
    
    return {
      overallScore: (returnStability + sharpeStability + drawdownStability) / 3,
      performanceStability: {
        totalReturn: returnStability,
        sharpeRatio: sharpeStability,
        maxDrawdown: drawdownStability
      },
      parameterStability,
      riskAssessment: this.assessStrategyRisk(topResults),
      recommendations: this.generateStabilityRecommendations(returnStability, parameterStability)
    };
  }

  /**
   * 生成优化建议
   */
  static generateOptimizationRecommendations(results: OptimizationResult[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (results.length === 0) {
      recommendations.push({
        type: 'warning',
        title: '无有效结果',
        description: '优化过程未产生有效结果，建议检查参数范围设置',
        priority: 'high',
        actionItems: ['检查参数约束', '扩大搜索范围', '增加迭代次数']
      });
      return recommendations;
    }

    const bestResult = results[0];
    const importanceAnalysis = this.analyzeParameterImportance(results);
    const stabilityAnalysis = this.analyzeStrategyStability(results);

    // 基于最优参数生成建议
    if (bestResult.metrics.totalReturn < 0) {
      recommendations.push({
        type: 'warning',
        title: '策略收益为负',
        description: '当前最优策略仍为负收益，建议调整策略逻辑或参数范围',
        priority: 'high',
        actionItems: ['重新评估市场环境', '调整权重范围', '考虑其他优化目标']
      });
    }

    // 基于参数重要性生成建议
    const topImportantParam = importanceAnalysis[0];
    if (topImportantParam && topImportantParam.importance > 0.5) {
      recommendations.push({
        type: 'insight',
        title: `${topImportantParam.parameterName}影响显著`,
        description: `${topImportantParam.parameterName}对策略表现影响最大，建议重点关注此参数的调优`,
        priority: 'medium',
        actionItems: [
          `细化${topImportantParam.parameterName}的搜索范围`,
          '考虑动态调整该参数',
          '分析该参数在不同市场条件下的表现'
        ]
      });
    }

    // 基于稳定性分析生成建议
    if (stabilityAnalysis.overallScore < 0.7) {
      recommendations.push({
        type: 'caution',
        title: '策略稳定性较低',
        description: '优化结果显示策略稳定性不足，可能存在过拟合风险',
        priority: 'high',
        actionItems: ['增加样本外验证', '简化参数设置', '考虑正则化约束']
      });
    }

    // 基于权重分布生成建议
    const weightAnalysis = this.analyzeWeightDistribution(results);
    if (weightAnalysis.hasExtremeWeights) {
      recommendations.push({
        type: 'optimization',
        title: '权重分布过于极端',
        description: '发现某些权重经常达到极值，建议适当约束权重范围',
        priority: 'medium',
        actionItems: ['设置权重上下限', '使用权重正则化', '分析极端权重的合理性']
      });
    }

    return recommendations;
  }

  /**
   * 导出优化结果为CSV格式
   */
  static exportToCSV(results: OptimizationResult[]): string {
    const headers = [
      '排名', '总收益率', '夏普比率', '最大回撤', '卡尔玛比率',
      '跌幅权重', '成交量权重', '波动率权重', '资金费率权重',
      '最多做空数量', '单币种限制', '分配策略', '目标函数值'
    ];

    const rows = results.map((result, index) => [
      index + 1,
      (result.metrics.totalReturn * 100).toFixed(2) + '%',
      result.metrics.sharpeRatio.toFixed(3),
      (result.metrics.maxDrawdown * 100).toFixed(2) + '%',
      result.metrics.calmarRatio.toFixed(3),
      (result.combination.priceChangeWeight * 100).toFixed(0) + '%',
      (result.combination.volumeWeight * 100).toFixed(0) + '%',
      (result.combination.volatilityWeight * 100).toFixed(0) + '%',
      (result.combination.fundingRateWeight * 100).toFixed(0) + '%',
      result.combination.maxShortPositions,
      (result.combination.maxSinglePositionRatio * 100).toFixed(0) + '%',
      this.formatAllocationStrategy(result.combination.allocationStrategy),
      result.objectiveValue.toFixed(4)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // === 私有辅助方法 ===

  private static getParameterValue(combination: ParameterCombination, key: string): number {
    const paramMap: Record<string, number> = {
      priceChangeWeight: combination.priceChangeWeight,
      volumeWeight: combination.volumeWeight,
      volatilityWeight: combination.volatilityWeight,
      fundingRateWeight: combination.fundingRateWeight,
      maxShortPositions: combination.maxShortPositions,
      maxSinglePositionRatio: combination.maxSinglePositionRatio
    };
    return paramMap[key] || 0;
  }

  private static calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2) return 0;

    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      denominatorX += deltaX * deltaX;
      denominatorY += deltaY * deltaY;
    }

    const denominator = Math.sqrt(denominatorX * denominatorY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private static calculateVariability(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean === 0 ? 0 : stdDev / Math.abs(mean); // 变异系数
  }

  private static findOptimalRange(results: OptimizationResult[], paramKey: string): { min: number; max: number } {
    const topResults = results.slice(0, Math.min(10, results.length));
    const values = topResults.map(r => this.getParameterValue(r.combination, paramKey));
    
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  private static generateParameterRecommendations(paramKey: string, correlation: number, variability: number): string[] {
    const recommendations: string[] = [];
    
    if (Math.abs(correlation) > 0.5) {
      const direction = correlation > 0 ? '增加' : '减少';
      recommendations.push(`${direction}此参数值可能提升策略表现`);
    }
    
    if (variability < 0.1) {
      recommendations.push('此参数在最优结果中变化较小，可能已接近最优值');
    } else if (variability > 0.5) {
      recommendations.push('此参数在最优结果中变化较大，建议进一步细化搜索');
    }

    return recommendations;
  }

  private static clusterByWeights(results: OptimizationResult[]): OptimizationResult[][] {
    // 简化的K-means聚类实现
    const clusters: OptimizationResult[][] = [[], [], []]; // 3个聚类
    
    results.forEach(result => {
      // 简单分配到最近的聚类（这里简化为按总收益率分组）
      if (result.metrics.totalReturn > 0.1) {
        clusters[0].push(result);
      } else if (result.metrics.totalReturn > 0) {
        clusters[1].push(result);
      } else {
        clusters[2].push(result);
      }
    });

    return clusters.filter(cluster => cluster.length > 0);
  }

  private static calculateAverageMetrics(results: OptimizationResult[]) {
    const n = results.length;
    if (n === 0) return { totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, calmarRatio: 0 };

    return {
      totalReturn: results.reduce((sum, r) => sum + r.metrics.totalReturn, 0) / n,
      sharpeRatio: results.reduce((sum, r) => sum + r.metrics.sharpeRatio, 0) / n,
      maxDrawdown: results.reduce((sum, r) => sum + r.metrics.maxDrawdown, 0) / n,
      calmarRatio: results.reduce((sum, r) => sum + r.metrics.calmarRatio, 0) / n
    };
  }

  private static calculateWeightCentroid(results: OptimizationResult[]) {
    const n = results.length;
    if (n === 0) return { priceChangeWeight: 0, volumeWeight: 0, volatilityWeight: 0, fundingRateWeight: 0 };

    return {
      priceChangeWeight: results.reduce((sum, r) => sum + r.combination.priceChangeWeight, 0) / n,
      volumeWeight: results.reduce((sum, r) => sum + r.combination.volumeWeight, 0) / n,
      volatilityWeight: results.reduce((sum, r) => sum + r.combination.volatilityWeight, 0) / n,
      fundingRateWeight: results.reduce((sum, r) => sum + r.combination.fundingRateWeight, 0) / n
    };
  }

  private static generateClusterDescription(centroid: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
  }): string {
    const weights = [
      { name: '跌幅', value: centroid.priceChangeWeight },
      { name: '成交量', value: centroid.volumeWeight },
      { name: '波动率', value: centroid.volatilityWeight },
      { name: '资金费率', value: centroid.fundingRateWeight }
    ];

    const dominant = weights.reduce((max, current) => 
      current.value > max.value ? current : max
    );

    return `以${dominant.name}为主导的权重配置 (${(dominant.value * 100).toFixed(0)}%)`;
  }

  private static generateDistribution(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    return {
      min: sorted[0],
      max: sorted[n - 1],
      median: n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)],
      q1: sorted[Math.floor(n * 0.25)],
      q3: sorted[Math.floor(n * 0.75)],
      mean: values.reduce((sum, val) => sum + val, 0) / n,
      std: Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - values.reduce((s, v) => s + v, 0) / n, 2), 0) / n)
    };
  }

  private static generateCorrelationMatrix(results: OptimizationResult[]) {
    const parameters = ['priceChangeWeight', 'volumeWeight', 'volatilityWeight', 'fundingRateWeight'];
    const matrix: { [key: string]: { [key: string]: number } } = {};

    parameters.forEach(param1 => {
      matrix[param1] = {};
      parameters.forEach(param2 => {
        const values1 = results.map(r => this.getParameterValue(r.combination, param1));
        const values2 = results.map(r => this.getParameterValue(r.combination, param2));
        matrix[param1][param2] = this.calculateCorrelation(values1, values2);
      });
    });

    return matrix;
  }

  private static calculateStabilityScore(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const cv = mean === 0 ? 1 : Math.sqrt(variance) / Math.abs(mean);
    
    // 稳定性分数：变异系数越小，稳定性越高
    return Math.max(0, 1 - cv);
  }

  private static analyzeParameterStability(results: OptimizationResult[]) {
    const parameters = ['priceChangeWeight', 'volumeWeight', 'volatilityWeight', 'fundingRateWeight'];
    const stability: { [key: string]: number } = {};

    parameters.forEach(param => {
      const values = results.map(r => this.getParameterValue(r.combination, param));
      stability[param] = this.calculateStabilityScore(values);
    });

    return stability;
  }

  private static assessStrategyRisk(results: OptimizationResult[]): RiskAssessment {
    const drawdowns = results.map(r => r.metrics.maxDrawdown);
    const returns = results.map(r => r.metrics.totalReturn);
    
    const avgDrawdown = drawdowns.reduce((sum, val) => sum + val, 0) / drawdowns.length;
    const maxDrawdown = Math.max(...drawdowns);
    const negativeReturns = returns.filter(r => r < 0).length;
    
    let riskLevel: 'low' | 'medium' | 'high';
    if (maxDrawdown > 0.3 || negativeReturns > results.length * 0.5) {
      riskLevel = 'high';
    } else if (maxDrawdown > 0.15 || negativeReturns > results.length * 0.2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      level: riskLevel,
      maxDrawdown,
      averageDrawdown: avgDrawdown,
      negativeReturnRate: negativeReturns / results.length,
      recommendations: this.generateRiskRecommendations(riskLevel, maxDrawdown)
    };
  }

  private static generateStabilityRecommendations(performanceStability: number, parameterStability: { [key: string]: number }): string[] {
    const recommendations: string[] = [];
    
    if (performanceStability < 0.7) {
      recommendations.push('考虑增加样本外测试验证策略稳定性');
      recommendations.push('适当增加正则化约束防止过拟合');
    }

    const unstableParams = Object.entries(parameterStability)
      .filter(([, stability]) => stability < 0.6)
      .map(([param]) => param);

    if (unstableParams.length > 0) {
      recommendations.push(`关注参数稳定性较低的权重: ${unstableParams.join(', ')}`);
    }

    return recommendations;
  }

  private static generateRiskRecommendations(riskLevel: string, maxDrawdown: number): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('考虑增加风险控制措施');
      recommendations.push('适当降低仓位或增加止损机制');
    }
    
    if (maxDrawdown > 0.2) {
      recommendations.push('最大回撤较大，建议优化仓位管理');
    }

    return recommendations;
  }

  private static analyzeWeightDistribution(results: OptimizationResult[]) {
    const weights = ['priceChangeWeight', 'volumeWeight', 'volatilityWeight', 'fundingRateWeight'];
    let hasExtremeWeights = false;

    weights.forEach(weight => {
      const values = results.map(r => this.getParameterValue(r.combination, weight));
      const extremeCount = values.filter(v => v < 0.05 || v > 0.8).length;
      if (extremeCount > results.length * 0.3) {
        hasExtremeWeights = true;
      }
    });

    return { hasExtremeWeights };
  }

  private static formatAllocationStrategy(strategy: PositionAllocationStrategy): string {
    switch (strategy) {
      case PositionAllocationStrategy.BY_VOLUME:
        return '按成交量';
      case PositionAllocationStrategy.BY_COMPOSITE_SCORE:
        return '按综合分数';
      case PositionAllocationStrategy.EQUAL_ALLOCATION:
        return '平均分配';
      default:
        return '未知';
    }
  }
}

// === 类型定义 ===

export interface ParameterImportanceResult {
  parameterKey: string;
  parameterName: string;
  correlation: number;
  importance: number;
  variability: number;
  optimalRange: { min: number; max: number };
  recommendations: string[];
}

export interface HeatmapDataPoint {
  x: number;
  y: number;
  value: number;
  result: OptimizationResult;
}

export interface ParameterCluster {
  id: string;
  results: OptimizationResult[];
  centroid: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
  };
  averageMetrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
  };
  size: number;
  description: string;
}

export interface PerformanceComparisonData {
  scatterData: Array<{
    id: string;
    x: number;
    y: number;
    size: number;
    rank: number;
    label: string;
    result: OptimizationResult;
  }>;
  distributionData: {
    totalReturn: {
      min: number;
      max: number;
      median: number;
      q1: number;
      q3: number;
      mean: number;
      std: number;
    };
    sharpeRatio: {
      min: number;
      max: number;
      median: number;
      q1: number;
      q3: number;
      mean: number;
      std: number;
    };
    maxDrawdown: {
      min: number;
      max: number;
      median: number;
      q1: number;
      q3: number;
      mean: number;
      std: number;
    };
  };
  correlationMatrix: { [key: string]: { [key: string]: number } };
}

export interface StrategyStabilityAnalysis {
  overallScore: number;
  performanceStability: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  parameterStability: { [key: string]: number };
  riskAssessment: RiskAssessment;
  recommendations: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  maxDrawdown: number;
  averageDrawdown: number;
  negativeReturnRate: number;
  recommendations: string[];
}

export interface OptimizationRecommendation {
  type: 'insight' | 'warning' | 'optimization' | 'caution';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionItems: string[];
}