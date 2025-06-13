const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const authenticateToken = require('../middleware/authMiddleware');
const AuctionService = require('../services/auctionService');

// Create new project (auction)
router.post('/', authenticateToken, async (req, res) => {
  const { 
    title, 
    description, 
    category, 
    budgetRange, 
    budgetMin, 
    budgetMax,
    deadline, 
    startDate,
    location,
    city,
    priority 
  } = req.body;

  // Input validation
  if (!title || !description || !category || !budgetRange || !deadline || !priority) {
    return res.status(400).json({ 
      success: false,
      error: 'Visi laukai yra privalomi' 
    });
  }

  // Validate deadline is in the future
  const deadlineDate = new Date(deadline);
  if (deadlineDate <= new Date()) {
    return res.status(400).json({ 
      success: false,
      error: 'Terminas turi būti ateityje' 
    });
  }
  
  // Validate start date if provided
  let projectStartDate = null;
  if (startDate) {
    projectStartDate = new Date(startDate);
    if (projectStartDate <= new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'Pradžios data turi būti ateityje' 
      });
    }
  }

  const userId = req.user?.userId || req.user?.id;

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Prisijungusio vartotojo ID nerastas. Patikrink tokeną.' 
    });
  }
  
  // Check if user is a client
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  
  if (!user || user.role !== 'CLIENT') {
    return res.status(403).json({
      success: false,
      error: 'Tik klientai gali kurti projektus'
    });
  }

  try {
    // Validate category
    const { validateSubcategory } = require('../constants/categories');
    if (!validateSubcategory(category)) {
      return res.status(400).json({
        success: false,
        error: 'Neteisinga kategorija'
      });
    }

    // Calculate auction timing
    const timing = AuctionService.calculateAuctionTiming();
    
    const project = await prisma.project.create({
      data: {
        title,
        description,
        category,
        budgetRange,
        budgetMin: budgetMin ? parseInt(budgetMin) : null,
        budgetMax: budgetMax ? parseInt(budgetMax) : null,
        deadline: deadlineDate,
        startDate: projectStartDate,
        location,
        city,
        priority,
        // Auction timing
        waitingStartsAt: timing.waitingStartsAt,
        auctionStartsAt: timing.auctionStartsAt,
        auctionEndsAt: timing.auctionEndsAt,
        clientId: userId
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            city: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: project,
      message: 'Projektas (aukcionas) sėkmingai sukurtas!'
    });
  } catch (error) {
    console.error('❌ Klaida kuriant projektą:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko sukurti projekto',
      details: error.message
    });
  }
});

// ✅ Gauti visus projektus su filtravimo galimybėmis
router.get('/', async (req, res) => {
  try {
    const { category, subcategory, priority, budgetRange, search } = req.query;
    
    let whereClause = {};
    
    // Filter by category or subcategory
    if (category) {
      const { validateCategory, validateSubcategory } = require('../constants/categories');
      if (validateCategory(category) || validateSubcategory(category)) {
        whereClause.category = category;
      }
    }
    
    if (subcategory) {
      const { validateSubcategory } = require('../constants/categories');
      if (validateSubcategory(subcategory)) {
        whereClause.category = subcategory;
      }
    }
    
    // Filter by priority
    if (priority && ['PRICE', 'SPEED', 'EXPERIENCE'].includes(priority)) {
      whereClause.priority = priority;
    }
    
    // Filter by budget range
    if (budgetRange) {
      whereClause.budgetRange = {
        contains: budgetRange,
        mode: 'insensitive'
      };
    }
    
    // Search in title and description
    if (search) {
      whereClause.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }
    
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        proposals: true,
        client: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Add category information to each project
    const { getCategoryBySubcategory, getSubcategoryById } = require('../constants/categories');
    const enrichedProjects = projects.map(project => {
      const subcategory = getSubcategoryById(project.category);
      const parentCategory = getCategoryBySubcategory(project.category);
      
      return {
        ...project,
        categoryInfo: {
          subcategory,
          parentCategory: parentCategory ? {
            id: parentCategory.id,
            name: parentCategory.name
          } : null
        }
      };
    });
    
    res.json({
      success: true,
      data: enrichedProjects,
      count: enrichedProjects.length,
      filters: {
        category: category || null,
        subcategory: subcategory || null,
        priority: priority || null,
        budgetRange: budgetRange || null,
        search: search || null
      }
    });
  } catch (error) {
    console.error('❌ Klaida gaunant projektus:', error);
    res.status(500).json({ error: 'Nepavyko gauti projektų', details: error.message });
  }
});

// ✅ Gauti vieną projektą su pasiūlymais
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        proposals: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        client: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Projektas nerastas' });
    }

    res.json(project);
  } catch (error) {
    console.error('❌ Klaida gaunant projektą:', error);
    res.status(500).json({ error: 'Nepavyko gauti projekto', details: error.message });
  }
});

// Get project with detailed auction information
router.get('/:id/auction', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            avatar: true,
            city: true,
            verified: true,
            rating: true
          }
        },
        proposals: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                avatar: true,
                rating: true,
                wonAuctions: true,
                totalJobs: true,
                city: true,
                verified: true
              }
            }
          },
          orderBy: {
            price: 'asc'
          }
        },
        _count: {
          select: {
            proposals: true
          }
        }
      }
    });
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Projektas nerastas'
      });
    }
    
    // Add timing and bidding information
    const timing = AuctionService.getTimeRemaining(project);
    const biddingAllowed = AuctionService.canSubmitBid(project);
    
    // Add category information
    const { getCategoryBySubcategory, getSubcategoryById } = require('../constants/categories');
    const subcategory = getSubcategoryById(project.category);
    const parentCategory = getCategoryBySubcategory(project.category);
    
    res.json({
      success: true,
      data: {
        ...project,
        timing,
        biddingAllowed,
        categoryInfo: {
          subcategory,
          parentCategory: parentCategory ? {
            id: parentCategory.id,
            name: parentCategory.name
          } : null
        },
        statistics: {
          totalBids: project._count.proposals,
          lowestBid: project.proposals.length > 0 ? project.proposals[0].price : null,
          averageBid: project.proposals.length > 0 
            ? Math.round(project.proposals.reduce((sum, p) => sum + p.price, 0) / project.proposals.length)
            : null
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching auction details:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti aukcionų duomenų'
    });
  }
});

// Get projects by auction phase
router.get('/phase/:phase', async (req, res) => {
  try {
    const { phase } = req.params;
    const { category, limit = 20, offset = 0 } = req.query;
    
    // Validate phase
    const validPhases = ['WAITING', 'ACTIVE', 'ENDED', 'AWARDED'];
    if (!validPhases.includes(phase)) {
      return res.status(400).json({
        success: false,
        error: 'Neteisinga aukcionų faze'
      });
    }
    
    let filters = {};
    if (category) {
      const { validateSubcategory } = require('../constants/categories');
      if (validateSubcategory(category)) {
        filters.category = category;
      }
    }
    
    const projects = await AuctionService.getProjectsByPhase(phase, filters);
    
    // Apply pagination
    const paginatedProjects = projects.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    // Add category information
    const { getCategoryBySubcategory, getSubcategoryById } = require('../constants/categories');
    const enrichedProjects = paginatedProjects.map(project => {
      const subcategory = getSubcategoryById(project.category);
      const parentCategory = getCategoryBySubcategory(project.category);
      
      return {
        ...project,
        categoryInfo: {
          subcategory,
          parentCategory: parentCategory ? {
            id: parentCategory.id,
            name: parentCategory.name
          } : null
        }
      };
    });
    
    res.json({
      success: true,
      data: enrichedProjects,
      pagination: {
        total: projects.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: projects.length > parseInt(offset) + parseInt(limit)
      },
      phase,
      filters
    });
  } catch (error) {
    console.error('❌ Error fetching projects by phase:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti projektų pagal fazę'
    });
  }
});

module.exports = router;
