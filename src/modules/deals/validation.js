/**
 * CreatorsMantra Backend - Deal CRM Validation Schemas
 * Joi validation schemas for deal management endpoints
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const Joi = require('joi')
const { isValidPhone, isValidEmail } = require('../../shared/utils')

// ============================================
// DEAL CREATION & UPDATE SCHEMAS
// ============================================

const createDealSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    'string.min': 'Deal title must be at least 3 characters',
    'string.max': 'Deal title cannot exceed 200 characters',
    'any.required': 'Deal title is required',
  }),

  brand: Joi.object({
    name: Joi.string().trim().min(2).max(100).required().messages({
      'string.min': 'Brand name must be at least 2 characters',
      'string.max': 'Brand name cannot exceed 100 characters',
      'any.required': 'Brand name is required',
    }),

    contactPerson: Joi.object({
      name: Joi.string().trim().min(2).max(100).messages({
        'string.min': 'Contact person name must be at least 2 characters',
        'string.max': 'Contact person name cannot exceed 100 characters',
      }),

      email: Joi.string().email().lowercase().trim().messages({
        'string.email': 'Invalid email format',
      }),

      phone: Joi.string()
        .custom((value, helpers) => {
          if (value && !isValidPhone(value)) {
            return helpers.error('any.invalid')
          }
          return value
        })
        .messages({
          'any.invalid': 'Invalid phone number format',
        }),

      designation: Joi.string().trim().max(100).messages({
        'string.max': 'Designation cannot exceed 100 characters',
      }),
    }).optional(),

    website: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .messages({
        'string.uri': 'Invalid website URL format',
      }),

    industry: Joi.string()
      .valid(
        'fashion',
        'beauty',
        'lifestyle',
        'tech',
        'food',
        'travel',
        'fitness',
        'finance',
        'education',
        'entertainment',
        'gaming',
        'automotive',
        'real_estate',
        'healthcare',
        'home_decor',
        'other'
      )
      .default('other')
      .messages({
        'any.only': 'Invalid industry selection',
      }),

    companySize: Joi.string()
      .valid('startup', 'small', 'medium', 'large', 'enterprise')
      .default('startup')
      .messages({
        'any.only': 'Invalid company size selection',
      }),
  }).required(),

  platform: Joi.string()
    .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat', 'multiple')
    .required()
    .messages({
      'any.only': 'Invalid platform selection',
      'any.required': 'Platform is required',
    }),

  deliverables: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid(
            'instagram_post',
            'instagram_reel',
            'instagram_story',
            'instagram_igtv',
            'youtube_video',
            'youtube_short',
            'youtube_community_post',
            'linkedin_post',
            'linkedin_article',
            'linkedin_video',
            'twitter_post',
            'twitter_thread',
            'twitter_space',
            'facebook_post',
            'facebook_reel',
            'facebook_story',
            'blog_post',
            'podcast_mention',
            'newsletter_mention',
            'website_review',
            'app_review',
            'product_unboxing',
            'brand_collaboration',
            'event_coverage',
            'other'
          )
          .required()
          .messages({
            'any.only': 'Invalid deliverable type',
            'any.required': 'Deliverable type is required',
          }),

        quantity: Joi.number().integer().min(1).max(100).required().messages({
          'number.integer': 'Quantity must be a whole number',
          'number.min': 'Quantity must be at least 1',
          'number.max': 'Quantity cannot exceed 100',
          'any.required': 'Quantity is required',
        }),

        description: Joi.string().trim().max(500).messages({
          'string.max': 'Deliverable description cannot exceed 500 characters',
        }),

        specifications: Joi.object({
          duration: Joi.number().min(1).max(3600), // 1 second to 1 hour
          dimensions: Joi.string().pattern(/^\d+x\d+$/),
          hashtags: Joi.array().items(Joi.string().trim()),
          mentions: Joi.array().items(Joi.string().trim()),
          musicRequired: Joi.boolean(),
          locationTagRequired: Joi.boolean(),
        }).optional(),

        deadline: Joi.date().min('now').messages({
          'date.min': 'Deadline cannot be in the past',
        }),
      })
    )
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.min': 'At least one deliverable is required',
      'array.max': 'Maximum 20 deliverables allowed',
      'any.required': 'Deliverables are required',
    }),

  dealValue: Joi.object({
    amount: Joi.number().min(100).max(10000000).required().messages({
      'number.min': 'Deal value must be at least ₹100',
      'number.max': 'Deal value cannot exceed ₹1 Crore',
      'any.required': 'Deal value is required',
    }),

    currency: Joi.string().valid('INR', 'USD', 'EUR').default('INR').messages({
      'any.only': 'Invalid currency selection',
    }),

    paymentTerms: Joi.string()
      .valid('full_advance', '50_50', '30_70', 'on_delivery', 'net_30', 'net_15', 'custom')
      .default('50_50')
      .messages({
        'any.only': 'Invalid payment terms selection',
      }),

    customPaymentTerms: Joi.when('paymentTerms', {
      is: 'custom',
      then: Joi.string().trim().min(10).max(500).required().messages({
        'string.min': 'Custom payment terms must be at least 10 characters',
        'string.max': 'Custom payment terms cannot exceed 500 characters',
        'any.required': 'Custom payment terms are required when payment terms is custom',
      }),
      otherwise: Joi.optional(),
    }),

    gstApplicable: Joi.boolean().default(true),
    tdsApplicable: Joi.boolean().default(false),
  }).required(),

  timeline: Joi.object({
    responseDeadline: Joi.date().min('now').messages({
      'date.min': 'Response deadline cannot be in the past',
    }),

    contentDeadline: Joi.date().min('now').messages({
      'date.min': 'Content deadline cannot be in the past',
    }),

    goLiveDate: Joi.date().min('now').messages({
      'date.min': 'Go live date cannot be in the past',
    }),

    paymentDueDate: Joi.date().min('now').messages({
      'date.min': 'Payment due date cannot be in the past',
    }),
  }).optional(),

  campaignRequirements: Joi.object({
    exclusivity: Joi.object({
      required: Joi.boolean().default(false),
      duration: Joi.number().min(1).max(365), // 1 day to 1 year
      categories: Joi.array().items(Joi.string().trim()),
    }).optional(),

    contentGuidelines: Joi.object({
      mustInclude: Joi.array().items(Joi.string().trim()),
      mustAvoid: Joi.array().items(Joi.string().trim()),
      tone: Joi.string().valid(
        'professional',
        'casual',
        'humorous',
        'educational',
        'inspirational'
      ),
      style: Joi.string().trim().max(200),
    }).optional(),

    usageRights: Joi.object({
      duration: Joi.string()
        .valid('1_month', '3_months', '6_months', '1_year', 'lifetime', 'custom')
        .default('3_months'),
      platforms: Joi.array().items(Joi.string().trim()),
      geography: Joi.string().valid('india', 'global', 'specific_regions').default('india'),
      whiteLabel: Joi.boolean().default(false),
    }).optional(),

    performanceTargets: Joi.object({
      minViews: Joi.number().min(0),
      minLikes: Joi.number().min(0),
      minComments: Joi.number().min(0),
      minShares: Joi.number().min(0),
      minSaves: Joi.number().min(0),
      ctr: Joi.number().min(0).max(100),
      engagementRate: Joi.number().min(0).max(100),
    }).optional(),
  }).optional(),

  source: Joi.string()
    .valid(
      'direct_outreach',
      'brand_inquiry',
      'referral',
      'social_media',
      'email_campaign',
      'networking',
      'repeat_client',
      'other'
    )
    .default('brand_inquiry')
    .messages({
      'any.only': 'Invalid deal source selection',
    }),

  referralSource: Joi.string().trim().max(200).messages({
    'string.max': 'Referral source cannot exceed 200 characters',
  }),

  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium').messages({
    'any.only': 'Invalid priority selection',
  }),

  tags: Joi.array()
    .items(
      Joi.string().trim().min(1).max(50).messages({
        'string.min': 'Tag cannot be empty',
        'string.max': 'Tag cannot exceed 50 characters',
      })
    )
    .max(10)
    .unique()
    .messages({
      'array.max': 'Maximum 10 tags allowed',
      'array.unique': 'Tags must be unique',
    }),

  internalNotes: Joi.string().trim().max(2000).messages({
    'string.max': 'Internal notes cannot exceed 2000 characters',
  }),

  templateId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid template ID format',
    }),

  initialCommunication: Joi.object({
    type: Joi.string()
      .valid('email', 'call', 'meeting', 'whatsapp', 'instagram_dm', 'other')
      .required(),
    direction: Joi.string().valid('inbound', 'outbound').required(),
    subject: Joi.string().trim().max(200),
    summary: Joi.string().trim().max(1000),
  }).optional(),
})

const updateDealSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).messages({
    'string.min': 'Deal title must be at least 3 characters',
    'string.max': 'Deal title cannot exceed 200 characters',
  }),

  brand: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    contactPerson: Joi.object({
      name: Joi.string().trim().min(2).max(100),
      email: Joi.string().email().lowercase().trim(),
      phone: Joi.string().custom((value, helpers) => {
        if (value && !isValidPhone(value)) {
          return helpers.error('any.invalid')
        }
        return value
      }),
      designation: Joi.string().trim().max(100),
    }),
    website: Joi.string().uri({ scheme: ['http', 'https'] }),
    industry: Joi.string().valid(
      'fashion',
      'beauty',
      'lifestyle',
      'tech',
      'food',
      'travel',
      'fitness',
      'finance',
      'education',
      'entertainment',
      'gaming',
      'automotive',
      'real_estate',
      'healthcare',
      'home_decor',
      'other'
    ),
    companySize: Joi.string().valid('startup', 'small', 'medium', 'large', 'enterprise'),
  }),

  platform: Joi.string().valid(
    'instagram',
    'youtube',
    'linkedin',
    'twitter',
    'facebook',
    'snapchat',
    'multiple'
  ),

  deliverables: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid(
          'instagram_post',
          'instagram_reel',
          'instagram_story',
          'instagram_igtv',
          'youtube_video',
          'youtube_short',
          'youtube_community_post',
          'linkedin_post',
          'linkedin_article',
          'linkedin_video',
          'twitter_post',
          'twitter_thread',
          'twitter_space',
          'facebook_post',
          'facebook_reel',
          'facebook_story',
          'blog_post',
          'podcast_mention',
          'newsletter_mention',
          'website_review',
          'app_review',
          'product_unboxing',
          'brand_collaboration',
          'event_coverage',
          'other'
        ),
        quantity: Joi.number().integer().min(1).max(100),
        description: Joi.string().trim().max(500),
        specifications: Joi.object().unknown(true),
        deadline: Joi.date().min('now'),
      })
    )
    .min(1)
    .max(20),

  dealValue: Joi.object({
    amount: Joi.number().min(100).max(10000000),
    currency: Joi.string().valid('INR', 'USD', 'EUR'),
    paymentTerms: Joi.string().valid(
      'full_advance',
      '50_50',
      '30_70',
      'on_delivery',
      'net_30',
      'net_15',
      'custom'
    ),
    customPaymentTerms: Joi.string().trim().min(10).max(500),
    gstApplicable: Joi.boolean(),
    tdsApplicable: Joi.boolean(),
  }),

  timeline: Joi.object({
    responseDeadline: Joi.date().min('now'),
    contentDeadline: Joi.date().min('now'),
    goLiveDate: Joi.date().min('now'),
    paymentDueDate: Joi.date().min('now'),
    negotiationStartDate: Joi.date(),
    contractSignedDate: Joi.date(),
    contentCreationStart: Joi.date(),
    completedDate: Joi.date(),
  }),

  campaignRequirements: Joi.object().unknown(true),

  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).unique(),
  internalNotes: Joi.string().trim().max(2000),
  status: Joi.string().valid('active', 'paused', 'completed', 'cancelled'),
})

// ============================================
// DEAL STAGE UPDATE SCHEMA
// ============================================

const updateDealStageSchema = Joi.object({
  stage: Joi.string()
    .valid(
      'pitched',
      'in_talks',
      'negotiating',
      'live',
      'completed',
      'paid',
      'cancelled',
      'rejected',
      'all'
    )
    .required()
    .messages({
      'any.only': 'Invalid stage selection',
      'any.required': 'Stage is required',
    }),

  goLiveDate: Joi.date().min('now').messages({
    'date.min': 'Go live date cannot be in the past',
  }),

  negotiationNotes: Joi.string().trim().max(1000).messages({
    'string.max': 'Negotiation notes cannot exceed 1000 characters',
  }),

  cancellationReason: Joi.string().trim().max(500).messages({
    'string.max': 'Cancellation reason cannot exceed 500 characters',
  }),

  rejectionReason: Joi.string().trim().max(500).messages({
    'string.max': 'Rejection reason cannot exceed 500 characters',
  }),
})

// ============================================
// COMMUNICATION SCHEMAS
// ============================================

const addCommunicationSchema = Joi.object({
  type: Joi.string()
    .valid('email', 'call', 'meeting', 'whatsapp', 'instagram_dm', 'other')
    .required()
    .messages({
      'any.only': 'Invalid communication type',
      'any.required': 'Communication type is required',
    }),

  direction: Joi.string().valid('inbound', 'outbound').required().messages({
    'any.only': 'Direction must be inbound or outbound',
    'any.required': 'Communication direction is required',
  }),

  subject: Joi.string().trim().max(200).messages({
    'string.max': 'Subject cannot exceed 200 characters',
  }),

  summary: Joi.string().trim().min(5).max(1000).required().messages({
    'string.min': 'Summary must be at least 5 characters',
    'string.max': 'Summary cannot exceed 1000 characters',
    'any.required': 'Communication summary is required',
  }),

  outcome: Joi.string()
    .valid('positive', 'neutral', 'negative', 'follow_up_required')
    .default('neutral')
    .messages({
      'any.only': 'Invalid outcome selection',
    }),

  nextAction: Joi.string().trim().max(200).messages({
    'string.max': 'Next action cannot exceed 200 characters',
  }),

  followUpDate: Joi.date().min('now').messages({
    'date.min': 'Follow-up date cannot be in the past',
  }),

  attachments: Joi.array().items(Joi.string().uri()).max(5).messages({
    'array.max': 'Maximum 5 attachments allowed',
  }),
})

const updateCommunicationSchema = Joi.object({
  subject: Joi.string().trim().max(200),
  summary: Joi.string().trim().min(5).max(1000),
  outcome: Joi.string().valid('positive', 'neutral', 'negative', 'follow_up_required'),
  nextAction: Joi.string().trim().max(200),
  followUpDate: Joi.date().min('now'),
  attachments: Joi.array().items(Joi.string().uri()).max(5),
})

// ============================================
// DELIVERABLE SCHEMAS
// ============================================

const updateDeliverableSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'in_progress', 'submitted', 'approved', 'revision_required', 'completed')
    .required()
    .messages({
      'any.only': 'Invalid deliverable status',
      'any.required': 'Deliverable status is required',
    }),

  submissionUrl: Joi.when('status', {
    is: 'submitted',
    then: Joi.string().uri().required().messages({
      'string.uri': 'Invalid submission URL format',
      'any.required': 'Submission URL is required when status is submitted',
    }),
    otherwise: Joi.string().uri().optional(),
  }),

  revisionNotes: Joi.when('status', {
    is: 'revision_required',
    then: Joi.string().trim().min(10).max(500).required().messages({
      'string.min': 'Revision notes must be at least 10 characters',
      'string.max': 'Revision notes cannot exceed 500 characters',
      'any.required': 'Revision notes are required when status is revision_required',
    }),
    otherwise: Joi.string().trim().max(500).optional(),
  }),
})

const addDeliverableSchema = Joi.object({
  type: Joi.string()
    .valid(
      'instagram_post',
      'instagram_reel',
      'instagram_story',
      'instagram_igtv',
      'youtube_video',
      'youtube_short',
      'youtube_community_post',
      'linkedin_post',
      'linkedin_article',
      'linkedin_video',
      'twitter_post',
      'twitter_thread',
      'twitter_space',
      'facebook_post',
      'facebook_reel',
      'facebook_story',
      'blog_post',
      'podcast_mention',
      'newsletter_mention',
      'website_review',
      'app_review',
      'product_unboxing',
      'brand_collaboration',
      'event_coverage',
      'other'
    )
    .required()
    .messages({
      'any.only': 'Invalid deliverable type',
      'any.required': 'Deliverable type is required',
    }),

  quantity: Joi.number().integer().min(1).max(100).required().messages({
    'number.integer': 'Quantity must be a whole number',
    'number.min': 'Quantity must be at least 1',
    'number.max': 'Quantity cannot exceed 100',
    'any.required': 'Quantity is required',
  }),

  description: Joi.string().trim().max(500).messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),

  specifications: Joi.object({
    duration: Joi.number().min(1).max(3600),
    dimensions: Joi.string().pattern(/^\d+x\d+$/),
    hashtags: Joi.array().items(Joi.string().trim()),
    mentions: Joi.array().items(Joi.string().trim()),
    musicRequired: Joi.boolean(),
    locationTagRequired: Joi.boolean(),
  }).optional(),

  deadline: Joi.date().min('now').messages({
    'date.min': 'Deadline cannot be in the past',
  }),
})

// ============================================
// BRAND PROFILE SCHEMAS
// ============================================

const updateBrandProfileSchema = Joi.object({
  description: Joi.string().trim().max(1000).messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),

  website: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .messages({
      'string.uri': 'Invalid website URL format',
    }),

  industry: Joi.string()
    .valid(
      'fashion',
      'beauty',
      'lifestyle',
      'tech',
      'food',
      'travel',
      'fitness',
      'finance',
      'education',
      'entertainment',
      'gaming',
      'automotive',
      'real_estate',
      'healthcare',
      'home_decor',
      'other'
    )
    .messages({
      'any.only': 'Invalid industry selection',
    }),

  companySize: Joi.string().valid('startup', 'small', 'medium', 'large', 'enterprise').messages({
    'any.only': 'Invalid company size selection',
  }),

  primaryContact: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    designation: Joi.string().trim().max(100),
    email: Joi.string().email().lowercase().trim(),
    phone: Joi.string().custom((value, helpers) => {
      if (value && !isValidPhone(value)) {
        return helpers.error('any.invalid')
      }
      return value
    }),
    linkedin: Joi.string().uri(),
    preferredContactMethod: Joi.string().valid('email', 'phone', 'whatsapp', 'linkedin'),
  }),

  socialMedia: Joi.object({
    instagram: Joi.object({
      handle: Joi.string().trim(),
      followers: Joi.number().min(0),
      verified: Joi.boolean(),
      url: Joi.string().uri(),
    }),
    youtube: Joi.object({
      channel: Joi.string().trim(),
      subscribers: Joi.number().min(0),
      verified: Joi.boolean(),
      url: Joi.string().uri(),
    }),
    linkedin: Joi.object({
      handle: Joi.string().trim(),
      followers: Joi.number().min(0),
      url: Joi.string().uri(),
    }),
    twitter: Joi.object({
      handle: Joi.string().trim(),
      followers: Joi.number().min(0),
      verified: Joi.boolean(),
      url: Joi.string().uri(),
    }),
    facebook: Joi.object({
      page: Joi.string().trim(),
      likes: Joi.number().min(0),
      url: Joi.string().uri(),
    }),
  }),

  preferences: Joi.object({
    budgetRange: Joi.object({
      min: Joi.number().min(0),
      max: Joi.number().min(Joi.ref('min')),
      currency: Joi.string().valid('INR', 'USD', 'EUR').default('INR'),
    }),
    campaignTypes: Joi.array().items(
      Joi.string().valid(
        'brand_awareness',
        'product_launch',
        'seasonal',
        'influencer_takeover',
        'ugc',
        'review',
        'tutorial',
        'lifestyle'
      )
    ),
    contentStyle: Joi.array().items(
      Joi.string().valid(
        'professional',
        'casual',
        'humorous',
        'educational',
        'inspirational',
        'trendy'
      )
    ),
    exclusivityRequirements: Joi.object({
      required: Joi.boolean(),
      duration: Joi.number().min(1).max(365),
      categories: Joi.array().items(Joi.string().trim()),
    }),
  }),

  status: Joi.string().valid('active', 'potential', 'blacklisted', 'inactive').messages({
    'any.only': 'Invalid brand status',
  }),

  blacklistReason: Joi.string().trim().max(500).messages({
    'string.max': 'Blacklist reason cannot exceed 500 characters',
  }),

  internalNotes: Joi.string().trim().max(2000).messages({
    'string.max': 'Internal notes cannot exceed 2000 characters',
  }),

  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).unique().messages({
    'array.max': 'Maximum 10 tags allowed',
    'array.unique': 'Tags must be unique',
  }),
})

// ============================================
// DEAL TEMPLATE SCHEMAS
// ============================================

const createDealTemplateSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    'string.min': 'Template name must be at least 3 characters',
    'string.max': 'Template name cannot exceed 100 characters',
    'any.required': 'Template name is required',
  }),

  description: Joi.string().trim().max(500).messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),

  category: Joi.string()
    .valid(
      'instagram_post',
      'instagram_reel',
      'youtube_video',
      'brand_collaboration',
      'product_review',
      'custom'
    )
    .default('custom')
    .messages({
      'any.only': 'Invalid template category',
    }),

  platform: Joi.string()
    .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat', 'multiple')
    .required()
    .messages({
      'any.only': 'Invalid platform selection',
      'any.required': 'Platform is required',
    }),

  deliverables: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid(
            'instagram_post',
            'instagram_reel',
            'instagram_story',
            'instagram_igtv',
            'youtube_video',
            'youtube_short',
            'youtube_community_post',
            'linkedin_post',
            'linkedin_article',
            'linkedin_video',
            'twitter_post',
            'twitter_thread',
            'twitter_space',
            'facebook_post',
            'facebook_reel',
            'facebook_story',
            'blog_post',
            'podcast_mention',
            'newsletter_mention',
            'website_review',
            'app_review',
            'product_unboxing',
            'brand_collaboration',
            'event_coverage',
            'other'
          )
          .required(),
        quantity: Joi.number().integer().min(1).max(100).required(),
        description: Joi.string().trim().max(500),
        specifications: Joi.object().unknown(true),
      })
    )
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.min': 'At least one deliverable is required',
      'array.max': 'Maximum 20 deliverables allowed',
      'any.required': 'Deliverables are required',
    }),

  defaultValue: Joi.number().min(100).max(10000000).messages({
    'number.min': 'Default value must be at least ₹100',
    'number.max': 'Default value cannot exceed ₹1 Crore',
  }),

  paymentTerms: Joi.string()
    .valid('full_advance', '50_50', '30_70', 'on_delivery', 'net_30', 'net_15', 'custom')
    .default('50_50')
    .messages({
      'any.only': 'Invalid payment terms',
    }),

  timeline: Joi.object({
    responseDeadline: Joi.number().min(1).max(365), // days
    contentDeadline: Joi.number().min(1).max(365), // days
    revisionTime: Joi.number().min(1).max(30), // days
  }),

  campaignRequirements: Joi.object().unknown(true),

  isPublic: Joi.boolean().default(false),

  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).unique().messages({
    'array.max': 'Maximum 10 tags allowed',
    'array.unique': 'Tags must be unique',
  }),
})

const updateDealTemplateSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100),
  description: Joi.string().trim().max(500),
  category: Joi.string().valid(
    'instagram_post',
    'instagram_reel',
    'youtube_video',
    'brand_collaboration',
    'product_review',
    'custom'
  ),
  platform: Joi.string().valid(
    'instagram',
    'youtube',
    'linkedin',
    'twitter',
    'facebook',
    'snapchat',
    'multiple'
  ),
  deliverables: Joi.array().items(Joi.object().unknown(true)).min(1).max(20),
  defaultValue: Joi.number().min(100).max(10000000),
  paymentTerms: Joi.string().valid(
    'full_advance',
    '50_50',
    '30_70',
    'on_delivery',
    'net_30',
    'net_15',
    'custom'
  ),
  timeline: Joi.object().unknown(true),
  campaignRequirements: Joi.object().unknown(true),
  isPublic: Joi.boolean(),
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).unique(),
})

// ============================================
// QUERY PARAMETER SCHEMAS
// ============================================

const getDealsQuerySchema = Joi.object({
  stage: Joi.alternatives().try(
    Joi.string().valid(
      'pitched',
      'in_talks',
      'negotiating',
      'live',
      'completed',
      'paid',
      'cancelled',
      'rejected'
    ),
    Joi.array().items(
      Joi.string().valid(
        'pitched',
        'in_talks',
        'negotiating',
        'live',
        'completed',
        'paid',
        'cancelled',
        'rejected'
      )
    )
  ),

  status: Joi.string().valid('active', 'paused', 'completed', 'cancelled'),
  platform: Joi.string().valid(
    'instagram',
    'youtube',
    'linkedin',
    'twitter',
    'facebook',
    'snapchat',
    'multiple'
  ),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  source: Joi.string().valid(
    'direct_outreach',
    'brand_inquiry',
    'referral',
    'social_media',
    'email_campaign',
    'networking',
    'repeat_client',
    'other'
  ),

  brand: Joi.string().trim().max(100),
  search: Joi.string().trim().max(200),
  tags: Joi.string().pattern(/^[^,]+(,[^,]+)*$/), // Comma-separated tags

  minValue: Joi.number().min(0),
  maxValue: Joi.number().min(Joi.ref('minValue')),

  dateFrom: Joi.date(),
  dateTo: Joi.date().min(Joi.ref('dateFrom')),

  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('createdAt', 'updatedAt', 'dealValue.amount', 'priority', 'stage', 'brand.name')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
})

const getBrandProfilesQuerySchema = Joi.object({
  status: Joi.string().valid('active', 'potential', 'blacklisted', 'inactive'),
  industry: Joi.string().valid(
    'fashion',
    'beauty',
    'lifestyle',
    'tech',
    'food',
    'travel',
    'fitness',
    'finance',
    'education',
    'entertainment',
    'gaming',
    'automotive',
    'real_estate',
    'healthcare',
    'home_decor',
    'other'
  ),
  search: Joi.string().trim().max(200),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
})

const getDealTemplatesQuerySchema = Joi.object({
  category: Joi.string().valid(
    'instagram_post',
    'instagram_reel',
    'youtube_video',
    'brand_collaboration',
    'product_review',
    'custom'
  ),
  isPublic: Joi.boolean(),
})

const getPipelineOverviewQuerySchema = Joi.object({
  dateFrom: Joi.date(),
  dateTo: Joi.date().min(Joi.ref('dateFrom')),
})

const getRevenueAnalyticsQuerySchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
})

// ============================================
// BULK OPERATIONS SCHEMAS
// ============================================

const bulkUpdateDealsSchema = Joi.object({
  dealIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one deal ID is required',
      'array.max': 'Cannot update more than 50 deals at once',
      'any.required': 'Deal IDs array is required',
    }),

  updateData: Joi.object({
    stage: Joi.string().valid(
      'pitched',
      'in_talks',
      'negotiating',
      'live',
      'completed',
      'paid',
      'cancelled',
      'rejected'
    ),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    status: Joi.string().valid('active', 'paused', 'completed', 'cancelled'),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).unique(),
  })
    .min(1)
    .required()
    .messages({
      'object.min': 'At least one field to update is required',
      'any.required': 'Update data is required',
    }),
})

const quickActionSchema = Joi.object({
  subject: Joi.string().trim().max(200),
  message: Joi.string().trim().max(1000),
  followUpDate: Joi.date().min('now'),
})

// ============================================
// PARAMETER VALIDATION SCHEMAS
// ============================================

const dealIdParamSchema = Joi.object({
  dealId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid deal ID format',
      'any.required': 'Deal ID is required',
    }),
})

const brandIdParamSchema = Joi.object({
  brandId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid brand ID format',
      'any.required': 'Brand ID is required',
    }),
})

const templateIdParamSchema = Joi.object({
  templateId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid template ID format',
      'any.required': 'Template ID is required',
    }),
})

const deliverableIdParamSchema = Joi.object({
  deliverableId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid deliverable ID format',
      'any.required': 'Deliverable ID is required',
    }),
})

// Add this new combined schema for routes with both dealId and deliverableId
const dealAndDeliverableParamSchema = Joi.object({
  dealId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid deal ID format',
      'any.required': 'Deal ID is required',
    }),
  deliverableId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid deliverable ID format',
      'any.required': 'Deliverable ID is required',
    }),
})

const communicationIdParamSchema = Joi.object({
  commId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid communication ID format',
      'any.required': 'Communication ID is required',
    }),
})

const stageParamSchema = Joi.object({
  stage: Joi.string()
    .valid(
      'pitched',
      'in_talks',
      'negotiating',
      'live',
      'completed',
      'paid',
      'cancelled',
      'rejected',
      'all'
    )
    .required()
    .messages({
      'any.only': 'Invalid stage parameter',
      'any.required': 'Stage parameter is required',
    }),
})

const actionParamSchema = Joi.object({
  action: Joi.string()
    .valid('duplicate', 'convert_to_template', 'send_reminder')
    .required()
    .messages({
      'any.only': 'Invalid action parameter',
      'any.required': 'Action parameter is required',
    }),
})

// ============================================
// EXPORT ALL SCHEMAS
// ============================================

module.exports = {
  // Deal CRUD schemas
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,

  // Communication schemas
  addCommunicationSchema,
  updateCommunicationSchema,

  // Deliverable schemas
  updateDeliverableSchema,
  addDeliverableSchema,

  // Brand profile schemas
  updateBrandProfileSchema,

  // Template schemas
  createDealTemplateSchema,
  updateDealTemplateSchema,

  // Query parameter schemas
  getDealsQuerySchema,
  getBrandProfilesQuerySchema,
  getDealTemplatesQuerySchema,
  getPipelineOverviewQuerySchema,
  getRevenueAnalyticsQuerySchema,

  // Bulk operations schemas
  bulkUpdateDealsSchema,
  quickActionSchema,

  // Parameter validation schemas
  dealIdParamSchema,
  brandIdParamSchema,
  templateIdParamSchema,
  deliverableIdParamSchema,
  communicationIdParamSchema,
  stageParamSchema,
  actionParamSchema,
  dealAndDeliverableParamSchema,
}
