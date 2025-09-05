import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateSmokeDto, RateSmokeDto, ReportSmokeDto } from './index';

describe('DTOs Validation', () => {
  describe('CreateSmokeDto', () => {
    it('should validate a valid CreateSmokeDto', async () => {
      const dto = plainToClass(CreateSmokeDto, {
        title: 'Test Smoke',
        videoUrl: 'https://example.com/video.mp4',
        timestamp: 30,
        x_coord: 100.5,
        y_coord: 200.7,
        mapId: 1,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid data', async () => {
      const dto = plainToClass(CreateSmokeDto, {
        title: '', // Invalid: empty string
        videoUrl: 'not-a-url', // Invalid: not a URL
        timestamp: -5, // Invalid: negative number
        x_coord: 'not-a-number', // Invalid: not a number
        y_coord: 200.7,
        mapId: 0, // Invalid: not positive
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('RateSmokeDto', () => {
    it('should validate valid rating values', async () => {
      const dto1 = plainToClass(RateSmokeDto, { value: 1 });
      const dto2 = plainToClass(RateSmokeDto, { value: -1 });

      const errors1 = await validate(dto1);
      const errors2 = await validate(dto2);

      expect(errors1).toHaveLength(0);
      expect(errors2).toHaveLength(0);
    });

    it('should fail validation for invalid rating values', async () => {
      const dto = plainToClass(RateSmokeDto, { value: 2 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ReportSmokeDto', () => {
    it('should validate a valid reason', async () => {
      const dto = plainToClass(ReportSmokeDto, {
        reason: 'This smoke is inappropriate because it contains offensive content.',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for short reason', async () => {
      const dto = plainToClass(ReportSmokeDto, { reason: 'Too short' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation for long reason', async () => {
      const dto = plainToClass(ReportSmokeDto, {
        reason: 'A'.repeat(501), // 501 characters, exceeds limit
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});