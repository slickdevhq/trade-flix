// analytics.routes.js (IMPROVED VERSION)
import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { analyticsQuerySchema } from '../validation/analytics.validation.js';
import { 
  getAnalyticsOverview,
  getKpiMetrics,
  getEquityCurve,
  getMonthlyBreakdown,
  getMistakeAnalysis
} from '../controllers/analytics.controller.js';

const router = Router();

// Master endpoint - returns everything (current behavior)
router.get('/overview', validate(analyticsQuerySchema, 'query'), getAnalyticsOverview);

// Granular endpoints - fetch specific data
router.get('/kpi', validate(analyticsQuerySchema, 'query'), getKpiMetrics);
router.get('/equity', validate(analyticsQuerySchema, 'query'), getEquityCurve);
router.get('/monthly', validate(analyticsQuerySchema, 'query'), getMonthlyBreakdown);
router.get('/mistakes', validate(analyticsQuerySchema, 'query'), getMistakeAnalysis);

export default router;