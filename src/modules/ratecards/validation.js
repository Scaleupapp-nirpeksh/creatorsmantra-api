/**
 * CreatorsMantra Backend - Rate Card Validation
 * Joi validation schemas for rate card operations
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const Joi = require('joi');

// Custom validation for Indian phone numbers
const indianPhone = Joi.string().pattern(/^[6-9]\d{9}$/);

// Platform enum
const platforms = ['instagram', 'youtube', 'linkedin', 'twitter'];

// Niche enum
const niches = [
  'fashion', 'beauty', 'tech', 'finance', 'food', 'travel',
  'lifestyle', 'fitness', 'gaming', 'education', 'entertainment',
  'business', 'health', 'parenting', 'general'
];

// Template designs
const templateDesigns = [
  'minimal_clean', 'bold_gradient', 'corporate_professional',
  'creative_playful', 'luxury_premium'
];

/**
 * Schema for creating a rate card
 */
const createRateCardSchema = Joi.object({
  title: Joi.string().trim().max(100).default('My Rate Card'),
  
  status: Joi.string().valid('draft', 'active', 'archived').default('draft'),
  
  creatorMetrics: Joi.object({
    platforms: Joi.array().items(
      Joi.object({
        name: Joi.string().valid(...platforms).required(),
        followers: Joi.number().min(0).required(),
        engagementRate: Joi.number().min(0).max(100),
        avgViews: Joi.number().min(0),
        verified: Joi.boolean().default(false)
      })
    ).min(1).required(),
    
    niche: Joi.string().valid(...niches).required(),
    
    location: Joi.object({
      city: Joi.string().trim(),
      state: Joi.string().trim(),
      country: Joi.string().default('India')
    }),
    
    language: Joi.array().items(
      Joi.string().valid(
        'english', 'hindi', 'tamil', 'telugu', 'bengali',
        'marathi', 'gujarati', 'kannada', 'malayalam', 'punjabi', 'other'
      )
    )
  }),
  
  deliverables: Joi.array().items(
    Joi.object({
      platform: Joi.string().valid(...platforms).required(),
      
      items: Joi.array().items(
        Joi.object({
          type: Joi.string().required(),
          description: Joi.string().max(200),
          
          pricing: Joi.object({
            basePrice: Joi.number().min(0),
            finalPrice: Joi.number().min(0).required(),
            currency: Joi.string().default('INR'),
            priceUnit: Joi.string().valid(
              'per_post', 'per_video', 'per_story', 
              'per_hour', 'per_campaign'
            ).default('per_post')
          }).required(),
          
          turnaroundTime: Joi.object({
            value: Joi.number().min(1),
            unit: Joi.string().valid('hours', 'days', 'weeks').default('days')
          }),
          
          includedRevisions: Joi.number().min(0).default(2),
          active: Joi.boolean().default(true)
        })
      ).min(1)
    })
  ),
  
  packages: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().max(50).required(),
      description: Joi.string().max(500),
      
      items: Joi.array().items(
        Joi.object({
          deliverableId: Joi.string(),
          quantity: Joi.number().min(1).default(1),
          description: Joi.string()
        })
      ),
      
      pricing: Joi.object({
        individualTotal: Joi.number().min(0).required(),
        packagePrice: Joi.number().min(0).required()
      }).required(),
      
      validity: Joi.object({
        value: Joi.number().min(1),
        unit: Joi.string().valid('days', 'weeks', 'months').default('days')
      }),
      
      popular: Joi.boolean().default(false),
      active: Joi.boolean().default(true)
    })
  ),
  
  template: Joi.object({
    designId: Joi.string().valid(...templateDesigns).default('minimal_clean'),
    
    customization: Joi.object({
      primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#8B5CF6'),
      secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#EC4899'),
      accentColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#3B82F6'),
      fontFamily: Joi.string().valid(
        'inter', 'poppins', 'montserrat', 'playfair', 'roboto'
      ).default('inter'),
      logoUrl: Joi.string().uri(),
      watermarkEnabled: Joi.boolean().default(true)
    })
  }),
  
  terms: Joi.object({
    paymentTerms: Joi.string().valid(
      '100_advance', '50_50', '25_75', 'post_delivery', 'custom'
    ).default('50_50'),
    
    customPaymentTerms: Joi.when('paymentTerms', {
      is: 'custom',
      then: Joi.string().required(),
      otherwise: Joi.string()
    }),
    
    usageRights: Joi.object({
      duration: Joi.object({
        value: Joi.number().min(1),
        unit: Joi.string().valid('days', 'months', 'years', 'perpetual')
      }),
      
      platforms: Joi.array().items(
        Joi.string().valid(
          'owned_channels', 'paid_promotion', 'all_digital',
          'print', 'broadcast', 'unlimited'
        )
      ),
      
      exclusivity: Joi.object({
        required: Joi.boolean().default(false),
        duration: Joi.object({
          value: Joi.number().min(1),
          unit: Joi.string().valid('days', 'weeks', 'months')
        })
      })
    }),
    
    cancellationPolicy: Joi.string().max(500),
    
    additionalTerms: Joi.array().items(
      Joi.string().max(200)
    ),
    
    validity: Joi.object({
      days: Joi.number().min(7).max(90).default(30)
    })
  }),
  
  notes: Joi.string().max(1000),
  
  tags: Joi.array().items(
    Joi.string().trim().lowercase()
  )
});

/**
 * Schema for updating a rate card
 */
const updateRateCardSchema = Joi.object({
  title: Joi.string().trim().max(100),
  status: Joi.string().valid('draft', 'active', 'archived'),
  creatorMetrics: createRateCardSchema.extract('creatorMetrics'),
  deliverables: createRateCardSchema.extract('deliverables'),
  packages: createRateCardSchema.extract('packages'),
  template: createRateCardSchema.extract('template'),
  terms: createRateCardSchema.extract('terms'),
  notes: Joi.string().max(1000),
  tags: Joi.array().items(Joi.string().trim().lowercase())
}).min(1);

/**
 * Schema for creating a package
 */
const createPackageSchema = Joi.object({
  name: Joi.string().trim().max(50).required(),
  description: Joi.string().max(500),
  
  items: Joi.array().items(
    Joi.object({
      deliverableId: Joi.string().required(),
      quantity: Joi.number().min(1).default(1),
      description: Joi.string()
    })
  ).min(1).required(),
  
  packagePrice: Joi.number().min(0).required(),
  
  validity: Joi.object({
    value: Joi.number().min(1),
    unit: Joi.string().valid('days', 'weeks', 'months').default('days')
  }),
  
  popular: Joi.boolean().default(false),
  active: Joi.boolean().default(true)
});

/**
 * Schema for updating a package
 */
const updatePackageSchema = Joi.object({
  name: Joi.string().trim().max(50),
  description: Joi.string().max(500),
  packagePrice: Joi.number().min(0),
  validity: createPackageSchema.extract('validity'),
  popular: Joi.boolean(),
  active: Joi.boolean()
}).min(1);

/**
 * Schema for AI suggestions request
 */
const aiSuggestionsSchema = Joi.object({
  platforms: Joi.array().items(
    Joi.object({
      name: Joi.string().valid(...platforms).required(),
      followers: Joi.number().min(0).required(),
      engagementRate: Joi.number().min(0).max(100),
      avgViews: Joi.number().min(0),
      verified: Joi.boolean()
    })
  ).min(1).required(),
  
  niche: Joi.string().valid(...niches).required(),
  
  location: Joi.object({
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string().default('India')
  })
});

/**
 * Schema for share options
 */
const shareOptionsSchema = Joi.object({
  expiryDays: Joi.number().min(1).max(90),
  password: Joi.string().min(4).max(20),
  allowDownload: Joi.boolean().default(true)
});

/**
 * Schema for bulk update
 */
const bulkUpdateSchema = Joi.object({
  percentageChange: Joi.number().min(-50).max(100),
  
  platformUpdates: Joi.object().pattern(
    Joi.string().valid(...platforms),
    Joi.number().min(-50).max(100)
  ),
  
  deliverableUpdates: Joi.object().pattern(
    Joi.string(),
    Joi.number().min(-50).max(100)
  ),
  
  applyTo: Joi.string().valid('all', 'active', 'draft').default('active')
}).or('percentageChange', 'platformUpdates', 'deliverableUpdates');

module.exports = {
  createRateCardSchema,
  updateRateCardSchema,
  createPackageSchema,
  updatePackageSchema,
  aiSuggestionsSchema,
  shareOptionsSchema,
  bulkUpdateSchema
};