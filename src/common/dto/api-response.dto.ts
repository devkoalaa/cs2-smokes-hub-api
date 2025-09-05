export class ApiResponseDto<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  statusCode: number;

  constructor(success: boolean, statusCode: number, data?: T, message?: string) {
    this.success = success;
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    return new ApiResponseDto(true, 200, data, message);
  }

  static created<T>(data: T, message?: string): ApiResponseDto<T> {
    return new ApiResponseDto(true, 201, data, message);
  }

  static error(statusCode: number, message: string): ApiResponseDto {
    return new ApiResponseDto(false, statusCode, undefined, message);
  }
}