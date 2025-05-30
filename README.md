# 研究看板前端 (Research Dashboard Frontend)

一个基于 Next.js 15 的现代化金融数据研究看板，提供全球流动性监控和 BTCDOM 策略对比等功能。

## 🚀 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS 4
- **UI组件**: shadcn/ui + Radix UI
- **图表**: Recharts
- **主题**: next-themes (支持深色模式)
- **图标**: Lucide React
- **包管理**: Yarn

## 📁 项目结构

```
src/
├── app/                          # Next.js App Router 页面
│   ├── api/                      # API 路由
│   ├── btcdom-comparison/        # BTCDOM策略对比页面
│   ├── gli/                      # 全球流动性页面
│   ├── globals.css              # 全局样式
│   ├── layout.tsx               # 根布局组件
│   └── page.tsx                 # 首页
├── components/                   # React组件
│   ├── btcdom/                  # BTCDOM相关组件
│   │   ├── btcdom-comparison-chart.tsx
│   │   ├── btcdom-data-table.tsx
│   │   ├── btcdom-params.tsx
│   │   └── performance-metrics.tsx
│   ├── gli/                     # 全球流动性相关组件
│   │   ├── gli-benchmark-trend-table.tsx
│   │   ├── gli-chart.tsx
│   │   ├── gli-params.tsx
│   │   └── gli-trend-table.tsx
│   ├── navigation/              # 导航组件
│   │   └── navbar.tsx
│   ├── ui/                      # 基础UI组件 (shadcn/ui)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── skeleton.tsx
│   │   ├── table.tsx
│   │   └── theme-provider.tsx
│   └── theme-toggle.tsx         # 主题切换组件
├── config/                      # 配置文件
├── lib/                         # 工具库
├── types/                       # TypeScript类型定义
└── config.ts                    # 应用配置
```

## 🎯 功能模块

### 1. 全球流动性 (GLI) 监控
- 监控各国央行流动性数据
- M2货币供应量追踪
- Howell Liquidity 数据集成
- 多维度趋势分析
- 基准资产对比

### 2. BTCDOM 策略对比
- 自制BTCDOM策略 vs 币安BTCDOM合约
- 性能指标对比（收益率、夏普比率、最大回撤等）
- 标准化图表展示
- 详细数据表格

### 3. 通用功能
- 响应式设计
- 深色/浅色主题切换
- 数据可视化图表
- 实时数据更新
- 移动端适配

## 🛠️ 开发环境设置

### 环境要求
- Node.js 18+
- Yarn

### 安装依赖
```bash
yarn install
```

### 启动开发服务器
```bash
yarn dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 其他脚本
```bash
# 生产构建
yarn build

# 启动生产服务器
yarn start

# 代码检查
yarn lint

# PM2部署
yarn pm2
```

## 🎨 UI/UX 设计

### 设计系统
- **颜色主题**: 基于 `neutral` 色调的现代化设计
- **图标风格**: Lucide React 图标库
- **组件风格**: shadcn/ui New York 风格
- **动画**: tw-animate-css 动画库

### 响应式断点
- **移动端**: < 768px
- **平板**: 768px - 1024px  
- **桌面端**: > 1024px
- **大屏**: 1920px 最大宽度

## 🔧 配置文件

### Next.js 配置 (`next.config.ts`)
- 使用 App Router
- 自定义构建目录

### Tailwind 配置 (`tailwind.config.js`)
- CSS变量支持
- 自定义颜色主题
- 深色模式支持

### shadcn/ui 配置 (`components.json`)
- New York 风格
- TypeScript 支持
- 路径别名配置

## 📊 数据流

### API 集成
- 后端API接口调用
- 数据缓存策略
- 错误处理机制
- 加载状态管理

### 状态管理
- React Hooks (useState, useEffect, useMemo)
- 组件级别状态管理
- 数据实时更新

## 🚀 部署

### 生产环境构建
```bash
yarn build
```

### PM2 部署
项目已配置 PM2 生态系统文件 (`ecosystem.json`)：
```bash
yarn pm2
```

### 部署脚本
使用 `deploy.sh` 脚本进行自动化部署。

## 🧪 开发规范

### 代码风格
- TypeScript 严格模式
- ESLint 代码检查
- Prettier 格式化
- 组件函数式编程

### 文件命名
- 组件文件: `kebab-case.tsx`
- 页面文件: `page.tsx`, `layout.tsx`
- 类型文件: `types.ts`

### 组件规范
- 使用 TypeScript Props 接口
- 组件默认导出
- 合理的组件拆分粒度

## 📦 依赖说明

### 核心依赖
- `next`: Next.js 框架
- `react`: React 库
- `typescript`: TypeScript 支持

### UI 相关
- `@radix-ui/*`: 无样式基础组件
- `tailwindcss`: CSS 框架
- `lucide-react`: 图标库
- `next-themes`: 主题管理

### 数据可视化
- `recharts`: 图表库

### 工具库
- `class-variance-authority`: 条件类名
- `clsx`: 类名合并
- `tailwind-merge`: Tailwind 类名合并

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目采用私有许可证，仅供内部使用。

## 📞 联系方式

如有问题请联系项目维护者。

---

**最后更新**: 2024年12月
**版本**: 0.1.0