# Configuration System

This configuration system allows loading different configurations based on the current environment (development, production, test).

## Structure

- `default.json` - Base configuration that applies to all environments
- `development.json` - Development environment specific configuration
- `production.json` - Production environment specific configuration
- `test.json` - Test environment specific configuration
- `index.ts` - Configuration utility functions

## Usage

### Import the configuration

```typescript
// Import the entire config
import config from '@/config';

// Or import specific utility functions
import { getConfig, getConfigValue } from '@/config';
```

### Get configuration values

```typescript
// Get the entire configuration
const fullConfig = getConfig();

// Get a specific value with dot notation
const apiBaseUrl = getConfigValue('api.baseUrl');

// Get a value with a default fallback
const featureFlag = getConfigValue('features.newFeature', false);
```

### Override configuration (for testing)

```typescript
import { overrideConfig } from '@/config';

// Override specific values
overrideConfig({
  api: {
    baseUrl: 'http://test-api.example.com'
  }
});
```

## Environment Detection

The configuration system automatically detects the current environment based on `process.env.NODE_ENV`:

- When `NODE_ENV` is 'development', it loads development.json
- When `NODE_ENV` is 'production', it loads production.json
- When `NODE_ENV` is 'test', it loads test.json
- If `NODE_ENV` is not set, it defaults to 'development'

## Adding New Configuration

To add new configuration options, update the appropriate JSON files and extend the `Config` interface in `index.ts` if needed.
