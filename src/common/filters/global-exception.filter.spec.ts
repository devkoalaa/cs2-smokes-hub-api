import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
// Do not import Prisma error classes directly to avoid tight coupling with runtime
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test-endpoint',
      method: 'POST',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('HTTP Exceptions', () => {
    it('should handle basic HTTP exceptions', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Test error',
        error: 'HttpException',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle validation errors with detailed field messages', () => {
      const validationException = new BadRequestException({
        message: [
          'title must be longer than or equal to 1 characters',
          'videoUrl must be a URL address',
          'mapId must be a positive number',
        ],
        error: 'Bad Request',
      });

      filter.catch(validationException, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: [
          'title: must be longer than or equal to 1 characters',
          'videoUrl: must be a URL address',
          'mapId: must be a positive number',
        ],
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle HTTP exceptions with object response', () => {
      const exception = new HttpException(
        {
          message: 'Custom error message',
          error: 'CustomError',
        },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'Custom error message',
        error: 'CustomError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });
  });

  describe('Prisma Errors', () => {
    it('should handle unique constraint violation (P2002)', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Unique constraint failed',
        code: 'P2002',
        meta: { target: ['email'] },
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 409,
        message: 'A record with this email already exists',
        error: 'ConflictError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle record not found (P2025)', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Record not found',
        code: 'P2025',
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Record not found',
        error: 'NotFoundError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle foreign key constraint violation (P2003)', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Foreign key constraint failed',
        code: 'P2003',
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Invalid reference to related record',
        error: 'BadRequestError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle required relation violation (P2014)', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Required relation missing',
        code: 'P2014',
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Required relation is missing',
        error: 'BadRequestError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle unknown Prisma errors', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Unknown error',
        code: 'P9999',
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Database operation failed',
        error: 'DatabaseError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle Prisma validation errors', () => {
      const prismaError = {
        name: 'PrismaClientValidationError',
        message: 'Invalid data provided',
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Invalid data provided',
        error: 'ValidationError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle other Prisma errors', () => {
      const prismaError = {
        name: 'PrismaClientUnknownRequestError',
        message: 'Connection failed',
      } as any;

      filter.catch(prismaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Database connection error',
        error: 'DatabaseConnectionError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });
  });

  describe('Unknown Errors', () => {
    it('should handle unknown errors', () => {
      const unknownError = new Error('Something went wrong');

      filter.catch(unknownError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
        error: 'InternalServerError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });

    it('should handle non-Error objects', () => {
      const unknownError = 'String error';

      filter.catch(unknownError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
        error: 'InternalServerError',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });
  });

  describe('Validation Error Aggregation', () => {
    it('should aggregate validation errors by field', () => {
      const validationException = new BadRequestException({
        message: [
          'title must be longer than or equal to 1 characters',
          'title must be a string',
          'videoUrl must be a URL address',
          'General validation error',
        ],
        error: 'Bad Request',
      });

      filter.catch(validationException, mockArgumentsHost);

      const expectedMessage = [
        'title: must be longer than or equal to 1 characters, must be a string',
        'videoUrl: must be a URL address',
        'General validation error',
      ];

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: expectedMessage,
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: '/test-endpoint',
      });
    });
  });

  describe('Request Context Logging', () => {
    it('should include request context in error response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          path: '/test-endpoint',
        }),
      );
    });

    it('should handle requests without user-agent header', () => {
      mockRequest.headers = {};
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });
});