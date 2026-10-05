import 'dotenv/config';
import { openApiDocument as openApiSpec } from './openapi';
import { assertConfigured, errorHandler, notFoundHandler, parseTrustProxy } from '@mairie360/bffs-lib';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import sessionRouter from './routes/session';

export const app = express();
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';



// Client IP used by the auth rate limiters: behind the ingress/fronts, set TRUST_PROXY (hop count or
// trusted subnets) so that req.ip comes from X-Forwarded-For; unset = the TCP peer is the client.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

// --- Middlewares globaux ---
// En-têtes de sécurité (CSP, X-Content-Type-Options, Permissions-Policy, CORP…)
// et suppression de X-Powered-By. upgrade-insecure-requests est retiré car le
// BFF est servi en HTTP derrière le reverse proxy.
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'upgrade-insecure-requests': null },
    },
}));
app.use(express.json());
app.use(cookieParser());

// --- Routes Swagger ---
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});

// --- Routes métier ---
app.use('/health', healthRouter);
app.use('/check_apis', checkApis);
app.use('/auth', authRouter);
app.use('/user', userRouter);
app.use('/session', sessionRouter);
// Alias conservé pour les frontends et les BFFs qui consomment GET /me.
app.use('/', sessionRouter);
app.use('/bff/admin', adminRouter);

// --- Unknown routes and errors: the shared envelope { error: { code, message, details } } ---
// The status of the error is kept (400 unparsable body, 401, 404, 409, 502...); anything unexpected
// becomes a generic 500 whose message never reaches the client.
app.use(notFoundHandler);
app.use(errorHandler());

/**
 * Fail-fast startup check: refuses to start without a valid `CORE_API_URL` or without `JWT_SECRET`
 * (admin session check), naming every missing variable, instead of failing on the first request.
 */
export function assertStartupConfiguration(): void {
  assertConfigured(['CORE_API']);
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('Missing configuration: JWT_SECRET');
  }
}

// --- Server start (not when imported by the tests) ---
if (require.main === module) {
  assertStartupConfiguration();
  app.listen(Number(PORT), HOST, () => {
    console.log(`Server ready at http://${HOST}:${PORT}`);
    console.log(`Swagger docs at http://${HOST}:${PORT}/docs`);
  });
}
