// server/index.ts
import 'dotenv/config';
import { connectDb } from './db.js';
import { seedDatabase } from './seed.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3001);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/splitnest';

async function start() {
  await connectDb(MONGODB_URI);

  if (process.env.NODE_ENV !== 'production') {
    await seedDatabase();
  }

  const app = createApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SplitNest API running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
