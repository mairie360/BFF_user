import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import authRouter from './routes/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// --- Configuration Swagger ---
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BFF API',
      version: '1.0.0',
      description: 'Documentation du BFF gérant la vérification des services',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Serveur local',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- Middlewares globaux ---
app.use(express.json());
app.use(cookieParser());

// --- Routes Swagger ---
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// --- Routes métier ---
app.use('/health', healthRouter);
app.use('/check_apis', checkApis);
app.use('/auth', authRouter);

// --- Middleware de gestion des erreurs ---
app.use(errorHandler);

// --- Démarrage du serveur ---
app.listen(Number(PORT), HOST, () => {
  console.log(`Server ready at http://${HOST}:${PORT}`);
  console.log(`Swagger docs at http://${HOST}:${PORT}/docs`);
});