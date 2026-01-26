import { Response } from 'express';
import { AppError } from './errors';
import { ZodError } from 'zod';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  res.status(statusCode).json({
    success: true,
    data
  });
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      ...(error instanceof AppError && 'errors' in error ? { errors: (error as any).errors } : {})
    });
    return;
  }

  if (error instanceof ZodError) {
    const formattedErrors: Record<string, string[]> = {};
    error.errors.forEach(err => {
      const path = err.path.join('.');
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(err.message);
    });

    res.status(400).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: formattedErrors
    });
    return;
  }

  console.error('Unexpected error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}
