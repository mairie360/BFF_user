import { Router } from 'express';
import axios from 'axios'; // La lib utilisée

const router = Router();

// Récupération des variables d'environnement
const core_api_url = process.env.CORE_API_URL;
const core_api_port = process.env.CORE_API_PORT;

const FULL_URL = `http://${core_api_url}:${core_api_port}`;

router.get('/', async (_, res) => {
  try {
    // On fait l'appel vers l'API de base (ou un endpoint /health spécifique)
    const response = await axios.get(`${FULL_URL}/health`, { timeout: 5000 });
    
    console.log(response);
    
    res.status(200).json({
      status: 'OK',
      core_api: 'Connected',
      details: response.data
    });
  } catch (error) {
    res.status(502).json({
      status: 'Error',
      core_api: 'Unreachable',
      message: (error as Error).message
    });
  }
});

export default router;