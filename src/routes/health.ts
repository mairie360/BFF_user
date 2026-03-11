import { Router } from 'express';

const router = Router();

/**
 * @openapi
 * /health:
 * get:
 * summary: Vérifie la santé du BFF
 * responses:
 * 200:
 * description: OK
 */
router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;