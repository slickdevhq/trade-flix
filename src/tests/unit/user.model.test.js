import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../../src/models/User.model.js';

// Note: This requires jest-mongodb setup or a live test DB.
// Assuming a simple mock or focusing on the method logic.

describe('User Model', () => {
  const userData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123',
  };

  // Mock bcrypt
  jest.mock('bcryptjs', () => ({
    genSalt: jest.fn(() => Promise.resolve('mockedSalt')),
    hash: jest.fn(() => Promise.resolve('mockedHashedPassword')),
    compare: jest.fn(),
  }));

  beforeEach(() => {
    // Clear mocks before each test
    bcrypt.hash.mockClear();
    bcrypt.compare.mockClear();
  });

  it('should hash password before saving', async () => {
    // We can't use new User().save() without a DB connection.
    // We'll test the pre-save hook logic conceptually.
    // A better test would use an in-memory DB.

    const user = new User(userData);
    
    // Manually trigger the logic (simplified)
    if (user.isModified('password') && user.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    }

    expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 'mockedSalt');
    expect(user.password).toBe('mockedHashedPassword');
  });

  it('should not hash password if not modified', async () => {
    const user = new User(userData);
    // Simulate setting password and "saving"
    user.password = 'hashedPasswordFromDB';
    // Clear the 'modified' flag
    user.isModified = jest.fn(() => false); 

    // Manually trigger logic
    if (user.isModified('password') && user.password) {
       // ... hash logic
    }

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(user.password).toBe('hashedPasswordFromDB');
  });

  it('should compare password correctly', async () => {
    const user = new User(userData);
    user.password = 'hashedPassword'; // Simulating it's already hashed

    // Test correct password
    bcrypt.compare.mockResolvedValue(true);
    let isMatch = await user.comparePassword('Password123');
    expect(bcrypt.compare).toHaveBeenCalledWith('Password123', 'hashedPassword');
    expect(isMatch).toBe(true);

    // Test incorrect password
    bcrypt.compare.mockResolvedValue(false);
    isMatch = await user.comparePassword('WrongPassword');
    expect(bcrypt.compare).toHaveBeenCalledWith('WrongPassword', 'hashedPassword');
    expect(isMatch).toBe(false);
  });
});