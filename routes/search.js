const express = require('express');
const SearchService = require('../services/searchService');
const authenticateToken = require('../middleware/authMiddleware');
const { validateSearchParams } = require('../middleware/validation');
const router = express.Router();

/**
 * @route GET /api/search/projects
 * @desc Search projects with advanced filters
 * @access Public
 * @queryParams {
 *   query: string - Search text
 *   category: string - Category filter
 *   location: string - Location filter
 *   budgetMin: number - Minimum budget
 *   budgetMax: number - Maximum budget
 *   priority: string - Priority level (LOW, MEDIUM, HIGH, URGENT)
 *   phase: string - Project phase (ACTIVE, COMPLETED, etc.)
 *   sortBy: string - Sort option (ending_soon, newest, budget_low, budget_high)
 *   limit: number - Results per page (default: 20, max: 50)
 *   offset: number - Pagination offset (default: 0)
 * }
 */
router.get('/projects', validateSearchParams, async (req, res) => {
  try {
    const {
      query = '',
      category,
      location,
      budgetMin,
      budgetMax,
      priority,
      phase = 'ACTIVE',
      sortBy = 'ending_soon',
      limit = 20,
      offset = 0
    } = req.query;

    // Validate limit to prevent abuse
    const validatedLimit = Math.min(parseInt(limit) || 20, 50);
    const validatedOffset = Math.max(parseInt(offset) || 0, 0);

    const searchParams = {
      query: query.trim(),
      category,
      location,
      budgetMin: budgetMin ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax ? parseFloat(budgetMax) : null,
      priority,
      phase,
      sortBy,
      limit: validatedLimit,
      offset: validatedOffset,
      userId: req.user?.id || null
    };

    const results = await SearchService.searchProjects(searchParams);

    res.json({
      success: true,
      data: results,
      meta: {
        searchParams: {
          query,
          category,
          location,
          budgetRange: budgetMin || budgetMax ? {
            min: budgetMin,
            max: budgetMax
          } : null,
          priority,
          phase,
          sortBy
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Search projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search projects',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/search/recommendations
 * @desc Get personalized project recommendations for providers
 * @access Private (Providers only)
 * @queryParams {
 *   limit: number - Number of recommendations (default: 10, max: 20)
 * }
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    // Only providers can get recommendations
    if (req.user.role !== 'PROVIDER') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only service providers can access recommendations'
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    
    const recommendations = await SearchService.getRecommendedProjects(
      req.user.id,
      limit
    );

    res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        message: recommendations.length === 0 
          ? 'No recommendations available. Complete more projects to get better recommendations.'
          : `Found ${recommendations.length} recommended projects for you`
      },
      meta: {
        userId: req.user.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/search/suggestions
 * @desc Get search suggestions based on query
 * @access Public
 * @queryParams {
 *   q: string - Search query for suggestions
 *   category: string - Optional category context
 * }
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query = '', category } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          categories: [],
          locations: [],
          keywords: []
        },
        message: 'Query too short for suggestions'
      });
    }

    const suggestions = await SearchService.getSearchSuggestions(
      query.trim(),
      category
    );

    res.json({
      success: true,
      data: suggestions,
      meta: {
        query: query.trim(),
        category,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/search/trending
 * @desc Get trending projects and popular search terms
 * @access Public
 */
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);

    // Get trending projects (most bids in last 24 hours)
    const trending = await SearchService.searchProjects({
      query: '',
      phase: 'ACTIVE',
      sortBy: 'newest',
      limit
    });

    // Filter to projects with multiple proposals (trending)
    const trendingProjects = trending.projects
      .filter(project => project.statistics.totalBids >= 2)
      .slice(0, limit);

    res.json({
      success: true,
      data: {
        trending: trendingProjects,
        count: trendingProjects.length,
        popularCategories: [
          'electrical',
          'plumbing',
          'construction',
          'renovation',
          'painting'
        ], // In practice, calculate from recent project data
        searchTips: [
          'Use specific keywords like "vonios remontas" for better results',
          'Filter by your location to find nearby projects',
          'Sort by "ending soon" to find urgent opportunities',
          'Check budget range to match your pricing'
        ]
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending data',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/search/stats
 * @desc Get search and marketplace statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const [activeProjects, totalProviders, avgResponseTime, totalCompleted] = await Promise.all([
      prisma.project.count({ where: { phase: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'PROVIDER' } }),
      prisma.proposal.aggregate({
        _avg: {
          createdAt: true
        },
        where: {
          status: 'ACCEPTED',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.project.count({ where: { phase: 'COMPLETED' } })
    ]);

    res.json({
      success: true,
      data: {
        marketplace: {
          activeProjects,
          totalProviders,
          completedProjects: totalCompleted,
          avgResponseTime: '< 2 hours' // Simplified for now
        },
        categories: {
          mostPopular: 'construction',
          fastest: 'electrical',
          highest_budget: 'renovation'
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

