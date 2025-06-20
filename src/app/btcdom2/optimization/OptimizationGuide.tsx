'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronRight, 
  Lightbulb, 
  AlertTriangle, 
  Target, 
  TrendingUp, 
  Settings, 
  BarChart3,
  BookOpen,
  CheckCircle2
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; }>;
  content: React.ReactNode;
}

export default function OptimizationGuide() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const sections: GuideSection[] = [
    {
      id: 'introduction',
      title: '参数优化简介',
      icon: BookOpen,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            参数优化工具帮助您科学地找到BTCDOM2策略的最佳参数组合。通过系统性地搜索参数空间，
            我们可以发现在历史数据上表现最优的参数配置。
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">核心优势</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• 系统性探索参数空间，避免主观偏见</li>
              <li>• 多目标优化，平衡收益和风险</li>
              <li>• 自动化流程，节省大量手工调参时间</li>
              <li>• 统计分析结果，提供参数重要性洞察</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'objectives',
      title: '优化目标详解',
      icon: Target,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 mb-4">
            选择合适的优化目标是参数优化成功的关键。不同目标适用于不同的投资偏好：
          </p>
          <div className="grid gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-700 mb-2">📈 最大化总收益率</h4>
              <p className="text-sm text-gray-600 mb-2">
                追求绝对收益最大化，适合风险承受能力较强的投资者。
              </p>
              <p className="text-xs text-gray-500">
                适用场景：看重绝对收益，可以承受较大波动
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-700 mb-2">📊 最大化夏普比率</h4>
              <p className="text-sm text-gray-600 mb-2">
                追求单位风险下的收益最大化，平衡收益和波动性。
              </p>
              <p className="text-xs text-gray-500">
                适用场景：追求风险调整后收益，适合稳健投资者
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-700 mb-2">📉 最小化最大回撤</h4>
              <p className="text-sm text-gray-600 mb-2">
                控制最大损失幅度，适合风险厌恶型投资者。
              </p>
              <p className="text-xs text-gray-500">
                适用场景：无法承受大幅亏损，资金安全优先
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-700 mb-2">⚖️ 最大化风险调整收益</h4>
              <p className="text-sm text-gray-600 mb-2">
                综合考虑收益和回撤，追求最佳风险收益比。
              </p>
              <p className="text-xs text-gray-500">
                适用场景：平衡收益和风险，推荐的默认选择
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'methods',
      title: '优化方法选择',
      icon: Settings,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="border border-green-200 bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">🔍 网格搜索</h4>
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  系统性地遍历所有参数组合，确保不遗漏任何可能的最优解。
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-green-600">优点:</span>
                    <span className="text-green-600">全面覆盖、结果可靠</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">缺点:</span>
                    <span className="text-green-600">耗时较长</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">适用:</span>
                    <span className="text-green-600">参数空间较小、时间充足</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">🧠 贝叶斯优化</h4>
              <div className="space-y-2">
                <p className="text-sm text-blue-700">
                  利用机器学习算法智能选择下一个测试点，快速收敛到最优解。
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-blue-600">优点:</span>
                    <span className="text-blue-600">收敛快速、效率高</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">缺点:</span>
                    <span className="text-blue-600">可能陷入局部最优</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">适用:</span>
                    <span className="text-blue-600">参数空间大、时间有限</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-purple-800 mb-2">🎯 混合方法（推荐）</h4>
              <div className="space-y-2">
                <p className="text-sm text-purple-700">
                  先用粗网格快速识别有希望的区域，再用贝叶斯优化精细搜索。
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-purple-600">优点:</span>
                    <span className="text-purple-600">平衡速度和效果</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-600">缺点:</span>
                    <span className="text-purple-600">复杂度中等</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-600">适用:</span>
                    <span className="text-purple-600">大多数情况的最佳选择</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'parameters',
      title: '参数空间设置',
      icon: BarChart3,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            合理设置参数搜索范围是优化成功的关键。范围太小可能错过最优解，范围太大会增加计算时间。
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">权重参数建议范围</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">跌幅权重:</span> 10%-70%
                <p className="text-xs text-gray-600">做空策略核心，不宜过低</p>
              </div>
              <div>
                <span className="font-medium">成交量权重:</span> 10%-50%
                <p className="text-xs text-gray-600">确保流动性，防止滑点</p>
              </div>
              <div>
                <span className="font-medium">波动率权重:</span> 0%-30%
                <p className="text-xs text-gray-600">控制风险，可适当较低</p>
              </div>
              <div>
                <span className="font-medium">资金费率权重:</span> 10%-60%
                <p className="text-xs text-gray-600">做空成本控制，很重要</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">其他参数建议</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>最多做空数量:</span>
                <span className="font-mono">8-15个</span>
              </div>
              <div className="flex justify-between">
                <span>单币种持仓限制:</span>
                <span className="font-mono">15%-25%</span>
              </div>
              <div className="flex justify-between">
                <span>分配策略:</span>
                <span>建议包含所有3种</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'interpretation',
      title: '结果解读指南',
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 mb-4">
            优化完成后，如何正确解读和使用结果是关键：
          </p>
          
          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-700">1. 关注前几名结果</h4>
              <p className="text-sm text-gray-600">
                不要只看第一名，前3-5名的参数组合都值得关注，它们可能在不同市场条件下表现更好。
              </p>
            </div>
            
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-700">2. 分析参数稳定性</h4>
              <p className="text-sm text-gray-600">
                观察最优结果中的参数分布。如果某个参数在多个优秀结果中都相近，说明该参数比较稳定。
              </p>
            </div>
            
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold text-purple-700">3. 评估风险指标</h4>
              <p className="text-sm text-gray-600">
                除了关注收益率，也要看最大回撤、夏普比率等风险指标，确保策略符合你的风险承受能力。
              </p>
            </div>
            
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-semibold text-orange-700">4. 样本外验证</h4>
              <p className="text-sm text-gray-600">
                用优化得到的参数在不同时间段进行验证，确保参数的泛化能力。
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'best-practices',
      title: '最佳实践',
      icon: CheckCircle2,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                推荐做法
              </h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 从小范围开始，逐步扩大搜索空间</li>
                <li>• 选择风险调整收益作为默认优化目标</li>
                <li>• 使用混合优化方法平衡速度和效果</li>
                <li>• 记录和比较不同时期的优化结果</li>
                <li>• 定期重新优化以适应市场变化</li>
              </ul>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                常见误区
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• 过度优化：在历史数据上过度拟合</li>
                <li>• 忽视交易成本：优化时未考虑实际成本</li>
                <li>• 数据窥探：反复优化同一段数据</li>
                <li>• 参数过于复杂：设置过多变动参数</li>
                <li>• 忽视市场环境变化</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tips',
      title: '实用技巧',
      icon: Lightbulb,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <h5 className="font-medium text-blue-800">分阶段优化</h5>
                <p className="text-sm text-blue-700">
                  先固定部分参数优化权重，再优化其他参数，避免参数空间过大。
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <h5 className="font-medium text-green-800">设置合理约束</h5>
                <p className="text-sm text-green-700">
                  利用高级设置中的性能约束，过滤掉明显不符合要求的参数组合。
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
              <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <h5 className="font-medium text-purple-800">保存优化历史</h5>
                <p className="text-sm text-purple-700">
                  记录不同市场环境下的最优参数，建立参数档案库。
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
              <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <h5 className="font-medium text-orange-800">组合多个结果</h5>
                <p className="text-sm text-orange-700">
                  考虑将多个优秀参数组合进行加权平均，提高策略的稳健性。
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">参数优化使用指南</h2>
        <p className="text-gray-600">
          掌握科学的参数优化方法，提升策略表现
        </p>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);
        
        return (
          <Card key={section.id} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleSection(section.id)}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5 text-blue-600" />
                  <span>{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </CardTitle>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="pt-0">
                {section.content}
              </CardContent>
            )}
          </Card>
        );
      })}

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">准备开始优化？</h3>
            <p className="text-gray-600 mb-4">
              记住：参数优化是一个迭代过程，需要结合市场环境和风险偏好不断调整。
            </p>
            <div className="flex justify-center space-x-4">
              <Button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                variant="outline"
              >
                返回顶部
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                开始优化
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}