import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';

/**
 * Middleware to authenticate requests using Supabase JWT
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. Missing or malformed authorization header.',
        },
        meta: {},
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. Token is empty.',
        },
        meta: {},
      });
    }

    // Verify token with Supabase Auth
    // By calling getUser, we securely retrieve the user record associated with this token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: error?.message || 'Access denied. Invalid or expired token.',
        },
        meta: {},
      });
    }

    // Attach user information to request
    req.user = user;
    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err.message || err);
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during authentication processing.',
      },
      meta: {},
    });
  }
};
