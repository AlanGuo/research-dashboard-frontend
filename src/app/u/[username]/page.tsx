"use client"

import { useParams } from 'next/navigation'
import { useEffect, useState } from "react"
import "@/styles/finance-theme.css"
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

// Import the interfaces and types from the main page
// K线图数据类型
interface Candle {
  timestamp: number;
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KlineResponse {
  success: boolean;
  data: {
    symbol: string;
    interval: string;
    count: number;
    candles: Candle[];
    marketInfo: {
      description: string;
      exchange: string;
      currency: string;
      type: string;
    };
    lastUpdated: string;
  };
  timestamp: string;
}

// 图表数据类型
interface ChartDataPoint {
  date: string;
  fundReturnPct: number; // 策略收益百分比变化率
  btcPricePct: number;   // BTC价格百分比变化率
  fundReturn: number;    // 策略收益绝对值
  btcPrice: number;      // BTC价格绝对值
}

// 策略实时估值数据类型
interface FundRealtimeItem {
  "可用金额": number;
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
  "初始本金(U)": number;
  "初始BTC价格": number;
  "当前余额(U)": number;
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
  const [btcKlineData, setBtcKlineData] = useState<KlineResponse | null>(null);
  const [fundRealtimeData, setFundRealtimeData] = useState<FundRealtimeResponse | null>(null);
  const [holdingStrategies, setHoldingStrategies] = useState<HoldingStrategyResponse | null>(null);
  const [historicalHoldings, setHistoricalHoldings] = useState<HoldingStrategyResponse | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  // 持仓标签页状态
  const [activeHoldingTab, setActiveHoldingTab] = useState<'current' | 'historical'>('current');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 用于控制曲线的显示/隐藏
  const [visibleLines, setVisibleLines] = useState({
    fundReturnPct: true,
    btcPricePct: true,
    fundReturn: true,
    btcPrice: true
  });
  
  // 图表模式：百分比模式或绝对值模式
  const [chartMode, setChartMode] = useState<'percentage' | 'absolute'>('percentage');

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
  
  // 获取BTC价格数据 - 在获取到实时数据后调用
  const fetchBtcData = async (startDate: string, endDate: string) => {
    try {
      // 计算需要获取的天数
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 3; // 加3天确保覆盖全部时间
      const bars = Math.max(daysDiff, 100); // 获取足够多的数据
      
      const response = await fetch(`/api/kline/btcusdt?interval=1D&bars=${bars}`);
      
      if (!response.ok) {
        throw new Error(`BTC API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      setBtcKlineData(data);
    } catch (err) {
      console.error('Error fetching BTC data:', err);
      // 不设置页面错误状态，因为这只是图表数据
    }
  };
  
  // 获取策略实时估值数据
  useEffect(() => {
    async function fetchFundRealtimeData() {
      try {
        // 直接使用路由参数中的username
        if (!username) {
          return; // 如果username为空，不进行请求
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
        
        // 如果获取到实时数据，则获取对应时间范围的BTC数据
        if (data.success && data.data.length > 0) {
          // 将数据按日期排序（从早到晚）
          const sortedData = [...data.data].sort((a, b) => {
            return new Date(a["日期"]).getTime() - new Date(b["日期"]).getTime();
          });
          
          // 获取最早和最晚的日期
          const earliestDate = sortedData[0]["日期"];
          const latestDate = sortedData[sortedData.length - 1]["日期"];
          
          console.log('策略数据日期范围:', earliestDate, '至', latestDate);
          
          // 获取该时间范围的BTC数据
          await fetchBtcData(earliestDate, latestDate);
        }
      } catch (err) {
        console.error('Error fetching fund realtime data:', err);
        // 不设置页面错误状态，因为这只是图表数据
      }
    }
    
    fetchFundRealtimeData();
  }, [username]);
  
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
        if (item["日期"] && item["可用金额"]) {
          // 使用标准化的日期格式作为键
          const dateKey = new Date(item["日期"]).toISOString().split('T')[0];
          const balance = typeof item["可用金额"] === 'string' 
            ? parseFloat(item["可用金额"]) 
            : item["可用金额"];
            
          if (!isNaN(balance)) {
            fundDataMap.set(dateKey, balance);
          }
        }
      });
      
      // 创建BTC日期到数据的映射
      const btcDataMap = new Map<string, number>();
      if (btcKlineData?.success && btcKlineData.data?.candles) {
        const sortedBtcData = [...btcKlineData.data.candles].sort((a, b) => {
          return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
        });
        
        sortedBtcData.forEach(item => {
          if (item.datetime && item.close) {
            const dateKey = new Date(item.datetime).toISOString().split('T')[0];
            btcDataMap.set(dateKey, item.close);
          }
        });
      }
      
      // 获取所有日期并排序
      const allDates = [...new Set([...fundDataMap.keys()])];
      allDates.sort();
      
      // 获取初始值，用于计算百分比变化
      let initialFundValue: number | undefined;
      let initialBtcValue: number | undefined;
      
      // 使用baseInfoResponse中的初始值
      if (baseInfoResponse?.data && baseInfoResponse.data.length > 0) {
        initialFundValue = baseInfoResponse.data[0]["初始本金(U)"];
        initialBtcValue = baseInfoResponse.data[0]["初始BTC价格"];
      }
      
      // 如果没有初始值，使用第一个数据点
      if (initialFundValue === undefined && allDates.length > 0) {
        const firstDateKey = allDates[0];
        initialFundValue = fundDataMap.get(firstDateKey);
      }
      
      // 如果没有BTC初始值，尝试找到最早的BTC数据
      if (initialBtcValue === undefined && btcDataMap.size > 0) {
        // 获取所有BTC日期并排序
        const btcDates = [...btcDataMap.keys()].sort();
        if (btcDates.length > 0) {
          initialBtcValue = btcDataMap.get(btcDates[0]);
        }
      }
      
      // 如果还是没有初始值，使用默认值
      if (initialFundValue === undefined) {
        initialFundValue = 10000; // 默认初始资金
      }
      
      if (initialBtcValue === undefined) {
        initialBtcValue = 60000; // 默认BTC初始值
      }
      
      // 为每个策略日期创建数据点
      allDates.forEach(dateKey => {
        const fundValue = fundDataMap.get(dateKey);
        let btcValue = btcDataMap.get(dateKey);
        
        // 如果当天没有BTC数据，尝试找前一天的
        if (btcValue === undefined && btcDataMap.size > 0) {
          // 创建日期对象并减去一天
          const prevDate = new Date(dateKey);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevDateKey = prevDate.toISOString().split('T')[0];
          btcValue = btcDataMap.get(prevDateKey);
          
          // 如果还是没有，再往前找一天
          if (btcValue === undefined) {
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateKey2 = prevDate.toISOString().split('T')[0];
            btcValue = btcDataMap.get(prevDateKey2);
          }
        }
        
        // 如果还是没有BTC数据，使用前面数据点的BTC值
        if (btcValue === undefined && newChartData.length > 0) {
          // 使用前一个数据点的原始BTC值（非百分比）
          const lastBtcPct = newChartData[newChartData.length - 1].btcPricePct;
          // 将百分比转换回原始值
          btcValue = initialBtcValue! * (1 + lastBtcPct / 100);
        }
        
        // 如果还是没有BTC数据，使用一个默认值
        if (btcValue === undefined) {
          // 如果有其他BTC数据，使用平均值
          if (btcDataMap.size > 0) {
            const btcValues = Array.from(btcDataMap.values());
            const avgBtcValue = btcValues.reduce((sum, value) => sum + value, 0) / btcValues.length;
            btcValue = avgBtcValue;
          } else {
            // 完全没有BTC数据时的最后备选
            btcValue = 60000;
          }
        }
        
        // 只要有策略数据，就添加数据点
        if (fundValue !== undefined && initialFundValue !== undefined && initialBtcValue !== undefined) {
          // 计算百分比变化
          const fundReturnPct = ((fundValue / initialFundValue) - 1) * 100;
          const btcPricePct = ((btcValue / initialBtcValue) - 1) * 100;
          
          const date = new Date(dateKey).toLocaleDateString();
          newChartData.push({
            date,
            fundReturnPct,
            btcPricePct,
            fundReturn: fundValue,
            btcPrice: btcValue
          });
        }
      });
      
      // 如果成功生成了数据点，则使用真实数据
      if (newChartData.length > 0) {
        setChartData(newChartData);
      }
    }
  }, [btcKlineData, fundRealtimeData, baseInfoResponse]);

  // 渲染UI
  return (
    <div className="container mx-auto py-6 md:py-10 px-4 md:px-6 space-y-6 md:space-y-8">
      { !username || loading ? (
        <div className="flex flex-col justify-center items-center py-4 space-y-2 h-[50vh]">
          <div className="h-10 w-10 border-t-2 border-blue-500 rounded-full animate-spin"></div>
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
          
          {/* 标题区域 - 恢复为轻量样式 */}
          <div className="finance-animate-in">
            <h1 className="text-3xl md:text-4xl font-bold">CRYPTO趋势策略</h1>
            <p className="text-base md:text-lg text-muted-foreground mt-2">{baseInfoResponse.data[0]["备注"]}</p>
          </div>
          
          <div className="finance-grid finance-grid-2 finance-animate-in">
            <div className="finance-card">
              <div className="finance-card-header">
                <h3 className="finance-card-title">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="finance-icon-lg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  概况
                </h3>
              </div>
              <div className="finance-card-content">
                <dl className="space-y-3">
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground font-medium">当前余额</dt>
                    <dd className="font-semibold">${baseInfoResponse.data[0]["当前余额(U)"].toLocaleString()}</dd>
                  </div>
                  <div className="finance-divider" style={{margin: '0.5rem 0'}}></div>
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">初始本金</dt>
                    <dd className="">${baseInfoResponse.data[0]["初始本金(U)"].toLocaleString()}</dd>
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
            
            <div className="finance-card">
              <div className="finance-card-header">
                <h3 className="finance-card-title">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="finance-icon-lg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  收益
                </h3>
              </div>
              <div className="finance-card-content">
                <dl className="space-y-1 md:space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground font-medium">实时盈亏</dt>
                    <dd className="font-semibold">
                      {(() => {
                        try {
                          const initialCapital = baseInfoResponse.data[0]["初始本金(U)"];
                          const currentBalance = baseInfoResponse.data[0]["当前余额(U)"];
                          
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
                  <div className="finance-divider" style={{margin: '0.5rem 0'}}></div>
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
                          
                          // 获取金额并转换为数字
                          const currentAmount = typeof latestData["可用金额"] === 'string' 
                            ? parseFloat(latestData["可用金额"]) 
                            : latestData["可用金额"];
                            
                          const weekAgoAmount = typeof weekAgoData["可用金额"] === 'string' 
                            ? parseFloat(weekAgoData["可用金额"]) 
                            : weekAgoData["可用金额"];
                          
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
                          const initialCapitalRaw = baseInfoResponse.data[0]["初始本金(U)"];
                          const currentBalanceRaw = baseInfoResponse.data[0]["当前余额(U)"];
                          
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
                            return `${apr.toFixed(2)}%`;
                          }
                          
                          return "-";
                        } catch (error) {
                          console.error('计算APR时出错:', error);
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
                          
                          // 获取金额并转换为数字
                          const currentAmount = typeof latestData["可用金额"] === 'string' 
                            ? parseFloat(latestData["可用金额"]) 
                            : latestData["可用金额"];
                            
                          const weekAgoAmount = typeof weekAgoData["可用金额"] === 'string' 
                            ? parseFloat(weekAgoData["可用金额"]) 
                            : weekAgoData["可用金额"];
                          
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
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p>未能获取数据</p>
        </div>
      )}
      
      {!loading && !error && baseInfoResponse && baseInfoResponse.success && (
        <div className="finance-card finance-animate-in">
          <div className="finance-card-header flex flex-col md:flex-row md:justify-between md:items-center px-4 py-3">
            <div className="flex items-center mb-2 md:mb-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="finance-icon-lg mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              <h3 className="finance-card-title m-0 text-sm md:text-base">
                {chartMode === 'percentage' ? '策略收益率与BTC涨跌幅对比' : '策略收益与BTC价格对比'}
              </h3>
            </div>
            <div className="finance-time-selector self-start md:self-auto">
              <button
                className={`${chartMode === 'percentage' ? 'active' : ''}`}
                onClick={() => setChartMode('percentage')}
              >
                收益率对比
              </button>
              <button
                className={`${chartMode === 'absolute' ? 'active' : ''}`}
                onClick={() => setChartMode('absolute')}
              >
                绝对值对比
              </button>
            </div>
          </div>
          <div className="finance-card-content">
            <div className="finance-chart-container h-60 sm:h-72 md:h-80">
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
                  
                  {/* 绝对值模式下的右侧Y轴（BTC价格） */}
                  {chartMode === 'absolute' && 
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
                        if (name === "BTC涨跌幅") {
                          return [`${numValue.toFixed(1)}%`, "BTC涨跌幅"];
                        }
                      } else {
                        if (name === "策略收益") {
                          return [`$${numValue.toLocaleString()}`, "策略收益"];
                        }
                        if (name === "BTC价格") {
                          return [`$${numValue.toLocaleString()}`, "BTC价格"];
                        }
                      }
                      return [value, name];
                    }}
                  />
                  <Legend 
                    onClick={(e) => {
                      // 处理图例点击事件
                      const dataKey = e.dataKey as keyof typeof visibleLines;
                      if (dataKey in visibleLines) {
                        setVisibleLines(prev => ({
                          ...prev,
                          [dataKey]: !prev[dataKey as keyof typeof visibleLines]
                        }));
                      }
                    }}
                    wrapperStyle={{ cursor: 'pointer', fontSize: '12px', marginTop: '4px' }}
                    payload={chartMode === 'percentage' ? [
                      { value: '策略收益率', type: 'line', color: 'var(--chart-1)', dataKey: 'fundReturnPct', inactive: !visibleLines.fundReturnPct },
                      { value: 'BTC涨跌幅', type: 'line', color: 'var(--chart-2)', dataKey: 'btcPricePct', inactive: !visibleLines.btcPricePct }
                    ] : [
                      { value: '策略收益', type: 'line', color: 'var(--chart-1)', dataKey: 'fundReturn', inactive: !visibleLines.fundReturn },
                      { value: 'BTC价格', type: 'line', color: 'var(--chart-2)', dataKey: 'btcPrice', inactive: !visibleLines.btcPrice }
                    ]}
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
                  
                  {/* 百分比模式 - BTC涨跌幅 */}
                  {chartMode === 'percentage' && 
                    <Line
                      yAxisId="main"
                      type="monotone"
                      dataKey="btcPricePct"
                      name="BTC涨跌幅"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 8 }}
                      hide={!visibleLines.btcPricePct}
                    />
                  }
                  
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
                  
                  {/* 绝对值模式 - BTC价格 */}
                  {chartMode === 'absolute' && 
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="btcPrice"
                      name="BTC价格"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 8 }}
                      hide={!visibleLines.btcPrice}
                    />
                  }
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
        <div className="finance-card finance-animate-in">
          <div className="finance-card-header flex justify-between items-center">
            <h3 className="finance-card-title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="finance-icon-lg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
              持仓策略
            </h3>
            
            {/* 标签页切换 - 放在右侧 */}
            <div className="flex space-x-2">
              <button 
                onClick={() => setActiveHoldingTab('current')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${activeHoldingTab === 'current' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                当前持仓
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-primary-foreground text-primary">{holdingStrategies.data.length}</span>
              </button>
              <button 
                onClick={() => setActiveHoldingTab('historical')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${activeHoldingTab === 'historical' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                历史持仓
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-primary-foreground text-primary">{historicalHoldings.data.length}</span>
              </button>
            </div>
          </div>
          <div>
            {/* 当前持仓标签页 */}
            {activeHoldingTab === 'current' && holdingStrategies.data.length > 0 ? (
              <>
                {/* 桌面版表格 - 在中等及以上屏幕显示 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="finance-table text-sm" style={{tableLayout: 'auto', minWidth: '100%'}}>
                    <thead>
                      <tr>
                        <th style={{width: '10%', textAlign: 'left'}}>标的</th>
                        <th style={{width: '8%', textAlign: 'left'}}>策略</th>
                        <th style={{width: '10%', textAlign: 'center'}}>开仓日期</th>
                        <th style={{width: '8%', textAlign: 'right'}}>仓位</th>
                        <th style={{width: '8%', textAlign: 'right'}}>占比</th>
                        <th style={{width: '10%', textAlign: 'right'}}>成本</th>
                        <th style={{width: '10%', textAlign: 'right'}}>估值</th>
                        <th style={{width: '10%', textAlign: 'right'}}>盈亏</th>
                        <th style={{width: '16%', textAlign: 'right'}}>备注</th>
                        <th style={{width: '10%', textAlign: 'right'}}>最近更新</th>
                      </tr>
                    </thead>
                    <tbody>
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
                        const proportion = marketValue / (baseInfoResponse?.data[0]["当前余额(U)"] || 0);
                        
                        return (
                          <tr key={index}>
                            <td className="font-medium">{strategy["标的"]}</td>
                            <td>{strategy["策略"] || '-'}</td>
                            <td className="text-center">{strategy["进场日期"] || "-"}</td>
                            <td className="text-right">{strategy["仓位"] || "-"}</td>
                            <td className="text-right">
                              <div className="flex flex-col items-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
                                <div className="finance-progress-bar w-16 mt-1">
                                  <div className="finance-progress-value" style={{width: `${Math.min(proportion * 100, 100)}%`}}></div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right font-medium">${holdingCost ? holdingCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</td>
                            <td className="text-right font-medium">${marketValue ? marketValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</td>
                            <td className="text-right">
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
                            </td>
                            <td className="text-right text-muted-foreground">{strategy["备注"] || '-'}</td>
                            <td className="text-right text-sm">{strategy["更新日期"] || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                    const proportion = marketValue / (baseInfoResponse?.data[0]["当前余额(U)"] || 0);
                    
                    return (
                      <div key={index} className="finance-card p-3">
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
                              估值
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
            ) : activeHoldingTab === 'current' ? (
              <div className="py-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-muted-foreground">当前无持仓</p>
              </div>
            ) : null}
            
            {/* 历史持仓标签页 */}
            {activeHoldingTab === 'historical' && historicalHoldings.data.length > 0 ? (
              <>
                {/* 桌面版表格 - 在中等及以上屏幕显示 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="finance-table text-sm" style={{tableLayout: 'auto', minWidth: '100%'}}>
                    <thead>
                      <tr>
                        <th style={{width: '10%', textAlign: 'left'}}>标的</th>
                        <th style={{width: '8%', textAlign: 'left'}}>策略</th>
                        <th style={{width: '10%', textAlign: 'center'}}>开仓日期</th>
                        <th style={{width: '8%', textAlign: 'right'}}>仓位</th>
                        <th style={{width: '8%', textAlign: 'right'}}>占比</th>
                        <th style={{width: '10%', textAlign: 'right'}}>成本</th>
                        <th style={{width: '10%', textAlign: 'right'}}>平仓成本</th>
                        <th style={{width: '10%', textAlign: 'right'}}>盈亏</th>
                        <th style={{width: '16%', textAlign: 'right'}}>备注</th>
                        <th style={{width: '10%', textAlign: 'right'}}>平仓日期</th>
                      </tr>
                    </thead>
                    <tbody>
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
                        const proportion = entryCost ? entryCost / (baseInfoResponse?.data[0]["当前余额(U)"] || 0) : 0;
                        const profitPercent = entryCost > 0 ? (profit / entryCost) * 100 : 0;
                        
                        return (
                          <tr key={index}>
                            <td className="font-medium">{strategy["标的"]}</td>
                            <td>{strategy["策略"]}</td>
                            <td className="text-center">{strategy["进场日期"]}</td>
                            <td className="text-right">{strategy["仓位"]}</td>
                            <td className="text-right">
                              <div className="flex flex-col items-end">
                                <span>{(proportion * 100).toFixed(2)}%</span>
                                <div className="finance-progress-bar w-16 mt-1">
                                  <div className="finance-progress-value" style={{width: `${Math.min(proportion * 100, 100)}%`}}></div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right">${entryCost ? entryCost.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</td>
                            <td className="text-right">${closingValue ? closingValue.toLocaleString(undefined, {maximumFractionDigits: 2}) : "-"}</td>
                            <td className="text-right">
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
                            </td>
                            <td className="text-right text-muted-foreground">{strategy["备注"] || '-'}</td>
                            <td className="text-right text-muted-foreground">{strategy["更新日期"]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                    const proportion = entryCost ? entryCost / (baseInfoResponse?.data[0]["当前余额(U)"] || 0) : 0;
                    const profitPercent = entryCost > 0 ? (profit / entryCost) * 100 : 0;
                    
                    return (
                      <div key={index} className="finance-card p-3">
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
                                持仓成本
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
                                平仓成本
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
            ) : activeHoldingTab === 'historical' ? (
              <div className="py-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="mt-4 text-muted-foreground">暂无历史持仓记录</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {!loading && !error && baseInfoResponse && baseInfoResponse.success && fundRealtimeData && fundRealtimeData.success && (
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground mt-1">
            数据最后更新时间: {new Date(fundRealtimeData.timestamp).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}