import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, seedDb } from './src/db/db.ts';
import { initExpiryJob } from './src/services/expiryJob.ts';
import apiRoutes from './src/routes/api.ts';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = 3000;

  // Initialize DB and Cron
  initDb();
  seedDb();
  initExpiryJob();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---
  app.use('/api', apiRoutes);

  if (process.env.NODE_ENV === 'production') {
    // Serve static assets from the Vite build directory
    app.use(express.static(path.join(__dirname, 'dist')));

    // For any other request, serve the index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Create Vite server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Use vite's connect instance as middleware
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
