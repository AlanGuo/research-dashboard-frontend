"use client"

import { useParams } from 'next/navigation'
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { MarketReference } from "@/components/market-reference"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// 图表数据类型
interface ChartDataPoint {
  date: string;
  fundReturnPct: number; // 策略收益百分比变化率
  fundReturn: number;    // 策略收益绝对值
  [key: string]: string | number; // 动态比较资产数据
}

// 策略实时估值数据类型
interface FundRealtimeItem {
  "市值": number;
  "日期": string;
  "备注"?: string;
}

interface FundRealtimeResponse {
  success: boolean;
  data: FundRealtimeItem[];
  timestamp: string;
}

// 持仓策略数据类型
interface HoldingStrategyItem {
  "策略": string;
  "标的": string;
  "仓位": string;
  "进场日期": string;
  "进场": number;
  "进场价值": number;
  "出场": number;
  "盈亏": number;
  "实时估值": number;
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
  "初始本金": number;
  "初始价格": string;
  "可用金额": number;
  "市值": number;
  "对比": string;
  "备注": string;
}

interface BaseInfoResponse {
  success: boolean;
  data: FundDataItem[];
  timestamp: string;
}

export default function UserPage() {
  // 使用useParams获取动态路由参数
  const params = useParams();
  const username = params.username as string;

  const [baseInfoResponse, setBaseInfoResponse] = useState<BaseInfoResponse | null>(null);
  const [fundRealtimeData, setFundRealtimeData] = useState<FundRealtimeResponse | null>(null);
  const [holdingStrategies, setHoldingStrategies] = useState<HoldingStrategyResponse | null>(null);
  const [historicalHoldings, setHistoricalHoldings] = useState<HoldingStrategyResponse | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  // 持仓标签页状态
  const [activeHoldingTab, setActiveHoldingTab] = useState<'current' | 'historical'>('current');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 用于控制曲线的显示/隐藏
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    fundReturnPct: true,
    fundReturn: true
  });
  
  // 存储比较资产列表
  const [comparisonAssets, setComparisonAssets] = useState<string[]>([]);
  
  // 存储比较资产数据
  const [assetDataMaps, setAssetDataMaps] = useState<Map<string, Map<string, number>>>(new Map());
  
  // 图表模式：百分比模式或绝对值模式
  const [chartMode, setChartMode] = useState<'percentage' | 'absolute'>('percentage');

  // 计算实时市值：可用金额 + 所有当前持仓的市值之和
  const calculateTotalMarketValue = (): number => {
    try {
      if (holdingStrategies && holdingStrategies.success && holdingStrategies.data && baseInfoResponse && baseInfoResponse.success && baseInfoResponse.data && baseInfoResponse.data.length > 0) {
        const availableFunds = baseInfoResponse.data[0]["可用金额"];
        if (!availableFunds) throw new Error("可用金额不存在");
        // 计算所有持仓的市值总和
        const totalHoldingsValue = holdingStrategies.data.reduce((sum, strategy) => {
          const marketValue = strategy["实时估值"] || 0;
          return sum + marketValue;
        }, 0);
        
        // 总市值 = 可用金额 + 持仓市值总和
        const totalMarketValue = availableFunds + totalHoldingsValue;
        
        if (!isNaN(totalMarketValue) && totalMarketValue > 0) {
          return totalMarketValue;
        }
      }
      
      // 如果计算有问题，使用 FundDataItem 里的"市值"
      return baseInfoResponse?.data?.[0]?.["市值"] || 0;
    } catch (error) {
      console.error('计算实时市值时出错:', error);
      return baseInfoResponse?.data?.[0]?.["市值"] || 0;
    }
  };
  
  // 获取策略数据
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
        setBaseInfoResponse(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching page data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setLoading(false);
      }
    }
    
    fetchPageData();
  }, [username]);
  
  // 获取比较资产数据 - 在获取到实时数据后调用
  const fetchComparisonData = async (asset: string, startDate: string, endDate: string, assetDataMaps: Map<string, Map<string, number>>) => {
    try {
      // 计算需要获取的天数
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 3; // 加3天确保覆盖全部时间
      const bars = Math.max(daysDiff, 100); // 获取足够多的数据
      
      // 将资产名称转换为小写并添加usdt后缀
      const symbol = `${asset.toLowerCase()}usdt`;
      const response = await fetch(`/api/kline/${symbol}?interval=1D&bars=${bars}`);
      
      if (!response.ok) {
        throw new Error(`${asset} API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // 处理返回的数据并存入assetDataMaps
      if (data?.success && data.data?.candles) {
        const assetKey = asset.toLowerCase();
        // 创建该资产的数据映射
        const assetDataMap = new Map<string, number>();
        assetDataMaps.set(assetKey, assetDataMap);
        
        // 按日期排序数据
        const sortedData = [...data.data.candles].sort((a, b) => {
          return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
        });
        
        // 将数据存入映射
        sortedData.forEach(item => {
          if (item.datetime && item.close) {
            const dateKey = new Date(item.datetime).toISOString().split('T')[0];
            assetDataMap.set(dateKey, item.close);
          }
        });
        
        console.log(`已获取${asset}数据，共${assetDataMap.size}条`);
      }
      
      return data;
    } catch (err) {
      console.error(`Error fetching ${asset} data:`, err);
      return null;
    }
  };

  // 获取策略实时估值数据
  useEffect(() => {
    async function fetchFundRealtimeData() {
      try {
        // 直接使用路由参数中的username
        if (!username || !baseInfoResponse) {
          return; // 如果username为空或基本信息未加载，不进行请求
        }
        
        // 同时获取持仓策略数据
        try {
          // 获取当前持仓
          const holdingResponse = await fetch(`/api/holding/${username}?status=持仓`);
          
          if (holdingResponse.ok) {
            const holdingData = await holdingResponse.json();
            setHoldingStrategies(holdingData);
          } else {
            console.error(`Holding strategies API request failed with status ${holdingResponse.status}`);
          }
          
          // 获取历史持仓
          const historicalResponse = await fetch(`/api/holding/${username}?except=持仓`);
          
          if (historicalResponse.ok) {
            const historicalData = await historicalResponse.json();
            setHistoricalHoldings(historicalData);
          } else {
            console.error(`Historical holdings API request failed with status ${historicalResponse.status}`);
          }
        } catch (holdingErr) {
          console.error('Error fetching holdings data:', holdingErr);
        }
        const response = await fetch(`/api/realtime/${username}`);
        
        if (!response.ok) {
          throw new Error(`Fund realtime data API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        setFundRealtimeData(data);
        
        // 如果获取到实时数据，则获取对应时间范围的比较资产数据
        if (data.success && data.data.length > 0) {
          // 将数据按日期排序（从早到晚）
          const sortedData = [...data.data].sort((a, b) => {
            return new Date(a["日期"]).getTime() - new Date(b["日期"]).getTime();
          });
          
          // 获取最早和最晚的日期
          const earliestDate = sortedData[0]["日期"];
          const latestDate = sortedData[sortedData.length - 1]["日期"];
          
          // 获取基本信息以解析对比字段
          if (baseInfoResponse && baseInfoResponse.success && baseInfoResponse.data.length > 0) {
            const comparisonString = baseInfoResponse.data[0]["对比"] || "";
            const assets = comparisonString ? comparisonString.split(',').map(asset => asset.trim()).filter(asset => asset) : [];
            
            // 更新比较资产列表
            setComparisonAssets(assets);
            
            // 初始化可见性设置
            const newVisibleLines: Record<string, boolean> = {
              fundReturnPct: true,
              fundReturn: true
            };
            
            // 创建共享的比较资产日期到数据的映射
            const newAssetDataMaps = new Map<string, Map<string, number>>();
            
            // 为每个资产获取数据
            for (const asset of assets) {
              // 添加每个资产的可见性设置
              newVisibleLines[`${asset.toLowerCase()}PricePct`] = true;
              newVisibleLines[`${asset.toLowerCase()}Price`] = true;
              
              // 获取资产数据
              await fetchComparisonData(asset, earliestDate, latestDate, newAssetDataMaps);
            }
            
            // 将资产数据保存到状态
            setAssetDataMaps(newAssetDataMaps);
            
            // 更新可见性设置
            setVisibleLines(newVisibleLines);
          }
        }
      } catch (err) {
        console.error('Error fetching fund realtime data:', err);
        // 不设置页面错误状态，因为这只是图表数据
      }
    }
    
    if (username && baseInfoResponse) {
      fetchFundRealtimeData();
    }
  }, [username, baseInfoResponse]);
  
  // 生成图表数据
  useEffect(() => {
    // 图表数据生成逻辑，与原页面相同
    // 为了简化，这里只保留基本结构
    if (fundRealtimeData?.success && fundRealtimeData.data && fundRealtimeData.data.length > 0 && baseInfoResponse?.success) {
      // 将策略实时数据按日期排序（从早到晚）
      const sortedFundData = [...fundRealtimeData.data].sort((a, b) => {
        return new Date(a["日期"]).getTime() - new Date(b["日期"]).getTime();
      });
      
      // 使用全部策略数据
      const allFundData = sortedFundData;
      
      // 生成图表数据
      const newChartData: ChartDataPoint[] = [];
      
      // 创建策略日期到数据的映射
      const fundDataMap = new Map<string, number>();
      allFundData.forEach(item => {
        // 确保有效的日期和金额
        if (item["日期"] && item["市值"]) {
          // 使用标准化的日期格式作为键
          const dateKey = new Date(item["日期"]).toISOString().split('T')[0];
          const balance = typeof item["市值"] === 'string' 
            ? parseFloat(item["市值"]) 
            : item["市值"];
            
          if (!isNaN(balance)) {
            fundDataMap.set(dateKey, balance);
          }
        }
      });
      
      // 使用状态中保存的比较资产数据
      console.log('使用比较资产数据，映射大小:', assetDataMaps.size, '资产列表:', comparisonAssets);
      
      // 获取所有日期并排序
      const allDates = [...new Set([...fundDataMap.keys()])];
      allDates.sort();
      
      // 获取初始值，用于计算百分比变化
      let initialFundValue: number | undefined;
      const initialAssetValues = new Map<string, number>();
      
      // 使用baseInfoResponse中的初始值
      if (baseInfoResponse?.data && baseInfoResponse.data.length > 0) {
        initialFundValue = baseInfoResponse.data[0]["初始本金"];
        
        // 对比资产列表
        const comparisonString = baseInfoResponse.data[0]["对比"] || "";
        const assets = comparisonString.split(',').map(asset => asset.trim()).filter(asset => asset);
        
        // 解析初始价格字段，同样是逗号分隔
        const initialPricesString = baseInfoResponse.data[0]["初始价格"] || "";
        const initialPrices = initialPricesString.split(',').map(price => price.trim());
        
        // 为每个资产设置初始价格
        assets.forEach((asset, index) => {
          const assetKey = asset.toLowerCase();
          if (index < initialPrices.length) {
            const priceValue = parseFloat(initialPrices[index]);
            if (!isNaN(priceValue)) {
              initialAssetValues.set(assetKey, priceValue);
            }
          }
        });
      }
      
      // 如果没有初始值，使用第一个数据点
      if (initialFundValue === undefined && allDates.length > 0) {
        const firstDateKey = allDates[0];
        initialFundValue = fundDataMap.get(firstDateKey);
      }
      
      // 处理其他比较资产的初始值
      for (const [asset, dataMap] of assetDataMaps.entries()) {
        if (!initialAssetValues.has(asset) && dataMap.size > 0) {
          const assetDates = [...dataMap.keys()].sort();
          if (assetDates.length > 0) {
            const firstValue = dataMap.get(assetDates[0]);
            if (firstValue !== undefined) {
              initialAssetValues.set(asset, firstValue);
            }
          }
        }
      }
      
      // 如果还是没有初始值，使用默认值
      if (initialFundValue === undefined) {
        initialFundValue = 10000; // 默认初始资金
      }
      
      // 为其他比较资产设置默认初始值
      for (const asset of comparisonAssets) {
        const assetKey = asset.toLowerCase();
        if (!initialAssetValues.has(assetKey)) {
          initialAssetValues.set(assetKey, 1000); // 默认初始值
        }
      }
      
      // 为每个策略日期创建数据点
      allDates.forEach(dateKey => {
        const fundValue = fundDataMap.get(dateKey);
        
        // 创建数据点对象
        const dataPoint: ChartDataPoint = {
          date: dateKey,
          fundReturnPct: 0,
          fundReturn: 0
        };
        
        // 处理所有比较资产的数据
        for (const asset of comparisonAssets) {
          const assetKey = asset.toLowerCase();
          const assetDataMap = assetDataMaps.get(assetKey) || new Map<string, number>();
          let assetValue = assetDataMap.get(dateKey);
          
          // 如果当天没有资产数据，尝试找前一天的
          if (assetValue === undefined && assetDataMap.size > 0) {
            // 创建日期对象并减去一天
            const prevDate = new Date(dateKey);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateKey = prevDate.toISOString().split('T')[0];
            assetValue = assetDataMap.get(prevDateKey);
            
            // 如果还是没有，再往前找一天
            if (assetValue === undefined) {
              prevDate.setDate(prevDate.getDate() - 1);
              const prevDateKey2 = prevDate.toISOString().split('T')[0];
              assetValue = assetDataMap.get(prevDateKey2);
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
              assetValue = initialAssetValues.get(assetKey) || 1000;
            }
          }
          
          // 计算百分比和绝对值
          const initialValue = initialAssetValues.get(assetKey) || 1000;
          const pctChange = ((assetValue / initialValue) - 1) * 100;
          
          // 添加到数据点
          dataPoint[`${assetKey}PricePct`] = pctChange;
          dataPoint[`${assetKey}Price`] = assetValue;
        }
        
        // 只要有策略数据，就添加数据点
        if (fundValue !== undefined && initialFundValue !== undefined) {
          // 计算策略百分比变化
          const fundReturnPct = ((fundValue / initialFundValue) - 1) * 100;
          
          // 设置策略数据
          dataPoint.fundReturnPct = fundReturnPct;
          dataPoint.fundReturn = fundValue;
          
          // 格式化日期显示
          dataPoint.date = new Date(dateKey).toLocaleDateString();
          
          // 添加数据点
          newChartData.push(dataPoint);
        }
      });
      
      // 如果成功生成了数据点，则使用真实数据
      if (newChartData.length > 0) {
        setChartData(newChartData);
      }
    }
  }, [fundRealtimeData, baseInfoResponse, assetDataMaps, comparisonAssets]);

  // 渲染UI
  return (
    <div className="container mx-auto py-6 md:py-10 px-4 md:px-6 space-y-6 md:space-y-8">
      { !username || loading ? (
        <div className="flex flex-col justify-center items-center py-4 space-y-2 h-[50vh]">
          <div className="h-10 w-10 border-t-2 border-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground mt-2">加载数据中...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">加载数据时出错</p>
          <p>{error}</p>
        </div>
      ) : baseInfoResponse && baseInfoResponse.success && baseInfoResponse.data.length > 0 ? (
        <div className="space-y-6 md:space-y-8">
          {/* 市场参考板块 */}
          <MarketReference />
          
          {/* 标题区域 */}
          <div className="animate-in fade-in duration-700 flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">CRYPTO趋势策略</h1>
              <p className="text-base md:text-lg text-muted-foreground mt-2">{baseInfoResponse.data[0]["备注"]}</p>
            </div>
            <ThemeToggle />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-700">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="p-4 flex flex-col space-y-1.5 border-b">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 md:text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  概况
                </h3>
              </div>
              <div className="p-4">
                <dl className="space-y-3">
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground font-medium">实时市值</dt>
                    <dd className="font-semibold">
                      {`$${calculateTotalMarketValue().toLocaleString()}`}
                    </dd>
                  </div>
                  <div className="h-px bg-border my-2"></div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">初始本金</dt>
                    <dd className="">${baseInfoResponse.data[0]["初始本金"].toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">开始日期</dt>
                    <dd className="">{new Date(baseInfoResponse.data[0]["开始日期"]).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">运行时长</dt>
                    <dd className="">{(() => {
                        // 计算运行时长
                        const startDateStr = baseInfoResponse.data[0]["开始日期"];
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
              </div>
            </div>
            
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="p-4 flex flex-col space-y-1.5 border-b">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 md:text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  收益
                </h3>
              </div>
              <div className="p-4">
                <dl className="space-y-1 md:space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground font-medium">实时盈亏</dt>
                    <dd className="font-semibold">
                      {(() => {
                        try {
                          const initialCapital = baseInfoResponse.data[0]["初始本金"];
                          
                          // 计算实时市值
                          const currentBalance = calculateTotalMarketValue();
                          
                          if (initialCapital && currentBalance) {
                            const initCapNum = typeof initialCapital === 'string' 
                              ? parseFloat(initialCapital) 
                              : initialCapital;
                            const currBalNum = typeof currentBalance === 'string' 
                              ? parseFloat(currentBalance) 
                              : currentBalance;
                              
                            if (!isNaN(initCapNum) && !isNaN(currBalNum) && initCapNum > 0) {
                              const profit = currBalNum - initCapNum;
                              const ratio = (profit / initCapNum) * 100;
                              const colorClass = profit >= 0 ? 'text-green-600' : 'text-red-600';
                              
                              return (
                                <span className={colorClass}>
                                  ${profit >= 0 ? '+' : ''}{profit.toLocaleString(undefined, {maximumFractionDigits: 2})} ({ratio.toFixed(2)}%)
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
                    </dd>
                  </div>
                  <div className="h-px bg-border my-2"></div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">7日盈亏</dt>
                    <dd className="font-medium">
                      {(() => {
                        try {
                          // 获取实时数据
                          if (!fundRealtimeData?.success || !fundRealtimeData.data || fundRealtimeData.data.length < 2) {
                            return "-"; // 没有足够的数据点
                          }
                          
                          // 将数据按日期排序（从晚到早）
                          const sortedData = [...fundRealtimeData.data].sort((a, b) => {
                            return new Date(b["日期"]).getTime() - new Date(a["日期"]).getTime();
                          });
                          
                          // 获取最新和7天前的数据
                          const latestData = sortedData[0];
                          
                          // 找到距离最新数据约有7天的数据点
                          const latestDate = new Date(latestData["日期"]);
                          let weekAgoData = null;
                          
                          for (const item of sortedData) {
                            const itemDate = new Date(item["日期"]);
                            const daysDiff = (latestDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
                            
                            if (daysDiff >= 6) { // 至少有6天差距（约一周）
                              weekAgoData = item;
                              break;
                            }
                          }
                          
                          if (!weekAgoData) {
                            return "-"; // 没有找到足够早的数据点
                          }
                          
                          // 获取金额
                          const currentAmount = latestData["市值"];
                          const weekAgoAmount = weekAgoData["市值"];
                          
                          if (isNaN(currentAmount) || isNaN(weekAgoAmount) || weekAgoAmount <= 0) {
                            return "-";
                          }
                          
                          // 计算盈亏金额
                          const profitAmount = currentAmount - weekAgoAmount;
                          const profitPercent = (profitAmount / weekAgoAmount) * 100;
                          
                          // 根据正负值设置颜色
                          const colorClass = profitAmount >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <span className={colorClass}>
                              ${profitAmount >= 0 ? '+' : ''}{profitAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%)
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
                          // 自行计算年化收益率
                          const initialCapitalRaw = baseInfoResponse.data[0]["初始本金"];
                          
                          // 计算实时市值
                          const currentBalanceRaw = calculateTotalMarketValue();
                          
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
                          
                          // 计算运行时长
                          const startDateStr = baseInfoResponse.data[0]["开始日期"];
                          if (!startDateStr) return "-";
                          
                          const startDate = new Date(startDateStr);
                          const currentDate = new Date();
                          const diffTime = currentDate.getTime() - startDate.getTime();
                          const diffDays = diffTime / (1000 * 3600 * 24);
                          const runningTimeYears = diffDays / 365;
                          
                          // 计算年化收益率: ((当前余额 / 初始本金) ^ (1/年数) - 1) * 100
                          if (runningTimeYears > 0) {
                            const apr = (Math.pow(currentBalance / initialCapital, 1 / runningTimeYears) - 1) * 100;
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
                          // 获取实时数据
                          if (!fundRealtimeData?.success || !fundRealtimeData.data || fundRealtimeData.data.length < 2) {
                            return "-"; // 没有足够的数据点
                          }
                          
                          // 将数据按日期排序（从晚到早）
                          const sortedData = [...fundRealtimeData.data].sort((a, b) => {
                            return new Date(b["日期"]).getTime() - new Date(a["日期"]).getTime();
                          });
                          
                          // 获取最新和7天前的数据
                          const latestData = sortedData[0];
                          
                          // 找到距离最新数据约有7天的数据点
                          const latestDate = new Date(latestData["日期"]);
                          let weekAgoData = null;
                          
                          for (const item of sortedData) {
                            const itemDate = new Date(item["日期"]);
                            const daysDiff = (latestDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
                            
                            if (daysDiff >= 6) { // 至少有6天差距（约一周）
                              weekAgoData = item;
                              break;
                            }
                          }
                          
                          if (!weekAgoData) {
                            return "-"; // 没有找到足够早的数据点
                          }
                          
                          // 获取实时市值
                          let currentAmount = calculateTotalMarketValue();
                          
                          // 如果计算有问题，使用实时数据里的"市值"
                          if (isNaN(currentAmount) || currentAmount <= 0) {
                            currentAmount = latestData["市值"];
                          }

                          // 使用历史数据中的市值
                          const weekAgoAmount = weekAgoData["市值"];
                          
                          if (isNaN(currentAmount) || isNaN(weekAgoAmount) || weekAgoAmount <= 0) {
                            return "-";
                          }
                          
                          // 计算实际天数
                          const daysDiff = (latestDate.getTime() - new Date(weekAgoData["日期"]).getTime()) / (1000 * 3600 * 24);
                          
                          // 计算周收益率
                          const weeklyReturn = (currentAmount / weekAgoAmount) - 1;
                          
                          // 计算年化收益率: ((1 + 周收益率) ^ (365/天数) - 1) * 100
                          const sevenDayAPR = (Math.pow(1 + weeklyReturn, 365 / daysDiff) - 1) * 100;
                          
                          // 根据正负值设置颜色
                          const colorClass = sevenDayAPR >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <span className={colorClass}>
                              {sevenDayAPR.toFixed(2)}%
                            </span>
                          );
                          
                        } catch (error) {
                          console.error('计算7日APR时出错:', error);
                          return "-";
                        }
                      })()}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg">
          <p>未能获取数据</p>
        </div>
      )}
      
      {!loading && !error && baseInfoResponse && baseInfoResponse.success && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm animate-in fade-in duration-700">
          <div className="p-4 flex flex-col md:flex-row md:justify-between items-center border-b">
            <div className="flex items-center mb-4 md:mb-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              <h3 className="font-semibold leading-none tracking-tight md:text-lg">
                收益曲线
              </h3>
            </div>
            <div className="self-start md:self-auto">
              <Tabs value={chartMode} onValueChange={(value) => setChartMode(value as 'percentage' | 'absolute')}>
                <TabsList>
                  <TabsTrigger value="percentage">收益率对比</TabsTrigger>
                  <TabsTrigger value="absolute">绝对值对比</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="p-4">
            <div className="h-60 sm:h-72 md:h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                  {/* 百分比模式下的Y轴 */}
                  {chartMode === 'percentage' && 
                    <YAxis 
                      yAxisId="main" 
                      stroke="var(--foreground)" 
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                  }
                  
                  {/* 绝对值模式下的左侧Y轴（策略收益） */}
                  {chartMode === 'absolute' && 
                    <YAxis 
                      yAxisId="left" 
                      orientation="left"
                      stroke="var(--chart-1)" 
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                  }
                  
                  {/* 绝对值模式下的右侧Y轴（比较资产价格） */}
                  {chartMode === 'absolute' && comparisonAssets.length > 0 && 
                    <YAxis 
                      yAxisId="right" 
                      orientation="right"
                      stroke="var(--chart-2)" 
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                  }
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--card-foreground)",
                      fontSize: '12px',
                      padding: '8px'
                    }}
                    labelFormatter={(label) => `日期: ${label}`}
                    formatter={(value, name) => {
                      const numValue = Number(value);
                      if (chartMode === 'percentage') {
                        if (name === "策略收益率") {
                          return [`${numValue.toFixed(1)}%`, "策略收益率"];
                        }
                        
                        // 处理比较资产的百分比
                        for (const asset of comparisonAssets) {
                          if (name === `${asset}涨跌幅`) {
                            return [`${numValue.toFixed(1)}%`, `${asset}涨跌幅`];
                          }
                        }
                      } else {
                        if (name === "策略收益") {
                          return [`$${numValue.toLocaleString()}`, "策略收益"];
                        }
                        
                        // 处理比较资产的绝对值
                        for (const asset of comparisonAssets) {
                          if (name === `${asset}价格`) {
                            return [`$${numValue.toLocaleString()}`, `${asset}价格`];
                          }
                        }
                      }
                      return [value, name];
                    }}
                  />
                  <Legend 
                    onClick={(e) => {
                      // 处理图例点击事件
                      const dataKey = e.dataKey as string;
                      if (dataKey in visibleLines) {
                        setVisibleLines(prev => ({
                          ...prev,
                          [dataKey]: !prev[dataKey]
                        }));
                      }
                    }}
                    wrapperStyle={{ cursor: 'pointer', fontSize: '12px', marginTop: '4px' }}
                    payload={
                      (() => {
                        // 创建图例数组
                        const legendItems = [];
                        
                        // 添加策略收益图例
                        if (chartMode === 'percentage') {
                          legendItems.push({ 
                            value: '策略收益率', 
                            type: 'line' as const, 
                            color: 'var(--chart-1)', 
                            dataKey: 'fundReturnPct', 
                            inactive: !visibleLines.fundReturnPct 
                          });
                          
                          // 添加比较资产的百分比图例
                          comparisonAssets.forEach((asset, index) => {
                            const assetKey = asset.toLowerCase();
                            const colorIndex = (index % 4) + 2; // 使用不同的颜色
                            const dataKey = `${assetKey}PricePct`;
                            
                            legendItems.push({
                              value: `${asset}涨跌幅`,
                              type: 'line' as const,
                              color: `var(--chart-${colorIndex})`,
                              dataKey: dataKey,
                              inactive: !visibleLines[dataKey]
                            });
                          });
                        } else {
                          legendItems.push({ 
                            value: '策略收益', 
                            type: 'line' as const, 
                            color: 'var(--chart-1)', 
                            dataKey: 'fundReturn', 
                            inactive: !visibleLines.fundReturn 
                          });
                          
                          // 添加比较资产的绝对值图例
                          comparisonAssets.forEach((asset, index) => {
                            const assetKey = asset.toLowerCase();
                            const colorIndex = (index % 4) + 2; // 使用不同的颜色
                            const dataKey = `${assetKey}Price`;
                            
                            legendItems.push({
                              value: `${asset}价格`,
                              type: 'line' as const,
                              color: `var(--chart-${colorIndex})`,
                              dataKey: dataKey,
                              inactive: !visibleLines[dataKey]
                            });
                          });
                        }
                        
                        return legendItems;
                      })()
                    }
                  />
                  {/* 百分比模式 - 策略收益率 */}
                  {chartMode === 'percentage' && 
                    <Line
                      yAxisId="main"
                      type="monotone"
                      dataKey="fundReturnPct"
                      name="策略收益率"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 8 }}
                      hide={!visibleLines.fundReturnPct}
                    />
                  }
                  
                  {/* 百分比模式 - 比较资产涨跌幅 */}
                  {chartMode === 'percentage' && comparisonAssets.map((asset, index) => {
                    const assetKey = asset.toLowerCase();
                    const colorIndex = (index % 4) + 2; // 使用不同的颜色
                    const dataKey = `${assetKey}PricePct`;
                    
                    return (
                      <Line
                        key={dataKey}
                        yAxisId="main"
                        type="monotone"
                        dataKey={dataKey}
                        name={`${asset}涨跌幅`}
                        stroke={`var(--chart-${colorIndex})`}
                        dot={false}
                        activeDot={{ r: 6 }}
                        strokeWidth={2}
                        hide={!visibleLines[dataKey]}
                      />
                    );
                  })}
                  
                  {/* 绝对值模式 - 策略收益 */}
                  {chartMode === 'absolute' && 
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="fundReturn"
                      name="策略收益"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 8 }}
                      hide={!visibleLines.fundReturn}
                    />
                  }
                  
                  {/* 绝对值模式 - 比较资产价格 */}
                  {chartMode === 'absolute' && comparisonAssets.map((asset, index) => {
                    const assetKey = asset.toLowerCase();
                    const colorIndex = (index % 4) + 2; // 使用不同的颜色
                    const dataKey = `${assetKey}Price`;
                    
                    return (
                      <Line
                        key={dataKey}
                        yAxisId="right"
                        type="monotone"
                        dataKey={dataKey}
                        name={`${asset}价格`}
                        stroke={`var(--chart-${colorIndex})`}
                        dot={false}
                        activeDot={{ r: 6 }}
                        strokeWidth={2}
                        hide={!visibleLines[dataKey]}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">暂无图表数据</p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* 持仓策略模块 */}
      {!loading && !error && baseInfoResponse && baseInfoResponse.success && holdingStrategies && holdingStrategies.success && historicalHoldings && historicalHoldings.success && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm animate-in fade-in duration-700">
          <Tabs value={activeHoldingTab} onValueChange={(value) => setActiveHoldingTab(value as 'current' | 'historical')}>
            <div className="p-4 flex flex-col md:flex-row justify-between items-center border-b">
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 md:text-lg mb-4 md:mb-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
                持仓策略
              </h3>
              
              <div className="self-start md:self-auto">
                <TabsList>
                  <TabsTrigger value="current">
                    当前持仓
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-muted text-muted-foreground">{holdingStrategies.data.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="historical">
                    历史持仓
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-muted text-muted-foreground">{historicalHoldings.data.length}</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
                <TabsContent value="current">
                  {holdingStrategies.data.length > 0 ? (
              <>

              {/* 桌面版表格 - 在中等及以上屏幕显示 */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{width: '10%'}}>标的</TableHead>
                        <TableHead style={{width: '8%'}}>策略</TableHead>
                        <TableHead className="text-center" style={{width: '10%'}}>开仓日期</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>仓位</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>占比</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>成本</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>市值</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>盈亏</TableHead>
                        <TableHead className="text-right" style={{width: '16%'}}>备注</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>更新于</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdingStrategies.data.map((strategy, index) => {
                        // 处理进场价格和市值数据
                        const entryPrice = strategy["进场"];
                        const marketValue = strategy["实时估值"];
                        
                        // 计算持仓成本: 优先使用"进场价值"字段，如果没有则计算"仓位"×"进场"
                        const holdingCost = strategy["进场价值"] !== undefined ? 
                          strategy["进场价值"] : 
                          (strategy["仓位"] && strategy["进场"]) ? 
                            parseFloat(strategy["仓位"]) * strategy["进场"] : 
                            entryPrice;
                        
                        const profit = marketValue - holdingCost;
                        const profitPercent = (profit / holdingCost) * 100;
                        
                        // 计算实时市值总额
                        const totalMarketValue = calculateTotalMarketValue();
                        
                        // 计算比例
                        const proportion = marketValue / totalMarketValue;
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{strategy["标的"]}</TableCell>
                            <TableCell>{strategy["策略"] || '-'}</TableCell>
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
                            <TableCell className="text-right font-medium">${holdingCost ? holdingCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</TableCell>
                            <TableCell className="text-right font-medium">${marketValue ? marketValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className={`flex flex-col items-end ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                <span className="font-medium">
                                  {profit >= 0 ? "+" : ""}
                                  ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </span>
                                <span className="text-xs">
                                  {profit >= 0 ? "+" : ""}
                                  {profitPercent.toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{strategy["备注"] || '-'}</TableCell>
                            <TableCell className="text-right text-sm">{strategy["更新日期"] || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* 移动版卡片布局 - 在小屏幕显示 */}
                <div className="md:hidden space-y-3 px-2 py-4">
                  {holdingStrategies.data.map((strategy, index) => {
                    // 处理进场价格和市值数据
                    const entryPrice = strategy["进场"];
                    const marketValue = strategy["实时估值"];
                    
                    // 计算持仓成本: 优先使用"进场价值"字段，如果没有则计算"仓位"×"进场"
                    const holdingCost = strategy["进场价值"] !== undefined ? 
                      strategy["进场价值"] : 
                      (strategy["仓位"] && strategy["进场"]) ? 
                        parseFloat(strategy["仓位"]) * strategy["进场"] : 
                        entryPrice;
                    
                    const profit = marketValue - holdingCost;
                    const profitPercent = (profit / holdingCost) * 100;
                    
                    // 计算比例
                    const proportion = marketValue / (baseInfoResponse?.data[0]["市值"] || 0);
                    
                    return (
                      <div key={index} className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
                        {/* 标题栏 */}
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <strong className="font-medium">{strategy["标的"] || '-'}</strong>
                          </div>
                          <div>
                            <span className="font-medium">{strategy["策略"] || '-'}</span>
                          </div>
                        </div>
                        
                        {/* 开仓日期 */}
                        <div className="mb-3">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            开仓日期
                          </div>
                          <div className="font-medium">{strategy["进场日期"] || "-"}</div>
                        </div>
                        
                        {/* 仓位信息 */}
                        <div className="mb-3">
                          <div className="grid grid-cols-2 gap-4 items-start">
                            <div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                                </svg>
                                仓位
                              </div>
                              <div className="font-medium break-all" style={{maxWidth: '150px', wordBreak: 'break-word'}}>{strategy["仓位"] || "-"}</div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                </svg>
                                占比
                              </div>
                              <div className="flex items-center justify-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* 价格信息 */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                              </svg>
                              成本
                            </div>
                            <div className="font-medium">${holdingCost ? holdingCost.toLocaleString(undefined, {maximumFractionDigits: 0}) : "-"}</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              市值
                            </div>
                            <div className="font-medium">${marketValue ? marketValue.toLocaleString(undefined, {maximumFractionDigits: 0}) : "-"}</div>
                          </div>
                        </div>
                        
                        {/* 盈亏信息 */}
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                              </svg>
                              盈亏
                            </div>
                            <div className={`font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {profit >= 0 ? "+" : ""}
                              ${profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </div>
                          </div>
                          <div className={`text-right ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            <span className="font-medium flex items-center justify-end gap-1">
                              {profit >= 0 ? "+" : ""}{profitPercent.toFixed(2)}%
                            </span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-muted-foreground">当前无持仓</p>
              </div>
                  )}
                </TabsContent>
                
                <TabsContent value="historical">
                  {historicalHoldings.data.length > 0 ? (
              <>

              {/* 桌面版表格 - 在中等及以上屏幕显示 */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{width: '10%'}}>标的</TableHead>
                        <TableHead style={{width: '8%'}}>策略</TableHead>
                        <TableHead className="text-center" style={{width: '10%'}}>开仓日期</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>仓位</TableHead>
                        <TableHead className="text-right" style={{width: '8%'}}>占比</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>成本</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>平仓市值</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>盈亏</TableHead>
                        <TableHead className="text-right" style={{width: '16%'}}>备注</TableHead>
                        <TableHead className="text-right" style={{width: '10%'}}>平仓日期</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicalHoldings.data.map((strategy, index) => {
                        // 处理进场价格和平仓价值数据
                        const entryPrice = typeof strategy["进场"] === 'string' ? parseFloat(strategy["进场"]) : strategy["进场"];
                        
                        // 计算持仓成本: 优先使用"进场价值"字段，如果没有则计算"仓位"×"进场"
                        const entryCost = strategy["进场价值"]? 
                          strategy["进场价值"] : 
                          (strategy["仓位"] && strategy["进场"]) ? 
                            parseFloat(strategy["仓位"]) * strategy["进场"] : 
                            entryPrice;
                        
                        // 计算平仓价值: 优先取"实时估值"字段，如果该字段为空，则通过"出场"*"仓位"计算得出
                        let closingValue;
                        if (strategy["实时估值"] !== undefined && strategy["实时估值"] !== null && strategy["实时估值"].toString() !== '') {
                          closingValue = strategy["实时估值"];
                        } else if (strategy["出场"] !== undefined && strategy["仓位"] !== undefined) {
                          const exitPrice = strategy["出场"];
                          const position = typeof strategy["仓位"] === 'string' ? parseFloat(strategy["仓位"]) : strategy["仓位"];
                          closingValue = exitPrice * position;
                        } else {
                          closingValue = null;
                        }
                        
                        // 计算盈亏
                        const profit = strategy["盈亏"];
                        
                        // 计算实时市值总额
                        const totalMarketValue = calculateTotalMarketValue();
                        
                        const proportion = entryCost ? entryCost / totalMarketValue : 0;
                        const profitPercent = entryCost > 0 ? (profit / entryCost) * 100 : 0;
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{strategy["标的"]}</TableCell>
                            <TableCell>{strategy["策略"]}</TableCell>
                            <TableCell className="text-center">{strategy["进场日期"]}</TableCell>
                            <TableCell className="text-right">{strategy["仓位"]}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
                                <div className="w-16 mt-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{width: `${Math.min(proportion * 100, 100)}%`}}></div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">${entryCost ? entryCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</TableCell>
                            <TableCell className="text-right">${closingValue ? closingValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className={`flex flex-col items-end ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                <span className="font-medium">
                                  {profit >= 0 ? "+" : ""}
                                  ${profit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </span>
                                <span className="text-xs">
                                  {profit >= 0 ? "+" : ""}
                                  {profitPercent.toFixed(2)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{strategy["备注"] || '-'}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{strategy["更新日期"]}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* 移动版卡片 - 在小屏幕显示 */}
                <div className="md:hidden space-y-3 px-2 py-4">
                  {historicalHoldings.data.map((strategy, index) => {
                    // 处理进场价格和平仓价值数据
                    const entryPrice = typeof strategy["进场"] === 'string' ? parseFloat(strategy["进场"]) : strategy["进场"];
                    
                    // 计算持仓成本: 优先取"进场价值"字段，如果没有则计算"仓位"×"进场"
                    const entryCost = strategy["进场价值"]? 
                          strategy["进场价值"] : 
                          (strategy["仓位"] && strategy["进场"]) ? 
                            parseFloat(strategy["仓位"]) * strategy["进场"] : 
                            entryPrice;
                    
                    // 计算平仓价值: 优先取"实时估值"字段，如果该字段为空，则通过"出场"*"仓位"计算得出
                    let closingValue;
                    if (strategy["实时估值"] !== undefined && strategy["实时估值"] !== null && strategy["实时估值"].toString() !== '') {
                      closingValue = strategy["实时估值"];
                    } else if (strategy["出场"] !== undefined && strategy["仓位"] !== undefined) {
                      const exitPrice = strategy["出场"];
                      const position = typeof strategy["仓位"] === 'string' ? parseFloat(strategy["仓位"]) : strategy["仓位"];
                      closingValue = exitPrice * position;
                    } else {
                      closingValue = null;
                    }
                    
                    // 计算盈亏
                    const profit = strategy["盈亏"];
                    const proportion = entryCost ? entryCost / (baseInfoResponse?.data[0]["市值"] || 0) : 0;
                    const profitPercent = entryCost > 0 ? (profit / entryCost) * 100 : 0;
                    
                    return (
                      <div key={index} className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
                        {/* 标题栏 */}
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <strong className="font-medium">{strategy["标的"] || '-'}</strong>
                          </div>
                          <div>
                            <span className="font-medium">{strategy["策略"] || '-'}</span>
                          </div>
                        </div>
                        
                        {/* 开仓日期 */}
                        <div className="mb-3">
                        <div className="grid grid-cols-2 gap-4 items-start">
                          <div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              开仓日期
                            </div>
                            <div className="font-medium">{strategy["进场日期"] || "-"}</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                                </svg>
                                仓位
                              </div>
                              <div className="font-medium break-all" style={{maxWidth: '150px', wordBreak: 'break-word'}}>{strategy["仓位"] || "-"}</div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                </svg>
                                占比
                              </div>
                              <div className="flex items-center justify-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                成本
                              </div>
                              <div className="font-medium">
                                ${entryCost ? entryCost.toLocaleString(undefined, {maximumFractionDigits: 0}) : "-"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                平仓市值
                              </div>
                              <div className="font-medium">
                                ${closingValue ? closingValue.toLocaleString(undefined, {maximumFractionDigits: 0}) : "-"}
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                                </svg>
                                盈亏
                              </div>
                              <div className={`font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {profit >= 0 ? "+" : ""}
                                ${profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                              </div>
                            </div>
                            <div className={`text-right ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              <span className="font-medium flex items-center justify-end gap-1">
                                {profit >= 0 ? "+" : ""}{profitPercent.toFixed(2)}%
                              </span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-muted-foreground">暂无历史持仓记录</p>
              </div>
                  )}
                </TabsContent>
          </Tabs>
        </div>
      )}

      {baseInfoResponse && baseInfoResponse.success && fundRealtimeData && fundRealtimeData.success && (
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground mt-1">
            最近更新: {new Date(fundRealtimeData.timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}