const prisma = require('../config/prisma');
const { hashPassword, comparePassword, generateToken, sanitizeUser } = require('../utils/auth');

/**
 * Regular expression for basic email validation
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valid user roles defined in Prisma schema
 */
const VALID_ROLES = ['CITIZEN', 'AUTHORITY', 'FIELD_WORKER'];

/**
 * POST /api/auth/register
 * Register a new user (Public registration strictly restricted to CITIZEN)
 */
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // 1. Input Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required.',
      });
    }

    if (!email || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check for Duplicate Email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // 3. Hash Password
    const hashedPassword = await hashPassword(password);

    // 4. Create User in PostgreSQL via Prisma (Public registration strictly creates CITIZEN role)
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CITIZEN',
        phone: phone ? phone.trim() : null,
        department: null,
      },
    });

    // 5. Generate Token and Safe User Response
    const safeUser = sanitizeUser(newUser);
    const token = generateToken(safeUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Registration Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete registration due to a server error.',
    });
  }
};

/**
 * POST /api/auth/login
 * Authenticate existing user credentials
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Input Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Find User by Email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Verify Password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Generate Token and Return Response
    const safeUser = sanitizeUser(user);
    const token = generateToken(safeUser);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Login Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process login due to a server error.',
    });
  }
};

/**
 * GET /api/auth/me
 * Fetch authenticated user's profile
 */
const getMe = async (req, res) => {
  try {
    // req.user is set by authenticateToken middleware
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('getMe Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile information.',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
