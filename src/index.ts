import 'dotenv/config';
// Before the app: OpenTelemetry must hook Express before it is loaded (MAIR-504).
import './telemetry';
import { assertConfigured } from '@mairie360/bffs-lib';
import app from './app';

/**
 * Fail-fast startup check: refuses to start without a valid `CORE_API_URL` or without `JWT_SECRET`
 * (admin session check), naming every missing variable, instead of failing on the first request.
 */
export function assertStartupConfiguration(): void {
  assertConfigured(['CORE_API']);
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('Missing configuration: JWT_SECRET');
  }
}

if (require.main === module) {
  assertStartupConfiguration();
  const listenPort = Number(process.env.PORT || 4000);
  app.listen(listenPort, '0.0.0.0', () => {
    console.log(`Server listening on port ${listenPort}, Swagger docs at /docs`);
  });
}
