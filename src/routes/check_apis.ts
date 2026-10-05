import { checkApis, checkApisResponseSchema, withoutSession } from '@mairie360/bffs-lib';
import { Router } from 'express';
import { coreApi } from '../clients/coreClient';
import { registry } from '../openapi-registry';

const router = Router();

// One `<service>: Connected | Unreachable` entry per upstream the BFF calls: Core API only, probed through
// its generated `health` operation with the same CORE_API_URL (+ CORE_API_PORT) as the real calls.
export const CheckApisResponseSchema = registry.register('CheckApisResponse', checkApisResponseSchema(['core_api']));

registry.registerPath({
  method: 'get',
  path: '/check_apis',
  security: [],
  tags: ['Connectivity'],
  summary: 'Checks that Core API is reachable',
  responses: {
    200: { description: 'Core API is reachable', content: { 'application/json': { schema: CheckApisResponseSchema } } },
    502: { description: 'Core API is unreachable or CORE_API_URL is not set', content: { 'application/json': { schema: CheckApisResponseSchema } } },
  },
});

// The network detail (host, port, error code) is only logged, never sent to the client.
router.get('/', checkApis({ core_api: () => coreApi.health(withoutSession('CORE_API', 5_000)) }));

export default router;
