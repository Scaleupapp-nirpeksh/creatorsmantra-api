/**
 * CreatorsMantra Backend - Rate Card Service
 * Business logic for rate card management and AI pricing suggestions
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const RateCard = require('./model');
const User = require('../auth/model');
const { logInfo, logError, logWarning } = require('../../shared/utils');
const { AppError } = require('../../shared/errors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';


class RateCardService {
  /**
   * Create a new rate card with AI suggestions
   */
  async createRateCard(data, userId) {
    try {
      logInfo('Creating rate card', { userId });

      // Get user and subscription details
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check subscription limits
      await this.checkSubscriptionLimits(user);

      // Generate AI pricing suggestions if metrics provided
      let aiSuggestions = null;
      if (data.creatorMetrics) {
        aiSuggestions = await this.generateAIPricingSuggestions(data.creatorMetrics);
        
        // Apply AI suggestions to deliverables if not manually set
        if (data.deliverables && aiSuggestions) {
          data.deliverables = this.mergeAISuggestionsWithDeliverables(
            data.deliverables, 
            aiSuggestions
          );
        }
      }

      // Create rate card
      const rateCard = new RateCard({
        ...data,
        creator: userId,
        subscriptionTier: user.subscription.plan,
        aiSuggestions: aiSuggestions ? {
          generated: true,
          generatedAt: new Date(),
          suggestedRates: aiSuggestions.rates,
          marketComparison: aiSuggestions.comparison,
          acceptanceRate: this.calculateAcceptanceRate(data.deliverables, aiSuggestions)
        } : undefined
      });

      await rateCard.save();

      logInfo('Rate card created successfully', { 
        rateCardId: rateCard._id,
        hasAISuggestions: !!aiSuggestions 
      });

      return rateCard;
    } catch (error) {
      logError('Error creating rate card', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate AI pricing suggestions based on creator metrics
   */
  async generateAIPricingSuggestions(metrics) {
    try {
      logInfo('Generating AI pricing suggestions', { metrics });

      // Only use OpenAI if API key is configured
      if (!OPENAI_API_KEY) {
        logWarning('OpenAI API key not configured, using fallback pricing');
        return this.generateFallbackPricing(metrics);
      }

      // Prepare prompt for OpenAI
      const prompt = `You are an expert in Indian creator economy pricing. Based on the following creator metrics, suggest appropriate rates in INR:

Creator Metrics:
- Platform: ${metrics.platforms.map(p => `${p.name} (${p.followers} followers, ${p.engagementRate}% engagement)`).join(', ')}
- Niche: ${metrics.niche}
- Location: ${metrics.location?.city || 'India'}

Provide pricing suggestions for each platform's deliverables (Reel, Post, Story for Instagram; Video, Integration, Shorts for YouTube).

Return ONLY a valid JSON object in this exact format:
{
  "rates": [
    {
      "platform": "instagram",
      "deliverableType": "reel",
      "suggestedPrice": 25000,
      "marketRange": {"min": 20000, "max": 30000},
      "confidence": 85,
      "reasoning": "Based on follower count and engagement"
    }
  ],
  "comparison": {
    "percentile": 75,
    "similarCreators": 50,
    "averageMarketRate": 22000
  }
}`;

      // Call OpenAI API
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a pricing expert for Indian content creators. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Low temperature for consistent pricing
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      
      // Parse and validate the response
      try {
        const suggestions = JSON.parse(aiResponse);
        logInfo('AI pricing suggestions generated successfully');
        return suggestions;
      } catch (parseError) {
        logError('Failed to parse AI response', { error: parseError.message });
        return this.generateFallbackPricing(metrics);
      }

    } catch (error) {
      logError('OpenAI API error, using fallback', { error: error.message });
      return this.generateFallbackPricing(metrics);
    }
  }

  /**
   * Fallback pricing when AI is not available
   */
  generateFallbackPricing(metrics) {
    // Use the existing calculatePlatformRates logic as fallback
    return {
      rates: this.calculatePlatformRates(
        metrics.platforms[0],
        metrics.niche,
        metrics.location
      ),
      comparison: {
        percentile: 50,
        similarCreators: 100,
        averageMarketRate: 25000
      }
    };
  }
  
  /**
   * Calculate platform-specific rates using our pricing algorithm
   */
  async calculatePlatformRates(platform, niche, location) {
    const rates = [];
    
    // Get market data for this platform
    const marketData = this.getMarketData(platform.name, platform.followers);
    
    // Calculate niche multiplier
    const nicheMultiplier = this.getNicheMultiplier(niche);
    
    // Calculate engagement multiplier
    const engagementMultiplier = this.getEngagementMultiplier(platform.engagementRate);
    
    // Platform-specific deliverables
    const deliverables = this.getPlatformDeliverables(platform.name);
    
    for (const deliverable of deliverables) {
      const baseRate = this.calculateBaseRate(
        platform.followers,
        platform.name,
        deliverable.type
      );
      
      const suggestedPrice = Math.round(
        baseRate * nicheMultiplier * engagementMultiplier
      );
      
      rates.push({
        platform: platform.name,
        deliverableType: deliverable.type,
        suggestedPrice,
        marketRange: {
          min: Math.round(suggestedPrice * 0.8),
          max: Math.round(suggestedPrice * 1.2)
        },
        confidence: this.calculateConfidence(platform.followers, niche),
        dataSources: this.getDataSourceCount(platform.followers),
        reasoning: this.generatePricingReasoning(
          platform,
          deliverable.type,
          nicheMultiplier,
          engagementMultiplier
        )
      });
    }
    
    return rates;
  }

  /**
   * Calculate base rate based on followers and platform
   */
  calculateBaseRate(followers, platform, deliverableType) {
    // Base rates from our market research
    const rateMatrix = {
      instagram: {
        reel: {
          '0-10000': 5000,
          '10000-50000': 20000,
          '50000-100000': 40000,
          '100000-500000': 150000,
          '500000-1000000': 300000,
          '1000000+': 500000
        },
        post: {
          '0-10000': 3000,
          '10000-50000': 12000,
          '50000-100000': 25000,
          '100000-500000': 80000,
          '500000-1000000': 200000,
          '1000000+': 350000
        },
        story: {
          '0-10000': 2000,
          '10000-50000': 7000,
          '50000-100000': 15000,
          '100000-500000': 40000,
          '500000-1000000': 100000,
          '1000000+': 200000
        },
        story_series: {
          '0-10000': 6000,
          '10000-50000': 20000,
          '50000-100000': 40000,
          '100000-500000': 100000,
          '500000-1000000': 250000,
          '1000000+': 500000
        }
      },
      youtube: {
        dedicated_video: {
          '0-10000': 15000,
          '10000-50000': 50000,
          '50000-100000': 100000,
          '100000-500000': 300000,
          '500000-1000000': 700000,
          '1000000+': 1500000
        },
        integration: {
          '0-10000': 7000,
          '10000-50000': 25000,
          '50000-100000': 50000,
          '100000-500000': 150000,
          '500000-1000000': 350000,
          '1000000+': 750000
        },
        shorts: {
          '0-10000': 5000,
          '10000-50000': 15000,
          '50000-100000': 30000,
          '100000-500000': 75000,
          '500000-1000000': 150000,
          '1000000+': 300000
        }
      }
    };

    // Find the appropriate follower range
    const range = this.getFollowerRange(followers);
    
    // Return base rate for platform and deliverable type
    return rateMatrix[platform]?.[deliverableType]?.[range] || 10000;
  }

  /**
   * Get follower range for rate calculation
   */
  getFollowerRange(followers) {
    if (followers < 10000) return '0-10000';
    if (followers < 50000) return '10000-50000';
    if (followers < 100000) return '50000-100000';
    if (followers < 500000) return '100000-500000';
    if (followers < 1000000) return '500000-1000000';
    return '1000000+';
  }

  /**
   * Get niche multiplier based on industry
   */
  getNicheMultiplier(niche) {
    const multipliers = {
      'tech': 1.5,
      'finance': 1.5,
      'business': 1.4,
      'fashion': 1.3,
      'beauty': 1.3,
      'lifestyle': 1.2,
      'fitness': 1.2,
      'food': 1.1,
      'travel': 1.1,
      'health': 1.1,
      'education': 1.0,
      'gaming': 1.0,
      'entertainment': 0.9,
      'general': 1.0
    };
    
    return multipliers[niche] || 1.0;
  }

  /**
   * Get engagement rate multiplier
   */
  getEngagementMultiplier(engagementRate) {
    if (!engagementRate) return 1.0;
    
    if (engagementRate > 7) return 1.5;  // Exceptional engagement
    if (engagementRate > 5) return 1.3;  // High engagement
    if (engagementRate > 3) return 1.15; // Good engagement
    if (engagementRate > 1) return 1.0;  // Average engagement
    return 0.85; // Low engagement
  }

  /**
   * Get platform-specific deliverables
   */
  getPlatformDeliverables(platform) {
    const deliverables = {
      instagram: [
        { type: 'reel', name: 'Instagram Reel' },
        { type: 'post', name: 'Feed Post' },
        { type: 'story', name: 'Story' },
        { type: 'story_series', name: 'Story Series (3-5)' }
      ],
      youtube: [
        { type: 'dedicated_video', name: 'Dedicated Video' },
        { type: 'integration', name: 'Product Integration' },
        { type: 'shorts', name: 'YouTube Shorts' }
      ],
      linkedin: [
        { type: 'post', name: 'LinkedIn Post' },
        { type: 'article', name: 'LinkedIn Article' },
        { type: 'video', name: 'LinkedIn Video' }
      ]
    };
    
    return deliverables[platform] || [];
  }

  /**
   * Update existing rate card
   */
  async updateRateCard(rateCardId, updates, userId) {
    try {
      logInfo('Updating rate card', { rateCardId, userId });

      const rateCard = await RateCard.findOne({
        _id: rateCardId,
        creator: userId,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      // Create version before updating
      if (this.hasSignificantChanges(rateCard, updates)) {
        await rateCard.createVersion('Manual update');
      }

      // Update fields
      Object.assign(rateCard, updates);
      
      // Regenerate AI suggestions if metrics changed
      if (updates.creatorMetrics) {
        const newSuggestions = await this.generateAIPricingSuggestions(updates.creatorMetrics);
        if (newSuggestions) {
          rateCard.aiSuggestions = {
            generated: true,
            generatedAt: new Date(),
            suggestedRates: newSuggestions.rates,
            marketComparison: newSuggestions.comparison
          };
        }
      }

      await rateCard.save();

      logInfo('Rate card updated successfully', { rateCardId });
      return rateCard;
    } catch (error) {
      logError('Error updating rate card', { error: error.message });
      throw error;
    }
  }

  /**
   * Create package deal
   */
  async createPackage(rateCardId, packageData, userId) {
    try {
      logInfo('Creating package', { rateCardId, userId });

      const rateCard = await RateCard.findOne({
        _id: rateCardId,
        creator: userId,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      // Calculate individual total
      let individualTotal = 0;
      for (const item of packageData.items) {
        const deliverable = rateCard.deliverables
          .flatMap(d => d.items)
          .find(i => i._id.toString() === item.deliverableId);
        
        if (deliverable) {
          individualTotal += deliverable.pricing.finalPrice * item.quantity;
        }
      }

      // Add package with calculated savings
      const newPackage = {
        ...packageData,
        pricing: {
          individualTotal,
          packagePrice: packageData.packagePrice,
          savings: {
            amount: individualTotal - packageData.packagePrice,
            percentage: ((individualTotal - packageData.packagePrice) / individualTotal * 100).toFixed(2)
          }
        }
      };

      rateCard.packages.push(newPackage);
      await rateCard.save();

      logInfo('Package created successfully', { 
        rateCardId,
        packageName: packageData.name 
      });

      return rateCard;
    } catch (error) {
      logError('Error creating package', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate PDF rate card
   */
  async generatePDF(rateCardId, userId) {
    try {
      logInfo('Generating PDF for rate card', { rateCardId, userId });

      const rateCard = await RateCard.findOne({
        _id: rateCardId,
        creator: userId,
        isDeleted: false
      }).populate('creator', 'name email phone businessDetails');

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      // Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 50,
        info: {
          Title: `Rate Card - ${rateCard.creator.name}`,
          Author: 'CreatorsMantra',
          Subject: 'Creator Rate Card',
          CreationDate: new Date()
        }
      });

      // Generate PDF content based on template
      await this.applyPDFTemplate(doc, rateCard);

      // Save to buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          logInfo('PDF generated successfully', { 
            rateCardId,
            size: pdfBuffer.length 
          });
          resolve(pdfBuffer);
        });
        
        doc.on('error', reject);
        doc.end();
      });
    } catch (error) {
      logError('Error generating PDF', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply PDF template design
   */
  async applyPDFTemplate(doc, rateCard) {
    const template = rateCard.template.designId;
    const colors = rateCard.template.customization;
    
    // Apply template-specific styling
    switch (template) {
      case 'minimal_clean':
        this.applyMinimalTemplate(doc, rateCard, colors);
        break;
      case 'bold_gradient':
        this.applyGradientTemplate(doc, rateCard, colors);
        break;
      case 'corporate_professional':
        this.applyCorporateTemplate(doc, rateCard, colors);
        break;
      case 'creative_playful':
        this.applyCreativeTemplate(doc, rateCard, colors);
        break;
      case 'luxury_premium':
        this.applyLuxuryTemplate(doc, rateCard, colors);
        break;
      default:
        this.applyMinimalTemplate(doc, rateCard, colors);
    }
  }

  /**
   * Apply minimal clean template
   */
  applyMinimalTemplate(doc, rateCard, colors) {
    // Header
    doc.fillColor(colors.primaryColor)
       .fontSize(28)
       .text('RATE CARD', 50, 50, { align: 'center' });
    
    // Creator Name
    doc.fillColor('#000000')
       .fontSize(20)
       .text(rateCard.creator.name, 50, 100, { align: 'center' });
    
    // Add line
    doc.moveTo(50, 140)
       .lineTo(545, 140)
       .stroke(colors.primaryColor);
    
    // Deliverables Section
    doc.fillColor('#000000')
       .fontSize(16)
       .text('DELIVERABLES', 50, 160);
    
    let yPosition = 190;
    
    for (const platform of rateCard.deliverables) {
      doc.fontSize(14)
         .fillColor(colors.primaryColor)
         .text(platform.platform.toUpperCase(), 50, yPosition);
      
      yPosition += 25;
      
      for (const item of platform.items) {
        if (item.active) {
          doc.fontSize(12)
             .fillColor('#333333')
             .text(`• ${item.type}`, 70, yPosition)
             .text(`₹${item.pricing.finalPrice.toLocaleString('en-IN')}`, 400, yPosition);
          
          yPosition += 20;
        }
      }
      
      yPosition += 10;
    }
    
    // Packages Section
    if (rateCard.packages.length > 0) {
      doc.fontSize(16)
         .fillColor('#000000')
         .text('PACKAGES', 50, yPosition + 20);
      
      yPosition += 50;
      
      for (const pkg of rateCard.packages) {
        if (pkg.active) {
          doc.fontSize(14)
             .fillColor(colors.primaryColor)
             .text(pkg.name, 50, yPosition);
          
          doc.fontSize(12)
             .fillColor('#333333')
             .text(pkg.description || '', 50, yPosition + 20)
             .text(`₹${pkg.pricing.packagePrice.toLocaleString('en-IN')}`, 400, yPosition + 20);
          
          if (pkg.pricing.savings.percentage > 0) {
            doc.fontSize(10)
               .fillColor(colors.secondaryColor)
               .text(`Save ${pkg.pricing.savings.percentage}%`, 400, yPosition + 35);
          }
          
          yPosition += 60;
        }
      }
    }
    
    // Terms Section
    doc.fontSize(12)
       .fillColor('#666666')
       .text('TERMS & CONDITIONS', 50, yPosition + 30);
    
    doc.fontSize(10)
       .text(`• Payment Terms: ${this.formatPaymentTerms(rateCard.terms.paymentTerms)}`, 50, yPosition + 50)
       .text(`• Usage Rights: ${rateCard.terms.usageRights.duration.value} ${rateCard.terms.usageRights.duration.unit}`, 50, yPosition + 65)
       .text(`• Valid for ${rateCard.terms.validity.days} days`, 50, yPosition + 80);
    
    // Footer
    doc.fontSize(8)
       .fillColor('#999999')
       .text('Generated by CreatorsMantra', 50, 750, { align: 'center' })
       .text(new Date().toLocaleDateString('en-IN'), 50, 765, { align: 'center' });
  }

  /**
   * Share rate card with unique link
   */
  async shareRateCard(rateCardId, shareOptions, userId) {
    try {
      logInfo('Sharing rate card', { rateCardId, userId });

      const rateCard = await RateCard.findOne({
        _id: rateCardId,
        creator: userId,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      // Generate public URL if not exists
      if (!rateCard.sharing.publicUrl) {
        rateCard.sharing.publicUrl = `${process.env.BASE_URL}/rate-card/${rateCard.sharing.shortCode}`;
      }

      // Set expiry if specified
      if (shareOptions.expiryDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + shareOptions.expiryDays);
        rateCard.sharing.expiresAt = expiryDate;
      }

      // Set password if specified
      if (shareOptions.password) {
        rateCard.sharing.password = shareOptions.password; // Should be hashed in production
      }

      // Update share settings
      rateCard.sharing.allowDownload = shareOptions.allowDownload !== false;
      rateCard.analytics.timesShared += 1;

      await rateCard.save();

      logInfo('Rate card shared successfully', { 
        rateCardId,
        shortCode: rateCard.sharing.shortCode 
      });

      return {
        publicUrl: rateCard.sharing.publicUrl,
        shortCode: rateCard.sharing.shortCode,
        expiresAt: rateCard.sharing.expiresAt
      };
    } catch (error) {
      logError('Error sharing rate card', { error: error.message });
      throw error;
    }
  }

  /**
   * Get rate card analytics
   */
  async getRateCardAnalytics(rateCardId, userId) {
    try {
      logInfo('Fetching rate card analytics', { rateCardId, userId });

      const rateCard = await RateCard.findOne({
        _id: rateCardId,
        creator: userId,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      // Calculate additional analytics
      const analytics = {
        ...rateCard.analytics.toObject(),
        performanceScore: this.calculatePerformanceScore(rateCard.analytics),
        recommendations: await this.generateRecommendations(rateCard),
        marketPosition: await this.calculateMarketPosition(rateCard)
      };

      logInfo('Analytics fetched successfully', { rateCardId });
      return analytics;
    } catch (error) {
      logError('Error fetching analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk update rates
   */
  async bulkUpdateRates(userId, updateOptions) {
    try {
      logInfo('Bulk updating rates', { userId, updateOptions });

      const rateCards = await RateCard.find({
        creator: userId,
        status: 'active',
        isDeleted: false
      });

      const updates = [];
      
      for (const rateCard of rateCards) {
        // Apply percentage increase/decrease
        if (updateOptions.percentageChange) {
          for (const platform of rateCard.deliverables) {
            for (const item of platform.items) {
              const multiplier = 1 + (updateOptions.percentageChange / 100);
              item.pricing.finalPrice = Math.round(item.pricing.finalPrice * multiplier);
            }
          }
        }

        // Apply platform-specific updates
        if (updateOptions.platformUpdates) {
          for (const [platform, change] of Object.entries(updateOptions.platformUpdates)) {
            const platformDeliverables = rateCard.deliverables.find(d => d.platform === platform);
            if (platformDeliverables) {
              for (const item of platformDeliverables.items) {
                const multiplier = 1 + (change / 100);
                item.pricing.finalPrice = Math.round(item.pricing.finalPrice * multiplier);
              }
            }
          }
        }

        await rateCard.createVersion(`Bulk rate update: ${JSON.stringify(updateOptions)}`);
        await rateCard.save();
        updates.push(rateCard._id);
      }

      logInfo('Bulk update completed', { 
        userId,
        updatedCount: updates.length 
      });

      return updates;
    } catch (error) {
      logError('Error in bulk update', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper: Check subscription limits
   */
  async checkSubscriptionLimits(user) {
    const limits = {
      starter: { maxRateCards: 3 },
      pro: { maxRateCards: 10 },
      elite: { maxRateCards: -1 },
      agency_starter: { maxRateCards: 50 },
      agency_pro: { maxRateCards: -1 }
    };

    const limit = limits[user.subscription.plan];
    
    if (limit.maxRateCards !== -1) {
      const count = await RateCard.countDocuments({
        creator: user._id,
        isDeleted: false
      });
      
      if (count >= limit.maxRateCards) {
        throw new AppError(
          `Rate card limit reached. Upgrade to create more.`,
          403
        );
      }
    }
  }

  /**
   * Helper: Calculate performance score
   */
  calculatePerformanceScore(analytics) {
    let score = 0;
    
    // Conversion rate (40% weight)
    score += (analytics.conversionRate || 0) * 0.4;
    
    // Views to deals ratio (30% weight)
    const viewToDealRatio = analytics.timesViewed > 0 
      ? (analytics.dealsInitiated / analytics.timesViewed) * 100
      : 0;
    score += Math.min(viewToDealRatio, 50) * 0.6;
    
    // Revenue performance (30% weight)
    const revenueScore = Math.min(analytics.totalRevenue / 1000000, 1) * 30;
    score += revenueScore;
    
    return Math.round(score);
  }

  /**
   * Helper: Generate pricing reasoning
   */
  generatePricingReasoning(platform, deliverableType, nicheMultiplier, engagementMultiplier) {
    const reasons = [];
    
    if (platform.followers > 100000) {
      reasons.push('Large audience reach');
    }
    
    if (engagementMultiplier > 1.2) {
      reasons.push(`High engagement rate (${platform.engagementRate}%)`);
    }
    
    if (nicheMultiplier > 1.2) {
      reasons.push('Premium niche category');
    }
    
    if (platform.verified) {
      reasons.push('Verified account premium');
    }
    
    return reasons.join(', ') || 'Standard market rate';
  }

  /**
   * Helper: Format payment terms
   */
  formatPaymentTerms(terms) {
    const termMap = {
      '100_advance': '100% Advance',
      '50_50': '50% Advance, 50% Post-delivery',
      '25_75': '25% Advance, 75% Post-delivery',
      'post_delivery': '100% Post-delivery',
      'custom': 'Custom Terms'
    };
    
    return termMap[terms] || terms;
  }

  /**
   * Helper: Calculate confidence score
   */
  calculateConfidence(followers, niche) {
    let confidence = 70; // Base confidence
    
    // More data for common follower ranges
    if (followers >= 10000 && followers <= 100000) {
      confidence += 15;
    }
    
    // Popular niches have more data
    if (['fashion', 'beauty', 'lifestyle', 'food'].includes(niche)) {
      confidence += 10;
    }
    
    // Cap at 95%
    return Math.min(confidence, 95);
  }

  /**
   * Helper: Get data source count
   */
  getDataSourceCount(followers) {
    if (followers < 10000) return 45;
    if (followers < 50000) return 150;
    if (followers < 100000) return 200;
    if (followers < 500000) return 100;
    return 50;
  }
}

module.exports = new RateCardService();