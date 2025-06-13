const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class NotificationService {
  // Create notification
  static async createNotification({ userId, type, title, message, data = null }) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          data
        }
      });
      
      // In production, you'd send push notifications here
      console.log(`📱 Notification sent to user ${userId}: ${title}`);
      
      return notification;
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
    }
  }
  
  // Notify when auction starts
  static async notifyAuctionStart(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        proposals: {
          include: { provider: true }
        }
      }
    });
    
    if (!project) return;
    
    // Notify client
    await this.createNotification({
      userId: project.clientId,
      type: 'PROJECT_PHASE_CHANGE',
      title: '🔥 Aukcionas prasidėjo!',
      message: `Aukcionas projektui "${project.title}" prasidėjo. Laukite pasiūlymų!`,
      data: { projectId, phase: 'ACTIVE' }
    });
    
    // Find matching providers based on category
    const providers = await prisma.user.findMany({
      where: {
        role: 'PROVIDER',
        // In future: add specialization matching
      }
    });
    
    // Notify relevant providers
    for (const provider of providers) {
      await this.createNotification({
        userId: provider.id,
        type: 'NEW_PROJECT',
        title: '💼 Naujas aukcionas!',
        message: `Naujas projektas jūsų srityje: "${project.title}"`,
        data: { projectId, category: project.category }
      });
    }
  }
  
  // Notify when proposal is submitted
  static async notifyNewProposal(proposalId) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        project: {
          include: { client: true }
        },
        provider: true
      }
    });
    
    if (!proposal) return;
    
    await this.createNotification({
      userId: proposal.project.clientId,
      type: 'NEW_PROPOSAL',
      title: '💰 Naujas pasiūlymas!',
      message: `${proposal.provider.name} pateikė pasiūlymą projektui "${proposal.project.title}"`,
      data: {
        projectId: proposal.projectId,
        proposalId: proposal.id,
        price: proposal.price
      }
    });
  }
  
  // Notify when proposal is accepted
  static async notifyProposalAccepted(proposalId) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        project: {
          include: { client: true }
        },
        provider: true
      }
    });
    
    if (!proposal) return;
    
    await this.createNotification({
      userId: proposal.providerId,
      type: 'PROPOSAL_ACCEPTED',
      title: '🎉 Pasiūlymas priimtas!',
      message: `Jūsų pasiūlymas projektui "${proposal.project.title}" buvo priimtas!`,
      data: {
        projectId: proposal.projectId,
        proposalId: proposal.id
      }
    });
  }
  
  // Notify auction ending soon (1 hour before)
  static async notifyAuctionEndingSoon() {
    const endingSoon = await prisma.project.findMany({
      where: {
        phase: 'ACTIVE',
        auctionEndsAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 60 * 60 * 1000) // Next hour
        }
      },
      include: {
        client: true,
        proposals: {
          include: { provider: true }
        }
      }
    });
    
    for (const project of endingSoon) {
      // Notify client
      await this.createNotification({
        userId: project.clientId,
        type: 'AUCTION_ENDING',
        title: '⏰ Aukcionas baigiasi!',
        message: `Aukcionas projektui "${project.title}" baigiasi per valandą. Turite ${project.proposals.length} pasiūlymų.`,
        data: { projectId: project.id }
      });
      
      // Notify providers who haven't bid yet
      const biddingProviders = project.proposals.map(p => p.providerId);
      const potentialProviders = await prisma.user.findMany({
        where: {
          role: 'PROVIDER',
          id: { notIn: biddingProviders }
        }
      });
      
      for (const provider of potentialProviders) {
        await this.createNotification({
          userId: provider.id,
          type: 'AUCTION_ENDING',
          title: '⏰ Paskutinė galimybė!',
          message: `Aukcionas projektui "${project.title}" baigiasi per valandą. Pateikite pasiūlymą!`,
          data: { projectId: project.id }
        });
      }
    }
  }
  
  // Get notifications for user
  static async getUserNotifications(userId, limit = 20, offset = 0) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    const total = await prisma.notification.count({ where: { userId } });
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });
    
    return {
      notifications,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      },
      unreadCount
    };
  }
  
  // Mark notifications as read
  static async markAsRead(userId, notificationIds = null) {
    const whereClause = { userId };
    if (notificationIds) {
      whereClause.id = { in: notificationIds };
    }
    
    const result = await prisma.notification.updateMany({
      where: whereClause,
      data: { isRead: true }
    });
    
    return result.count;
  }
}

module.exports = NotificationService;

