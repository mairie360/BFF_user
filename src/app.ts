import 'dotenv/config';
import { apiOnlyHeaders, errorHandler, notFoundHandler, parseTrustProxy, securityHeaders } from '@mairie360/bffs-lib';
import cookieParser from 'cookie-parser';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import checkApis from './routes/check_apis';
import healthRouter from './routes/health';
import sessionRouter from './routes/session';
import userRouter from './routes/user';

export const app = express();
app.disable('x-powered-by');
// Client IP (req.ip) used by the auth rate limiters: behind the ingress/fronts, set TRUST_PROXY (hop count or
// trusted subnets) so that req.ip comes from X-Forwarded-For; unset = the TCP peer is the client.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
// Security headers shared by every BFF, then the stricter API-only ones (default-src 'none') everywhere but
// /docs. Both run before body parsing, so they also cover body-parse error responses.
app.use(securityHeaders);
app.use(apiOnlyHeaders());

app.use(express.json());
// Only for the refreshToken cookie of /auth/refresh and /auth/logout: the session itself is the Bearer header.
app.use(cookieParser());

// Interactive documentation, and the JSON spec: /openapi.json is the target of the ZAP scan
// (docker-compose-security.yml), /swagger.json is read by the CI composite action.
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get(['/openapi.json', '/swagger.json'], (_req, res) => res.json(openApiDocument));

// Session-bound routers set Cache-Control: no-store and require the Bearer header themselves (MAIR-429).
app.use('/health', healthRouter);
app.use('/check_apis', checkApis);
app.use('/auth', authRouter);
app.use('/user', userRouter);
app.use('/session', sessionRouter);
// Alias kept for the fronts and the BFFs that call GET /me.
app.use('/', sessionRouter);
app.use('/bff/admin', adminRouter);

// Unknown routes and every error end in the shared envelope `{ error: { code, message, details } }`:
// the status of the error is kept (400 for an unparsable body, 401, 404, 409, 502, 503...) and anything
// unexpected becomes a 500 without leaking its message.
app.use(notFoundHandler);
app.use(errorHandler());

export default app;
