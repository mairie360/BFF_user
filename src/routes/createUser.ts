import { Router } from "express";
import axios from "axios";
import dotenv from "dotenv";
import handleApiRequest from "../function/handleApiRequest";
import { Request, Response } from "express";
dotenv.config();

const createUserRouter = Router();
const BASE_API_URL = process.env.BASE_API_URL;

/**
 * Sends a POST request to create a new user on the backend API.
 *
 * @param req.body - The request body containing the new user data.
 * @returns A promise that resolves to the Axios response containing the created user information.
 * @throws Will throw an error if the HTTP request fails.
 */

createUserRouter.post("/", (req: Request, res: Response) => {
  handleApiRequest(req, res, async () => {
    const response = await axios.post(`${BASE_API_URL}/users`, req.body);
    return response.data;
  });
});

export default createUserRouter;