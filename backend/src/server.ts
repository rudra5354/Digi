import app from './app';
import { config } from './config';
import { verifySupabaseConnection } from './services/supabase';
import { ensureBucketExists } from './services/storage';

const server = app.listen(config.PORT, async () => {
  console.log(`🚀 Digi-Doc API server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
  await verifySupabaseConnection();
  await ensureBucketExists();
});

// Graceful Shutdown
const shutdown = () => {
  console.log('🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('💻 Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
