import React from 'react';
import config, { getConfigValue } from './index';

const ConfigExample: React.FC = () => {
  // Get the entire configuration
  console.log('Full config:', config);
  
  // Get specific values
  const appName = getConfigValue('app.name', 'Default App Name');
  const apiBaseUrl = getConfigValue('api.baseUrl', 'https://default-api.com');
  const isDarkMode = getConfigValue('features.darkMode', false);
  
  return (
    <div>
      <h1>Configuration Example</h1>
      <p>Current Environment: {process.env.NODE_ENV || 'development'}</p>
      
      <h2>Configuration Values:</h2>
      <ul>
        <li><strong>App Name:</strong> {appName}</li>
        <li><strong>API Base URL:</strong> {apiBaseUrl}</li>
        <li><strong>Dark Mode Enabled:</strong> {isDarkMode ? 'Yes' : 'No'}</li>
      </ul>
      
      <h2>Full Configuration (check console):</h2>
      <pre>{JSON.stringify(config, null, 2)}</pre>
    </div>
  );
};

export default ConfigExample;
