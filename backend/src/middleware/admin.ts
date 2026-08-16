import { NextFunction, Request, Response } from 'express';

const isAdmin = (user: NonNullable<Request['user']>): boolean => {
  const metadata = user.app_metadata as { role?: string; roles?: string[] } | undefined;
  return metadata?.role === 'admin' || metadata?.roles?.includes('admin') === true;
};

/** Requires a Supabase Auth user whose server-controlled app metadata grants admin access. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: { code: 'ADMIN_ACCESS_REQUIRED', message: 'Administrator access is required.' },
      meta: {},
    });
  }
  next();
};
