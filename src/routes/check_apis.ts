import { Router } from 'express';
import axios from 'axios';
import { CheckApiResponse, CheckApiResponseSchema } from '../views/check_api_view';
import { registry } from '../openapi-registry';
import { getCoreApiBaseUrl } from '../clients/coreClient';

const router = Router();

// Déclaration OpenAPI automatisée
registry.registerPath({
  method: 'get',
  path: '/check_apis',
  tags: ['Connectivity'],
  summary: "Vérifie la connexion avec l'API Core (Rust)",
  responses: {
    200: {
      description: 'Connexion réussie',
      content: {
        'application/json': {
          schema: CheckApiResponseSchema,
        },
      },
    },
    502: {
      description: 'API Core injoignable',
      content: {
        'application/json': {
          schema: CheckApiResponseSchema,
        },
      },
    },
  },
});

router.get('/', async (_, res) => {
  try {
    // Même URL que le client Core (CORE_API_URL + CORE_API_PORT), relue à chaque vérification.
    await axios.get(`${getCoreApiBaseUrl()}/health`, { timeout: 5000 });

    const result: CheckApiResponse = {
      status: 'OK',
      core_api: 'Connected',
    };

    res.status(200).json(result);
  } catch (error) {
    // Le détail (hôte, port, code réseau) reste dans les logs : il ne doit pas fuiter vers le client.
    console.error('[BFF] Core API health check failed:', error instanceof Error ? error.message : error);
    const result: CheckApiResponse = {
      status: 'Error',
      core_api: 'Unreachable',
    };

    res.status(502).json(result);
  }
});

export default router;
