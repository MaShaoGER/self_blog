import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export async function checkHealth(url = 'http://127.0.0.1:3000/healthz', timeoutMs = 4000) {
  require('sharp');
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  if (!response.ok || (await response.json()).status !== 'healthy') throw new Error('Unhealthy');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkHealth();
  } catch {
    console.error('Health check failed');
    process.exitCode = 1;
  }
}
