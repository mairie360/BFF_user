import { Router } from 'express';

const router = Router();

/**
 * Sends a GET request to test the health of the backend API.
 *
 * @returns A promise that resolves to the Axios response containing the health status.
 * @throws Will throw an error if the HTTP request fails.
 */
router.get('/', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

export default router;
