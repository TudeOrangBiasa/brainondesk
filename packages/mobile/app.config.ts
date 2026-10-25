import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'BrainOnDesk',
  slug: 'brainondesk',
  scheme: 'brainondesk',
  version: '0.84.0',
  orientation: 'portrait',
  android: {
    package: 'app.brainondesk',
  },
  plugins: ['expo-dev-client'],
};

export default config;
