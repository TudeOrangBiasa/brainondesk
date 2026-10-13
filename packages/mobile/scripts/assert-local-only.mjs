import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const banned = [
  'expo-updates',
  'expo-insights',
  'expo-notifications',
  'expo-app-metrics',
  'expo-analytics-amplitude',
  '@sentry/react-native',
  'sentry-expo',
];
const declared = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
  ...pkg.optionalDependencies,
};
const found = banned.filter((name) => declared[name]);
if (found.length > 0) {
  console.error(`local-only check failed, banned packages declared: ${found.join(', ')}`);
  process.exit(1);
}
if (existsSync(join(packageRoot, 'eas.json'))) {
  console.error('local-only check failed, eas.json must not exist');
  process.exit(1);
}
const config = readFileSync(join(packageRoot, 'app.config.ts'), 'utf8');
if (config.includes('updates.url') || config.includes('u.expo.dev')) {
  console.error('local-only check failed, app.config.ts must not set an updates URL');
  process.exit(1);
}
