import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { requireAuth } from './middleware/auth';
import packageRoutes from './routes/package.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// Standard Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: config.NODE_ENV === 'production' ? false : '*', // Strict CORS in production can be set here
    credentials: true,
  })
);

// Rate Limiter: Max 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    data: null,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    meta: {},
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { status: 'healthy', timestamp: new Date().toISOString() },
    error: null,
    meta: {},
  });
});

// API Welcome Route
app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { message: 'Welcome to the Digi-Doc API' },
    error: null,
    meta: {},
  });
});

// Auth Verification Route
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
    error: null,
    meta: {},
  });
});

// Package Management Routes
app.use('/api/packages', packageRoutes);
app.use('/api/admin', adminRoutes);

// 404 Route Not Found Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
    meta: {},
  });
});

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Unhandled error:', err.message || err);

  const status = err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = config.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message || 'An unexpected error occurred';

  res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
    meta: {},
  });
});

export default app;
