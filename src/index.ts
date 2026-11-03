import 'dotenv/config';
// Before the app: OpenTelemetry must hook Express before it is loaded (MAIR-504).
import './telemetry';
import { assertConfigured, sessionKeysFromEnv } from '@mairie360/bffs-lib';
import app from './app';
import { logger } from './logger';

/**
 * Fail-fast startup check: refuses to start without a valid `CORE_API_URL` or without a session key, naming the
 * missing variable, instead of failing on the first request. The session tokens are verified with Core's public key
 * `JWT_PUBLIC_KEY` (MAIR-680); `JWT_SECRET` alone is still accepted during the transition (HS256 tokens).
 */
export function assertStartupConfiguration(): void {
  assertConfigured(['CORE_API']);
  let keys: ReturnType<typeof sessionKeysFromEnv>;
  try {
    keys = sessionKeysFromEnv();
  } catch {
    // The parsing detail is not needed to fix it, and the key is not logged.
    throw new Error('Invalid configuration: JWT_PUBLIC_KEY must hold Ed25519 PUBLIC KEY PEM blocks');
  }
  if (keys === undefined) {
    throw new Error('Missing configuration: JWT_PUBLIC_KEY (or JWT_SECRET during the HS256 transition)');
  }
}

if (require.main === module) {
  assertStartupConfiguration();
  const listenPort = Number(process.env.PORT || 4000);
  app.listen(listenPort, '0.0.0.0', () => {
    logger.info('server listening', { port: listenPort, docs: '/docs' });
  });
}
