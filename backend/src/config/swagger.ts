import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Occasio API',
      version: '1.0.0',
      description: 'API documentation for Occasio - Full-stack Event Planning Platform',
    },
    servers: [
      {
        url: '/',
        description: 'Default Server',
      },
    ],
  },
  apis: [
    path.resolve(__dirname, '../constants/swagger.ts'),
    path.resolve(__dirname, '../constants/swagger.js'),
    path.resolve(__dirname, '../modules/**/*.routes.ts'),
    path.resolve(__dirname, '../modules/**/*.routes.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
