import jwt from 'jsonwebtoken';
import { tokenService } from '../../src/services/token.service.js';

// Mock environment variables
process.env.JWT_ACCESS_SECRET = 'access_secret';
process.env.JWT_ACCESS_EXPIRATION = '15m';
process.env.JWT_VERIFY_EMAIL_SECRET = 'email_secret';
process.env.JWT_VERIFY_EMAIL_EXPIRATION = '1d';

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('Token Service', () => {
  const user = { _id: '12345', email: 'test@test.com' };
  const mockToken = 'mocked.jwt.token';

  beforeEach(() => {
    // Reset mocks before each test
    jwt.sign.mockClear();
    jwt.verify.mockClear();
  });

  it('should generate an access token', () => {
    jwt.sign.mockReturnValue(mockToken);
    
    const token = tokenService.generateAccessToken(user);

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: user._id, email: user.email },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRATION }
    );
    expect(token).toBe(mockToken);
  });

  it('should generate an email verification token', () => {
    jwt.sign.mockReturnValue(mockToken);

    const token = tokenService.generateVerificationToken(user);

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: user._id },
      process.env.JWT_VERIFY_EMAIL_SECRET,
      { expiresIn: process.env.JWT_VERIFY_EMAIL_EXPIRATION }
    );
    expect(token).toBe(mockToken);
  });

  it('should verify an access token', () => {
    const payload = { sub: user._id };
    jwt.verify.mockReturnValue(payload);

    const result = tokenService.verifyAccessToken(mockToken);

    expect(jwt.verify).toHaveBeenCalledWith(
      mockToken,
      process.env.JWT_ACCESS_SECRET
    );
    expect(result).toEqual(payload);
  });

  it('should return null for an invalid access token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const result = tokenService.verifyAccessToken('invalid_token');

    expect(result).toBeNull();
  });
});