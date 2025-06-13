const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Get portfolio items for a provider
router.get('/provider/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, limit = 20, offset = 0 } = req.query;
    
    let whereClause = { providerId: id };
    if (category) {
      whereClause.category = category;
    }
    
    const portfolioItems = await prisma.portfolioItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    const total = await prisma.portfolioItem.count({ where: whereClause });
    
    res.json({
      success: true,
      data: portfolioItems,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti portfolio'
    });
  }
});

// Add portfolio item (providers only)
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Pavadinimas turi būti 3-100 simbolių'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('imageUrl').isURL().withMessage('Neteisingas nuotraukos URL'),
  body('category').optional().trim(),
  body('completedAt').optional().isISO8601().toDate()
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
    const { title, description, imageUrl, category, completedAt } = req.body;
    
    // Check if user is a provider
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    if (!user || user.role !== 'PROVIDER') {
      return res.status(403).json({
        success: false,
        error: 'Tik paslaugos teikėjai gali pridėti portfolio elementus'
      });
    }
    
    const portfolioItem = await prisma.portfolioItem.create({
      data: {
        title,
        description,
        imageUrl,
        category,
        completedAt: completedAt ? new Date(completedAt) : null,
        providerId: userId
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      data: portfolioItem,
      message: 'Portfolio elementas sėkmingai pridėtas'
    });
  } catch (error) {
    console.error('❌ Error adding portfolio item:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko pridėti portfolio elemento'
    });
  }
});

// Update portfolio item
router.put('/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 3, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('imageUrl').optional().isURL(),
  body('category').optional().trim()
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
    
    const { id } = req.params;
    const userId = req.user.userId;
    const { title, description, imageUrl, category } = req.body;
    
    // Check if portfolio item belongs to user
    const portfolioItem = await prisma.portfolioItem.findUnique({
      where: { id },
      select: { providerId: true }
    });
    
    if (!portfolioItem || portfolioItem.providerId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio elementas nerastas arba jūs neturite teisių jį redaguoti'
      });
    }
    
    const updatedItem = await prisma.portfolioItem.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(imageUrl && { imageUrl }),
        ...(category && { category })
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: updatedItem,
      message: 'Portfolio elementas sėkmingai atnaujintas'
    });
  } catch (error) {
    console.error('❌ Error updating portfolio item:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko atnaujinti portfolio elemento'
    });
  }
});

// Delete portfolio item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Check if portfolio item belongs to user
    const portfolioItem = await prisma.portfolioItem.findUnique({
      where: { id },
      select: { providerId: true }
    });
    
    if (!portfolioItem || portfolioItem.providerId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio elementas nerastas arba jūs neturite teisių jį ištrinti'
      });
    }
    
    await prisma.portfolioItem.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Portfolio elementas sėkmingai ištrintas'
    });
  } catch (error) {
    console.error('❌ Error deleting portfolio item:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko ištrinti portfolio elemento'
    });
  }
});

module.exports = router;

