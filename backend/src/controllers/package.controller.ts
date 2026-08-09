import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createPackage } from '../services/package.service';

const createPackageSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(255, 'Title cannot exceed 255 characters'),
  expiryHours: z
    .number()
    .int('Expiry hours must be an integer')
    .min(1, 'Expiry must be at least 1 hour')
    .max(168, 'Expiry cannot exceed 168 hours (7 days)')
    .default(24),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits')
    .optional()
    .or(z.literal('')),
});

/**
 * Controller to handle POST /api/packages requests
 */
export const createPackageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context is missing.',
        },
        meta: {},
      });
    }

    const validationResult = createPackageSchema.safeParse(req.body);

    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: `${issue.path.join('.')}: ${issue.message}`,
        },
        meta: {},
      });
    }

    const { title, expiryHours, pin } = validationResult.data;

    const createdPackage = await createPackage({
      senderId: req.user.id,
      title,
      expiryHours,
      pin: pin && pin.trim().length > 0 ? pin.trim() : undefined,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      data: createdPackage,
      error: null,
      meta: {},
    });
  } catch (err: any) {
    next(err);
  }
};
