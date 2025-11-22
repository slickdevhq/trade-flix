import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import passport from 'passport';
import './src/config/passport.js'
import logger from './src/config/logger.js';
import v1Routes from './src/routes/index.js';
import { globalErrorHandler, notFoundHandler } from './src/middleware/error.middleware.js';
import { authLimiter } from './src/middleware/rateLimiter.middleware.js';

const app = express();

// Logger
app.use(pinoHttp({ logger }));

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [process.env.CLIENT_URL, process.env.LOCAL_URL]; // Allow both client and local URLs
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
 //// allowedHeaders: ['Content-Type', 'Authorization', 
 // //'X-CSRF-Token',  'x-paystack-signature'], 
};
app.use(cors(corsOptions));
// Security middleware
app.use(helmet());


// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Passport Middleware
app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API v1 routes
app.use('/api/v1/auth', authLimiter); // Apply rate limit to auth routes
app.use('/api/v1', v1Routes);

// 404 Not Found handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

export default app;