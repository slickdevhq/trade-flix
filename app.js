import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import passport from 'passport';
import './src/config/passport.js';
import logger from './src/config/logger.js';
import v1Routes from './src/routes/index.js';
import { globalErrorHandler, notFoundHandler } from './src/middleware/error.middleware.js';

const app = express();

// Logger
app.use(pinoHttp({ logger }));

const allowedOrigins = [
  process.env.CLIENT_URL, // Your Vercel link
  process.env.LOCAL_URL,  // Your local frontend
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in our allowed list
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
// Handle preflight requests
app.options('*', cors(corsOptions));


// Security middleware (after cors so helmet doesn't block OPTIONS)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Passport
app.use(passport.initialize());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', env: process.env.NODE_ENV });
});

// API v1 routes
// NOTE: Do NOT apply authLimiter here — the individual auth routes already have their own
// rate limiters. Applying it here double-limits every auth request.
app.use('/api/v1', v1Routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

export default app;