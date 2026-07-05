import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';

export const getCorsOrigins = () =>
  (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174,https://splitnest.netlify.app,https://splitn.netlify.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: getCorsOrigins(),
      credentials: true
    })
  );
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);

  return app;
}
