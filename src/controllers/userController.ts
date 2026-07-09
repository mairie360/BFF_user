import { Request, Response } from 'express';
import axios from 'axios';
import { extractTokenFromHeader } from '../utils/cookieUtils';
import { UserIdParams } from '../openapi-registry';
import type { AboutResponseView } from '@mairie360/core-api-openapi/models/AboutResponseView';
import { coreClient, getCoreApiBaseUrl } from '../clients/coreClient';

export async function about(req: Request, res: Response) {
    try {
        const paramsResult = UserIdParams.safeParse(req.params);

        if (!paramsResult.success) {
            return res.status(400).json({
                message: 'Invalid user ID',
                error: paramsResult.error.issues,
            });
        }

        const token = extractTokenFromHeader(req.headers.authorization);
        const { data: userInfo } = await coreClient.get<AboutResponseView>(
            `/api/v1/user/${paramsResult.data.userId}/about`,
            {
                baseURL: getCoreApiBaseUrl(),
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            },
        );

        res.status(200).json(userInfo);
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        res.status(500).json({ message: 'Unknown error', error });
    }
}

export default {
    about,
};
