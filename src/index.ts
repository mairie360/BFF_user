import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { registry } from './openapi-registry';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import adminRouter from './routes/admin';
import sessionRouter from './routes/session';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const generator = new OpenApiGeneratorV31(registry.definitions);

const openApiSpec = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'BFF User API',
    version: '1.0.0',
    description: 'API du Backend for Frontend (BFF) pour l\'authentification et les informations utilisateur.',
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Serveur local',
    },
  ],
});

// --- Middlewares globaux ---
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

// --- Middleware de gestion des erreurs ---
app.use(errorHandler);

// --- Démarrage du serveur ---
app.listen(Number(PORT), HOST, () => {
  console.log(`Server ready at http://${HOST}:${PORT}`);
  console.log(`Swagger docs at http://${HOST}:${PORT}/docs`);
});
