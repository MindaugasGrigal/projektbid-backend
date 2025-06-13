const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/authMiddleware');
const AuctionService = require('../services/auctionService');
const router = express.Router();
const prisma = new PrismaClient();

// Submit proposal to project (auction bid)
router.post('/', authenticateToken, async (req, res) => {
  const { projectId, price, duration, startDate, comment } = req.body;
  
  // Validation
  if (!projectId || !price || !duration) {
    return res.status(400).json({ 
      success: false,
      error: 'ProjectId, price ir duration yra privalomi laukai' 
    });
  }
  
  const userId = req.user?.userId || req.user?.id;  
  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Prisijungusio vartotojo ID nerastas' 
    });
  }

  try {
    // Check if project exists and get full auction info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        phase: true,
        auctionStartsAt: true,
        auctionEndsAt: true,
        clientId: true
      }
    });
    
    if (!project) {
      return res.status(404).json({ 
        success: false,
        error: 'Projektas nerastas' 
      });
    }
    
    // Check if bidding is allowed using auction service
    const biddingCheck = AuctionService.canSubmitBid(project);
    if (!biddingCheck.allowed) {
      return res.status(400).json({ 
        success: false,
        error: biddingCheck.reason
      });
    }
    
    // Check if user is trying to bid on their own project
    if (project.clientId === userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Negalite pateikti pasiūlymo savo pačių projektui' 
      });
    }
    
    // Check if user already submitted a proposal for this project
    const existingProposal = await prisma.proposal.findFirst({
      where: {
        projectId: projectId,
        providerId: userId
      }
    });
    
    if (existingProposal) {
      return res.status(400).json({ 
        success: false,
        error: 'Jūs jau pateikėte pasiūlymą šiam projektui. Galite jį redaguoti.' 
      });
    }
    
    // Validate start date
    let proposalStartDate = null;
    if (startDate) {
      proposalStartDate = new Date(startDate);
      if (proposalStartDate <= new Date()) {
        return res.status(400).json({ 
          success: false,
          error: 'Pradžios data turi būti ateityje' 
        });
      }
    }

    const proposal = await prisma.proposal.create({
      data: {
        price: parseInt(price),
        duration: parseInt(duration),
        startDate: proposalStartDate,
        comment: comment || '',
        projectId: projectId,
        providerId: userId
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            rating: true,
            wonAuctions: true,
            city: true
          }
        },
        project: {
          select: {
            id: true,
            title: true,
            category: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: proposal,
      message: 'Pasiūlymas sėkmingai pateiktas aukcionui'
    });
  } catch (error) {
    console.error('❌ Klaida kuriant pasiūlymą:', error);
    res.status(500).json({ 
      success: false,
      error: 'Nepavyko pateikti pasiūlymo',
      details: error.message
    });
  }
});

// Accept proposal (clients only)
router.put('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Get proposal with project info
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            clientId: true,
            status: true,
            title: true
          }
        },
        provider: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Pasiūlymas nerastas'
      });
    }
    
    // Check if user is the project owner
    if (proposal.project.clientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Tik projekto savininkas gali priimti pasiūlymus'
      });
    }
    
    // Check if project is still active
    if (proposal.project.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Projektas jau ne aktyvus'
      });
    }
    
    // Start transaction to update proposal and project
    const result = await prisma.$transaction(async (tx) => {
      // Accept the proposal
      const acceptedProposal = await tx.proposal.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          }
        }
      });
      
      // Reject all other proposals for this project
      await tx.proposal.updateMany({
        where: {
          projectId: proposal.project.id,
          id: { not: id }
        },
        data: { status: 'REJECTED' }
      });
      
      // Update project status and winner
      await tx.project.update({
        where: { id: proposal.project.id },
        data: {
          status: 'AWARDED',
          winnerId: proposal.providerId
        }
      });
      
      // Update provider statistics
      await tx.user.update({
        where: { id: proposal.providerId },
        data: {
          wonAuctions: { increment: 1 },
          totalJobs: { increment: 1 }
        }
      });
      
      return acceptedProposal;
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Pasiūlymas sėkmingai priimtas! Projektas priskirtas teikėjui.'
    });
  } catch (error) {
    console.error('❌ Error accepting proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko priimti pasiūlymo'
    });
  }
});

// Get proposals for a provider
router.get('/my-proposals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 20, offset = 0 } = req.query;
    
    let whereClause = { providerId: userId };
    if (status) {
      whereClause.status = status;
    }
    
    const proposals = await prisma.proposal.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            budgetRange: true,
            deadline: true,
            status: true,
            endsAt: true,
            client: {
              select: {
                id: true,
                name: true,
                avatar: true,
                city: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    const total = await prisma.proposal.count({ where: whereClause });
    
    res.json({
      success: true,
      data: proposals,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti pasiūlymų'
    });
  }
});

// Update proposal (providers only, before acceptance)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { price, duration, startDate, comment } = req.body;
    
    // Get existing proposal
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            endsAt: true,
            status: true
          }
        }
      }
    });
    
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Pasiūlymas nerastas'
      });
    }
    
    // Check if user owns the proposal
    if (proposal.providerId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Galite redaguoti tik savo pasiūlymus'
      });
    }
    
    // Check if proposal can still be edited
    if (proposal.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Negalite redaguoti jau priimto arba atmesto pasiūlymo'
      });
    }
    
    if (new Date() > new Date(proposal.project.endsAt)) {
      return res.status(400).json({
        success: false,
        error: 'Aukcionas jau pasibaigęs'
      });
    }
    
    // Validate start date if provided
    let proposalStartDate = proposal.startDate;
    if (startDate) {
      proposalStartDate = new Date(startDate);
      if (proposalStartDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Pradžios data turi būti ateityje'
        });
      }
    }
    
    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: {
        ...(price && { price: parseInt(price) }),
        ...(duration && { duration: parseInt(duration) }),
        ...(startDate && { startDate: proposalStartDate }),
        ...(comment !== undefined && { comment })
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            rating: true
          }
        },
        project: {
          select: {
            id: true,
            title: true,
            category: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: updatedProposal,
      message: 'Pasiūlymas sėkmingai atnaujintas'
    });
  } catch (error) {
    console.error('❌ Error updating proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko atnaujinti pasiūlymo'
    });
  }
});

// Withdraw proposal (providers only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            endsAt: true,
            status: true
          }
        }
      }
    });
    
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Pasiūlymas nerastas'
      });
    }
    
    if (proposal.providerId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Galite atšaukti tik savo pasiūlymus'
      });
    }
    
    if (proposal.status === 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: 'Negalite atšaukti jau priimto pasiūlymo'
      });
    }
    
    await prisma.proposal.update({
      where: { id },
      data: { status: 'WITHDRAWN' }
    });
    
    res.json({
      success: true,
      message: 'Pasiūlymas sėkmingai atšauktas'
    });
  } catch (error) {
    console.error('❌ Error withdrawing proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko atšaukti pasiūlymo'
    });
  }
});

module.exports = router;
