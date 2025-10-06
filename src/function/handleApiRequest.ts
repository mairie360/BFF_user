import e, { Request, Response } from 'express';

/**
 * Method to handle API requests with error handling.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param apiCall - A function that performs the API call.
 * @returns A promise that resolves to the Axios response containing the updated user information.
 * @throws Will return the API error if the HTTP request fails.
 */

async function handleApiRequest<T>(
  req: Request,
  res: Response,
  apiCall: () => Promise<T>
): Promise<void> {
  try {
    const data = await apiCall();
    res.json(data);
  } catch (error: unknown) {
    console.error('API request error:', (error as Error).message);

    const err = error as {
      response?: { status: number; data?: unknown };
      request?: unknown;
      message?: string;
    };

    if (err.response) {
      res.status(err.response.status).json({
        error: err.response.data || err.message,
      });
    } else if (err.request) {
      res.status(502).json({ error: 'No response from upstream API' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
}

export default handleApiRequest;