const { PrismaClient } = require('@prisma/client');
const { getCategoryBySubcategory, getAllSubcategories } = require('../constants/categories');
const AuctionService = require('./auctionService');

const prisma = new PrismaClient();

class SearchService {
  // Smart project search with AI-like recommendations
  static async searchProjects({
    query = '',
    category = null,
    location = null,
    budgetMin = null,
    budgetMax = null,
    priority = null,
    phase = 'ACTIVE',
    sortBy = 'ending_soon', // ending_soon, newest, budget_low, budget_high
    limit = 20,
    offset = 0,
    userId = null
  }) {
    let whereClause = {
      phase: phase || 'ACTIVE'
    };
    
    // Text search in title and description
    if (query) {
      whereClause.OR = [
        {
          title: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }
    
    // Category filter
    if (category) {
      whereClause.category = category;
    }
    
    // Location filter
    if (location) {
      whereClause.OR = [
        ...(whereClause.OR || []),
        {
          city: {
            contains: location,
            mode: 'insensitive'
          }
        },
        {
          location: {
            contains: location,
            mode: 'insensitive'
          }
        }
      ];
    }
    
    // Budget filter
    if (budgetMin !== null || budgetMax !== null) {
      if (budgetMin !== null) {
        whereClause.budgetMin = { gte: parseInt(budgetMin) };
      }
      if (budgetMax !== null) {
        whereClause.budgetMax = { lte: parseInt(budgetMax) };
      }
    }
    
    // Priority filter
    if (priority) {
      whereClause.priority = priority;
    }
    
    // Sort options
    let orderBy = [];
    switch (sortBy) {
      case 'ending_soon':
        orderBy = [{ auctionEndsAt: 'asc' }];
        break;
      case 'newest':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'budget_low':
        orderBy = [{ budgetMin: 'asc' }];
        break;
      case 'budget_high':
        orderBy = [{ budgetMax: 'desc' }];
        break;
      default:
        orderBy = [{ auctionEndsAt: 'asc' }];
    }
    
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            avatar: true,
            city: true,
            verified: true
          }
        },
        proposals: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                rating: true
              }
            }
          }
        },
        _count: {
          select: {
            proposals: true
          }
        }
      },
      orderBy,
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    const total = await prisma.project.count({ where: whereClause });
    
    // Add timing and category info
    const enrichedProjects = projects.map(project => {
      const timing = AuctionService.getTimeRemaining(project);
      const subcategory = getAllSubcategories().find(sub => sub.id === project.category);
      const parentCategory = getCategoryBySubcategory(project.category);
      
      return {
        ...project,
        timing,
        categoryInfo: {
          subcategory,
          parentCategory: parentCategory ? {
            id: parentCategory.id,
            name: parentCategory.name
          } : null
        },
        statistics: {
          totalBids: project._count.proposals,
          lowestBid: project.proposals.length > 0 
            ? Math.min(...project.proposals.map(p => p.price))
            : null,
          averageBid: project.proposals.length > 0
            ? Math.round(project.proposals.reduce((sum, p) => sum + p.price, 0) / project.proposals.length)
            : null
        }
      };
    });
    
    return {
      projects: enrichedProjects,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      },
      suggestions: await this.getSearchSuggestions(query, category)
    };
  }
  
  // Get search suggestions based on query
  static async getSearchSuggestions(query, category) {
    const suggestions = {
      categories: [],
      locations: [],
      keywords: []
    };
    
    if (query && query.length > 2) {
      // Find matching categories
      const allSubcategories = getAllSubcategories();
      suggestions.categories = allSubcategories
        .filter(sub => sub.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
      
      // Find popular locations
      const locations = await prisma.project.groupBy({
        by: ['city'],
        where: {
          city: {
            contains: query,
            mode: 'insensitive'
          },
          NOT: {
            city: null
          }
        },
        _count: true,
        orderBy: {
          _count: {
            city: 'desc'
          }
        },
        take: 5
      });
      
      suggestions.locations = locations.map(l => l.city);
      
      // Popular search terms (you'd track these in practice)
      suggestions.keywords = [
        'elektros darbai',
        'vonios remontas',
        'stogo dengimas',
        'plytelių klojimas',
        'dažymo darbai'
      ].filter(keyword => keyword.toLowerCase().includes(query.toLowerCase()));
    }
    
    return suggestions;
  }
  
  // Get personalized recommendations for providers
  static async getRecommendedProjects(providerId, limit = 10) {
    // Get provider's past categories and successful proposals
    const pastProposals = await prisma.proposal.findMany({
      where: {
        providerId,
        status: 'ACCEPTED'
      },
      include: {
        project: {
          select: {
            category: true,
            budgetMin: true,
            budgetMax: true,
            city: true
          }
        }
      },
      take: 20,
      orderBy: { createdAt: 'desc' }
    });
    
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { city: true }
    });
    
    // Extract preferences
    const preferredCategories = [...new Set(pastProposals.map(p => p.project.category))];
    const preferredBudgetRange = pastProposals.length > 0 ? {
      min: Math.min(...pastProposals.map(p => p.project.budgetMin || 0)),
      max: Math.max(...pastProposals.map(p => p.project.budgetMax || 100000))
    } : null;
    
    let whereClause = {
      phase: 'ACTIVE',
      // Exclude projects they've already bid on
      NOT: {
        proposals: {
          some: {
            providerId
          }
        }
      }
    };
    
    // Prioritize preferred categories
    if (preferredCategories.length > 0) {
      whereClause.category = {
        in: preferredCategories
      };
    }
    
    const recommendations = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            avatar: true,
            verified: true
          }
        },
        _count: {
          select: {
            proposals: true
          }
        }
      },
      orderBy: [
        // Prefer projects ending soon
        { auctionEndsAt: 'asc' },
        // Prefer projects with fewer bids (less competition)
        { createdAt: 'desc' }
      ],
      take: parseInt(limit)
    });
    
    return recommendations.map(project => {
      const timing = AuctionService.getTimeRemaining(project);
      return {
        ...project,
        timing,
        recommendationReason: this.getRecommendationReason(project, {
          preferredCategories,
          providerCity: provider?.city,
          preferredBudgetRange
        })
      };
    });
  }
  
  // Get recommendation reason
  static getRecommendationReason(project, preferences) {
    const reasons = [];
    
    if (preferences.preferredCategories.includes(project.category)) {
      reasons.push('Jūsų specializacijos sritis');
    }
    
    if (preferences.providerCity && project.city === preferences.providerCity) {
      reasons.push('Jūsų mieste');
    }
    
    if (project._count.proposals < 3) {
      reasons.push('Mažai konkurencijos');
    }
    
    const timeLeft = new Date(project.auctionEndsAt) - new Date();
    if (timeLeft < 24 * 60 * 60 * 1000) { // Less than 24 hours
      reasons.push('Baigiasi greitai');
    }
    
    return reasons.length > 0 ? reasons[0] : 'Rekomenduojama';
  }
}

module.exports = SearchService;

