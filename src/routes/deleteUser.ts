import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import handleApiRequest from '../function/handleApiRequest';
import { Request, Response } from 'express';

dotenv.config();

const deleteUserRouter = Router();
const BASE_API_URL = process.env.BASE_API_URL;


/**
 * Sends a DELETE request to remove a user from the backend API.
 *
 * @param id - The unique identifier of the user to delete.
 * @returns A promise that resolves to the Axios response containing the result of the deletion.
 * @throws Will throw an error if the HTTP request fails.
 */

deleteUserRouter.delete('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    handleApiRequest(req, res, async () => {
        console.log("Deleting user with id:", id);
        const response = await axios.delete(`${BASE_API_URL}/users/${id}`);
        return response.data; // juste retourner les données
    });
});


export default deleteUserRouter;