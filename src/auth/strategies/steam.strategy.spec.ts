import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { SteamStrategy } from './steam.strategy';

describe('SteamStrategy', () => {
  let strategy: SteamStrategy;
  let authService: AuthService;
  let configService: ConfigService;

  const mockAuthService = {
    validateSteamUser: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SteamStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<SteamStrategy>(SteamStrategy);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate Steam user successfully', async () => {
      const mockProfile = {
        id: '76561198000000000',
        displayName: 'TestUser',
      };

      const mockUser = {
        id: 1,
        steamId: '76561198000000000',
        username: 'TestUser',
      };

      const mockDone = jest.fn();
      mockAuthService.validateSteamUser.mockResolvedValue(mockUser);

      await strategy.validate('identifier', mockProfile, mockDone);

      expect(mockAuthService.validateSteamUser).toHaveBeenCalledWith(mockProfile);
      expect(mockDone).toHaveBeenCalledWith(null, mockUser);
    });

    it('should handle validation error', async () => {
      const mockProfile = {
        id: '76561198000000000',
        displayName: 'TestUser',
      };

      const mockError = new Error('Validation failed');
      const mockDone = jest.fn();
      mockAuthService.validateSteamUser.mockRejectedValue(mockError);

      await strategy.validate('identifier', mockProfile, mockDone);

      expect(mockAuthService.validateSteamUser).toHaveBeenCalledWith(mockProfile);
      expect(mockDone).toHaveBeenCalledWith(mockError, null);
    });
  });
});