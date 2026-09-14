import { openApiDocument as openApiSpec } from './openapi';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import sessionRouter from './routes/session';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';



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

// --- Route inconnue : 404 JSON (le fallback Express répond en text/html) ---
app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// --- Middleware de gestion des erreurs ---
app.use(errorHandler);

// --- Démarrage du serveur ---
if (require.main === module) app.listen(Number(PORT), HOST, () => {
  console.log(`Server ready at http://${HOST}:${PORT}`);
  console.log(`Swagger docs at http://${HOST}:${PORT}/docs`);
});
