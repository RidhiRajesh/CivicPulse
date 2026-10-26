const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Retrieve the active JWT secret.
 * Enforces strict presence in production and disallows hardcoded fallbacks.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing or empty. A secure JWT_SECRET is required in production.');
    }
    throw new Error('JWT_SECRET environment variable is missing or empty. Please configure JWT_SECRET.');
  }
  return secret;
};

// Fail fast in production if JWT_SECRET is not configured
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim())) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing or empty. A secure JWT_SECRET is required in production.');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Hash plain text password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare plain text password with hashed password
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate JWT token for an authenticated user
 */
const generateToken = (user) => {
  const secret = getJwtSecret();
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  const secret = getJwtSecret();
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

/**
 * Helper to omit sensitive password field from user object
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  sanitizeUser,
  getJwtSecret,
};
