import { Router } from 'express';
import axios from 'axios';

import dotenv from 'dotenv';
import handleApiRequest from '../function/handleApiRequest';
import { Request, Response } from 'express';
dotenv.config();

const updateUserRouter = Router();
const BASE_API_URL = process.env.BASE_API_URL;
/**
 * Sends a PUT request to update a user's information on the backend API.
 *
 * @param id - The unique identifier of the user to update.
 * @param req.body - The request body containing the updated user data.
 * @returns A promise that resolves to the Axios response containing the updated user information.
 * @throws Will throw an error if the HTTP request fails.
 */
updateUserRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  handleApiRequest(req, res, async () => {
    const response = await axios.put(`${BASE_API_URL}/users/${id}`, req.body);
    return response.data;
  });
});

export default updateUserRouter;