// GLI数据点接口定义
export interface GliDataPoint {
  timestamp: number;
  datetime: string;
  
  // 汇率数据
  eurusd?: number;
  cnyusd?: number;
  jpyusd?: number;
  gbpusd?: number;
  cadusd?: number;
  audusd?: number;
  inrusd?: number;
  chfusd?: number;
  rubusd?: number;
  brlusd?: number;
  krwusd?: number;
  mxnusd?: number;
  idrusd?: number;
  zarusd?: number;
  myrusd?: number;
  sekusd?: number;
  nzdusd?: number;
  
  // 央行数据
  fed?: number;
  rrp?: number;
  tga?: number;
  ecb?: number;
  pbc?: number;
  boj?: number;
  other_cb_total?: number;
  
  // M2供应数据
  usa?: number;
  eu?: number;
  china?: number;
  japan?: number;
  other_m2_total?: number;
  
  // 总计
  total: number;
}

// GLI API响应接口
export interface GliResponse {
  success: boolean;
  data?: GliDataPoint[];
  error?: string;
  timestamp?: string;
  params?: GliParams;
  message?: string;
}

// GLI参数接口
export interface GliParams {
  fed_active?: boolean;
  rrp_active?: boolean;
  tga_active?: boolean;
  ecb_active?: boolean;
  pbc_active?: boolean;
  boj_active?: boolean;
  other_active?: boolean;
  usa_active?: boolean;
  europe_active?: boolean;
  china_active?: boolean;
  japan_active?: boolean;
  other_m2_active?: boolean;
  interval?: string;
  limit?: number;
  from?: number;
}
