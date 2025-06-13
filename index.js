const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const passport = require('./config/passport');

const projectRoutes = require('./routes/projects');
const proposalRoutes = require('./routes/proposals');
const authRoutes = require('./routes/auth'); // 👈 SVARBU!
const categoriesRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const portfolioRoutes = require('./routes/portfolio');
const messagesRoutes = require('./routes/messages');
const searchRoutes = require('./routes/search');
const logger = require('./middleware/logger');
const AuctionService = require('./services/auctionService');

dotenv.config();

const app = express();
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Per dauž užklausų, bandykite vėliau',
    retryAfter: '15 minučių'
  }
});
app.use(limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // Higher limit for development
  message: {
    error: 'Per dauž bandymų prisijungti, bandykite vėliau',
    retryAfter: '15 minučių'
  }
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'projektbid_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(logger);
}

app.use('/projects', projectRoutes);
app.use('/proposals', proposalRoutes);
app.use('/auth', authLimiter, authRoutes); // 👈 SVARBU!
app.use('/categories', categoriesRoutes);
app.use('/users', usersRoutes);
app.use('/portfolio', portfolioRoutes);
app.use('/messages', messagesRoutes);
app.use('/search', searchRoutes);

// Serve static files for testing
app.use('/test', express.static('public'));

app.get('/', (req, res) => {
  res.json({
    message: 'ProjektBid API veikia!',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        me: 'GET /auth/me'
      },
      projects: {
        create: 'POST /projects',
        getAll: 'GET /projects',
        getOne: 'GET /projects/:id'
      },
      proposals: {
        create: 'POST /proposals'
      },
      categories: {
        getAll: 'GET /categories',
        getOne: 'GET /categories/:id',
        getAllSubcategories: 'GET /categories/subcategories/all',
        getSubcategory: 'GET /categories/subcategories/:id',
        search: 'GET /categories/search/:query'
      }
    }
  });
});

// Debug endpoint for demo credentials (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/demo-accounts', async (req, res) => {
    try {
      const demoUsers = await prisma.user.findMany({
        where: {
          email: {
            in: ['client@example.com', 'provider@example.com']
          }
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true
        }
      });
      
      res.json({
        message: 'Demo accounts info',
        accounts: [
          { email: 'client@example.com', password: 'client123', role: 'CLIENT' },
          { email: 'provider@example.com', password: 'provider123', role: 'PROVIDER' }
        ],
        database_users: demoUsers
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

const PORT = process.env.PORT || 4000;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📴 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📴 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`🚀 Serveris veikia ant http://localhost:${PORT}`);
  
  // Test database connection
  try {
    await prisma.$connect();
    console.log('💾 Database: Connected');
    
    // Start auction monitoring
    AuctionService.startAuctionMonitoring();
    
    // Initial phase update
    await AuctionService.updateAuctionPhases();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
});
