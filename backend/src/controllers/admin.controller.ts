import { NextFunction, Request, Response } from 'express';
import { getAdminActivity, getAdminOverview, getAdminPackages, getAdminUsers, getAdminVerifications } from '../services/admin.service';

const respond = async (res: Response, next: NextFunction, operation: () => Promise<unknown>) => {
  try { return res.status(200).json({ success: true, data: await operation(), error: null, meta: {} }); }
  catch (error) { next(error); }
};

export const adminOverviewHandler = (_req: Request, res: Response, next: NextFunction) => respond(res, next, getAdminOverview);
export const adminUsersHandler = (_req: Request, res: Response, next: NextFunction) => respond(res, next, getAdminUsers);
export const adminPackagesHandler = (_req: Request, res: Response, next: NextFunction) => respond(res, next, getAdminPackages);
export const adminVerificationsHandler = (_req: Request, res: Response, next: NextFunction) => respond(res, next, getAdminVerifications);
export const adminActivityHandler = (_req: Request, res: Response, next: NextFunction) => respond(res, next, getAdminActivity);
