


import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import handleApiRequest from '../function/handleApiRequest';
import { Request, Response } from 'express';
dotenv.config();

const usersRouter = Router();
const BASE_API_URL = process.env.BASE_API_URL;

/**
 * GET /users
 * 
 * Retrieves a list of all users from the external API.
 * 
 * @route GET /
 * @returns {User[]} 200 - An array of user objects
 * @returns {Error}  default - Unexpected error
 */
usersRouter.get('/', (req: Request, res: Response) => {
  handleApiRequest(req, res, async () => {
    const response = await axios.get(`${BASE_API_URL}/users`);
    return response.data;
  });
});

/**
 * GET /users/:id
 * 
 * Retrieves a specific user by their unique identifier from the external API.
 * 
 * @route GET /:id
 * @param {string} id - The unique identifier of the user
 * @returns {User} 200 - The user object
 * @returns {Error} default - Unexpected error
 */
usersRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  handleApiRequest(req, res, async () => {
    const response = await axios.get(`${BASE_API_URL}/users/${id}`);
    return response.data;
  });
});

export default usersRouter;