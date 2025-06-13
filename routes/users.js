const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const authenticateToken = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Get user profile by ID (public info)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        city: true,
        description: true,
        website: true,
        avatar: true,
        verified: true,
        rating: true,
        totalJobs: true,
        wonAuctions: true,
        createdAt: true,
        portfolioItems: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, avatar: true }
            },
            project: {
              select: { id: true, title: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Vartotojas nerastas'
      });
    }
    
    // Calculate average rating
    const avgRating = await prisma.review.aggregate({
      where: { revieweeId: id },
      _avg: { rating: true },
      _count: { rating: true }
    });
    
    res.json({
      success: true,
      data: {
        ...user,
        averageRating: avgRating._avg.rating || 0,
        totalReviews: avgRating._count.rating || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti vartotojo profilio'
    });
  }
});

// Update user profile (protected)
router.put('/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().trim().isMobilePhone('any'),
  body('city').optional().trim().isLength({ min: 2, max: 50 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('website').optional().trim().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation errors',
        details: errors.array()
      });
    }
    
    const userId = req.user.userId;
    const { name, phone, city, description, website, avatar } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(city && { city }),
        ...(description && { description }),
        ...(website && { website }),
        ...(avatar && { avatar })
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        description: true,
        website: true,
        avatar: true,
        role: true
      }
    });
    
    res.json({
      success: true,
      data: updatedUser,
      message: 'Profilis sėkmingai atnaujintas'
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko atnaujinti profilio'
    });
  }
});

// Get provider statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true }
    });
    
    if (!user || user.role !== 'PROVIDER') {
      return res.status(404).json({
        success: false,
        error: 'Paslaugos teikėjas nerastas'
      });
    }
    
    const [totalProposals, wonProposals, avgRating, totalReviews] = await Promise.all([
      prisma.proposal.count({ where: { providerId: id } }),
      prisma.proposal.count({ where: { providerId: id, status: 'ACCEPTED' } }),
      prisma.review.aggregate({
        where: { revieweeId: id },
        _avg: { rating: true }
      }),
      prisma.review.count({ where: { revieweeId: id } })
    ]);
    
    res.json({
      success: true,
      data: {
        totalProposals,
        wonProposals,
        winRate: totalProposals > 0 ? ((wonProposals / totalProposals) * 100).toFixed(1) : 0,
        averageRating: avgRating._avg.rating || 0,
        totalReviews
      }
    });
  } catch (error) {
    console.error('❌ Error fetching provider stats:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti statistikos'
    });
  }
});

module.exports = router;

