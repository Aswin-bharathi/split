import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server/app.js';
import { connectDb } from '../server/db.js';
import { getCorsOrigins } from '../server/app.js';

const MONGODB_URI = process.env.MONGODB_URI;

let app: ReturnType<typeof createApp> | null = null;
let dbPromise: Promise<void> | null = null;

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  const allowedOrigins = getCorsOrigins();
  if (typeof origin === 'string' && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!MONGODB_URI) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'MONGODB_URI is not configured.' }));
    return;
  }

  if (!dbPromise) dbPromise = connectDb(MONGODB_URI);
  await dbPromise;
  if (!app) app = createApp();

  return app(req, res);
}
