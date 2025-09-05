import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log error with request context for debugging and monitoring
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle HTTP exceptions (including validation errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        
        // Handle validation errors with detailed field messages
        if (responseObj.message && Array.isArray(responseObj.message)) {
          return {
            statusCode: status,
            message: this.aggregateValidationErrors(responseObj.message),
            error: responseObj.error || exception.name,
            timestamp,
            path,
          };
        }

        return {
          statusCode: status,
          message: responseObj.message || exception.message,
          error: responseObj.error || exception.name,
          timestamp,
          path,
        };
      }

      return {
        statusCode: status,
        message: exception.message,
        error: exception.name,
        timestamp,
        path,
      };
    }

    // Handle Prisma errors
    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception as any, timestamp, path);
    }

    // Handle unknown errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
      timestamp,
      path,
    };
  }

  private aggregateValidationErrors(messages: string[]): string[] {
    // Group validation errors by field for better readability
    const fieldErrors: { [key: string]: string[] } = {};
    const generalErrors: string[] = [];

    messages.forEach((message) => {
      // Try to extract field name from validation message
      // Look for patterns like "fieldName must be..." or "fieldName should be..."
      const fieldMatch = message.match(/^(\w+)\s+(must|should|cannot|is|has)\s+(.+)$/);
      if (fieldMatch) {
        const [, field, , error] = fieldMatch;
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(`${fieldMatch[2]} ${error}`);
      } else {
        generalErrors.push(message);
      }
    });

    // Format aggregated errors
    const aggregatedErrors: string[] = [];
    
    Object.entries(fieldErrors).forEach(([field, errors]) => {
      aggregatedErrors.push(`${field}: ${errors.join(', ')}`);
    });

    return [...aggregatedErrors, ...generalErrors];
  }

  // Narrow down Prisma-like errors without relying on Prisma runtime classes
  private isPrismaError(exception: unknown): boolean {
    if (typeof exception !== 'object' || exception === null) {
      return false;
    }

    const maybeError = exception as { code?: unknown; name?: unknown };

    // Known request errors include string codes like "P2002", "P2025", etc.
    if (typeof maybeError.code === 'string' && maybeError.code.startsWith('P')) {
      return true;
    }

    // Other Prisma errors often carry a name starting with "PrismaClient"
    if (typeof maybeError.name === 'string' && maybeError.name.startsWith('PrismaClient')) {
      return true;
    }

    return false;
  }

  private handlePrismaError(
    exception: { code?: string; meta?: Record<string, unknown>; name?: string },
    timestamp: string,
    path: string,
  ): ErrorResponse {
    // Handle known Prisma errors by error code
    if (typeof exception.code === 'string') {
      switch (exception.code) {
        case 'P2002':
          // Unique constraint violation
          const target = exception.meta?.target as string[] | undefined;
          const field = target ? target[0] : 'field';
          return {
            statusCode: HttpStatus.CONFLICT,
            message: `A record with this ${field} already exists`,
            error: 'ConflictError',
            timestamp,
            path,
          };

        case 'P2025':
          // Record not found
          return {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Record not found',
            error: 'NotFoundError',
            timestamp,
            path,
          };

        case 'P2003':
          // Foreign key constraint violation
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid reference to related record',
            error: 'BadRequestError',
            timestamp,
            path,
          };

        case 'P2014':
          // Required relation violation
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Required relation is missing',
            error: 'BadRequestError',
            timestamp,
            path,
          };

        default:
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Database operation failed',
            error: 'DatabaseError',
            timestamp,
            path,
          };
      }
    }

    // Handle validation errors by name
    if (exception.name === 'PrismaClientValidationError') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        error: 'ValidationError',
        timestamp,
        path,
      };
    }

    // Handle other Prisma errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database connection error',
      error: 'DatabaseConnectionError',
      timestamp,
      path,
    };
  }

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse,
  ): void {
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    
    const logContext = {
      method,
      url,
      ip,
      userAgent,
      statusCode: errorResponse.statusCode,
      timestamp: errorResponse.timestamp,
    };

    if (errorResponse.statusCode >= 500) {
      // Log server errors with full stack trace
      this.logger.error(
        `Server Error: ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : String(exception),
        logContext,
      );
    } else if (errorResponse.statusCode >= 400) {
      // Log client errors with less detail
      this.logger.warn(
        `Client Error: ${errorResponse.message}`,
        logContext,
      );
    }
  }
}