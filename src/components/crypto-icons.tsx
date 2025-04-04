import React from 'react';

interface CryptoIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export const CryptoIcon: React.FC<CryptoIconProps> = ({ symbol, size = 24, className = "" }) => {
  // 根据不同的加密货币符号返回不同的SVG图标
  switch (symbol.toUpperCase()) {
    case 'BTC':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <g fill="none">
            <circle cx="16" cy="16" r="16" fill="#F7931A"/>
            <path fill="#FFF" d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.53-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"/>
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
    default:
      // 默认图标
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" fill="#E0E0E0"/>
          <text x="16" y="20" textAnchor="middle" fill="#666" fontSize="14" fontWeight="bold">?</text>
        </svg>
      );
  }
};
