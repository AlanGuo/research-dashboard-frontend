import React from 'react';

interface AssetIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

// 判断是否为股票符号的简单函数
const isStockSymbol = (symbol: string): boolean => {
  // 美股常见标识特征：全大写，2-5个字符，无特殊字符
  const stockPattern = /^[A-Z]{1,5}$/;
  
  // 已知的加密货币符号列表
  const knownCryptoSymbols = [
    'BTC', 'ETH', 'SOL', 'SUI', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 
    'AVAX', 'SHIB', 'TRX', 'LINK', 'UNI', 'ATOM'
  ];
  
  // 如果在已知的加密货币列表中，则不是股票
  if (knownCryptoSymbols.includes(symbol.toUpperCase())) {
    return false;
  }
  
  // 否则，检查是否符合股票符号模式
  return stockPattern.test(symbol);
};

// 重命名为AssetIcon，同时保留CryptoIcon以兼容现有代码
export const AssetIcon: React.FC<AssetIconProps> = ({ symbol, size = 24, className = "" }) => {
  // 获取标准化的符号
  const normalizedSymbol = symbol.toUpperCase();
  
  // 资产颜色映射
  const iconColors: Record<string, string> = {
    // 美股科技公司
    'AAPL': '#A2AAAD', // 苹果灰色
    'MSFT': '#00A4EF', // 微软蓝色
    'GOOGL': '#4285F4', // 谷歌蓝色
    'AMZN': '#FF9900', // 亚马逊橙色
    'META': '#1877F2', // Meta蓝色
    'TSLA': '#E31937', // 特斯拉红色
    'NVDA': '#76B900', // 英伟达绿色
    'NFLX': '#E50914', // 奈飞红色
    
    // 金融股
    'JPM': '#2E285D',  // 摩根大通深蓝色
    'BAC': '#E31837',  // 美国银行红色
    'GS': '#00A4EF',   // 高盛蓝色
    'V': '#1434CB',    // Visa蓝色
    'MA': '#EB001B',   // 万事达卡红色
    
    // 消费品股
    'KO': '#F40009',   // 可口可乐红色
    'PEP': '#0065C3',  // 百事蓝色
    'MCD': '#FFC72C',  // 麦当劳黄色
    'DIS': '#113CCF',  // 迪士尼蓝色
    'NKE': '#000000',  // 耐克黑色
    
    // 医疗保健
    'JNJ': '#D80000',  // 强生红色
    'PFE': '#0093D0',  // 辉瑞蓝色
    'MRNA': '#FF0000', // Moderna红色
    
    // 加密货币
    BTC: '#F7931A',  // 比特币橙色
    ETH: '#627EEA',  // 以太坊蓝紫色
    SOL: '#66F9A1',  // Solana绿色
    SUI: '#6FBCF0',  // Sui蓝色
    BNB: '#F3BA2F',  // 币安币黄色
    XRP: '#23292F',  // 瑞波币深灰色
    ADA: '#0033AD',  // 卡尔达诺蓝色
    DOGE: '#C2A633', // 狗狗币金色
    MATIC: '#8247E5', // Polygon紫色
    DOT: '#E6007A',  // 波卡粉色
    AVAX: '#E84142', // Avalanche红色
    SHIB: '#FFA409', // 柴犬币橙色
    TRX: '#EF0027',  // 波场红色
    LINK: '#2A5ADA', // Chainlink蓝色
    UNI: '#FF007A',  // Uniswap粉色
    ATOM: '#2E3148', // Cosmos深蓝色
    // 添加更多加密货币颜色
  };
  
  // 根据不同的加密货币符号返回不同的SVG图标
  switch (normalizedSymbol) {
    case 'BTC':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#F7931A"/>
            <path fill="#FFF" d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.53-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"/>
          </g>
        </svg>
      );
    case 'ETH':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#627EEA"/>
            <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#FFF" fillOpacity=".602"/>
            <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#FFF"/>
            <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#FFF" fillOpacity=".602"/>
            <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#FFF"/>
            <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#FFF" fillOpacity=".2"/>
            <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#FFF" fillOpacity=".602"/>
          </g>
        </svg>
      );
    case 'SOL':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#66F9A1"/>
            <path d="M9.925 19.687a.59.59 0 01.415-.17h14.366a.29.29 0 01.207.497l-2.838 2.815a.59.59 0 01-.415.171H7.294a.29.29 0 01-.207-.497l2.838-2.815zm0-10.517a.59.59 0 01.415-.17h14.366a.29.29 0 01.207.496l-2.838 2.816a.59.59 0 01-.415.17H7.294a.29.29 0 01-.207-.496l2.838-2.816zm17.008 5.255a.59.59 0 00-.415-.17H12.152a.29.29 0 00-.207.496l2.838 2.816a.59.59 0 00.415.17h14.366a.29.29 0 00.207-.496l-2.838-2.816z" fill="#FFF"/>
          </g>
        </svg>
      );
    case 'SUI':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#6FBCF0"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M16.096 7C19.374 7 22 9.585 22 13.09c0 1.848-.8 3.588-2.192 4.814-2.243 1.969-2.756 2.304-2.756 4.096h-2.096c0-2.752 1.183-3.585 3.689-5.785.768-.676 1.26-1.585 1.26-2.608C19.905 10.79 18.213 9 16.096 9c-2.118 0-3.81 1.79-3.81 4.09 0 1.023.493 1.932 1.26 2.608 2.506 2.2 3.69 3.033 3.69 5.785h-2.097c0-1.792-.514-2.127-2.757-4.096C10.8 16.677 10 14.937 10 13.09 10 9.585 12.626 7 16.096 7zm-.62 17h2.096v2H15.476v-2z" fill="#FFF"/>
          </g>
        </svg>
      );
    case 'BNB':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#F3BA2F"/>
            <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002V16L16 18.294l-2.291-2.29-.004-.004.004-.003.401-.402.195-.195L16 13.706l2.293 2.293z" fill="#FFF"/>
          </g>
        </svg>
      );
    default:
      // 生成一个基于符号的颜色
      const color = iconColors[normalizedSymbol] || generateColorFromSymbol(normalizedSymbol);
      
      // 判断是否为股票符号
      const isStock = isStockSymbol(normalizedSymbol);
      
      // 创建一个简单的图标
      if (isStock) {
        // 股票使用方形图标
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="28" height="28" rx="4" fill={color}/>
            <text x="16" y="21" textAnchor="middle" fill="#FFF" fontSize="12" fontWeight="bold" fontFamily="Arial, sans-serif">
              {normalizedSymbol}
            </text>
          </svg>
        );
      } else {
        // 加密货币使用圆形图标
        return (
          <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill={color}/>
            <text x="16" y="21" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">
              {normalizedSymbol.charAt(0)}
            </text>
          </svg>
        );
      }
  }
};

// 导出CryptoIcon作为AssetIcon的别名，以保持向后兼容
export const CryptoIcon = AssetIcon;

// 根据符号生成一个稳定的颜色
function generateColorFromSymbol(symbol: string): string {
  // 简单的哈希函数，将字符串转换为数字
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 将哈希值转换为HSL颜色，保持饱和度和亮度固定以确保良好的可见性
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}
