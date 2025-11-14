//src/modules/scripts/controller.js
/**
 * CreatorsMantra Backend - Content Script Generator Controller
 * API endpoints for script management, AI generation, and video transcription
 *
 * @author CreatorsMantra Team
 * @version 2.0.0
 * @description Script CRUD operations, AI processing, video transcription management
 */

const ScriptGeneratorService = require('./service')
const { Script } = require('./model')
const {
  successResponse,
  errorResponse,
  asyncHandler,
  logInfo,
  logError,
} = require('../../shared/utils')
const { checkMemoryLimits } = require('../../shared/memoryMonitor')

// ============================================
// SCRIPT CREATION CONTROLLERS
// ============================================

/**
 * Create Script from Text Input
 * POST /api/scripts/create-text
 */
const createTextScript = asyncHandler(async (req, res) => {
  const {
    title,
    briefText,
    platform,
    granularityLevel,
    targetDuration,
    customDuration,
    creatorStyleNotes,
    notes,
    tags,
  } = req.body
  const userId = req.user.id

  logInfo('Creating text script', { userId, textLength: briefText?.length })

  const scriptData = {
    title: title.trim(),
    briefText: briefText.trim(),
    platform,
    granularityLevel: granularityLevel || 'detailed',
    targetDuration: targetDuration || '60_seconds',
    customDuration,
    creatorStyleNotes: creatorStyleNotes || '',
    notes: notes || '',
    tags: tags || [],
    subscriptionTier: req.user.subscriptionTier,
  }

  const script = await ScriptGeneratorService.createTextScript(scriptData, userId)

  res.status(201).json(
    successResponse('Text script created successfully', {
      script: {
        id: script._id,
        scriptId: script.scriptId,
        title: script.title,
        status: script.status,
        inputType: script.inputType,
        platform: script.platform,
        aiGenerationStatus: script.aiGeneration.status,
        createdAt: script.createdAt,
      },
    })
  )
})

/**
 * Create Script from File Upload
 * POST /api/scripts/create-file
 */
const createFileScript = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(errorResponse('No file uploaded', null, 400))
  }

  const {
    title,
    platform,
    granularityLevel,
    targetDuration,
    customDuration,
    creatorStyleNotes,
    tags,
  } = req.body
  const userId = req.user.id
  const fileData = {
    ...req.file,
    subscriptionTier: req.user.subscriptionTier,
  }

  logInfo('Creating file script', {
    userId,
    filename: req.file.filename,
    fileSize: req.file.size,
  })

  const scriptData = {
    title: title?.trim() || req.file.originalname,
    platform,
    granularityLevel: granularityLevel || 'detailed',
    targetDuration: targetDuration || '60_seconds',
    customDuration,
    creatorStyleNotes: creatorStyleNotes || '',
    tags: tags || [],
    subscriptionTier: req.user.subscriptionTier,
  }

  const script = await ScriptGeneratorService.createFileScript(fileData, scriptData, userId)

  res.status(201).json(
    successResponse('File script created successfully', {
      script: {
        id: script._id,
        scriptId: script.scriptId,
        title: script.title,
        status: script.status,
        inputType: script.inputType,
        platform: script.platform,
        aiGenerationStatus: script.aiGeneration.status,
        fileName: script.originalContent.uploadedFile.originalName,
        fileSize: script.originalContent.uploadedFile.fileSize,
        createdAt: script.createdAt,
      },
    })
  )
})

// Enhanced video script creation controller
const createVideoScript = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(errorResponse('No video file uploaded', null, 400))
  }

  // Final memory check before processing
  const memoryStatus = checkMemoryLimits()
  if (!memoryStatus.canProcess) {
    // Clean up uploaded file
    const fs = require('fs')
    try {
      fs.unlinkSync(req.file.path)
    } catch (cleanupError) {
      logError('Failed to cleanup file after memory check failure', {
        error: cleanupError.message,
        filePath: req.file.path,
      })
    }

    return res.status(503).json({
      success: false,
      message: 'Server memory capacity exceeded. Please try again later with a smaller file.',
      code: 503,
      memoryStats: memoryStatus.stats,
      retryAfter: 900, // 15 minutes
      timestamp: new Date().toISOString(),
    })
  }

  // Parse JSON fields from multipart form data

  const {
    title,
    platform,
    granularityLevel,
    targetDuration,
    customDuration,
    creatorStyleNotes,
    tags,
    notes,
    dealId,
  } = req.body

  const userId = req.user.id
  const videoData = {
    ...req.file,
    subscriptionTier: req.user.subscriptionTier,
  }

  logInfo('Creating video script with memory management', {
    userId,
    filename: req.file.filename,
    fileSize: req.file.size,
    memoryStats: memoryStatus.stats,
  })

  try {
    const scriptData = {
      title: title?.trim() || req.file.originalname,
      platform,
      granularityLevel: granularityLevel || 'detailed',
      targetDuration: targetDuration || '60_seconds',
      customDuration: customDuration ? parseInt(customDuration) : undefined,
      creatorStyleNotes: creatorStyleNotes || '',
      tags: tags || [],
      notes: notes || '',
      dealId: dealId || undefined,
      subscriptionTier: req.user.subscriptionTier,
    }

    const script = await ScriptGeneratorService.createVideoScript(videoData, scriptData, userId)

    // Success response
    res.status(201).json(
      successResponse('Video script created successfully', {
        script: {
          id: script._id,
          scriptId: script.scriptId,
          title: script.title,
          status: script.status,
          inputType: script.inputType,
          platform: script.platform,
          aiGenerationStatus: script.aiGeneration.status,
          videoFileName: script.originalContent.videoFile.originalName,
          videoFileSize: script.originalContent.videoFile.fileSize,
          createdAt: script.createdAt,
          memoryOptimized: true,
        },
      })
    )
  } catch (error) {
    logError('Video script creation failed', {
      error: error.message,
      userId,
      filename: req.file?.filename,
      fileSize: req.file?.size,
      memoryUsage: process.memoryUsage(),
    })

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      const fs = require('fs')
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        logError('Failed to cleanup file after error', {
          error: cleanupError.message,
          filePath: req.file.path,
        })
      }
    }

    // Force garbage collection on error
    if (global.gc) {
      global.gc()
    }

    // Return appropriate error based on error type
    if (error.message.includes('memory') || error.message.includes('Memory')) {
      return res.status(507).json({
        success: false,
        message: 'Insufficient memory for video processing. Try a smaller file or try again later.',
        code: 507,
        recommendation: 'Use a file smaller than 25MB or try again during off-peak hours',
        timestamp: new Date().toISOString(),
      })
    }

    if (error.message.includes('limit exceeded') || error.message.includes('subscription')) {
      return res.status(403).json({
        success: false,
        message: error.message,
        code: 403,
        upgrade: true,
        timestamp: new Date().toISOString(),
      })
    }

    throw error
  }
})

// ============================================
// SCRIPT RETRIEVAL CONTROLLERS
// ============================================

/**
 * Get Script by ID
 * GET /api/scripts/:scriptId
 */
const getScriptById = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  const script = await ScriptGeneratorService.getScriptById(scriptId, userId)

  // Add computed fields for frontend
  const scriptData = {
    ...script.toObject(),
    estimatedDuration: script.getEstimatedDuration(),
    complexityScore: script.getComplexityScore(),
    isGenerationComplete: script.isGenerationComplete(),
    isReadyForProduction: script.isReadyForProduction(),
    daysOld: script.getDaysOld(),
    scriptAge: script.scriptAge,
    totalScenes: script.totalScenes,
    generationSuccessRate: script.generationSuccessRate,
  }

  res.status(200).json(
    successResponse('Script retrieved successfully', {
      script: scriptData,
    })
  )
})

/**
 * Get User's Scripts with Filtering
 * GET /api/scripts
 */
const getUserScripts = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const filters = {
    status: req.query.status,
    platform: req.query.platform,
    inputType: req.query.inputType,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sortBy: req.query.sortBy || 'createdAt',
    sortOrder: req.query.sortOrder || 'desc',
    search: req.query.search,
  }

  logInfo('Retrieving user scripts', { userId, filters })

  const result = await ScriptGeneratorService.getUserScripts(userId, filters)

  res.status(200).json(successResponse('Scripts retrieved successfully', result))
})

/**
 * Get Scripts by Status
 * GET /api/scripts/status/:status
 */
const getScriptsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params
  const userId = req.user.id

  const scripts = await Script.getByStatus(userId, status)

  // Add computed fields
  const enrichedScripts = scripts.map((script) => ({
    ...script.toObject(),
    estimatedDuration: script.getEstimatedDuration(),
    complexityScore: script.getComplexityScore(),
    isGenerationComplete: script.isGenerationComplete(),
    daysOld: script.getDaysOld(),
  }))

  res.status(200).json(
    successResponse(`Scripts with status '${status}' retrieved`, {
      scripts: enrichedScripts,
      count: enrichedScripts.length,
    })
  )
})

/**
 * Get Dashboard Statistics
 * GET /api/scripts/dashboard/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id

  const stats = await ScriptGeneratorService.getDashboardStats(userId)

  res.status(200).json(
    successResponse('Dashboard statistics retrieved', {
      stats,
    })
  )
})

// ============================================
// SCRIPT UPDATE CONTROLLERS
// ============================================

/**
 * Update Script
 * PATCH /api/scripts/:scriptId
 */
const updateScript = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id
  const updateData = req.body

  logInfo('Updating script', { scriptId, userId, updates: Object.keys(updateData) })

  const updatedScript = await ScriptGeneratorService.updateScript(scriptId, updateData, userId)

  res.status(200).json(
    successResponse('Script updated successfully', {
      script: {
        id: updatedScript._id,
        scriptId: updatedScript.scriptId,
        title: updatedScript.title,
        status: updatedScript.status,
        updatedAt: updatedScript.updatedAt,
      },
    })
  )
})

/**
 * Update Script Status
 * PATCH /api/scripts/:scriptId/status
 */
const updateScriptStatus = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const { status } = req.body
  const userId = req.user.id

  logInfo('Updating script status', { scriptId, newStatus: status })

  const updatedScript = await ScriptGeneratorService.updateScript(scriptId, { status }, userId)

  res.status(200).json(
    successResponse('Script status updated successfully', {
      scriptId: updatedScript.scriptId,
      oldStatus: req.body.oldStatus,
      newStatus: status,
      updatedAt: updatedScript.updatedAt,
    })
  )
})

/**
 * Update Creator Notes
 * PATCH /api/scripts/:scriptId/notes
 */
const updateCreatorNotes = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const { notes } = req.body
  const userId = req.user.id

  const updatedScript = await ScriptGeneratorService.updateScript(
    scriptId,
    { creatorNotes: notes },
    userId
  )

  res.status(200).json(
    successResponse('Creator notes updated successfully', {
      scriptId: updatedScript.scriptId,
      notes: updatedScript.creatorNotes,
    })
  )
})

/**
 * Update Script Tags
 * PATCH /api/scripts/:scriptId/tags
 */
const updateScriptTags = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const { tags } = req.body
  const userId = req.user.id

  const updatedScript = await ScriptGeneratorService.updateScript(scriptId, { tags }, userId)

  res.status(200).json(
    successResponse('Script tags updated successfully', {
      scriptId: updatedScript.scriptId,
      tags: updatedScript.tags,
    })
  )
})

// ============================================
// AI PROCESSING CONTROLLERS
// ============================================

/**
 * Regenerate Script Content
 * POST /api/scripts/:scriptId/regenerate
 */
const regenerateScript = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  logInfo('Regenerating script', { scriptId, userId })

  const script = await ScriptGeneratorService.regenerateScript(scriptId, userId)

  res.status(200).json(
    successResponse('Script regeneration started successfully', {
      scriptId,
      aiGenerationStatus: script.aiGeneration.status,
      message: 'Script regeneration is in progress. Check status for completion.',
    })
  )
})

/**
 * Get AI Generation Status
 * GET /api/scripts/:scriptId/generation-status
 */
const getGenerationStatus = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  const script = await Script.findOne({
    _id: scriptId,
    userId,
    isDeleted: false,
  })

  if (!script) {
    return res.status(404).json(errorResponse('Script not found', null, 404))
  }

  res.status(200).json(
    successResponse('Generation status retrieved', {
      scriptId: script.scriptId,
      status: script.aiGeneration.status,
      isGenerationComplete: script.isGenerationComplete(),
      lastProcessedAt: script.lastProcessedAt,
      processingMetadata: script.aiGeneration.processingMetadata,
      totalScenes: script.totalScenes,
      generationSuccessRate: script.generationSuccessRate,
    })
  )
})

/**
 * Create Script Variation (A/B Testing)
 * POST /api/scripts/:scriptId/variations
 */
const createScriptVariation = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const { type, title, description, changes } = req.body
  const userId = req.user.id

  logInfo('Creating script variation', { scriptId, variationType: type })

  const variationData = {
    type,
    title,
    description,
    changes,
  }

  const updatedScript = await ScriptGeneratorService.createScriptVariation(
    scriptId,
    variationData,
    userId
  )

  res.status(201).json(
    successResponse('Script variation created successfully', {
      scriptId,
      variationType: type,
      totalVariations: updatedScript.aiGeneration.scriptVariations.length,
    })
  )
})

/**
 * Get Script Variations
 * GET /api/scripts/:scriptId/variations
 */
const getScriptVariations = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  const script = await Script.findOne({
    _id: scriptId,
    userId,
    isDeleted: false,
  })

  if (!script) {
    return res.status(404).json(errorResponse('Script not found', null, 404))
  }

  res.status(200).json(
    successResponse('Script variations retrieved', {
      scriptId: script.scriptId,
      variations: script.aiGeneration.scriptVariations || [],
      totalVariations: script.aiGeneration.scriptVariations?.length || 0,
    })
  )
})

// ============================================
// DEAL CONNECTION CONTROLLERS
// ============================================

/**
 * Get Available Deals for Linking
 * GET /api/scripts/available-deals
 */
const getAvailableDeals = asyncHandler(async (req, res) => {
  const userId = req.user.id

  const deals = await ScriptGeneratorService.getAvailableDeals(userId)

  res.status(200).json(
    successResponse('Available deals retrieved', {
      deals,
      count: deals.length,
    })
  )
})

/**
 * Link Script to Deal
 * POST /api/scripts/:scriptId/link-deal/:dealId
 */
const linkScriptToDeal = asyncHandler(async (req, res) => {
  const { scriptId, dealId } = req.params
  const userId = req.user.id

  logInfo('Linking script to deal', { scriptId, dealId, userId })

  const updatedScript = await ScriptGeneratorService.linkScriptToDeal(scriptId, dealId, userId)

  res.status(200).json(
    successResponse('Script linked to deal successfully', {
      scriptId: updatedScript.scriptId,
      dealId: updatedScript.dealConnection.dealId,
      dealTitle: updatedScript.dealConnection.dealTitle,
      brandName: updatedScript.dealConnection.brandName,
      linkedAt: updatedScript.dealConnection.linkedAt,
    })
  )
})

/**
 * Unlink Script from Deal
 * DELETE /api/scripts/:scriptId/unlink-deal
 */
const unlinkScriptFromDeal = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  logInfo('Unlinking script from deal', { scriptId, userId })

  const updatedScript = await ScriptGeneratorService.unlinkScriptFromDeal(scriptId, userId)

  res.status(200).json(
    successResponse('Script unlinked from deal successfully', {
      scriptId: updatedScript.scriptId,
      isLinked: updatedScript.dealConnection.isLinked,
    })
  )
})

// ============================================
// SCRIPT ANALYSIS CONTROLLERS
// ============================================

/**
 * Get Script Analysis Summary
 * GET /api/scripts/:scriptId/analysis
 */
const getScriptAnalysis = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  const script = await Script.findOne({
    _id: scriptId,
    userId,
    isDeleted: false,
  })

  if (!script) {
    return res.status(404).json(errorResponse('Script not found', null, 404))
  }

  const analysis = {
    basicInfo: {
      scriptId: script.scriptId,
      title: script.title,
      status: script.status,
      inputType: script.inputType,
      platform: script.platform,
      createdAt: script.createdAt,
      daysOld: script.getDaysOld(),
    },
    generation: {
      status: script.aiGeneration.status,
      isComplete: script.isGenerationComplete(),
      totalScenes: script.totalScenes,
      estimatedDuration: script.getEstimatedDuration(),
      complexityScore: script.getComplexityScore(),
      confidenceScore: script.aiGeneration.processingMetadata?.confidenceScore || 0,
    },
    content: {
      hasHook: !!script.aiGeneration.generatedScript?.hook?.text,
      scenesCount: script.aiGeneration.generatedScript?.scenes?.length || 0,
      brandMentionsCount: script.aiGeneration.generatedScript?.brandMentions?.length || 0,
      hasCallToAction: !!script.aiGeneration.generatedScript?.callToAction?.primary,
      hashtagsCount: script.aiGeneration.generatedScript?.hashtags?.primary?.length || 0,
    },
    variations: {
      total: script.aiGeneration.scriptVariations?.length || 0,
      types: script.aiGeneration.scriptVariations?.map((v) => v.variationType) || [],
    },
    dealConnection: {
      isLinked: script.dealConnection.isLinked,
      dealTitle: script.dealConnection.dealTitle,
      brandName: script.dealConnection.brandName,
      linkedAt: script.dealConnection.linkedAt,
    },
    performance: {
      viewCount: script.viewCount,
      generationSuccessRate: script.generationSuccessRate,
      timesGenerated: script.usageStats.timesGenerated,
      variationsCreated: script.usageStats.variationsCreated,
    },
  }

  res.status(200).json(
    successResponse('Script analysis retrieved', {
      analysis,
    })
  )
})

/**
 * Get Script Content for Export
 * GET /api/scripts/:scriptId/export
 */
const exportScriptContent = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const { format = 'json' } = req.query
  const userId = req.user.id

  const script = await Script.findOne({
    _id: scriptId,
    userId,
    isDeleted: false,
  })

  if (!script) {
    return res.status(404).json(errorResponse('Script not found', null, 404))
  }

  if (!script.isGenerationComplete()) {
    return res.status(400).json(errorResponse('Script generation not completed', null, 400))
  }

  const exportData = {
    title: script.title,
    platform: script.platform,
    estimatedDuration: script.getEstimatedDuration(),
    script: script.aiGeneration.generatedScript,
    createdAt: script.createdAt,
    dealInfo: script.dealConnection.isLinked
      ? {
          dealTitle: script.dealConnection.dealTitle,
          brandName: script.dealConnection.brandName,
        }
      : null,
  }

  // Format response based on requested format
  if (format === 'text') {
    let textContent = `# ${exportData.title}\n\n`
    textContent += `Platform: ${exportData.platform}\n`
    textContent += `Duration: ${exportData.estimatedDuration} seconds\n\n`

    if (exportData.script.hook) {
      textContent += `## Hook (${exportData.script.hook.duration})\n`
      textContent += `${exportData.script.hook.text}\n\n`
    }

    exportData.script.scenes?.forEach((scene, index) => {
      textContent += `## Scene ${scene.sceneNumber} (${scene.timeframe})\n`
      textContent += `**Visual:** ${scene.visualDescription}\n`
      textContent += `**Dialogue:** ${scene.dialogue}\n`
      textContent += `**Camera:** ${scene.cameraAngle}\n\n`
    })

    if (exportData.script.callToAction) {
      textContent += `## Call to Action\n`
      textContent += `${exportData.script.callToAction.primary}\n\n`
    }

    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${script.scriptId}_script.txt"`)
    return res.send(textContent)
  }

  // Default JSON response
  res.status(200).json(
    successResponse('Script content exported', {
      export: exportData,
    })
  )
})

// ============================================
// UTILITY CONTROLLERS
// ============================================

/**
 * Delete Script
 * DELETE /api/scripts/:scriptId
 */
const deleteScript = asyncHandler(async (req, res) => {
  const { scriptId } = req.params
  const userId = req.user.id

  logInfo('Deleting script', { scriptId, userId })

  await ScriptGeneratorService.deleteScript(scriptId, userId)

  res.status(200).json(
    successResponse('Script deleted successfully', {
      scriptId,
      deletedAt: new Date(),
    })
  )
})

/**
 * Get Script Metadata/Options
 * GET /api/scripts/metadata
 */
const getScriptMetadata = asyncHandler(async (req, res) => {
  const metadata = {
    statuses: [
      { value: 'draft', label: 'Draft', description: 'Recently created, being processed' },
      { value: 'generated', label: 'Generated', description: 'AI script generation completed' },
      { value: 'reviewed', label: 'Reviewed', description: 'Script reviewed by creator' },
      {
        value: 'approved',
        label: 'Approved',
        description: 'Script approved and ready for production',
      },
      { value: 'in_production', label: 'In Production', description: 'Content being created' },
      { value: 'completed', label: 'Completed', description: 'Content created and published' },
    ],
    inputTypes: [
      { value: 'text_brief', label: 'Text Brief', description: 'Manual text input' },
      { value: 'file_upload', label: 'File Upload', description: 'Uploaded document' },
      {
        value: 'video_transcription',
        label: 'Video Transcription',
        description: 'Transcribed from video',
      },
    ],
    platforms: [
      {
        value: 'instagram_reel',
        label: 'Instagram Reel',
        duration: '15-90 seconds',
        aspectRatio: '9:16',
      },
      { value: 'instagram_post', label: 'Instagram Post', duration: 'Static', aspectRatio: '1:1' },
      {
        value: 'instagram_story',
        label: 'Instagram Story',
        duration: '15 seconds',
        aspectRatio: '9:16',
      },
      {
        value: 'youtube_video',
        label: 'YouTube Video',
        duration: 'Up to 60 minutes',
        aspectRatio: '16:9',
      },
      {
        value: 'youtube_shorts',
        label: 'YouTube Shorts',
        duration: '60 seconds',
        aspectRatio: '9:16',
      },
      {
        value: 'linkedin_video',
        label: 'LinkedIn Video',
        duration: 'Up to 10 minutes',
        aspectRatio: '16:9',
      },
      { value: 'linkedin_post', label: 'LinkedIn Post', duration: 'Static', aspectRatio: '1:1' },
      {
        value: 'twitter_post',
        label: 'Twitter Post',
        duration: 'Static/Video',
        aspectRatio: 'Various',
      },
      {
        value: 'facebook_reel',
        label: 'Facebook Reel',
        duration: '15-90 seconds',
        aspectRatio: '9:16',
      },
      {
        value: 'tiktok_video',
        label: 'TikTok Video',
        duration: '15-180 seconds',
        aspectRatio: '9:16',
      },
    ],
    granularityLevels: [
      { value: 'basic', label: 'Basic', description: 'Main content flow and key points' },
      {
        value: 'detailed',
        label: 'Detailed',
        description: 'Scene-by-scene with camera angles and visuals',
      },
      {
        value: 'comprehensive',
        label: 'Comprehensive',
        description: 'Shot-by-shot with complete production details',
      },
    ],
    durations: [
      { value: '15_seconds', label: '15 seconds', platforms: ['instagram_story', 'tiktok_video'] },
      { value: '30_seconds', label: '30 seconds', platforms: ['instagram_reel', 'youtube_shorts'] },
      {
        value: '60_seconds',
        label: '1 minute',
        platforms: ['instagram_reel', 'youtube_shorts', 'tiktok_video'],
      },
      { value: '90_seconds', label: '1.5 minutes', platforms: ['instagram_reel', 'facebook_reel'] },
      { value: '3_minutes', label: '3 minutes', platforms: ['youtube_video', 'linkedin_video'] },
      { value: '5_minutes', label: '5 minutes', platforms: ['youtube_video', 'linkedin_video'] },
      { value: '10_minutes', label: '10 minutes', platforms: ['youtube_video'] },
      { value: 'custom', label: 'Custom Duration', platforms: ['all'] },
    ],
    variationTypes: [
      {
        value: 'hook_variation',
        label: 'Hook Variations',
        description: 'Different opening approaches',
      },
      {
        value: 'cta_variation',
        label: 'CTA Variations',
        description: 'Alternative call-to-actions',
      },
      { value: 'scene_order', label: 'Scene Order', description: 'Different scene arrangements' },
      {
        value: 'brand_integration',
        label: 'Brand Integration',
        description: 'Various brand mention styles',
      },
      {
        value: 'ending_variation',
        label: 'Ending Variations',
        description: 'Different conclusion approaches',
      },
    ],
    subscriptionLimits: {
      starter: {
        maxScriptsPerMonth: 10,
        maxFileSize: '5MB',
        videoTranscription: false,
        abTesting: false,
        trendIntegration: false,
      },
      pro: {
        maxScriptsPerMonth: 25,
        maxFileSize: '10MB',
        videoTranscription: true,
        maxVideoSize: '25MB',
        maxVideosPerMonth: 10,
        abTesting: true,
        trendIntegration: true,
      },
      elite: {
        maxScriptsPerMonth: 'Unlimited',
        maxFileSize: '25MB',
        videoTranscription: true,
        maxVideoSize: '100MB',
        maxVideosPerMonth: 'Unlimited',
        abTesting: true,
        trendIntegration: true,
        advancedFeatures: true,
      },
      agency_starter: {
        maxScriptsPerMonth: 'Unlimited',
        maxFileSize: '25MB',
        videoTranscription: true,
        maxVideoSize: '100MB',
        maxVideosPerMonth: 'Unlimited',
        abTesting: true,
        trendIntegration: true,
        advancedFeatures: true,
      },
      agency_pro: {
        maxScriptsPerMonth: 'Unlimited',
        maxFileSize: '50MB',
        videoTranscription: true,
        maxVideoSize: '200MB',
        maxVideosPerMonth: 'Unlimited',
        abTesting: true,
        trendIntegration: true,
        advancedFeatures: true,
        bulkOperations: true,
      },
    },
  }

  res.status(200).json(
    successResponse('Script metadata retrieved', {
      metadata,
    })
  )
})

/**
 * Search Scripts (Advanced)
 * POST /api/scripts/search
 */
const searchScripts = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { query, filters = {}, page = 1, limit = 20 } = req.body

  logInfo('Advanced script search', { userId, query, filters })

  // Build search criteria
  const searchFilters = {
    ...filters,
    search: query,
    page,
    limit,
  }

  const result = await ScriptGeneratorService.getUserScripts(userId, searchFilters)

  res.status(200).json(
    successResponse('Script search completed', {
      query,
      ...result,
    })
  )
})

/**
 * Bulk Update Scripts
 * PATCH /api/scripts/bulk-update
 */
const bulkUpdateScripts = asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { scriptIds, updateData } = req.body

  logInfo('Bulk updating scripts', { userId, scriptCount: scriptIds.length })

  const updatePromises = scriptIds.map((scriptId) =>
    ScriptGeneratorService.updateScript(scriptId, updateData, userId)
  )

  const results = await Promise.allSettled(updatePromises)

  const successful = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  res.status(200).json(
    successResponse('Bulk update completed', {
      total: scriptIds.length,
      successful,
      failed,
      results: results.map((result, index) => ({
        scriptId: scriptIds[index],
        status: result.status,
        error: result.status === 'rejected' ? result.reason.message : null,
      })),
    })
  )
})

/**
 * Get Scripts Needing Attention
 * GET /api/scripts/attention-required
 */
const getScriptsNeedingAttention = asyncHandler(async (req, res) => {
  const userId = req.user.id

  const scripts = await Script.findScriptsNeedingAttention(userId)

  const enrichedScripts = scripts.map((script) => ({
    id: script._id,
    scriptId: script.scriptId,
    title: script.title,
    status: script.status,
    aiGenerationStatus: script.aiGeneration.status,
    platform: script.platform,
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
    reason: getAttentionReason(script),
    priority: getAttentionPriority(script),
  }))

  res.status(200).json(
    successResponse('Scripts needing attention retrieved', {
      scripts: enrichedScripts,
      count: enrichedScripts.length,
    })
  )
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get reason why script needs attention
 * @param {Object} script - Script object
 * @returns {String} Attention reason
 */
const getAttentionReason = (script) => {
  if (script.aiGeneration.status === 'failed') {
    return 'AI generation failed'
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  if (script.aiGeneration.status === 'processing' && script.updatedAt < tenMinutesAgo) {
    return 'Generation taking too long'
  }

  if (script.status === 'generated') {
    return 'Ready for review'
  }

  return 'Requires attention'
}

/**
 * Get attention priority level
 * @param {Object} script - Script object
 * @returns {String} Priority level
 */
const getAttentionPriority = (script) => {
  if (script.aiGeneration.status === 'failed') {
    return 'high'
  }

  if (script.dealConnection.isLinked) {
    return 'high'
  }

  return 'medium'
}

// ============================================
// EXPORT CONTROLLERS
// ============================================

module.exports = {
  // Script creation
  createTextScript,
  createFileScript,
  createVideoScript,

  // Script retrieval
  getScriptById,
  getUserScripts,
  getScriptsByStatus,
  getDashboardStats,

  // Script updates
  updateScript,
  updateScriptStatus,
  updateCreatorNotes,
  updateScriptTags,

  // AI processing
  regenerateScript,
  getGenerationStatus,
  createScriptVariation,
  getScriptVariations,

  // Deal connection
  getAvailableDeals,
  linkScriptToDeal,
  unlinkScriptFromDeal,

  // Script analysis
  getScriptAnalysis,
  exportScriptContent,

  // Utility endpoints
  deleteScript,
  getScriptMetadata,
  searchScripts,
  bulkUpdateScripts,
  getScriptsNeedingAttention,
}
