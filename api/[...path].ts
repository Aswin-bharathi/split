import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server/app.js';
import { connectDb } from '../server/db.js';

const MONGODB_URI = process.env.MONGODB_URI;

let app: ReturnType<typeof createApp> | null = null;
let dbPromise: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!MONGODB_URI) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'MONGODB_URI is not configured.' }));
    return;
  }

  if (!dbPromise) dbPromise = connectDb(MONGODB_URI);
  await dbPromise;
  if (!app) app = createApp();

  return app(req, res);
}
