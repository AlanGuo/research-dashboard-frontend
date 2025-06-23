import { createContext, useContext, useCallback, ReactNode, useMemo } from 'react';
import { PositionAllocationStrategy } from '@/types/btcdom2';

interface ParameterContextType {
  // Weight parameters
  priceChangeWeight: number;
  volumeWeight: number;
  volatilityWeight: number;
  fundingRateWeight: number;
  updateWeight: (type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => void;
  
  // Trading parameters
  maxShortPositions: number;
  updateMaxShortPositions: (value: number) => void;
  
  // BTC ratio
  btcRatio: number;
  updateBtcRatio: (value: number) => void;
  
  // Strategy parameters
  allocationStrategy: PositionAllocationStrategy;
  updateAllocationStrategy: (value: PositionAllocationStrategy) => void;
  
  // Trading fees
  spotTradingFeeRate: number;
  futuresTradingFeeRate: number;
  updateSpotTradingFeeRate: (value: number) => void;
  updateFuturesTradingFeeRate: (value: number) => void;
  
  // Strategy selection
  longBtc: boolean;
  shortAlt: boolean;
  updateLongBtc: (value: boolean) => void;
  updateShortAlt: (value: boolean) => void;
}

const ParameterContext = createContext<ParameterContextType | undefined>(undefined);

export function useParameter() {
  const context = useContext(ParameterContext);
  if (!context) {
    throw new Error('useParameter must be used within a ParameterProvider');
  }
  return context;
}

interface ParameterProviderProps {
  children: ReactNode;
  onParameterChange: (key: string, value: unknown) => void;
  initialValues: {
    priceChangeWeight: number;
    volumeWeight: number;
    volatilityWeight: number;
    fundingRateWeight: number;
    maxShortPositions: number;
    btcRatio: number;
    allocationStrategy: PositionAllocationStrategy;
    spotTradingFeeRate: number;
    futuresTradingFeeRate: number;
    longBtc: boolean;
    shortAlt: boolean;
  };
}

export function ParameterProvider({ children, onParameterChange, initialValues }: ParameterProviderProps) {
  const updateWeight = useCallback((type: 'priceChange' | 'volume' | 'volatility' | 'fundingRate', value: number) => {
    onParameterChange(`${type}Weight`, value);
  }, [onParameterChange]);

  const updateMaxShortPositions = useCallback((value: number) => {
    onParameterChange('maxShortPositions', value);
  }, [onParameterChange]);

  const updateBtcRatio = useCallback((value: number) => {
    onParameterChange('btcRatio', value);
  }, [onParameterChange]);

  const updateAllocationStrategy = useCallback((value: PositionAllocationStrategy) => {
    onParameterChange('allocationStrategy', value);
  }, [onParameterChange]);

  const updateSpotTradingFeeRate = useCallback((value: number) => {
    onParameterChange('spotTradingFeeRate', value);
  }, [onParameterChange]);

  const updateFuturesTradingFeeRate = useCallback((value: number) => {
    onParameterChange('futuresTradingFeeRate', value);
  }, [onParameterChange]);

  const updateLongBtc = useCallback((value: boolean) => {
    onParameterChange('longBtc', value);
  }, [onParameterChange]);

  const updateShortAlt = useCallback((value: boolean) => {
    onParameterChange('shortAlt', value);
  }, [onParameterChange]);

  const value = useMemo(() => ({
    priceChangeWeight: initialValues.priceChangeWeight,
    volumeWeight: initialValues.volumeWeight,
    volatilityWeight: initialValues.volatilityWeight,
    fundingRateWeight: initialValues.fundingRateWeight,
    maxShortPositions: initialValues.maxShortPositions,
    btcRatio: initialValues.btcRatio,
    allocationStrategy: initialValues.allocationStrategy,
    spotTradingFeeRate: initialValues.spotTradingFeeRate,
    futuresTradingFeeRate: initialValues.futuresTradingFeeRate,
    longBtc: initialValues.longBtc,
    shortAlt: initialValues.shortAlt,
    updateWeight,
    updateMaxShortPositions,
    updateBtcRatio,
    updateAllocationStrategy,
    updateSpotTradingFeeRate,
    updateFuturesTradingFeeRate,
    updateLongBtc,
    updateShortAlt,
  }), [
    initialValues.priceChangeWeight,
    initialValues.volumeWeight,
    initialValues.volatilityWeight,
    initialValues.fundingRateWeight,
    initialValues.maxShortPositions,
    initialValues.btcRatio,
    initialValues.allocationStrategy,
    initialValues.spotTradingFeeRate,
    initialValues.futuresTradingFeeRate,
    initialValues.longBtc,
    initialValues.shortAlt,
    updateWeight,
    updateMaxShortPositions,
    updateBtcRatio,
    updateAllocationStrategy,
    updateSpotTradingFeeRate,
    updateFuturesTradingFeeRate,
    updateLongBtc,
    updateShortAlt,
  ]);

  return (
    <ParameterContext.Provider value={value}>
      {children}
    </ParameterContext.Provider>
  );
}
