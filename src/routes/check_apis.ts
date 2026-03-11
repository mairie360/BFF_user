import { Router } from 'express';
import axios from 'axios';
import { CheckApiResponse, CheckApiResponseSchema } from '../views/check_api_view';
import { registry } from '../openapi-registry';

const router = Router();
const FULL_URL = `http://${process.env.CORE_API_URL}:${process.env.CORE_API_PORT}`;

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
    },
  },
});

// Ta logique Express classique (inchangée et typée !)
router.get('/', async (_, res) => {
  try {
    await axios.get(`${FULL_URL}/health`, { timeout: 5000 });
    
    const result: CheckApiResponse = {
      status: 'OK',
      core_api: 'Connected',
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(502).json({
      status: 'Error',
      core_api: 'Unreachable',
      message: (error as Error).message
    });
  }
});

export default router;