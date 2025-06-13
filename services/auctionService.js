const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AuctionService {
  // Calculate auction timing when project is created
  static calculateAuctionTiming(waitingStartsAt = new Date()) {
    const auctionStartsAt = new Date(waitingStartsAt.getTime() + (72 * 60 * 60 * 1000)); // 72 hours later
    const auctionEndsAt = new Date(auctionStartsAt.getTime() + (24 * 60 * 60 * 1000)); // 24 hours after auction starts
    
    return {
      waitingStartsAt,
      auctionStartsAt,
      auctionEndsAt
    };
  }
  
  // Check and update auction phases
  static async updateAuctionPhases() {
    const now = new Date();
    
    try {
      // Update projects from WAITING to ACTIVE phase
      const waitingToActive = await prisma.project.updateMany({
        where: {
          phase: 'WAITING',
          auctionStartsAt: {
            lte: now
          }
        },
        data: {
          phase: 'ACTIVE',
          status: 'ACTIVE'
        }
      });
      
      // Update projects from ACTIVE to ENDED phase
      const activeToEnded = await prisma.project.updateMany({
        where: {
          phase: 'ACTIVE',
          auctionEndsAt: {
            lte: now
          }
        },
        data: {
          phase: 'ENDED'
        }
      });
      
      console.log(`🔄 Auction phase updates: ${waitingToActive.count} waiting→active, ${activeToEnded.count} active→ended`);
      
      return {
        waitingToActive: waitingToActive.count,
        activeToEnded: activeToEnded.count
      };
    } catch (error) {
      console.error('❌ Error updating auction phases:', error);
      throw error;
    }
  }
  
  // Get time remaining for auction
  static getTimeRemaining(project) {
    const now = new Date();
    let targetTime;
    let phase;
    
    if (project.phase === 'WAITING') {
      targetTime = new Date(project.auctionStartsAt);
      phase = 'waiting';
    } else if (project.phase === 'ACTIVE') {
      targetTime = new Date(project.auctionEndsAt);
      phase = 'auction';
    } else {
      return { phase: project.phase, timeRemaining: 0, isExpired: true };
    }
    
    const timeRemaining = Math.max(0, targetTime.getTime() - now.getTime());
    const isExpired = timeRemaining === 0;
    
    return {
      phase,
      timeRemaining,
      isExpired,
      targetTime,
      hours: Math.floor(timeRemaining / (1000 * 60 * 60)),
      minutes: Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((timeRemaining % (1000 * 60)) / 1000)
    };
  }
  
  // Check if bidding is allowed for a project
  static canSubmitBid(project) {
    const now = new Date();
    
    // Can only bid during ACTIVE phase
    if (project.phase !== 'ACTIVE') {
      return {
        allowed: false,
        reason: project.phase === 'WAITING' 
          ? 'Aukcionas dar neprasidėjo' 
          : 'Aukcionas jau pasibaigęs'
      };
    }
    
    // Check if auction time hasn't expired
    if (now > new Date(project.auctionEndsAt)) {
      return {
        allowed: false,
        reason: 'Aukcionas jau pasibaigęs'
      };
    }
    
    return { allowed: true };
  }
  
  // Get projects in specific auction phase
  static async getProjectsByPhase(phase, filters = {}) {
    const whereClause = {
      phase,
      ...filters
    };
    
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
                avatar: true,
                rating: true,
                wonAuctions: true
              }
            }
          },
          orderBy: {
            price: 'asc' // Show lowest price first
          }
        },
        _count: {
          select: {
            proposals: true
          }
        }
      },
      orderBy: {
        auctionEndsAt: 'asc' // Show ending soonest first
      }
    });
    
    // Add timing information to each project
    return projects.map(project => ({
      ...project,
      timing: this.getTimeRemaining(project),
      biddingAllowed: this.canSubmitBid(project)
    }));
  }
  
  // Start auction phase change monitoring
  static startAuctionMonitoring() {
    // Check for phase updates every minute
    setInterval(async () => {
      try {
        await this.updateAuctionPhases();
      } catch (error) {
        console.error('❌ Auction monitoring error:', error);
      }
    }, 60 * 1000); // Every minute
    
    console.log('🕰️ Auction monitoring started - checking every minute');
  }
}

module.exports = AuctionService;

