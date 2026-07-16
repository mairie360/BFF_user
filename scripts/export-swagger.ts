import fs from 'fs';
import path from 'path';
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from '../src/openapi-registry';

const routeFiles = fs.readdirSync(path.join(__dirname, '../src/routes')).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
routeFiles.forEach(file => {
  require(path.resolve(__dirname, '../src/routes', file));
});

const generator = new OpenApiGeneratorV31(registry.definitions);

const openApiDocument = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'BFF User API',
    version: '1.0.0',
    description: 'API du Backend for Frontend (BFF) pour l\'authentification et les informations utilisateur.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Serveur local de développement',
    },
  ],
});

const outputPath = path.join(process.cwd(), 'openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2));

console.log('✅ openapi.json a été généré avec succès !');
