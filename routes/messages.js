const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Send message
router.post('/', authenticateToken, [
  body('receiverId').isUUID().withMessage('Neteisingas gavėjo ID'),
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Žinutė turi būti 1-1000 simbolių'),
  body('projectId').optional().isUUID().withMessage('Neteisingas projekto ID')
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
    
    const senderId = req.user.userId;
    const { receiverId, content, projectId } = req.body;
    
    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, name: true }
    });
    
    if (!receiver) {
      return res.status(404).json({
        success: false,
        error: 'Gavėjas nerastas'
      });
    }
    
    // Can't send message to yourself
    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        error: 'Negalite siųsti žinutės sau'
      });
    }
    
    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
        projectId: projectId || null
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        project: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      data: message,
      message: 'Žinutė sėkmingai išsiųsta'
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko išsiųsti žinutės'
    });
  }
});

// Get conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const conversations = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true }
        },
        receiver: {
          select: { id: true, name: true, avatar: true }
        },
        project: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    // Group by conversation partner
    const conversationMap = new Map();
    
    for (const message of conversations) {
      const otherUser = message.senderId === userId ? message.receiver : message.sender;
      const key = `${otherUser.id}-${message.projectId || 'general'}`;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          otherUser,
          project: message.project,
          lastMessage: message,
          unreadCount: 0
        });
      }
      
      // Count unread messages
      if (message.receiverId === userId && !message.isRead) {
        conversationMap.get(key).unreadCount++;
      }
    }
    
    res.json({
      success: true,
      data: Array.from(conversationMap.values())
    });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti pokalbių'
    });
  }
});

// Get messages between two users
router.get('/conversation/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;
    const { projectId, limit = 50, offset = 0 } = req.query;
    
    let whereClause = {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    };
    
    if (projectId) {
      whereClause.projectId = projectId;
    }
    
    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false
      },
      data: { isRead: true }
    });
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Nepavyko gauti žinučių'
    });
  }
});

module.exports = router;
