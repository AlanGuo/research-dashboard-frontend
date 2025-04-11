"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { MarketReference } from "@/components/market-reference"
import { CurveChart } from "@/components/curve-chart"
import { FundChange } from "@/components/fund-change"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

// 图表数据类型
interface ChartDataPoint {
  date: string;
  fundReturnPct: number; // 策略收益百分比，已考虑出入金影响
  fundReturn: number;    // 总市值（包含初始本金、出入金和盈亏）
  realTimeCapital: number; // 实时本金（初始本金+出入金变化）
  [key: string]: string | number; // 动态比较资产数据
}

// 持仓策略数据类型
interface HoldingStrategyItem {
  "策略": string;
  "标的": string;
  "仓位": string;
  "进场日期": string;
  "进场": number;
  "成本": number;
  "出场": number;
  "盈亏": number;
  "实时估值": number;
  "实时标的": string; // 新增字段：用于指定实时价格标的
  "实时价格": number; // 新增字段：用于指定实时价格
  "状态": string;
  "更新日期": string;
  "备注": string;
}

interface HoldingStrategyResponse {
  success: boolean;
  data: HoldingStrategyItem[];
  timestamp: string;
}

// 定义 API 返回的数据类型
interface FundDataItem {
  "开始日期": string;
  "策略名": string;
  "初始本金": number;
  // "初始价格" 字段已移除，使用对比资产中的第一个数据作为初始价格
  "市值": number;
  "对比": string;
  "备注": string;
}

// 出入金数据类型
interface FundChangeItem {
  "日期": string;
  "金额": number;
  "操作": string;  // "入金" 或 "出金" 或 "初始本金"
  "备注"?: string;
}

export interface FundChangeResponse {
  success: boolean;
  data: FundChangeItem[];
  timestamp: string;
}

export default function UserPage() {
  // 使用useParams获取动态路由参数
  const params = useParams();
  const username = params.username as string;
  // check client
  if (typeof window !== 'undefined' && username) {
    document.title = `${username.toUpperCase()} - Funding Curve`;
  }

  const [baseInfoItem, setBaseInfoItem] = useState<FundDataItem | null>(null);
  const [holdingStrategies, setHoldingStrategies] = useState<HoldingStrategyResponse | null>(null);
  const [historicalHoldings, setHistoricalHoldings] = useState<HoldingStrategyResponse | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [totalMarketValue, setTotalMarketValue] = useState<number>(0);
  const [idleFunds, setIdleFunds] = useState<number>(0);
  const [fundChangeData, setFundChangeData] = useState<FundChangeResponse | null>(null);
  
  // 持仓标签页状态
  const [activeHoldingTab, setActiveHoldingTab] = useState<'current' | 'historical'>('current');

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [holdingLoading, setHoldingLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 用于控制曲线的显示/隐藏
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    fundReturnPct: true,
    fundReturn: true
  });
  
  // 存储比较资产列表
  const [comparisonAssets, setComparisonAssets] = useState<string[]>([]);
  
  // 图表模式：百分比模式或绝对值模式
  const [chartMode, setChartMode] = useState<'percentage' | 'absolute'>('percentage');
  
  // 在绝对值模式下，当前选中的对比资产
  const [selectedComparisonAsset, setSelectedComparisonAsset] = useState<string>('');

  // 用于缓存已获取的实时价格
  const [realtimePriceCache, setRealtimePriceCache] = useState<Record<string, number>>({});

  // 获取实时实时价格
  const fetchRealtimePrice = async (symbol: string): Promise<number> => {
    try {
      // 检查缓存中是否已有该标的的价格
      if (realtimePriceCache[symbol]) {
        return realtimePriceCache[symbol];
      }
      
      // 调用价格API获取实时价格
      const response = await fetch(`/api/price/${symbol}`);
      
      if (!response.ok) {
        throw new Error(`获取${symbol}价格失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.price) {
        // 更新价格缓存
        setRealtimePriceCache(prev => ({
          ...prev,
          [symbol]: data.data.price
        }));
        return data.data.price;
      } else {
        throw new Error(`获取${symbol}价格数据不完整`);
      }
    } catch (error) {
      console.error(`获取${symbol}实时价格失败:`, error);
      return 0; // 获取失败时返回0
    }
  };

  // 计算当前持仓的盈亏总和
  const calculateCurrentHoldingsProfit = async (strategies: HoldingStrategyItem[]): Promise<number> => {
    // 使用Map缓存相同标的的价格请求，避免重复请求
    const symbolPriceMap = new Map<string, Promise<number>>();
    const strategyPriceMap = new Map<HoldingStrategyItem, Promise<number>>();
    
    // 为每个有实时标的的策略关联价格获取Promise
    for (const strategy of strategies) {
      if (strategy["实时标的"]) {
        const symbol = strategy["实时标的"].trim();
        
        // 如果该标的已经有价格请求，则复用；否则创建新请求
        if (!symbolPriceMap.has(symbol)) {
          symbolPriceMap.set(symbol, fetchRealtimePrice(symbol));
        }
        
        // 将策略与对应的价格Promise关联
        strategyPriceMap.set(strategy, symbolPriceMap.get(symbol)!);
      }
    }
    
    // 并行获取所有实时价格
    await Promise.all([...symbolPriceMap.values()]);
    
    // 计算总盈亏
    let totalProfit = 0;
    
    // 处理所有策略
    for (const strategy of strategies) {
      // 计算当前持仓的盈亏：实时估值 - 成本
      let marketValue = 0;
      const position = typeof strategy["仓位"] === 'string' ? 
        parseFloat(strategy["仓位"]) : (strategy["仓位"] || 0);
      
      // 如果有实时标的字段，则使用仓位 * 实时价格计算市值
      if (strategy["实时标的"]) {
        // 获取对应的价格Promise结果
        const pricePromise = strategyPriceMap.get(strategy);
        const realtimePrice = pricePromise ? await pricePromise : 0;
        
        if (realtimePrice > 0) {
          // 使用实时价格 * 仓位计算市值
          marketValue = realtimePrice * position;
          // 更新策略的实时估值字段
          strategy["实时估值"] = marketValue;
          // 在更新日期字段显示"实时"
          strategy["更新日期"] = "实时";
          strategy["实时价格"] = realtimePrice;
        } else {
          // 如果获取实时价格失败，则使用原有的实时估值
          marketValue = strategy["实时估值"] || 0;
        }
      } else {
        // 没有实时标的时使用实时估值字段
        marketValue = strategy["实时估值"] ? strategy["实时估值"] : strategy["实时价格"] ? position * strategy["实时价格"] : 0;
      }
      
      let entryCost = 0;
      if (strategy["成本"]) {
        entryCost = strategy["成本"];
      } else if (position && strategy["进场"]) {
        entryCost = position * strategy["进场"];
      }
      
      const profit = marketValue - entryCost;
      totalProfit += profit;
    }
    
    return totalProfit;
  };
  
  // 计算历史持仓的盈亏总和
  const calculateHistoricalHoldingsProfit = (strategies: HoldingStrategyItem[]): number => {
    return strategies.reduce((sum, strategy) => {
      const profit = typeof strategy["盈亏"] === 'number' ? strategy["盈亏"] : 0;
      return sum + profit;
    }, 0);
  };

  // 计算实时市值和闲置资金，并更新状态
  const updateTotalMarketValue = async (baseInfoItem: FundDataItem) => {
    try {
      // 检查是否有基本数据      
      // 获取初始本金
      const initialCapital = baseInfoItem["初始本金"] || 0;
      if (initialCapital === 0) {
        // 如果初始本金为0，则直接返回市值字段
        return baseInfoItem["市值"] || 0;
      }
      // 使用已获取的出入金数据
      let netFundChange = 0;
      if (fundChangeData && fundChangeData.success && fundChangeData.data && fundChangeData.data.length > 0) {
        // 计算出入金净额
        // 忽略“初始本金”操作类型
        netFundChange = fundChangeData.data.reduce((sum: number, change: FundChangeItem) => {
          if (change["操作"] === "初始本金") {
            return sum;
          }
          const amount = change["金额"] * (change["操作"] === "入金" ? 1 : -1);
          return sum + amount;
        }, 0);
      }
      
      let totalProfit = 0;
      
      // 计算所有当前持仓的盈亏总和
      if (holdingStrategies && holdingStrategies.success && holdingStrategies.data) {
        const currentProfit = await calculateCurrentHoldingsProfit(holdingStrategies.data);
        totalProfit += currentProfit;
      }
      
      // 计算所有历史持仓的盈亏总和
      if (historicalHoldings && historicalHoldings.success && historicalHoldings.data) {
        totalProfit += calculateHistoricalHoldingsProfit(historicalHoldings.data);
      }
      
      // 总市值 = 初始本金 + 净出入金 + 总盈亏
      let calculatedValue = initialCapital + netFundChange + totalProfit;
      
      if (isNaN(calculatedValue) || calculatedValue <= 0) {
        // 如果计算有问题，使用 FundDataItem 里的"市值"
        calculatedValue = baseInfoItem["市值"] || 0;
      }
      
      // 计算当前持仓的总估值
      let totalCurrentHoldingsValue = 0;
      if (holdingStrategies && holdingStrategies.success && holdingStrategies.data) {
        // 由于在前面已经调用了calculateCurrentHoldingsProfit，实时标的的价格已经更新到实时估值字段
        // 现在可以直接使用实时估值字段计算总估值
        totalCurrentHoldingsValue = holdingStrategies.data.reduce((sum, strategy) => {
          return sum + (strategy["实时估值"] || 0);
        }, 0);
      }
      
      // 计算闲置资金 = 总市值 - 当前持仓总估值
      const calculatedIdleFunds = calculatedValue - totalCurrentHoldingsValue;
      
      // 更新状态
      setTotalMarketValue(calculatedValue);
      setIdleFunds(calculatedIdleFunds > 0 ? calculatedIdleFunds : 0);
    } catch (error) {
      console.error('计算实时市值时出错:', error);
      const fallbackValue = baseInfoItem["市值"] || 0;
      setTotalMarketValue(fallbackValue);
    }
  };
  
  // 获取策略数据
  // 当比较资产列表变化时，更新选中的资产
  useEffect(() => {
    if (comparisonAssets.length > 0 && !comparisonAssets.includes(selectedComparisonAsset)) {
      setSelectedComparisonAsset(comparisonAssets[0]);
    }
  }, [comparisonAssets, selectedComparisonAsset]);
  
  useEffect(() => {
    async function fetchPageData() {
      try {
        // 直接使用路由参数中的username
        if (!username) {
          return; // 如果username为空，不进行请求
        }
        
        const response = await fetch(`/api/baseinfo/${username}`);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success || !data.data || data.data.length === 0) {
          throw new Error('Invalid baseinfo data');
        }
        setBaseInfoItem(data.data[0]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching page data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setLoading(false);
      }
    }
    
    fetchPageData();
  }, [username]);

  // 获取当前持仓, 历史持仓, 出入金数据
  useEffect(() => {
    async function fetchHoldingsAndFundChanges(baseInfoItem: FundDataItem) {
      try {
        // 获取初始本金
        const initialCapital = baseInfoItem["初始本金"];
        if (!initialCapital) {
          console.error("初始本金不存在");
          return;
        }
        
        // 获取对比资产列表
        const comparisonString = baseInfoItem["对比"];
        const assets = comparisonString ? comparisonString.split(',').map(asset => asset.trim()).filter(asset => asset) : [];
        
        // 更新比较资产列表
        setComparisonAssets(assets);
        
        // 并行执行三个API调用
        const [
          holdingResponse,
          historicalResponse,
          fundChangeResponse
        ] = await Promise.all([
          fetch(`/api/holding/${username}?status=持仓`),
          fetch(`/api/holding/${username}?except=持仓`),
          fetch(`/api/change/${username}`)
        ]);
        
        // 处理当前持仓响应
        if (holdingResponse.ok) {
          const holdingData = await holdingResponse.json();
          setHoldingStrategies(holdingData);
        } else {
          console.error(`Holding strategies API request failed with status ${holdingResponse.status}`);
        }
        
        // 处理历史持仓响应
        if (!historicalResponse.ok) {
          console.error(`Historical holdings API request failed with status ${historicalResponse.status}`);
          return;
        }
        const historicalData: HoldingStrategyResponse | null = await historicalResponse.json();
        setHistoricalHoldings(historicalData);
        setHoldingLoading(false);

        // 处理出入金数据响应
        if (!fundChangeResponse.ok) {
          console.error(`Fund change API request failed with status ${fundChangeResponse.status}`);
          return;
        }
        const fundChangeData: FundChangeResponse | null = await fundChangeResponse.json();
        setFundChangeData(fundChangeData);
      } catch (err) {
        console.error('Error fetching data and generating base chart:', err);
        setChartLoading(false);
        return null;
      }
    }
    if (baseInfoItem) {
      setChartLoading(true);
      fetchHoldingsAndFundChanges(baseInfoItem);
    }
    // disable eslint warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseInfoItem]);

  // 更新总市值
  useEffect(() => {
    if (baseInfoItem && fundChangeData && holdingStrategies && historicalHoldings) {
      updateTotalMarketValue(baseInfoItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseInfoItem, holdingStrategies, historicalHoldings, fundChangeData]);

  // 生成图表数据
  useEffect(() => {
    async function fetchDataAndGenerateBaseChart(baseInfoItem: FundDataItem) {
      try {
        // 获取初始本金
        const initialCapital = baseInfoItem["初始本金"];
        if (!initialCapital) {
          console.error("初始本金不存在");
          return;
        }
        
        const assets = comparisonAssets;
        
        // 初始化可见性设置 - 先只设置主曲线
        const newVisibleLines: Record<string, boolean> = {
          fundReturnPct: true,
          fundReturn: true
        };
        
        // 为每个资产添加可见性设置
        for (const asset of assets) {
          const assetKey = asset.toLowerCase();
          newVisibleLines[`${assetKey}PricePct`] = true;
          newVisibleLines[`${assetKey}Price`] = true;
        }
        
        // 更新可见性设置
        setVisibleLines(newVisibleLines);
        
        // 按日期排序历史持仓（从早到晚）
        const sortedHistoricalHoldings = [...(historicalHoldings?.data || [])]
        
        // 创建日期到资金变化的映射
        const capitalChangeMap = new Map<string, number>();
        
        // 收集所有需要记录的日期（包括出入金日期和历史持仓更新日期）
        const allImportantDates = new Set<string>();
        
        // 获取开始日期和结束日期
        const startDate = new Date(baseInfoItem["开始日期"]);
        const endDate = new Date(); // 今天
        
        // 添加开始日期
        const startDateKey = startDate.toISOString().split('T')[0];
        allImportantDates.add(startDateKey);
        
        // 添加所有历史持仓更新日期
        sortedHistoricalHoldings.forEach(holding => {
          const exitDate = new Date(holding["更新日期"]).toISOString().split('T')[0];
          allImportantDates.add(exitDate);
        });
        
        // 添加所有出入金日期
        if (fundChangeData && fundChangeData.success && fundChangeData.data) {
          fundChangeData.data.forEach(change => {
            if (change["操作"] !== "初始本金") { // 排除初始本金
              const changeDate = new Date(change["日期"]).toISOString().split('T')[0];
              allImportantDates.add(changeDate);
            }
          });
        }
        
        // 添加今天的日期
        const todayKey = endDate.toISOString().split('T')[0];
        allImportantDates.add(todayKey);
        
        // 将所有重要日期转换为数组并按时间排序
        const sortedDates = Array.from(allImportantDates).sort();
        
        // 当前资金，初始为初始本金
        let currentCapital = initialCapital;
        
        // 记录初始本金
        capitalChangeMap.set(startDateKey, currentCapital);
        
        // 按时间顺序处理每个日期的资金变化
        for (let i = 0; i < sortedDates.length; i++) {
          const dateKey = sortedDates[i];
          
          if (dateKey === startDateKey) {
            // 开始日期已经设置了初始本金，跳过
            continue;
          }
          
          // 检查这一天是否有历史持仓更新
          const holdingsForDate = sortedHistoricalHoldings.filter(holding => {
            const exitDate = new Date(holding["更新日期"]).toISOString().split('T')[0];
            return exitDate === dateKey;
          });
          
          // 计算这一天的持仓盈亏
          const dayProfit = holdingsForDate.reduce((sum, holding) => {
            return sum + (holding["盈亏"] || 0);
          }, 0);
          
          // 更新当前资金
          currentCapital += dayProfit;
          
          // 检查这一天是否有出入金记录
          let dayFundChange = 0;
          if (fundChangeData && fundChangeData.success && fundChangeData.data) {
            // 找到当天的出入金记录
            const dayChanges = fundChangeData.data.filter(change => {
              const changeDate = new Date(change["日期"]).toISOString().split('T')[0];
              return changeDate === dateKey && change["操作"] !== "初始本金";
            });
            
            // 计算当天的出入金净额
            dayFundChange = dayChanges.reduce((sum, change) => {
              const amount = change["金额"] * (change["操作"] === "入金" ? 1 : -1);
              return sum + amount;
            }, 0);
            
            // 将出入金记录添加到当天资金中
            currentCapital += dayFundChange;
          }
          
          // 记录这一天的资金（包含盈亏和出入金）
          capitalChangeMap.set(dateKey, currentCapital);
        }
        
        // 如果有当前持仓，添加最新的估值
        capitalChangeMap.set(todayKey, totalMarketValue);
        
        // 获取所有日期并排序
        const allDates = [...capitalChangeMap.keys()];
        allDates.sort();
        
        // 生成图表数据 - 先只有主曲线
        const newChartData: ChartDataPoint[] = [];
        
        // 为每个资金变化日期创建数据点
        for (let i = 0; i < allDates.length; i++) {
          const currentDateKey = allDates[i];
          const currentDate = new Date(currentDateKey);
          const currentCapital = capitalChangeMap.get(currentDateKey) || initialCapital;
          
          // 获取当前日期之前的累计出入金
          let cumulativeFundChangeUntilDate = 0;
          if (fundChangeData && fundChangeData.success && fundChangeData.data) {
            cumulativeFundChangeUntilDate = fundChangeData.data
              .filter(change => {
                // 只考虑当前日期之前的出入金记录，并忽略“初始本金”类型
                const changeDate = new Date(change["日期"]).toISOString().split('T')[0];
                return changeDate <= currentDateKey && change["操作"] !== "初始本金";
              })
              .reduce((sum, change) => {
                const amount = change["金额"] * (change["操作"] === "入金" ? 1 : -1);
                return sum + amount;
              }, 0);
          }
          
          // 纯收益 = 当前资金 - 初始本金 - 累计出入金
          const pureProfit = currentCapital - initialCapital - cumulativeFundChangeUntilDate;
          
          // 计算实时本金 = 初始本金 + 累计出入金
          const realTimeCapital = initialCapital + cumulativeFundChangeUntilDate;
          
          // 正确计算收益率，排除出入金影响
          // 收益率 = 纯收益 / 实时本金（而非初始本金）
          const pureReturnRate = realTimeCapital > 0 ? (pureProfit / realTimeCapital) * 100 : 0;
          
          // 创建数据点 - 包含纯收益、累计出入金和收益率
          const dataPoint: ChartDataPoint = {
            date: currentDate.toLocaleDateString(),
            fundReturn: capitalChangeMap.get(currentDateKey) || currentCapital,  // 使用已计算好的当天资金值
            fundReturnPct: pureReturnRate,  // 纯收益率，排除出入金影响
            pureProfit: pureProfit,
            fundChange: cumulativeFundChangeUntilDate,
            realTimeCapital: initialCapital + cumulativeFundChangeUntilDate // 实时本金 = 初始本金 + 累计出入金
          };
          // 添加数据点
          newChartData.push(dataPoint);
        }
        
        // 如果成功生成了数据点，则更新图表数据
        if (newChartData.length > 0) {
          setChartData(newChartData);
        }
        
        // 保存重要数据供比较资产使用
        return {
          assets,
          startDate,
          endDate,
          allDates,
          initialCapital,
          newChartData
        };
      } catch (err) {
        console.error('Error fetching data and generating base chart:', err);
        return null;
      }
    }
    // 4个数据源准备好后，生成基础图表
    if (baseInfoItem && historicalHoldings && fundChangeData && totalMarketValue) {
      fetchDataAndGenerateBaseChart(baseInfoItem).then(baseChartData => {
        setChartLoading(false);
        // 如果成功生成了基础图表，启动获取比较资产数据的过程
        if (baseChartData && comparisonAssets.length > 0) {
          fetchComparisonAssetData(baseChartData);
        }
      });
    }
    // disable eslint warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalHoldings, fundChangeData, totalMarketValue, comparisonAssets]);

  // 获取比较资产数据 - 精确获取资金曲线中指定日期的价格数据
  const fetchComparisonData = async (asset: string, startDate: string, endDate: string, assetDataMaps: Map<string, Map<string, number>>, specificDates: string[]) => {
    try {
      // 将资产名称转换为小写
      const symbol = asset.toLowerCase();
      const assetKey = asset.toLowerCase();
      
      // 创建该资产的数据映射
      const assetDataMap = new Map<string, number>();
      assetDataMaps.set(assetKey, assetDataMap);
      
      // 如果没有指定日期，直接返回
      if (specificDates.length === 0) {
        return null;
      }
      
      // 优化：批量获取数据，每次最多获取50个日期的数据
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < specificDates.length; i += batchSize) {
        batches.push(specificDates.slice(i, i + batchSize));
      }
      
      // 并行获取每批日期的数据
      const batchPromises = batches.map(async (dateBatch) => {
        // 构建日期查询参数
        const dateParams = dateBatch.map(date => `dates[]=${encodeURIComponent(date)}`).join('&');
        
        // 使用新的API端点，只获取指定日期的价格
        const response = await fetch(`/api/kline/${symbol}/exact-dates?${dateParams}`);
        
        if (!response.ok) {
          throw new Error(`${asset} API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // 处理返回的数据并存入assetDataMap
        if (data?.success && data.data) {
          // 数据格式应该是 {date: string, price: number}[] 的形式
          data.data.forEach((item: {date: string, price: number}) => {
            if (item.date && item.price !== undefined) {
              assetDataMap.set(item.date, item.price);
            }
          });
        }
        
        return data;
      });
      
      // 等待所有批次数据获取完成
      await Promise.all(batchPromises);
      
      return { success: true };
    } catch (err) {
      console.error(`Error fetching ${asset} data:`, err);
      return null;
    }
  };

  // 处理比较资产数据点的函数
  const processAssetDataPoint = (dataPoint: ChartDataPoint, asset: string, currentDateKey: string, assetDataMap: Map<string, number>, initialAssetValues: Map<string, number>, newChartData: ChartDataPoint[]) => {
    const assetKey = asset.toLowerCase();
    let assetValue = assetDataMap.get(currentDateKey);

    // 如果当天没有资产数据，尝试找前一天的数据（最多往前找3天）
    if (assetValue === undefined && assetDataMap.size > 0) {
      for (let i = 1; i <= 3; i++) {
        const prevDate = new Date(currentDateKey);
        prevDate.setDate(prevDate.getDate() - i);
        const prevDateKey = prevDate.toISOString().split('T')[0];
        const prevValue = assetDataMap.get(prevDateKey);
        
        if (prevValue !== undefined) {
          assetValue = prevValue;
          break;
        }
      }
    }
    
    // 如果还是没有资产数据，使用前面数据点的值
    if (assetValue === undefined && newChartData.length > 0) {
      // 使用前一个数据点的百分比
      const lastPctKey = `${assetKey}PricePct`;
      const lastPct = newChartData[newChartData.length - 1][lastPctKey] as number;
      // 将百分比转换回原始值
      const initialValue = initialAssetValues.get(assetKey) || 0;
      assetValue = initialValue * (1 + lastPct / 100);
    }
    
    // 如果还是没有资产数据，使用一个默认值
    if (assetValue === undefined) {
      // 如果有其他数据，使用平均值
      if (assetDataMap.size > 0) {
        const values = Array.from(assetDataMap.values());
        const avgValue = values.reduce((sum, value) => sum + value, 0) / values.length;
        assetValue = avgValue;
      } else {
        // 完全没有数据时的最后备选
        assetValue = initialAssetValues.get(assetKey) || 0;
      }
    }
    
    // 如果这是第一个数据点，将其作为初始价格
    if (newChartData.length === 0 && assetValue !== undefined) {
      initialAssetValues.set(assetKey, assetValue);
      // 当这是第一个数据点时，百分比变化应为0
      dataPoint[`${assetKey}PricePct`] = 0;
      dataPoint[`${assetKey}Price`] = assetValue;
      return;
    }
    
    // 计算百分比和绝对值
    const initialValue = initialAssetValues.get(assetKey) || 0;
    
    // 比较资产不需要考虑出入金对价格的影响，因为它们是外部指数
    // 直接计算百分比变化
    const pctChange = ((assetValue / initialValue) - 1) * 100;
    
    // 添加到数据点
    dataPoint[`${assetKey}PricePct`] = pctChange;
    dataPoint[`${assetKey}Price`] = assetValue;
    // 可选：记录数据来源（用于调试）
    // dataPoint[`${assetKey}Source`] = valueSource;
  };
  
  // 获取比较资产数据并更新图表
  const fetchComparisonAssetData = async (baseChartData: {
    assets: string[],
    startDate: Date,
    endDate: Date,
    allDates: string[],
    newChartData: ChartDataPoint[]
  }) => {
    try {
      const { assets, startDate, endDate, allDates, newChartData } = baseChartData;
      
      if (assets.length === 0) return;
      
      // 创建共享的比较资产日期到数据的映射
      const newAssetDataMaps = new Map<string, Map<string, number>>();
      
      // 格式化日期
      const earliestDate = startDate.toISOString().split('T')[0];
      const latestDate = endDate.toISOString().split('T')[0];
      
      // 为每个资产初始化一个初始价格映射
      const initialAssetValues = new Map<string, number>();
      
      // 默认为所有资产设置默认初始值，后续将使用第一个数据点的价格覆盖
      for (const asset of assets) {
        const assetKey = asset.toLowerCase();
        initialAssetValues.set(assetKey, 0); // 默认初始值，将在获取到实际数据后更新
      }
      
      // 提取所有需要获取数据的日期
      const specificDates = allDates;
      
      // 为每个资产获取数据 - 并行获取以加快速度
      const fetchPromises = assets.map(asset => 
        fetchComparisonData(asset, earliestDate, latestDate, newAssetDataMaps, specificDates)
      );
      
      await Promise.all(fetchPromises);
      
      // 复制原始图表数据以添加比较资产数据
      const updatedChartData = [...newChartData];
      
      // 为每个数据点添加比较资产数据
      for (let i = 0; i < updatedChartData.length; i++) {
        const dataPoint = updatedChartData[i];
        const currentDateKey = allDates[i];

        // 处理所有比较资产的数据
        for (const asset of assets) {
          const assetKey = asset.toLowerCase();
          const assetDataMap = newAssetDataMaps.get(assetKey) || new Map<string, number>();
          
          // 处理每个资产的数据点
          processAssetDataPoint(dataPoint, asset, currentDateKey, assetDataMap, initialAssetValues, updatedChartData.slice(0, i));
        }
      }
      
      // 更新图表数据
      setChartData(updatedChartData);
    } catch (err) {
      console.error('Error fetching comparison asset data:', err);
    }
  };

  // 渲染UI
  return (
    <div className="container mx-auto py-6 md:py-10 px-4 md:px-6 space-y-6 md:space-y-8">
      { !username || loading ? (
        <div className="space-y-6 md:space-y-8">
          {/* 市场参考板块 Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-2">
                  <Skeleton className="h-6 w-16 md:w-24 mb-1" />
                  <Skeleton className="h-4 w-full mt-1" />
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* 标题区域 Skeleton */}
          <div className="flex justify-between items-start">
            <div>
              <Skeleton className="h-7 md:h-9 w-36 md:w-48 mb-2" />
              <Skeleton className="h-4 md:h-5 w-48 md:w-64" />
            </div>
            <Skeleton className="h-8 md:h-10 w-8 md:w-10 rounded-full" />
          </div>
          
          {/* 市值卡片 Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-3 md:p-4 pb-1 md:pb-2">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Skeleton className="h-5 md:h-6 w-5 md:w-6 rounded-full" />
                    <Skeleton className="h-5 md:h-6 w-16 md:w-24" />
                  </div>
                  <Skeleton className="h-5 md:h-6 w-24 md:w-32" />
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4">
                <div className="space-y-2 md:space-y-3">
                  <div className="h-px bg-border"></div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-3 md:h-4 w-16 md:w-20" />
                      <Skeleton className="h-3 md:h-4 w-16 md:w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="hidden md:block">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-px bg-border"></div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* 图表 Skeleton */}
          <Card>
            <CardHeader className="p-3 md:p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
                <Skeleton className="h-5 md:h-6 w-24 md:w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 md:h-8 w-20 md:w-24 rounded-md" />
                  <Skeleton className="h-7 md:h-8 w-20 md:w-24 rounded-md" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              <Skeleton className="h-[200px] md:h-[300px] w-full" />
            </CardContent>
          </Card>
          
          {/* 持仓策略 Skeleton */}
          <Card>
            <CardHeader className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 md:gap-2">
                  <Skeleton className="h-5 md:h-6 w-5 md:w-6 rounded-full" />
                  <Skeleton className="h-5 md:h-6 w-20 md:w-24" />
                </div>
                <Skeleton className="h-7 md:h-8 w-24 md:w-32 rounded-md" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-3 md:p-4">
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-3 md:p-4">
                      <div className="flex justify-between mb-2">
                        <Skeleton className="h-4 md:h-5 w-20 md:w-24" />
                        <Skeleton className="h-4 md:h-5 w-12 md:w-16" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                        {[...Array(4)].map((_, j) => (
                          <div key={j} className="flex justify-between">
                            <Skeleton className="h-3 md:h-4 w-12 md:w-16" />
                            <Skeleton className="h-3 md:h-4 w-16 md:w-20" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">加载数据时出错</p>
          <p>{error}</p>
        </div>
      ) : baseInfoItem ? (
        <div className="space-y-6 md:space-y-8">
          {/* 市场参考板块 */}
          <MarketReference comparisonAssets={comparisonAssets} />
          
          {/* 标题区域 */}
          <div className="animate-in fade-in duration-700 flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{baseInfoItem["策略名"]}</h1>
              <p className="text-base text-muted-foreground mt-2">{baseInfoItem["备注"]}</p>
            </div>
            <ThemeToggle />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-700">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <CardTitle className="text-lg">总资产</CardTitle>
                </div>
                <div className="font-semibold text-lg">
                  ${totalMarketValue ? totalMarketValue.toLocaleString() : "-"}
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">本金</dt>
                    <dd className="">${(() => {
                      // 计算实时本金 = 初始本金 + 出入金总额
                      let totalFundChange = 0;
                      if (fundChangeData && fundChangeData.success && fundChangeData.data) {
                        totalFundChange = fundChangeData.data
                          .filter(change => change["操作"] !== "初始本金")
                          .reduce((sum, change) => {
                            const amount = change["金额"] * (change["操作"] === "入金" ? 1 : -1);
                            return sum + amount;
                          }, 0);
                      }
                      const realTimeCapital = baseInfoItem["初始本金"] + totalFundChange;
                      return realTimeCapital.toLocaleString();
                    })()}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">空闲资金</dt>
                    <dd className="flex items-center gap-2">
                      <span>${idleFunds.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">({totalMarketValue ? ((idleFunds / totalMarketValue) * 100).toFixed(2) : '0.00'}%)</span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">开始日期</dt>
                    <dd className="">{new Date(baseInfoItem["开始日期"]).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">运行时长</dt>
                    <dd className="">{(() => {
                        // 计算运行时长
                        const startDateStr = baseInfoItem["开始日期"];
                        if (!startDateStr) return "-";
                        
                        const startDate = new Date(startDateStr);
                        const currentDate = new Date();
                        const diffTime = currentDate.getTime() - startDate.getTime();
                        const diffDays = diffTime / (1000 * 3600 * 24);
                        const years = diffDays / 365;
                        
                        return `${years.toFixed(2)} 年`;
                      })()}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  <CardTitle className="text-lg">总收益</CardTitle>
                </div>
                <div className="font-semibold text-lg">
                  {(() => {
                    if (!totalMarketValue) return "-";
                    try {
                      const initialCapital = baseInfoItem["初始本金"];
                      const currentBalance = totalMarketValue;
                      
                      if (initialCapital && currentBalance) {
                        const initCapNum = typeof initialCapital === 'string' 
                          ? parseFloat(initialCapital) 
                          : initialCapital;
                        const currBalNum = typeof currentBalance === 'string' 
                          ? parseFloat(currentBalance) 
                          : currentBalance;
                        
                        // 获取出入金净额
                        let netFundChange = 0;
                        if (fundChangeData && fundChangeData.success && fundChangeData.data && fundChangeData.data.length > 0) {
                          netFundChange = fundChangeData.data
                            .filter(change => change["操作"] !== "初始本金")
                            .reduce((sum, change) => {
                              const amount = change["金额"] * (change["操作"] === "入金" ? 1 : -1);
                              return sum + amount;
                            }, 0);
                        }
                          
                        if (!isNaN(initCapNum) && !isNaN(currBalNum) && initCapNum > 0) {
                          // 纯收益 = 当前余额 - 初始本金 - 出入金净额
                          const pureProfit = currBalNum - initCapNum - netFundChange;
                          
                          // 调整后的收益率计算：纯收益 / (初始本金 + 出入金净额)
                          const adjustedCapital = initCapNum + netFundChange;
                          const ratio = adjustedCapital > 0 ? (pureProfit / adjustedCapital) * 100 : 0;
                          
                          const colorClass = pureProfit >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <span className={colorClass}>
                              ${pureProfit >= 0 ? '+' : ''}{pureProfit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                              <span className="text-sm">({ratio.toFixed(2)}%)</span>
                            </span>
                          );
                        }
                      }
                      return "-";
                    } catch (error) {
                      console.error('计算盈亏比例时出错:', error);
                      return "-";
                    }
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="h-px bg-border"></div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">7日收益</dt>
                    <dd className="font-medium">
                      {(() => {
                        try {
                          // 使用图表数据
                          if (!chartData || chartData.length < 2) {
                            return "-"; // 没有足够的数据点
                          }
                          
                          // 获取最新的数据点
                          const latestData = chartData[chartData.length - 1];
                          const today = new Date();
                          let weekAgoData = null;
                          
                          // 从后向前遍历数据点，找到约7天前的数据点
                          for (let i = chartData.length - 2; i >= 0; i--) {
                            const dataPoint = chartData[i];
                            const itemDate = new Date(dataPoint.date);
                            const daysDiff = (today.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
                            
                            if (daysDiff >= 6) { // 至少有6天差距（约一周）
                              weekAgoData = dataPoint;
                              break;
                            }
                          }
                          
                          if (!weekAgoData) {
                            return "-"; // 没有找到足够早的数据点
                          }
                          
                          // 获取金额和出入金变化
                          const currentAmount = latestData.fundReturn;
                          const weekAgoAmount = weekAgoData.fundReturn;
                          
                          if (isNaN(currentAmount) || isNaN(weekAgoAmount) || weekAgoAmount <= 0) {
                            return "-";
                          }
                          
                          // 获取两个时间点的出入金数据
                          const currentFundChange = typeof latestData.fundChange === 'number' ? latestData.fundChange : 0;
                          const weekAgoFundChange = typeof weekAgoData.fundChange === 'number' ? weekAgoData.fundChange : 0;
                          
                          // 计算这一周的出入金净额
                          const weekFundChangeNet = currentFundChange - weekAgoFundChange;
                          
                          // 纯盈亏金额 = 当前金额 - 一周前金额 - 这一周的出入金净额
                          const pureProfitAmount = currentAmount - weekAgoAmount - weekFundChangeNet;
                          
                          // 计算纯盈亏百分比 = 纯盈亏 / 一周前金额
                          const pureProfitPercent = (pureProfitAmount / weekAgoAmount) * 100;
                          
                          // 根据纯盈亏的正负值设置颜色
                          const colorClass = pureProfitAmount >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <span className={colorClass}>
                              ${pureProfitAmount >= 0 ? '+' : ''}{pureProfitAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}
                              <span className="text-sm">({pureProfitPercent.toFixed(2)}%)</span>
                            </span>
                          );
                        } catch (error) {
                          console.error('计算7日盈亏时出错:', error);
                          return "-";
                        }
                      })()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">综合年化(APR)</dt>
                    <dd className="text-green-600">
                      {(() => {
                        try {
                          if (!totalMarketValue) return "-";
                          // 自行计算年化收益率
                          const initialCapitalRaw = baseInfoItem["初始本金"];
                          
                          // 计算实时市值
                          const currentBalanceRaw = totalMarketValue;
                          
                          // 转换为数字
                          const initialCapital = typeof initialCapitalRaw === 'string' 
                            ? parseFloat(initialCapitalRaw) 
                            : initialCapitalRaw;
                          const currentBalance = typeof currentBalanceRaw === 'string' 
                            ? parseFloat(currentBalanceRaw) 
                            : currentBalanceRaw;
                          
                          if (isNaN(initialCapital) || isNaN(currentBalance) || initialCapital <= 0) {
                            return "-";
                          }
                          
                          // 获取总出入金额
                          let totalFundChange = 0;
                          if (fundChangeData && fundChangeData.success && fundChangeData.data && fundChangeData.data.length > 0) {
                            totalFundChange = fundChangeData.data
                              .filter(change => change["操作"] !== "初始本金")
                              .reduce((sum, change) => {
                                const amount = change["金额"] * (change["操作"] === "入金" ? 1 : -1);
                                return sum + amount;
                              }, 0);
                          }
                          
                          // 计算纯收益：总市值 - 初始本金 - 总出入金
                          const pureProfit = currentBalance - initialCapital - totalFundChange;
                          
                          // 计算运行时长
                          const startDateStr = baseInfoItem["开始日期"];
                          if (!startDateStr) return "-";
                          
                          const startDate = new Date(startDateStr);
                          const currentDate = new Date();
                          const diffTime = currentDate.getTime() - startDate.getTime();
                          const diffDays = diffTime / (1000 * 3600 * 24);
                          const runningTimeYears = diffDays / 365;
                          
                          // 计算年化收益率: 使用实时本金计算 ((1 + 纯收益率) ^ (1/年数) - 1) * 100
                          if (runningTimeYears > 0) {
                            // 计算纯收益率：纯收益 / 实时本金（而非初始本金）
                            const realTimeCapital = initialCapital + totalFundChange; // 实时本金 = 初始本金 + 总出入金
                            const pureReturnRate = pureProfit / realTimeCapital;
                            // 年化收益率
                            const apr = (Math.pow(1 + pureReturnRate, 1 / runningTimeYears) - 1) * 100;
                            // 根据正负值设置颜色
                            const colorClass = apr >= 0 ? 'text-green-600' : 'text-red-600';
                            return (
                              <span className={colorClass}>
                                {apr.toFixed(2)}%
                              </span>
                            );
                          }
                        } catch (error) {
                          console.error('计算综合APR时出错:', error);
                          return "-";
                        }
                      })()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">7日年化(APR)</dt>
                    <dd className="text-green-600">
                      {(() => {
                        try {
                          // 使用图表数据
                          if (!chartData || chartData.length < 2) {
                            return "-"; // 没有足够的数据点
                          }
                          
                          // 获取最新的数据点
                          const latestData = chartData[chartData.length - 1];
                          const today = new Date();
                          let weekAgoData = null;
                          
                          // 从后向前遍历数据点，找到约7天前的数据点
                          for (let i = chartData.length - 2; i >= 0; i--) {
                            const dataPoint = chartData[i];
                            const itemDate = new Date(dataPoint.date);
                            const daysDiff = (today.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
                            
                            if (daysDiff >= 6) { // 至少有6天差距（约一周）
                              weekAgoData = dataPoint;
                              break;
                            }
                          }
                          
                          if (!weekAgoData) {
                            return "-"; // 没有找到足够早的数据点
                          }
                          
                          // 获取实时市值
                          let currentAmount = totalMarketValue;
                          
                          // 如果计算有问题，使用图表数据里的最新值
                          if (isNaN(currentAmount) || currentAmount <= 0) {
                            currentAmount = latestData.fundReturn;
                          }

                          // 使用一周前的数据
                          const weekAgoAmount = weekAgoData.fundReturn;
                          
                          if (isNaN(currentAmount) || isNaN(weekAgoAmount) || weekAgoAmount <= 0) {
                            return "-";
                          }
                          
                          // 获取两个时间点的出入金数据
                          const currentFundChange = typeof latestData.fundChange === 'number' ? latestData.fundChange : 0;
                          const weekAgoFundChange = typeof weekAgoData.fundChange === 'number' ? weekAgoData.fundChange : 0;
                          
                          // 计算这一周的出入金净额
                          const weekFundChangeNet = currentFundChange - weekAgoFundChange;
                          
                          // 纯收益金额 = 当前金额 - 一周前金额 - 这一周的出入金净额
                          const pureWeeklyProfit = currentAmount - weekAgoAmount - weekFundChangeNet;
                          
                          // 计算实际天数，确保至少为1天，避免除以零
                          const daysDiff = Math.max(1, (today.getTime() - new Date(weekAgoData.date).getTime()) / (1000 * 3600 * 24));
                          
                          // 计算纯周收益率
                          const weekAgoRealTimeCapital = weekAgoAmount - pureWeeklyProfit + weekAgoFundChange; // 一周前的实时本金
                          const pureWeeklyReturn = pureWeeklyProfit / weekAgoRealTimeCapital;
                          
                          // 计算年化收益率: ((1 + 纯周收益率) ^ (365/天数) - 1) * 100
                          const weeklyAPR = (Math.pow(1 + pureWeeklyReturn, 365 / daysDiff) - 1) * 100;
                          
                          // 根据纯收益率的正负值设置颜色
                          const colorClass = weeklyAPR >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <span className={colorClass}>
                              {weeklyAPR.toFixed(2)}%
                            </span>
                          );
                          
                        } catch (error) {
                          console.error('计算7日APR时出错:', error);
                          return "-";
                        }
                      })()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">30日年化(APR)</dt>
                    <dd className="text-green-600">
                      {(() => {
                        try {
                          // 使用图表数据
                          if (!chartData || chartData.length < 2) {
                            return "-"; // 没有足够的数据点
                          }
                          
                          // 获取最新的数据点
                          const latestData = chartData[chartData.length - 1];
                          const today = new Date();
                          let monthAgoData = null;
                          
                          // 从后向前遍历数据点，找到约30天前的数据点
                          for (let i = chartData.length - 2; i >= 0; i--) {
                            const dataPoint = chartData[i];
                            const itemDate = new Date(dataPoint.date);
                            const daysDiff = (today.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
                            
                            if (daysDiff >= 30) { // 至少有30天差距（约一个月）
                              monthAgoData = dataPoint;
                              break;
                            }
                          }
                          
                          if (!monthAgoData) {
                            return "-"; // 没有找到足够早的数据点
                          }
                          
                          // 获取实时市值
                          let currentAmount = totalMarketValue;
                          
                          // 如果计算有问题，使用图表数据里的最新值
                          if (isNaN(currentAmount) || currentAmount <= 0) {
                            currentAmount = latestData.fundReturn;
                          }

                          // 使用一个月前的数据
                          const monthAgoAmount = monthAgoData.fundReturn;
                          
                          if (isNaN(currentAmount) || isNaN(monthAgoAmount) || monthAgoAmount <= 0) {
                            return "-";
                          }
                          
                          // 获取两个时间点的出入金数据
                          const currentFundChange = typeof latestData.fundChange === 'number' ? latestData.fundChange : 0;
                          const monthAgoFundChange = typeof monthAgoData.fundChange === 'number' ? monthAgoData.fundChange : 0;
                          
                          // 计算这一周的出入金净额
                          const monthFundChangeNet = currentFundChange - monthAgoFundChange;
                          
                          // 纯收益金额 = 当前金额 - 一个月前金额 - 这一个月的出入金净额
                          const pureMonthProfit = currentAmount - monthAgoAmount - monthFundChangeNet;
                          
                          // 计算实际天数，确保至少为1天，避免除以零
                          const daysDiff = Math.max(1, (today.getTime() - new Date(monthAgoData.date).getTime()) / (1000 * 3600 * 24));
                          
                          // 计算纯月收益率
                          const monthAgoRealTimeCapital = monthAgoAmount - pureMonthProfit + monthAgoFundChange; // 一个月前的实时本金
                          const pureMonthReturn = pureMonthProfit / monthAgoRealTimeCapital;
                          
                          // 计算年化收益率: ((1 + 纯月收益率) ^ (365/天数) - 1) * 100
                          const monthlyAPR = (Math.pow(1 + pureMonthReturn, 365 / daysDiff) - 1) * 100;
                          
                          // 根据纯收益率的正负值设置颜色
                          const colorClass = monthlyAPR >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <span className={colorClass}>
                              {monthlyAPR.toFixed(2)}%
                            </span>
                          );
                          
                        } catch (error) {
                          console.error('计算30日APR时出错:', error);
                          return "-";
                        }
                      })()}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg">
          <p>未能获取数据</p>
        </div>
      )}
      
      {!error && baseInfoItem && (
        <CurveChart 
          chartData={chartData}
          chartMode={chartMode}
          setChartMode={setChartMode}
          comparisonAssets={comparisonAssets}
          selectedComparisonAsset={selectedComparisonAsset}
          setSelectedComparisonAsset={setSelectedComparisonAsset}
          visibleLines={visibleLines}
          setVisibleLines={setVisibleLines}
          isLoading={chartLoading}
        />
      )}

      {/* 持仓策略模块 - 始终显示，在加载中会显示加载状态 */}
      {!error && baseInfoItem && (
        <Card className="animate-in fade-in duration-700">
          <Tabs value={activeHoldingTab} onValueChange={(value) => setActiveHoldingTab(value as 'current' | 'historical')}>
            <CardHeader className="flex flex-row items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
                <CardTitle className="text-lg">持仓策略</CardTitle>
              </div>
              
              <TabsList>
                <TabsTrigger value="current">
                  当前持仓
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                    {loading ? '...' : (holdingStrategies?.success ? holdingStrategies.data.length : 0)}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="historical">
                  历史持仓
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                    {loading ? '...' : (historicalHoldings?.success ? historicalHoldings.data.length : 0)}
                  </span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-0">
              {holdingLoading ? (
                <div className="flex flex-col items-center justify-center h-60 gap-2">
                  <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
                  <p className="text-muted-foreground">持仓加载中...</p>
                </div>
              ) : (
                <TabsContent className="mt-0" value="current">
                { holdingStrategies?.success && holdingStrategies.data.length > 0 ? (
              <>
                {/* 桌面版表格 - 在中等及以上屏幕显示 */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead style={{width: '6%'}}>标的</TableHead>
                        <TableHead style={{width: '8%'}}>策略</TableHead>
                        <TableHead className="text-center" style={{width: '10%'}}>开仓日期</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>仓位</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>占比</TableHead>
                        <TableHead className="text-right" style={{width: '12%'}}>成本</TableHead>
                        <TableHead className="text-right" style={{width: '12%'}}>市值</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>盈亏</TableHead>
                        <TableHead className="text-right" style={{width: '12%'}}>备注</TableHead>
                        <TableHead className="text-right" style={{width: '14%'}}>更新</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdingStrategies?.success && holdingStrategies.data.map((strategy, index) => {
                        // 处理进场价格和市值数据
                        const marketValue = strategy["实时估值"] ? strategy["实时估值"] : 
                        strategy["实时价格"] ? strategy["实时价格"] * parseFloat(strategy["仓位"]) : 0;
                        
                        // 计算持仓成本: 优先使用"成本"字段，如果没有则计算"仓位"×"进场"
                        const holdingCost = strategy["成本"]? 
                          strategy["成本"] : 
                          parseFloat(strategy["仓位"]) * strategy["进场"];
                        
                        const profit = marketValue - holdingCost;
                        const profitPercent = (profit / holdingCost) * 100;
                        
                        // 计算比例
                        const proportion = totalMarketValue ? marketValue / totalMarketValue : 0;
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{strategy["标的"] || "-"}</TableCell>
                            <TableCell>
                              {strategy["策略"] ? (
                                <Badge variant="secondary" className="font-normal text-xs">
                                  {strategy["策略"]}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-center">{strategy["进场日期"] || "-"}</TableCell>
                            <TableCell className="text-right">{strategy["仓位"] || "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
                                <div className="w-16 mt-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{width: `${Math.min(proportion * 100, 100)}%`}}></div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-medium">${holdingCost ? holdingCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</span>
                                {strategy["进场"] && <div className="text-muted-foreground text-sm">
                                  <span>成本价: ${strategy["进场"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-medium">${marketValue ? marketValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</span>
                                {strategy["实时价格"] && <div className="text-muted-foreground text-sm">
                                  <span>最新价: ${strategy["实时价格"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`flex flex-col items-end ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                <span className="font-medium">
                                  {profit >= 0 ? "+" : ""}
                                  ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </span>
                                <span className="text-sm">
                                  {profit >= 0 ? "+" : ""}
                                  {profitPercent.toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{strategy["备注"] || '-'}</TableCell>
                            <TableCell className="text-right">{strategy["更新日期"] || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                  
                {/* 移动版卡片布局 - 在小屏幕显示 */}
                <div className="md:hidden space-y-3 p-4 pt-0">
                  {holdingStrategies.data.map((strategy, index) => {
                    // 处理进场价格和市值数据
                    const marketValue = strategy["实时估值"] ? strategy["实时估值"] : 
                        strategy["实时价格"] ? strategy["实时价格"] * parseFloat(strategy["仓位"]) : 0;
                    
                    // 计算持仓成本: 优先使用"成本"字段，如果没有则计算"仓位"×"进场"
                    const holdingCost = strategy["成本"] ? 
                      strategy["成本"] : 
                      parseFloat(strategy["仓位"]) * strategy["进场"];
                    
                    const profit = marketValue - holdingCost;
                    const profitPercent = (profit / holdingCost) * 100;
                    
                    // 计算比例
                    const proportion = totalMarketValue && holdingCost ? holdingCost / totalMarketValue : 0;
                    
                    return (
                      <div key={index} className="rounded-lg border bg-card text-card-foreground p-3">
                        {/* 标题栏 */}
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <strong className="font-medium">{strategy["标的"] || '-'}</strong>
                          </div>
                          <div>
                            {strategy["策略"] ? (
                              <Badge variant="secondary" className="font-normal text-xs">
                                {strategy["策略"]}
                              </Badge>
                            ) : '-'}
                          </div>
                        </div>
                        
                        {/* 开仓日期 */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              开仓日期
                            </div>
                            <div className="font-medium">{strategy["进场日期"] || "-"}</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              更新
                            </div>
                            <div className="flex items-center justify-end">
                              <span className="font-medium">{strategy["更新日期"] || "-"}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 仓位信息 */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                              </svg>
                              仓位
                            </div>
                            <div className="font-medium">{strategy["仓位"] || "-"}</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                              </svg>
                              占比
                            </div>
                            <div className="flex items-center justify-end">
                              <span className="font-medium">{(proportion * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 价格信息 */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                              </svg>
                              成本
                            </div>
                            <div className="flex flex-col">
                              <div className="font-medium">${holdingCost ? holdingCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</div>
                              {strategy["进场"] && <div className="text-muted-foreground text-sm">
                                <span>成本价: ${strategy["进场"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                              </div>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                              </svg>
                              市值
                            </div>
                            <div className="flex flex-col items-end">
                              <div className="font-medium">${marketValue ? marketValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</div>
                              {strategy["实时价格"] && <div className="text-muted-foreground text-sm">
                                <span>最新价: ${strategy["实时价格"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                              </div>}
                            </div>
                          </div>
                        </div>
                        
                        {/* 盈亏信息 */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                              </svg>
                              盈亏
                            </div>
                            <div className={`font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {profit >= 0 ? "+" : ""}
                              ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}({profitPercent.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                        
                        {/* 备注信息 (如果有) */}
                        {strategy["备注"] && (
                          <div className="text-sm mt-2 pt-2 border-t text-muted-foreground flex items-start gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            {strategy["备注"]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-muted-foreground">当前无持仓</p>
              </div>
                  )}
                </TabsContent>
              )}
                <TabsContent className="mt-0" value="historical">
                  { historicalHoldings?.success && historicalHoldings.data.length > 0 ? (
              <>
              {/* 桌面版表格 - 在中等及以上屏幕显示 */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead style={{width: '6%'}}>标的</TableHead>
                        <TableHead style={{width: '8%'}}>策略</TableHead>
                        <TableHead className="text-center" style={{width: '20%'}}>交易日期</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>仓位</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>占比</TableHead>
                        <TableHead className="text-right" style={{width: '12%'}}>成本</TableHead>
                        <TableHead className="text-right" style={{width: '12%'}}>平仓市值</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>盈亏</TableHead>
                        <TableHead className="text-right" style={{width: '14%'}}>备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicalHoldings?.success && historicalHoldings.data.map((strategy, index) => {
                        // 处理进场价格和平仓价值数据
                        const entryPrice = typeof strategy["进场"] === 'string' ? parseFloat(strategy["进场"]) : strategy["进场"];
                        
                        // 计算持仓成本: 优先使用"成本"字段，如果没有则计算"仓位"×"进场"
                        const entryCost = strategy["成本"]? 
                          strategy["成本"] : 
                          (strategy["仓位"] && strategy["进场"]) ? 
                            parseFloat(strategy["仓位"]) * strategy["进场"] : 
                            entryPrice;
                        
                        // 计算平仓价值: 优先取"实时估值"字段，如果该字段为空，则通过"出场"*"仓位"计算得出
                        let closingValue;
                        if (strategy["实时估值"]) {
                          closingValue = strategy["实时估值"];
                        } else if (strategy["出场"] && strategy["仓位"]) {
                          const exitPrice = strategy["出场"];
                          const position = typeof strategy["仓位"] === 'string' ? parseFloat(strategy["仓位"]) : strategy["仓位"];
                          closingValue = exitPrice * position;
                        } else {
                          closingValue = null;
                        }
                        
                        // 计算盈亏
                        const profit = strategy["盈亏"];
                        
                        // 计算实时市值总额
                        // 使用状态中的总市值变量
                        
                        const proportion = entryCost && totalMarketValue ? entryCost / totalMarketValue : 0;
                        const profitPercent = entryCost > 0 ? (profit / entryCost) * 100 : 0;
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{strategy["标的"] || "-"}</TableCell>
                            <TableCell>
                              {strategy["策略"] ? (
                                <Badge variant="secondary" className="font-normal text-xs">
                                  {strategy["策略"]}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-center">{strategy["进场日期"]} - {strategy["更新日期"]}</TableCell>
                            <TableCell className="text-right">{strategy["仓位"]}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
                                <div className="w-16 mt-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{width: `${Math.min(proportion * 100, 100)}%`}}></div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <div>${entryCost ? entryCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</div>
                                {strategy["进场"] && <div className="text-muted-foreground text-sm">
                                  <span>成本价: ${strategy["进场"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <div>${closingValue ? closingValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</div>
                                {strategy["出场"] && <div className="text-muted-foreground text-sm">
                                  <span>平仓价: ${strategy["出场"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`flex flex-col items-end ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                <span className="font-medium">
                                  {profit >= 0 ? "+" : ""}
                                  ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </span>
                                <span className="text-sm">
                                  {profit >= 0 ? "+" : ""}
                                  {profitPercent.toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{strategy["备注"] || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* 移动版卡片 - 在小屏幕显示 */}
                <div className="md:hidden space-y-3 py-2">
                  {historicalHoldings.data.map((strategy, index) => {
                    // 处理进场价格和平仓价值数据
                    const entryPrice = typeof strategy["进场"] === 'string' ? parseFloat(strategy["进场"]) : strategy["进场"];
                    
                    // 计算持仓成本: 优先取"成本"字段，如果没有则计算"仓位"×"进场"
                    const entryCost = strategy["成本"]? 
                          strategy["成本"] : 
                          (strategy["仓位"] && strategy["进场"]) ? 
                            parseFloat(strategy["仓位"]) * strategy["进场"] : 
                            entryPrice;
                    
                    // 计算平仓价值: 优先取"实时估值"字段，如果该字段为空，则通过"出场"*"仓位"计算得出
                    let closingValue;
                    if (strategy["实时估值"]) {
                      closingValue = strategy["实时估值"];
                    } else if (strategy["出场"] && strategy["仓位"]) {
                      const exitPrice = strategy["出场"];
                      const position = typeof strategy["仓位"] === 'string' ? parseFloat(strategy["仓位"]) : strategy["仓位"];
                      closingValue = exitPrice * position;
                    } else {
                      closingValue = null;
                    }
                    
                    // 计算盈亏
                    const profit = strategy["盈亏"];
                    // 计算实时市值总额
                    // 使用状态中的总市值变量

                    const proportion = entryCost ? entryCost / totalMarketValue : 0;
                    const profitPercent = entryCost > 0 ? (profit / entryCost) * 100 : 0;
                    
                    return (
                      <div key={index} className="rounded-lg border bg-card text-card-foreground p-3">
                        {/* 标题栏 */}
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <strong className="font-medium">{strategy["标的"] || '-'}</strong>
                          </div>
                          <div>
                            {strategy["策略"] ? (
                              <Badge variant="secondary" className="font-normal text-xs">
                                {strategy["策略"]}
                              </Badge>
                            ) : '-'}
                          </div>
                        </div>
                        
                        {/* 开仓日期 */}
                        <div className="mb-3">
                        <div className="grid grid-cols-2 gap-4 items-start">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              开仓日期
                            </div>
                            <div className="font-medium">{strategy["进场日期"] || "-"}</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              平仓日期
                            </div>
                            <div className="font-medium">{strategy["更新日期"] || "-"}</div>
                          </div>
                        </div>
                        </div>
                        
                        {/* 仓位信息 */}
                        <div className="mb-3">
                          <div className="grid grid-cols-2 gap-4 items-start">
                            <div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                                </svg>
                                仓位
                              </div>
                              <div className="font-medium break-all" style={{maxWidth: '150px', wordBreak: 'break-word'}}>{strategy["仓位"] || "-"}</div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                </svg>
                                占比
                              </div>
                              <div className="flex items-center justify-end">
                                <span className="font-medium">{(proportion * 100).toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* 价格信息 */}
                        <div className="mb-3">
                          <div className="grid grid-cols-2 gap-4 items-start">
                            <div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                </svg>
                                成本
                              </div>
                              <div className="flex flex-col">
                                <div className="font-medium">${entryCost ? entryCost.toLocaleString(undefined, {maximumFractionDigits: 0}) : "-"}</div>
                                {strategy["进场"] && <div className="text-muted-foreground text-sm">
                                  <span>成本价: ${strategy["进场"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                </svg>
                                平仓市值
                              </div>
                              <div className="flex flex-col">
                                <div className="font-medium">${closingValue ? closingValue.toLocaleString(undefined, {maximumFractionDigits: 0}) : "-"}</div>
                                {strategy["出场"] && <div className="text-muted-foreground text-sm">
                                  <span>平仓价: ${strategy["出场"].toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 持仓盈亏 */}
                        <div className="mb-3">
                          <div className="grid grid-cols-2 gap-4 items-start">
                            <div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                                </svg>
                                盈亏
                              </div>
                              <div className={`font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {profit >= 0 ? "+" : ""}
                                ${profit.toLocaleString(undefined, {maximumFractionDigits: 0})}({profitPercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* 备注信息 (如果有) */}
                        {strategy["备注"] && (
                          <div className="text-sm mt-2 pt-2 border-t text-muted-foreground flex items-start gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            {strategy["备注"]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-muted-foreground">暂无历史持仓</p>
              </div>
                  )}
                </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}

      {/* 出入金模块 */}
      {!loading && !error &&
        fundChangeData && fundChangeData.success && (
        <Card className="animate-in fade-in duration-700 mt-6">
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <CardTitle className="text-lg">出入金</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <FundChange
              fundChangeData={fundChangeData} 
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}