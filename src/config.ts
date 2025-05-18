/**
 * 应用配置
 */
const config = {
  api: {
    // API基础URL，可以根据环境变量设置
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4001',
  }
};

export default config;
