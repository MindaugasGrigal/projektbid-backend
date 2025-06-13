const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/authMiddleware');
const { validateRegistration, handleValidationErrors } = require('../middleware/validation');
const passport = require('../config/passport');

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'labai_slaptas_raktas';

// Helper function to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 🟢 Registracija
router.post('/register', async (req, res) => {
  const { email, name, password, role } = req.body;

  if (!email || !password || !role || !name) {
    return res.status(400).json({ error: 'Visi laukai privalomi' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Vartotojas jau egzistuoja' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        password: hashedPassword,
      }
    });

    res.json({
      message: 'Registracija sėkminga',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Klaida registruojant vartotoją:', error);
    res.status(500).json({
      error: 'Nepavyko užregistruoti vartotojo',
      details: error.message
    });
  }
});

// 🟢 Prisijungimas
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El. paštas ir slaptažodis yra privalomi' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Neteisingi duomenys' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Neteisingi duomenys' });
    }

    // ✅ Į JWT įrašome userId (NE tik id!)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Klaida prisijungiant:', error);
    res.status(500).json({
      error: 'Nepavyko prisijungti',
      details: error.message
    });
  }
});

// 🟢 Prisijungusio vartotojo duomenys
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }, // naudok userId kaip login metu
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Nepavyko gauti naudotojo' });
  }
});

// 🟢 Enhanced Registration with validation
router.post('/register/enhanced', validateRegistration, handleValidationErrors, async (req, res) => {
  const { email, name, password, role, phone, city } = req.body;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User already exists',
        message: 'Vartotojas su šiuo el. paštu jau egzistuoja' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with enhanced fields
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        password: hashedPassword,
        phone: phone || null,
        city: city || null,
        provider: 'local',
        isEmailVerified: false // Email verification can be added later
      }
    });

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registracija sėkminga! Sveiki atvykę į ProjektBid!',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          city: user.city,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  } catch (error) {
    console.error('❌ Enhanced registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: 'Nepavyko užregistruoti vartotojo. Bandykite dar kartą.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🟢 Google OAuth Routes (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Initiate Google OAuth
  router.get('/google', 
    passport.authenticate('google', { 
      scope: ['profile', 'email'] 
    })
  );
  
  // Google OAuth callback
  router.get('/google/callback',
    passport.authenticate('google', { session: false }),
    async (req, res) => {
      try {
        // Generate JWT token for the authenticated user
        const token = generateToken(req.user);
        
        // Redirect to frontend with token (you can customize this URL)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/success?token=${token}&user=${encodeURIComponent(JSON.stringify({
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          avatar: req.user.avatar
        }))}`);
      } catch (error) {
        console.error('❌ Google OAuth callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/error?message=authentication_failed`);
      }
    }
  );
} else {
  // Provide error endpoint when Google OAuth is not configured
  router.get('/google', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Google OAuth not configured',
      message: 'Google OAuth is not available. Please use regular registration/login or contact administrator.'
    });
  });
}

// 🟢 Role update endpoint (for users who sign up with Google)
router.patch('/update-role', authenticateToken, async (req, res) => {
  const { role } = req.body;
  
  if (!role || !['CLIENT', 'PROVIDER'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role',
      message: 'Rolė turi būti CLIENT arba PROVIDER'
    });
  }
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        provider: true
      }
    });
    
    res.json({
      success: true,
      message: 'Rolė sėkmingai atnaujinta',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('❌ Role update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update role',
      message: 'Nepavyko atnaujinti rolės'
    });
  }
});

// 🟢 Check authentication status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        provider: true,
        isEmailVerified: true,
        verified: true,
        city: true,
        phone: true,
        createdAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Vartotojas nerastas'
      });
    }
    
    res.json({
      success: true,
      data: { user },
      authenticated: true
    });
  } catch (error) {
    console.error('❌ Auth status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auth status',
      authenticated: false
    });
  }
});

module.exports = router;
