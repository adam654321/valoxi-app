export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Invalid request') {
    super(400, message, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    public errors?: Record<string, string[]>
  ) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}
