//src/modules/scripts/service.js
/**
 * CreatorsMantra Backend - Content Script Generator Service
 * Core business logic for script generation, AI processing, and transcription
 *
 * @author CreatorsMantra Team
 * @version 2.0.0
 * @description Script generation, AI integration, video transcription, and trend analysis
 */

const { Script } = require('./model')
const { Deal } = require('../deals/model')
const { User } = require('../auth/model')
const { successResponse, errorResponse, logInfo, logError, logWarn } = require('../../shared/utils')
const {
  withMemoryManagement,
  canHandleFileSize,
  forceGarbageCollection,
} = require('../../shared/memoryMonitor')
const config = require('../../shared/config')
const OpenAI = require('openai')
const fs = require('fs').promises
const { createReadStream } = require('fs')
const path = require('path')
const PDFParse = require('pdf-parse')
const mammoth = require('mammoth') // For .docx files
const FormData = require('form-data')
const axios = require('axios')

// ============================================
// OPENAI CONFIGURATION
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

class ScriptGeneratorService {
  // ============================================
  // CORE SCRIPT CREATION
  // ============================================

  /**
   * Create Script from Text Brief
   * @param {Object} scriptData - Script creation data
   * @param {String} userId - User ID
   * @returns {Object} Created script
   */
  async createTextScript(scriptData, userId) {
    try {
      logInfo('Creating text script', { userId, textLength: scriptData.briefText?.length })

      // Check subscription limits
      await this.checkSubscriptionLimits(userId, 'create_script')

      const script = new Script({
        userId,
        title: scriptData.title,
        inputType: 'text_brief',
        platform: scriptData.platform,
        granularityLevel: scriptData.granularityLevel || 'detailed',
        targetDuration: scriptData.targetDuration || '60_seconds',
        customDuration: scriptData.customDuration,
        originalContent: {
          briefText: scriptData.briefText.trim(),
        },
        creatorStyleNotes: scriptData.creatorStyleNotes || '',
        subscriptionTier: scriptData.subscriptionTier || 'starter',
        status: 'draft',
        creatorNotes: scriptData.notes || '',
        tags: scriptData.tags || [],
      })

      await script.save()

      logInfo('Text script created successfully', {
        scriptId: script.scriptId,
        userId,
      })

      // Trigger AI generation
      this.processAIGeneration(script._id).catch((error) => {
        logError('AI generation failed for script', {
          scriptId: script._id,
          error: error.message,
        })
      })

      return script
    } catch (error) {
      logError('Error creating text script', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Create Script from File Upload
   * @param {Object} fileData - Uploaded file data
   * @param {Object} scriptData - Script metadata
   * @param {String} userId - User ID
   * @returns {Object} Created script
   */
  async createFileScript(fileData, scriptData, userId) {
    try {
      logInfo('Creating file script', {
        userId,
        filename: fileData.filename,
        fileSize: fileData.size,
      })

      // Check subscription limits
      await this.checkSubscriptionLimits(userId, 'create_script')
      await this.checkFileLimits(userId, fileData.size)

      // Extract text from file
      const extractedText = await this.extractTextFromFile(fileData)

      const script = new Script({
        userId,
        title: scriptData.title,
        inputType: 'file_upload',
        platform: scriptData.platform,
        granularityLevel: scriptData.granularityLevel || 'detailed',
        targetDuration: scriptData.targetDuration || '60_seconds',
        customDuration: scriptData.customDuration,
        originalContent: {
          briefText: extractedText,
          uploadedFile: {
            filename: fileData.filename,
            originalName: fileData.originalname,
            fileSize: fileData.size,
            mimeType: fileData.mimetype,
            uploadPath: fileData.path,
            uploadedAt: new Date(),
          },
        },
        creatorStyleNotes: scriptData.creatorStyleNotes || '',
        subscriptionTier: scriptData.subscriptionTier || 'starter',
        status: 'draft',
        tags: scriptData.tags || [],
      })

      await script.save()

      logInfo('File script created successfully', {
        scriptId: script.scriptId,
        extractedTextLength: extractedText.length,
      })

      // Trigger AI generation
      this.processAIGeneration(script._id).catch((error) => {
        logError('AI generation failed for file script', {
          scriptId: script._id,
          error: error.message,
        })
      })

      return script
    } catch (error) {
      logError('Error creating file script', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Create Script from Video Transcription
   * @param {Object} videoData - Uploaded video data
   * @param {Object} scriptData - Script metadata
   * @param {String} userId - User ID
   * @returns {Object} Created script
   */
  async createVideoScript(videoData, scriptData, userId) {
    try {
      logInfo('Creating video script', {
        userId,
        filename: videoData.filename,
        fileSize: videoData.size,
      })

      // Check subscription limits
      await this.checkSubscriptionLimits(userId, 'create_script')
      await this.checkVideoLimits(userId, videoData.size)

      const script = new Script({
        userId,
        title: scriptData.title,
        inputType: 'video_transcription',
        platform: scriptData.platform,
        granularityLevel: scriptData.granularityLevel || 'detailed',
        targetDuration: scriptData.targetDuration || '60_seconds',
        customDuration: scriptData.customDuration,
        originalContent: {
          videoFile: {
            filename: videoData.filename,
            originalName: videoData.originalname,
            fileSize: videoData.size,
            mimeType: videoData.mimetype,
            uploadPath: videoData.path,
            duration: scriptData.duration, // If provided by frontend
            uploadedAt: new Date(),
          },
        },
        creatorStyleNotes: scriptData.creatorStyleNotes || '',
        subscriptionTier: scriptData.subscriptionTier || 'starter',
        status: 'draft',
        tags: scriptData.tags || [],
      })

      await script.save()

      logInfo('Video script created successfully', {
        scriptId: script.scriptId,
      })

      // Trigger video transcription first, then AI generation
      this.processVideoTranscription(script._id)
        .then(() => {
          return this.processAIGeneration(script._id)
        })
        .catch((error) => {
          logError('Video processing failed for script', {
            scriptId: script._id,
            error: error.message,
          })
        })

      return script
    } catch (error) {
      logError('Error creating video script', { userId, error: error.message })
      throw error
    }
  }

  // ============================================
  // VIDEO TRANSCRIPTION SERVICE
  // ============================================

  /**
   * Enhanced Video Transcription Process with Aggressive Memory Management
   */
  async processVideoTranscription(scriptId) {
    const MAX_RETRIES = 2
    let retryCount = 0
    let script

    try {
      script = await Script.findById(scriptId)
      if (!script) {
        throw new Error('Script not found')
      }

      logInfo('Starting video transcription with memory management', {
        scriptId,
        fileSizeMB: Math.round(script.originalContent.videoFile.fileSize / (1024 * 1024)),
      })

      const videoPath = script.originalContent.videoFile.uploadPath
      const fileSize = script.originalContent.videoFile.fileSize

      // Pre-processing memory validation
      const memoryCheck = canHandleFileSize(fileSize)
      if (!memoryCheck.canHandle) {
        throw new Error(
          `File too large for current memory capacity. ` +
            `File: ${memoryCheck.fileSizeMB}MB, Available: ${memoryCheck.availableHeapMB}MB, ` +
            `Required: ${memoryCheck.requiredMemoryMB}MB`
        )
      }

      // Validate file exists and is accessible
      try {
        await fs.access(videoPath)
      } catch (error) {
        throw new Error('Video file not found or inaccessible')
      }

      let transcriptionResults

      // Enhanced retry logic with exponential backoff and memory cleanup
      while (retryCount <= MAX_RETRIES) {
        try {
          // Wrap transcription in memory management
          transcriptionResults = await withMemoryManagement(
            () => this.performVideoTranscriptionMemoryOptimized(videoPath, fileSize),
            {
              operation: 'video_transcription',
              scriptId,
              attempt: retryCount + 1,
              fileSizeMB: memoryCheck.fileSizeMB,
            }
          )

          break // Success, exit retry loop
        } catch (transcriptionError) {
          retryCount++

          logWarn(`Video transcription attempt ${retryCount} failed`, {
            scriptId,
            error: transcriptionError.message,
            retryCount,
            maxRetries: MAX_RETRIES,
            memoryStats: process.memoryUsage(),
          })

          // Force aggressive cleanup between retries
          forceGarbageCollection()

          if (retryCount > MAX_RETRIES) {
            throw new Error(
              `Video transcription failed after ${MAX_RETRIES} attempts. ` +
                `Last error: ${transcriptionError.message}`
            )
          }

          // Exponential backoff with memory recovery time
          const delay = Math.pow(2, retryCount) * 2000 // 4s, 8s, 16s...
          logInfo(`Waiting ${delay}ms before retry for memory recovery`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      // Update script with transcription results
      script.originalContent.transcription = {
        originalText: transcriptionResults.text,
        cleanedText: this.cleanTranscriptionText(transcriptionResults.text),
        speakerCount: this.estimateSpeakerCount(transcriptionResults.text),
        language: transcriptionResults.language || 'en',
        confidence: transcriptionResults.confidence || 0.85,
        processingTime: transcriptionResults.processingTime,
        transcribedAt: new Date(),
        fileSizeMB: memoryCheck.fileSizeMB,
        retryCount,
      }

      script.originalContent.briefText = script.originalContent.transcription.cleanedText
      await script.save()

      // Aggressive cleanup after successful transcription
      await this.cleanupVideoFileImmediate(videoPath, scriptId)
      forceGarbageCollection()

      logInfo('Video transcription completed successfully with memory management', {
        scriptId,
        processingTime: transcriptionResults.processingTime,
        textLength: transcriptionResults.text.length,
        retryCount,
        finalMemoryMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      })

      return script.originalContent.transcription
    } catch (error) {
      logError('Video transcription failed after all retries', {
        scriptId,
        error: error.message,
        retryCount,
        memoryUsage: process.memoryUsage(),
      })

      // Update script with failure info
      if (script) {
        try {
          await Script.findByIdAndUpdate(scriptId, {
            'originalContent.transcription': {
              processingTime: 0,
              transcribedAt: new Date(),
              originalText: '',
              cleanedText: `Transcription failed: ${error.message}`,
              error: error.message,
              retryCount,
            },
          })
        } catch (updateError) {
          logError('Failed to update script with error info', {
            scriptId,
            updateError: updateError.message,
          })
        }
      }

      // Force cleanup on error
      forceGarbageCollection()
      throw error
    }
  }

  /**
   * Memory-optimized video transcription using streaming approach
   */
  async performVideoTranscriptionMemoryOptimized(videoPath, fileSize) {
    const startTime = Date.now()
    const fileSizeMB = Math.round((fileSize / (1024 * 1024)) * 100) / 100

    try {
      logInfo('Starting memory-optimized video transcription', {
        filePath: path.basename(videoPath),
        fileSizeMB,
        maxFileSizeMB: 100, // Whisper API limit
      })

      // Check file size limits for Whisper API
      if (fileSize > 100 * 1024 * 1024) {
        // 100MB limit
        throw new Error(
          `Video file too large for transcription. Maximum size is 100MB, got ${fileSizeMB}MB.`
        )
      }

      // Create read stream with memory management options
      const videoStream = createReadStream(videoPath, {
        highWaterMark: 64 * 1024, // 64KB chunks instead of default 64KB
        autoClose: true,
      })

      // Handle stream errors
      videoStream.on('error', (streamError) => {
        logError('Video stream error', { error: streamError.message })
        throw new Error(`Video stream error: ${streamError.message}`)
      })

      // Track stream progress for large files
      let bytesRead = 0
      videoStream.on('data', (chunk) => {
        bytesRead += chunk.length
        const progress = Math.round((bytesRead / fileSize) * 100)

        if (progress % 25 === 0) {
          // Log every 25%
          logInfo(`Video streaming progress: ${progress}%`, {
            bytesReadMB: Math.round(bytesRead / (1024 * 1024)),
            totalMB: fileSizeMB,
          })
        }
      })

      // Call Whisper API with optimized settings
      const transcription = await openai.audio.transcriptions.create({
        file: videoStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'], // Use segments instead of words to reduce memory
        language: 'en', // Specify language to improve performance
      })

      // Close stream immediately after use
      videoStream.destroy()

      const processingTime = Date.now() - startTime

      logInfo('Whisper API transcription successful with memory optimization', {
        duration: transcription.duration,
        language: transcription.language,
        processingTime,
        segmentCount: transcription.segments?.length || 0,
      })

      return {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        segments: transcription.segments || [],
        confidence: this.calculateAverageConfidenceFromSegments(transcription.segments),
        processingTime,
      }
    } catch (error) {
      logError('Memory-optimized transcription failed', {
        error: error.message,
        filePath: path.basename(videoPath),
        fileSize: fileSizeMB,
        processingTime: Date.now() - startTime,
      })

      // Handle specific OpenAI errors
      if (error.code === 'file_size_exceeded') {
        throw new Error(`Video file too large for transcription service: ${fileSizeMB}MB`)
      } else if (error.code === 'invalid_request_error') {
        throw new Error('Invalid video format or corrupted file')
      } else if (error.message.includes('timeout')) {
        throw new Error('Transcription service timeout - file may be too complex')
      }

      throw new Error(`Video transcription failed: ${error.message}`)
    }
  }

  /**
   * Calculate average confidence from segments instead of words
   */
  calculateAverageConfidenceFromSegments(segments) {
    if (!segments || segments.length === 0) return 0.8 // Default confidence

    // Segments don't have confidence in Whisper API, so estimate based on other factors
    const avgSegmentLength =
      segments.reduce((sum, seg) => sum + seg.text.length, 0) / segments.length
    const hasLongPauses = segments.some((seg) => seg.end - seg.start > 10) // 10+ second segments

    // Estimate confidence based on segment characteristics
    let confidence = 0.85 // Base confidence

    if (avgSegmentLength < 10) confidence -= 0.1 // Very short segments indicate poor quality
    if (hasLongPauses) confidence -= 0.05 // Long pauses might indicate unclear audio
    if (segments.length < 3) confidence -= 0.1 // Very few segments for the duration

    return Math.max(0.6, Math.min(0.95, confidence)) // Clamp between 60-95%
  }

  /**
   * Immediate cleanup of video file after processing
   */
  async cleanupVideoFileImmediate(videoPath, scriptId) {
    try {
      if (videoPath && (videoPath.includes('/uploads/') || videoPath.includes('\\uploads\\'))) {
        await fs.unlink(videoPath)

        logInfo('Video file cleaned up immediately after transcription', {
          scriptId,
          videoPath: path.basename(videoPath),
        })
      }
    } catch (error) {
      logWarn('Failed to cleanup video file immediately', {
        scriptId,
        videoPath: path.basename(videoPath),
        error: error.message,
      })
    }
  }

  /**
   * Enhanced memory check specifically for video processing
   */
  checkVideoProcessingMemory(fileSize) {
    const usage = process.memoryUsage()
    const fileSizeMB = fileSize / (1024 * 1024)
    const heapUsedMB = usage.heapUsed / (1024 * 1024)
    const heapTotalMB = usage.heapTotal / (1024 * 1024)
    const availableHeapMB = heapTotalMB - heapUsedMB

    // Require minimum memory thresholds for video processing
    const minRequiredMB = Math.max(100, fileSizeMB * 2) // At least 100MB or 2x file size
    const criticalThresholdPercent = 85
    const currentUsagePercent = (heapUsedMB / heapTotalMB) * 100

    const canProcess =
      availableHeapMB >= minRequiredMB && currentUsagePercent < criticalThresholdPercent

    logInfo('Video processing memory check', {
      fileSizeMB: Math.round(fileSizeMB * 100) / 100,
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      availableHeapMB: Math.round(availableHeapMB),
      minRequiredMB: Math.round(minRequiredMB),
      currentUsagePercent: Math.round(currentUsagePercent),
      canProcess,
    })

    return {
      canProcess,
      availableHeapMB: Math.round(availableHeapMB),
      requiredMB: Math.round(minRequiredMB),
      currentUsagePercent: Math.round(currentUsagePercent),
      recommendation: canProcess
        ? 'Memory sufficient for processing'
        : 'Insufficient memory - try smaller file or restart server',
    }
  }

  /**
   * Clean up video file after successful processing
   * @param {String} videoPath - Path to video file
   * @param {String} scriptId - Script ID for logging
   */
  async cleanupVideoFile(videoPath, scriptId) {
    try {
      // Only delete if file is in uploads directory and older than 1 hour
      if (videoPath.includes('/uploads/') || videoPath.includes('\\uploads\\')) {
        const stats = await fs.stat(videoPath)
        const hourAgo = Date.now() - 60 * 60 * 1000

        if (stats.birthtime.getTime() < hourAgo) {
          await fs.unlink(videoPath)
          logInfo('Video file cleaned up after transcription', {
            scriptId,
            videoPath: path.basename(videoPath),
          })
        }
      }
    } catch (error) {
      // Log warning but don't throw - cleanup failure shouldn't stop the process
      logWarn('Failed to cleanup video file', {
        scriptId,
        videoPath: path.basename(videoPath),
        error: error.message,
      })
    }
  }

  /**
   * Memory usage monitoring utility
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage() {
    const usage = process.memoryUsage()
    return {
      heapUsedMB: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsagePercent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
      rssMB: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
    }
  }

  /**
   * Check if system has enough memory for video processing
   * @param {Number} fileSize - File size in bytes
   * @returns {Boolean} Has enough memory
   */
  hasEnoughMemoryForProcessing(fileSize) {
    const memUsage = this.getMemoryUsage()
    const fileSizeMB = fileSize / (1024 * 1024)

    // Require at least 3x file size in available heap memory
    const requiredHeapMB = fileSizeMB * 3
    const availableHeapMB =
      (process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) / (1024 * 1024)

    logInfo('Memory check for video processing', {
      fileSizeMB: Math.round(fileSizeMB * 100) / 100,
      requiredHeapMB: Math.round(requiredHeapMB * 100) / 100,
      availableHeapMB: Math.round(availableHeapMB * 100) / 100,
      currentHeapUsage: `${memUsage.heapUsagePercent}%`,
    })

    return availableHeapMB >= requiredHeapMB
  }

  /**
   * Core Video Transcription Logic using Whisper API with memory optimization
   * @param {String} videoPath - Path to video file
   * @returns {Object} Transcription data
   */
  async performVideoTranscription(videoPath) {
    let fileStats

    try {
      // Check file exists and get stats
      fileStats = await fs.stat(videoPath)

      logInfo('Starting video transcription', {
        filePath: videoPath,
        fileSizeMB: Math.round((fileStats.size / (1024 * 1024)) * 100) / 100,
      })

      // For larger files, use streaming approach
      if (fileStats.size > 50 * 1024 * 1024) {
        // 50MB threshold
        throw new Error('Video file too large. Maximum size is 50MB for transcription.')
      }

      // Use createReadStream instead of loading entire file into memory
      const videoStream = createReadStream(videoPath)

      const transcription = await openai.audio.transcriptions.create({
        file: videoStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      })

      // Clean up stream
      videoStream.destroy()

      logInfo('Whisper API transcription successful', {
        duration: transcription.duration,
        language: transcription.language,
      })

      return {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        words: transcription.words,
        confidence: this.calculateAverageConfidence(transcription.words),
      }
    } catch (error) {
      logError('Whisper API transcription failed', {
        error: error.message,
        filePath: videoPath,
        fileSize: fileStats?.size,
      })
      throw new Error('Video transcription failed: ' + error.message)
    }
  }

  /**
   * Clean and format transcription text
   * @param {String} rawText - Raw transcription text
   * @returns {String} Cleaned text
   */
  cleanTranscriptionText(rawText) {
    if (!rawText) return ''

    return rawText
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n+/g, '\n') // Multiple newlines to single newline
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters except punctuation
      .trim()
  }

  /**
   * Estimate speaker count from transcription
   * @param {String} text - Transcription text
   * @returns {Number} Estimated speaker count
   */
  estimateSpeakerCount(text) {
    // Simple heuristic based on dialogue patterns
    const dialogueIndicators = text.match(/(\bi\b|\byou\b|\bhe\b|\bshe\b|\bthey\b)/gi) || []
    const questionMarks = (text.match(/\?/g) || []).length

    if (questionMarks > 2 && dialogueIndicators.length > 10) {
      return 2 // Likely conversation/interview
    }
    return 1 // Likely monologue
  }

  /**
   * Calculate average confidence from word-level data
   * @param {Array} words - Word-level transcription data
   * @returns {Number} Average confidence score
   */
  calculateAverageConfidence(words) {
    if (!words || words.length === 0) return 0.8 // Default confidence

    const confidences = words.map((word) => word.confidence || 0.8)
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
  }

  // ============================================
  // AI SCRIPT GENERATION
  // ============================================

  // Replace the existing processAIGeneration method with this fixed version

  async processAIGeneration(scriptId) {
    const MAX_RETRIES = 2
    let retryCount = 0

    try {
      const script = await Script.findById(scriptId)
      if (!script) {
        throw new Error('Script not found')
      }

      logInfo('Starting AI script generation', { scriptId })

      // Update status to processing
      script.aiGeneration.status = 'processing'
      await script.save()

      const startTime = Date.now()
      let generationResults

      // Retry logic for AI generation
      while (retryCount <= MAX_RETRIES) {
        try {
          generationResults = await this.performAIGeneration(
            script.originalContent.briefText,
            script.creatorStyleNotes,
            script.platform,
            script.granularityLevel,
            script.getEstimatedDuration()
          )
          break // Success, exit retry loop
        } catch (aiError) {
          retryCount++
          logWarn(`AI generation attempt ${retryCount} failed`, {
            scriptId,
            error: aiError.message,
            retryCount,
            maxRetries: MAX_RETRIES,
          })

          if (retryCount > MAX_RETRIES) {
            throw aiError // Final attempt failed, throw error
          }

          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000 // 2s, 4s, 8s...
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      // Calculate processing metrics
      const processingTime = Date.now() - startTime

      // Initialize scriptVariations as empty array
      let scriptVariations = []

      // Generate A/B variations if enabled
      if (await this.hasABTestingAccess(script.userId)) {
        try {
          scriptVariations = await this.generateABVariations(
            generationResults.script,
            script.platform
          )
        } catch (error) {
          logError('Failed to generate A/B variations', { scriptId, error: error.message })
          scriptVariations = [] // Fallback to empty array
        }
      }

      // Initialize trendIntegration with default values
      let trendIntegration = {
        trendingHashtags: [],
        trendingAudio: [],
        viralElements: [],
        lastUpdated: new Date(),
      }

      // Integrate trending elements if enabled
      if (await this.hasTrendAccess(script.userId)) {
        try {
          trendIntegration = await this.integrateTrendingElements(script.platform)
        } catch (error) {
          logError('Failed to integrate trending elements', { scriptId, error: error.message })
          // Keep default trendIntegration values
        }
      }

      // Update script with AI results - IMPORTANT: Set all fields explicitly
      script.aiGeneration = {
        status: 'completed',
        generatedScript: generationResults.script,
        scriptVariations: scriptVariations,
        trendIntegration: trendIntegration, // Always set this field
        processingMetadata: {
          modelUsed: 'gpt-4',
          tokensUsed: generationResults.tokensUsed || 0,
          processingTime,
          confidenceScore: generationResults.confidenceScore || 85,
          generationVersion: '2.0',
          retryCount,
        },
      }

      // Update overall status
      script.status = 'generated'
      await script.save()

      logInfo('AI script generation completed successfully', {
        scriptId,
        processingTime,
        scenesCount: generationResults.script.scenes.length,
        retryCount,
        hasVariations: scriptVariations.length > 0,
        hasTrendIntegration: await this.hasTrendAccess(script.userId),
      })

      return script.aiGeneration
    } catch (error) {
      logError('AI script generation failed after all retries', {
        scriptId,
        error: error.message,
        retryCount,
      })

      // Update script status to failed with proper structure
      await Script.findByIdAndUpdate(scriptId, {
        'aiGeneration.status': 'failed',
        'aiGeneration.processingMetadata.retryCount': retryCount,
        'aiGeneration.processingMetadata.lastError': error.message,
        // Ensure trendIntegration is always an object
        'aiGeneration.trendIntegration': {
          trendingHashtags: [],
          trendingAudio: [],
          viralElements: [],
          lastUpdated: new Date(),
        },
      })

      throw error
    }
  }
  /**
   * Core AI Script Generation Logic
   * @param {String} briefText - Original brief text
   * @param {String} styleNotes - Creator style preferences
   * @param {String} platform - Target platform
   * @param {String} granularity - Detail level
   * @param {Number} duration - Target duration in seconds
   * @returns {Object} Generated script data
   */
  async performAIGeneration(briefText, styleNotes, platform, granularity, duration) {
    try {
      const prompt = this.buildScriptGenerationPrompt(
        briefText,
        styleNotes,
        platform,
        granularity,
        duration
      )

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert content script writer specializing in social media content for Indian creators. Generate detailed, production-ready scripts that are engaging and platform-optimized.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7, // Balanced creativity and consistency
        max_tokens: 4000,
      })

      const generatedData = JSON.parse(response.choices[0].message.content)

      // Post-process and validate generated script
      const processedScript = this.postProcessScriptResults(generatedData, platform, duration)

      logInfo('AI script generation successful', {
        scenesCount: processedScript.scenes.length,
        brandMentionsCount: processedScript.brandMentions.length,
      })

      return {
        script: processedScript,
        tokensUsed: response.usage.total_tokens,
        confidenceScore: this.calculateScriptQualityScore(processedScript),
      }
    } catch (error) {
      logError('AI script generation API call failed', { error: error.message })
      throw new Error('AI script generation failed: ' + error.message)
    }
  }

  /**
   * Build AI Script Generation Prompt
   * @param {String} briefText - Brief content
   * @param {String} styleNotes - Creator preferences
   * @param {String} platform - Target platform
   * @param {String} granularity - Detail level
   * @param {Number} duration - Duration in seconds
   * @returns {String} Formatted prompt
   */
  buildScriptGenerationPrompt(briefText, styleNotes, platform, granularity, duration) {
    const platformSpecs = this.getPlatformSpecifications(platform)
    const granularityInstructions = this.getGranularityInstructions(granularity)

    return `
Create a detailed content script based on the following brief and creator preferences.

BRIEF CONTENT:
"""
${briefText}
"""

CREATOR STYLE PREFERENCES:
"""
${styleNotes || 'No specific style preferences provided.'}
"""

SCRIPT REQUIREMENTS:
- Platform: ${platform}
- Target Duration: ${duration} seconds
- Aspect Ratio: ${platformSpecs.aspectRatio}
- Key Features: ${platformSpecs.features.join(', ')}

GRANULARITY LEVEL: ${granularity}
${granularityInstructions}

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON with no markdown formatting
- Do NOT wrap JSON in code blocks or backticks
- Do NOT include explanatory text before or after JSON
- Your entire response must be parseable as JSON

Return this EXACT JSON structure with actual content:

{
  "hook": {
    "text": "Compelling opening line to grab attention in first 3 seconds",
    "visualCue": "Description of opening visual",
    "duration": "0-3 seconds",
    "notes": "Why this hook works for the platform"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title/purpose",
      "timeframe": "3-15 seconds",
      "dialogue": "Exact words to be spoken",
      "visualDescription": "What viewers will see",
      "cameraAngle": "Close-up/Wide/Medium shot etc",
      "lighting": "Natural/Studio/Dramatic etc",
      "props": ["prop1", "prop2"],
      "transitions": "How to transition to next scene",
      "notes": "Director notes or tips"
    }
  ],
  "brandMentions": [
    {
      "timing": "at 15 seconds",
      "type": "natural_mention",
      "content": "How to naturally mention the brand",
      "duration": "3-5 seconds",
      "placement": "verbal"
    }
  ],
  "callToAction": {
    "primary": "Main CTA text",
    "secondary": "Optional secondary CTA",
    "placement": "end",
    "visualTreatment": "How CTA appears visually"
  },
  "hashtags": {
    "primary": ["#primaryhashtag1", "#primaryhashtag2"],
    "secondary": ["#secondary1", "#secondary2"],
    "trending": ["#trending1", "#trending2"]
  },
  "mentions": [
    {
      "handle": "@brandhandle",
      "purpose": "Brand mention",
      "timing": "throughout"
    }
  ],
  "audioSuggestions": {
    "musicStyle": "Upbeat/Calm/Trending etc",
    "trendingAudio": "Specific trending sound if applicable",
    "voiceoverNotes": "Tone and pace instructions",
    "soundEffects": ["effect1", "effect2"]
  },
  "textOverlays": [
    {
      "text": "Text to display on screen",
      "timing": "5-8 seconds",
      "style": "Bold/Casual/Animated",
      "position": "center/top/bottom"
    }
  ],
  "alternativeEndings": [
    {
      "description": "Alternative ending option",
      "content": "Different ending script",
      "useCase": "When to use this ending"
    }
  ]
}

PLATFORM-SPECIFIC REQUIREMENTS:
${this.getPlatformSpecificInstructions(platform)}

CONTENT GUIDELINES:
- Optimize for ${platform} audience engagement
- Include natural brand integration
- Ensure script fits ${duration} seconds duration  
- Make content authentic to Indian creator audience
- Include trending elements where appropriate
- Ensure dialogue sounds natural and conversational

Return ONLY the JSON object - no additional text or formatting.
`
  }

  /**
   * Get Platform Specifications
   * @param {String} platform - Platform name
   * @returns {Object} Platform specs
   */
  getPlatformSpecifications(platform) {
    const specs = {
      instagram_reel: {
        aspectRatio: '9:16',
        features: ['music', 'effects', 'text_overlay', 'trending_audio'],
        maxDuration: 90,
      },
      instagram_post: {
        aspectRatio: '1:1',
        features: ['carousel', 'single_image', 'detailed_captions'],
        maxDuration: 0,
      },
      youtube_video: {
        aspectRatio: '16:9',
        features: ['intro', 'outro', 'chapters', 'end_screen'],
        maxDuration: 3600,
      },
      youtube_shorts: {
        aspectRatio: '9:16',
        features: ['music', 'effects', 'quick_cuts', 'trending_sounds'],
        maxDuration: 60,
      },
      linkedin_video: {
        aspectRatio: '16:9',
        features: ['professional_tone', 'captions', 'cta', 'educational'],
        maxDuration: 600,
      },
    }

    return specs[platform] || specs['instagram_reel']
  }

  /**
   * Get Granularity Instructions
   * @param {String} granularity - Detail level
   * @returns {String} Instructions
   */
  getGranularityInstructions(granularity) {
    const instructions = {
      basic: `
        - Focus on main content flow and key talking points
        - Include basic visual descriptions
        - Minimal technical details
        - 3-5 scenes maximum
      `,
      detailed: `
        - Include specific camera angles and lighting suggestions
        - Detailed visual descriptions and prop requirements
        - Scene-by-scene dialogue breakdown
        - Transition suggestions between scenes
        - 5-8 scenes with comprehensive coverage
      `,
      comprehensive: `
        - Shot-by-shot breakdown with precise timing
        - Detailed camera work (angles, movements, focus)
        - Lighting and technical specifications
        - Complete prop and costume requirements  
        - Alternative scene variations
        - Director notes and production tips
        - 8+ scenes with exhaustive detail
      `,
    }

    return instructions[granularity] || instructions['detailed']
  }

  /**
   * Get Platform-Specific Instructions
   * @param {String} platform - Platform name
   * @returns {String} Specific instructions
   */
  getPlatformSpecificInstructions(platform) {
    const instructions = {
      instagram_reel:
        'Focus on quick cuts, trending audio, vertical format optimization, and high visual impact',
      instagram_post:
        'Emphasize strong static visuals or carousel storytelling with detailed captions',
      youtube_video:
        'Include proper intro/outro, maintain viewer retention, optimize for watch time',
      youtube_shorts: 'Quick hook, fast-paced content, trending elements, maximum engagement',
      linkedin_video:
        'Professional tone, educational value, clear business message, subtle branding',
    }

    return instructions[platform] || instructions['instagram_reel']
  }

  /**
   * Post-process AI Script Results
   * @param {Object} rawScript - Raw AI generated script
   * @param {String} platform - Target platform
   * @param {Number} duration - Target duration
   * @returns {Object} Processed script
   */
  postProcessScriptResults(rawScript, platform, duration) {
    try {
      // Ensure required structure exists
      const processedScript = {
        hook: rawScript.hook || {
          text: 'Engaging hook needed',
          visualCue: 'Visual description needed',
          duration: '0-3 seconds',
          notes: 'Hook optimization needed',
        },
        scenes: this.validateScenes(rawScript.scenes || [], duration),
        brandMentions: rawScript.brandMentions || [],
        callToAction: rawScript.callToAction || {
          primary: 'CTA needed',
          placement: 'end',
          visualTreatment: 'Text overlay',
        },
        hashtags: rawScript.hashtags || { primary: [], secondary: [], trending: [] },
        mentions: rawScript.mentions || [],
        audioSuggestions: rawScript.audioSuggestions || {
          musicStyle: 'Upbeat',
          voiceoverNotes: 'Clear and engaging',
        },
        textOverlays: rawScript.textOverlays || [],
        alternativeEndings: rawScript.alternativeEndings || [],
      }

      // Platform-specific post-processing
      this.applyPlatformOptimizations(processedScript, platform)

      return processedScript
    } catch (error) {
      logError('Error post-processing script results', { error: error.message })

      // Return minimal valid structure if processing fails
      return this.getMinimalScriptStructure(duration)
    }
  }

  /**
   * Validate and process scenes array
   * @param {Array} scenes - Raw scenes array
   * @param {Number} duration - Target duration
   * @returns {Array} Validated scenes
   */
  validateScenes(scenes, duration) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      // Create default scenes based on duration
      return this.createDefaultScenes(duration)
    }

    return scenes.map((scene, index) => ({
      sceneNumber: scene.sceneNumber || index + 1,
      title: scene.title || `Scene ${index + 1}`,
      timeframe: scene.timeframe || `${index * 10}-${(index + 1) * 10} seconds`,
      dialogue: scene.dialogue || 'Dialogue needed',
      visualDescription: scene.visualDescription || 'Visual description needed',
      cameraAngle: scene.cameraAngle || 'Medium shot',
      lighting: scene.lighting || 'Natural',
      props: Array.isArray(scene.props) ? scene.props : [],
      transitions: scene.transitions || 'Cut to next scene',
      notes: scene.notes || '',
    }))
  }

  /**
   * Create default scenes for given duration
   * @param {Number} duration - Duration in seconds
   * @returns {Array} Default scenes
   */
  createDefaultScenes(duration) {
    const sceneCount = Math.max(3, Math.min(8, Math.floor(duration / 15)))
    const sceneDuration = Math.floor(duration / sceneCount)

    const scenes = []
    for (let i = 0; i < sceneCount; i++) {
      const startTime = i * sceneDuration
      const endTime = Math.min((i + 1) * sceneDuration, duration)

      scenes.push({
        sceneNumber: i + 1,
        title: `Scene ${i + 1}`,
        timeframe: `${startTime}-${endTime} seconds`,
        dialogue: 'Content dialogue needed',
        visualDescription: 'Visual description needed',
        cameraAngle: 'Medium shot',
        lighting: 'Natural',
        props: [],
        transitions: i < sceneCount - 1 ? 'Cut to next scene' : 'End with CTA',
        notes: '',
      })
    }

    return scenes
  }

  /**
   * Apply platform-specific optimizations
   * @param {Object} script - Script object
   * @param {String} platform - Platform name
   */
  applyPlatformOptimizations(script, platform) {
    switch (platform) {
      case 'instagram_reel':
      case 'youtube_shorts':
        // Optimize for vertical video engagement
        if (script.scenes.length > 0) {
          script.scenes[0].cameraAngle = 'Close-up' // Strong opening
        }
        break

      case 'youtube_video':
        // Add intro/outro structure
        if (script.scenes.length > 2) {
          script.scenes[0].notes = 'Channel intro and video preview'
          script.scenes[script.scenes.length - 1].notes = 'End screen and subscribe CTA'
        }
        break

      case 'linkedin_video':
        // Professional optimization
        script.audioSuggestions.musicStyle = 'Professional/Minimal'
        break
    }
  }

  /**
   * Get minimal script structure for fallback
   * @param {Number} duration - Target duration
   * @returns {Object} Minimal script
   */
  getMinimalScriptStructure(duration) {
    return {
      hook: {
        text: 'AI processing failed - manual script needed',
        visualCue: 'Opening visual needed',
        duration: '0-3 seconds',
        notes: 'Manual optimization required',
      },
      scenes: this.createDefaultScenes(duration),
      brandMentions: [],
      callToAction: { primary: 'Manual CTA needed', placement: 'end' },
      hashtags: { primary: [], secondary: [], trending: [] },
      mentions: [],
      audioSuggestions: { musicStyle: 'TBD', voiceoverNotes: 'Manual planning needed' },
      textOverlays: [],
      alternativeEndings: [],
    }
  }

  /**
   * Calculate script quality score
   * @param {Object} script - Generated script
   * @returns {Number} Quality score 0-100
   */
  calculateScriptQualityScore(script) {
    let score = 0

    // Hook quality (20 points)
    if (script.hook && script.hook.text && script.hook.text.length > 10) score += 20

    // Scenes completeness (30 points)
    if (script.scenes && script.scenes.length >= 3) {
      score += 20
      if (script.scenes.every((scene) => scene.dialogue && scene.visualDescription)) score += 10
    }

    // Brand integration (20 points)
    if (script.brandMentions && script.brandMentions.length > 0) score += 20

    // CTA presence (15 points)
    if (script.callToAction && script.callToAction.primary) score += 15

    // Social elements (15 points)
    if (script.hashtags && script.hashtags.primary && script.hashtags.primary.length > 0)
      score += 10
    if (script.mentions && script.mentions.length > 0) score += 5

    return Math.min(score, 100)
  }

  // ============================================
  // A/B TESTING VARIATIONS
  // ============================================

  async generateABVariations(originalScript, platform) {
    try {
      if (!originalScript || typeof originalScript !== 'object') {
        logWarn('Invalid original script provided for A/B variations')
        return []
      }

      const variations = []

      // Hook variations - only if hook exists
      if (originalScript.hook && originalScript.hook.text) {
        const hookVariations = await this.generateHookVariations(originalScript.hook, platform)
        variations.push(...hookVariations)
      }

      // CTA variations - only if CTA exists
      if (originalScript.callToAction && originalScript.callToAction.primary) {
        const ctaVariations = await this.generateCTAVariations(
          originalScript.callToAction,
          platform
        )
        variations.push(...ctaVariations)
      }

      // Brand mention variations - only if brand mentions exist
      if (originalScript.brandMentions && originalScript.brandMentions.length > 0) {
        const brandVariations = await this.generateBrandMentionVariations(
          originalScript.brandMentions
        )
        variations.push(...brandVariations)
      }

      logInfo('A/B variations generated successfully', {
        variationsCount: variations.length,
        platform,
      })

      return variations.slice(0, 6) // Limit to 6 variations max
    } catch (error) {
      logError('Error generating A/B variations', { error: error.message, platform })
      return [] // Return empty array instead of throwing
    }
  }

  /**
   * Generate hook variations
   * @param {Object} originalHook - Original hook
   * @param {String} platform - Target platform
   * @returns {Array} Hook variations
   */
  async generateHookVariations(originalHook, platform) {
    const variations = [
      {
        variationType: 'hook_variation',
        title: 'Question Hook',
        description: 'Start with engaging question',
        changes: {
          hook: {
            ...originalHook,
            text: this.convertToQuestionHook(originalHook.text),
            notes: 'Question-based hook for engagement',
          },
        },
      },
      {
        variationType: 'hook_variation',
        title: 'Stat Hook',
        description: 'Start with surprising statistic',
        changes: {
          hook: {
            ...originalHook,
            text: this.convertToStatHook(originalHook.text),
            notes: 'Statistic-based hook for credibility',
          },
        },
      },
      {
        variationType: 'hook_variation',
        title: 'Story Hook',
        description: 'Start with personal story',
        changes: {
          hook: {
            ...originalHook,
            text: this.convertToStoryHook(originalHook.text),
            notes: 'Story-based hook for emotional connection',
          },
        },
      },
    ]

    return variations
  }

  /**
   * Generate CTA variations
   * @param {Object} originalCTA - Original call to action
   * @param {String} platform - Target platform
   * @returns {Array} CTA variations
   */
  async generateCTAVariations(originalCTA, platform) {
    return [
      {
        variationType: 'cta_variation',
        title: 'Urgent CTA',
        description: 'Create urgency in call-to-action',
        changes: {
          callToAction: {
            ...originalCTA,
            primary: this.convertToUrgentCTA(originalCTA.primary),
            visualTreatment: 'Bold text with timer animation',
          },
        },
      },
      {
        variationType: 'cta_variation',
        title: 'Social Proof CTA',
        description: 'Include social proof in CTA',
        changes: {
          callToAction: {
            ...originalCTA,
            primary: this.convertToSocialProofCTA(originalCTA.primary),
            secondary: 'Join thousands of satisfied customers',
          },
        },
      },
    ]
  }

  /**
   * Generate brand mention variations
   * @param {Array} originalMentions - Original brand mentions
   * @returns {Array} Brand mention variations
   */
  async generateBrandMentionVariations(originalMentions) {
    return [
      {
        variationType: 'brand_integration',
        title: 'Subtle Integration',
        description: 'More natural brand integration',
        changes: {
          brandMentions: originalMentions.map((mention) => ({
            ...mention,
            type: 'natural_mention',
            content: this.makeMoreSubtle(mention.content),
          })),
        },
      },
    ]
  }

  // Helper methods for A/B variations
  convertToQuestionHook(originalText) {
    return `Have you ever wondered ${originalText.toLowerCase()}?`
  }

  convertToStatHook(originalText) {
    return `Did you know that 90% of people ${originalText.toLowerCase()}?`
  }

  convertToStoryHook(originalText) {
    return `Last week, something amazing happened that changed how I think about ${originalText.toLowerCase()}`
  }

  convertToUrgentCTA(originalCTA) {
    return `${originalCTA} - Limited time offer!`
  }

  convertToSocialProofCTA(originalCTA) {
    return `${originalCTA} (Loved by 10K+ creators)`
  }

  makeMoreSubtle(originalContent) {
    return originalContent.replace(/check out|buy now|click here/gi, 'discover')
  }

  // ============================================
  // TREND INTEGRATION
  // ============================================

  /**
   * Integrate Trending Elements
   * @param {String} platform - Target platform
   * @returns {Object} Trend integration data
   */
  async integrateTrendingElements(platform) {
    try {
      const [trendingHashtags, trendingAudio, viralElements] = await Promise.all([
        this.getTrendingHashtags(platform),
        this.getTrendingAudio(platform),
        this.getViralElements(platform),
      ])

      return {
        trendingHashtags,
        trendingAudio,
        viralElements,
        lastUpdated: new Date(),
      }
    } catch (error) {
      logError('Error integrating trending elements', { error: error.message })
      return {
        trendingHashtags: [],
        trendingAudio: [],
        viralElements: [],
        lastUpdated: new Date(),
      }
    }
  }

  /**
   * Get trending hashtags for platform
   * @param {String} platform - Target platform
   * @returns {Array} Trending hashtags
   */
  async getTrendingHashtags(platform) {
    try {
      // This would integrate with actual trend APIs
      // For now, returning sample trending hashtags
      const platformTrends = {
        instagram_reel: [
          { hashtag: '#trending', trendScore: 95, platform: 'instagram', category: 'general' },
          { hashtag: '#viral', trendScore: 90, platform: 'instagram', category: 'general' },
          { hashtag: '#reels', trendScore: 85, platform: 'instagram', category: 'platform' },
        ],
        youtube_shorts: [
          { hashtag: '#shorts', trendScore: 98, platform: 'youtube', category: 'platform' },
          { hashtag: '#trending', trendScore: 92, platform: 'youtube', category: 'general' },
          { hashtag: '#viral', trendScore: 88, platform: 'youtube', category: 'general' },
        ],
      }

      return platformTrends[platform] || platformTrends['instagram_reel']
    } catch (error) {
      logError('Error fetching trending hashtags', { error: error.message })
      return []
    }
  }

  /**
   * Get trending audio for platform
   * @param {String} platform - Target platform
   * @returns {Array} Trending audio
   */
  async getTrendingAudio(platform) {
    try {
      // Sample trending audio data
      return [
        {
          title: 'Trending Sound #1',
          artist: 'Popular Artist',
          platform: platform,
          usage: 'Perfect for upbeat content',
        },
        {
          title: 'Viral Audio Track',
          artist: 'Trending Creator',
          platform: platform,
          usage: 'Great for storytelling',
        },
      ]
    } catch (error) {
      logError('Error fetching trending audio', { error: error.message })
      return []
    }
  }

  /**
   * Get viral content elements
   * @param {String} platform - Target platform
   * @returns {Array} Viral elements
   */
  async getViralElements(platform) {
    try {
      return [
        {
          element: 'Quick Transitions',
          description: 'Fast-paced scene transitions',
          howToUse: 'Use between scenes for engagement',
        },
        {
          element: 'Text Overlays',
          description: 'Bold text animations',
          howToUse: 'Highlight key points visually',
        },
      ]
    } catch (error) {
      logError('Error fetching viral elements', { error: error.message })
      return []
    }
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Get Script by ID
   * @param {String} scriptId - Script ID
   * @param {String} userId - User ID
   * @returns {Object} Script data
   */
  async getScriptById(scriptId, userId) {
    try {
      const script = await Script.findOne({
        _id: scriptId,
        userId,
        isDeleted: false,
      })

      if (!script) {
        throw new Error('Script not found')
      }

      // Increment view count
      script.viewCount += 1
      await script.save()

      logInfo('Script retrieved successfully', { scriptId, userId })

      return script
    } catch (error) {
      logError('Error retrieving script', { scriptId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Get User's Scripts with Filtering
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Paginated scripts
   */
  async getUserScripts(userId, filters = {}) {
    try {
      const {
        status,
        platform,
        inputType,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
      } = filters

      // Build query
      const query = {
        userId,
        isDeleted: false,
      }

      if (status && status !== 'all') query.status = status
      if (platform && platform !== 'all') query.platform = platform
      if (inputType && inputType !== 'all') query.inputType = inputType

      // Add search functionality
      if (search && search.trim() !== '') {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { 'originalContent.briefText': { $regex: search, $options: 'i' } },
          { creatorStyleNotes: { $regex: search, $options: 'i' } },
          { creatorNotes: { $regex: search, $options: 'i' } },
          { 'dealConnection.brandName': { $regex: search, $options: 'i' } },
        ]
      }

      // Execute query with pagination
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
      const skip = (page - 1) * limit

      const [scripts, total] = await Promise.all([
        Script.find(query).sort(sort).skip(skip).limit(limit).lean(),
        Script.countDocuments(query),
      ])

      // Add computed fields
      const enrichedScripts = scripts.map((script) => ({
        ...script,
        estimatedDuration: this.calculateEstimatedDuration(script),
        complexityScore: this.calculateComplexityFromData(script),
        daysOld: Math.floor(
          (Date.now() - new Date(script.createdAt).getTime()) / (24 * 60 * 60 * 1000)
        ),
      }))

      logInfo('User scripts retrieved', {
        userId,
        count: scripts.length,
        total,
        filters,
      })

      return {
        scripts: enrichedScripts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      }
    } catch (error) {
      logError('Error retrieving user scripts', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Update Script
   * @param {String} scriptId - Script ID
   * @param {Object} updateData - Update data
   * @param {String} userId - User ID
   * @returns {Object} Updated script
   */
  async updateScript(scriptId, updateData, userId) {
    try {
      const script = await Script.findOne({
        _id: scriptId,
        userId,
        isDeleted: false,
      })

      if (!script) {
        throw new Error('Script not found')
      }

      // Update allowed fields
      const allowedUpdates = [
        'title',
        'creatorStyleNotes',
        'tags',
        'status',
        'creatorNotes',
        'granularityLevel',
        'targetDuration',
        'customDuration',
      ]

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          script[key] = updateData[key]
        }
      })

      await script.save()

      logInfo('Script updated successfully', { scriptId, userId, updates: Object.keys(updateData) })

      return script
    } catch (error) {
      logError('Error updating script', { scriptId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Delete Script (Soft Delete)
   * @param {String} scriptId - Script ID
   * @param {String} userId - User ID
   * @returns {Boolean} Success status
   */
  async deleteScript(scriptId, userId) {
    try {
      const script = await Script.findOne({
        _id: scriptId,
        userId,
        isDeleted: false,
      })

      if (!script) {
        throw new Error('Script not found')
      }

      script.isDeleted = true
      script.deletedAt = new Date()
      await script.save()

      logInfo('Script deleted successfully', { scriptId, userId })

      return true
    } catch (error) {
      logError('Error deleting script', { scriptId, userId, error: error.message })
      throw error
    }
  }

  // ============================================
  // DEAL CONNECTION MANAGEMENT
  // ============================================

  /**
   * Link Script to Deal
   * @param {String} scriptId - Script ID
   * @param {String} dealId - Deal ID
   * @param {String} userId - User ID
   * @returns {Object} Updated script
   */
  async linkScriptToDeal(scriptId, dealId, userId) {
    try {
      const [script, deal] = await Promise.all([
        Script.findOne({ _id: scriptId, userId, isDeleted: false }),
        Deal.findOne({ _id: dealId, userId }),
      ])

      if (!script) {
        throw new Error('Script not found')
      }

      if (!deal) {
        throw new Error('Deal not found')
      }

      script.dealConnection = {
        isLinked: true,
        dealId: deal._id,
        dealTitle: deal.title,
        brandName: deal.brand.name,
        linkedAt: new Date(),
        linkedBy: userId,
      }

      await script.save()

      logInfo('Script linked to deal successfully', { scriptId, dealId, userId })

      return script
    } catch (error) {
      logError('Error linking script to deal', { scriptId, dealId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Unlink Script from Deal
   * @param {String} scriptId - Script ID
   * @param {String} userId - User ID
   * @returns {Object} Updated script
   */
  async unlinkScriptFromDeal(scriptId, userId) {
    try {
      const script = await Script.findOne({
        _id: scriptId,
        userId,
        isDeleted: false,
      })

      if (!script) {
        throw new Error('Script not found')
      }

      script.dealConnection = {
        isLinked: false,
        dealId: null,
        dealTitle: '',
        brandName: '',
        linkedAt: null,
        linkedBy: null,
      }

      await script.save()

      logInfo('Script unlinked from deal successfully', { scriptId, userId })

      return script
    } catch (error) {
      logError('Error unlinking script from deal', { scriptId, userId, error: error.message })
      throw error
    }
  }

  // Update your getAvailableDeals method in service.js

  /**
   * Get Available Deals for Linking
   * @param {String} userId - User ID
   * @returns {Array} Available deals
   */
  async getAvailableDeals(userId) {
    try {
      const deals = await Deal.find({
        userId,
        status: 'active',
        stage: { $in: ['pitched', 'in_talks', 'negotiating', 'live'] },
      })
        .select('title brand.name brand.companyName stage createdAt') // Add more specific fields
        .lean() // Use lean() to get plain objects instead of Mongoose documents
        .sort({ createdAt: -1 })

      // Transform the data to ensure safe structure
      const safeDeals = deals.map((deal) => ({
        _id: deal._id,
        title: deal.title || 'Untitled Deal',
        brandName: deal.brand?.name || deal.brand?.companyName || 'Unknown Brand',
        stage: deal.stage,
        createdAt: deal.createdAt,
      }))

      logInfo('Available deals retrieved successfully', {
        userId,
        dealCount: safeDeals.length,
      })

      return safeDeals
    } catch (error) {
      logError('Error getting available deals', { userId, error: error.message })

      // Return empty array instead of throwing to prevent cascade failures
      return []
    }
  }

  // ============================================
  // FILE PROCESSING
  // ============================================

  /**
   * Extract Text from Uploaded File
   * @param {Object} fileData - File data
   * @returns {String} Extracted text
   */
  async extractTextFromFile(fileData) {
    try {
      const filePath = fileData.path
      const mimeType = fileData.mimetype

      let extractedText = ''

      if (mimeType === 'application/pdf') {
        // Extract from PDF
        const fileBuffer = await fs.readFile(filePath)
        const pdfData = await PDFParse(fileBuffer)
        extractedText = pdfData.text
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        // Extract from DOCX
        const result = await mammoth.extractRawText({ path: filePath })
        extractedText = result.value
      } else if (mimeType === 'text/plain') {
        // Extract from TXT
        extractedText = await fs.readFile(filePath, 'utf8')
      } else {
        throw new Error('Unsupported file type')
      }

      // Clean and validate extracted text
      extractedText = extractedText.trim()
      if (extractedText.length === 0) {
        throw new Error('No text content found in file')
      }

      logInfo('Text extracted from file successfully', {
        filename: fileData.filename,
        textLength: extractedText.length,
      })

      return extractedText
    } catch (error) {
      logError('Error extracting text from file', {
        filename: fileData.filename,
        error: error.message,
      })
      throw new Error('Failed to extract text from file: ' + error.message)
    }
  }

  // ============================================
  // SUBSCRIPTION & LIMITS
  // ============================================

  /**
   * Check Subscription Limits for Script Creation
   * @param {String} userId - User ID
   * @param {String} action - Action type
   * @returns {Boolean} Within limits
   */
  async checkSubscriptionLimits(userId, action) {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      const limits = Script.getSubscriptionLimits(user.subscriptionTier)

      if (action === 'create_script' && limits.maxScriptsPerMonth !== -1) {
        // Check monthly script limit
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const scriptsThisMonth = await Script.countDocuments({
          userId,
          createdAt: { $gte: startOfMonth },
          isDeleted: false,
        })

        if (scriptsThisMonth >= limits.maxScriptsPerMonth) {
          throw new Error(`Monthly script limit exceeded. Upgrade to create more scripts.`)
        }
      }

      return true
    } catch (error) {
      logError('Subscription limit check failed', { userId, action, error: error.message })
      throw error
    }
  }

  /**
   * Check File Upload Limits
   * @param {String} userId - User ID
   * @param {Number} fileSize - File size in bytes
   * @returns {Boolean} Within limits
   */
  async checkFileLimits(userId, fileSize) {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      const limits = Script.getSubscriptionLimits(user.subscriptionTier)

      if (fileSize > limits.maxFileSize) {
        const maxSizeMB = Math.round(limits.maxFileSize / (1024 * 1024))
        throw new Error(
          `File size exceeds limit of ${maxSizeMB}MB for ${user.subscriptionTier} plan`
        )
      }

      return true
    } catch (error) {
      logError('File limit check failed', { userId, fileSize, error: error.message })
      throw error
    }
  }

  /**
   * Check Video Upload Limits
   * @param {String} userId - User ID
   * @param {Number} fileSize - File size in bytes
   * @returns {Boolean} Within limits
   */
  async checkVideoLimits(userId, fileSize) {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      const limits = Script.getSubscriptionLimits(user.subscriptionTier)

      if (!limits.videoTranscription) {
        throw new Error('Video transcription not available in your subscription tier')
      }

      if (fileSize > limits.maxVideoSize) {
        const maxSizeMB = Math.round(limits.maxVideoSize / (1024 * 1024))
        throw new Error(
          `Video size exceeds limit of ${maxSizeMB}MB for ${user.subscriptionTier} plan`
        )
      }

      // Check monthly video limit
      if (limits.maxVideosPerMonth !== -1) {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const videosThisMonth = await Script.countDocuments({
          userId,
          inputType: 'video_transcription',
          createdAt: { $gte: startOfMonth },
          isDeleted: false,
        })

        if (videosThisMonth >= limits.maxVideosPerMonth) {
          throw new Error(`Monthly video limit exceeded. Upgrade to process more videos.`)
        }
      }

      return true
    } catch (error) {
      logError('Video limit check failed', { userId, fileSize, error: error.message })
      throw error
    }
  }

  /**
   * Check if User has A/B Testing Access
   * @param {String} userId - User ID
   * @returns {Boolean} Has access
   */
  async hasABTestingAccess(userId) {
    try {
      const user = await User.findById(userId)
      if (!user) return false

      const limits = Script.getSubscriptionLimits(user.subscriptionTier)
      return limits.abTesting
    } catch (error) {
      logError('Error checking A/B testing access', { userId, error: error.message })
      return false
    }
  }

  /**
   * Check if User has Trend Integration Access
   * @param {String} userId - User ID
   * @returns {Boolean} Has access
   */
  async hasTrendAccess(userId) {
    try {
      const user = await User.findById(userId)
      if (!user) return false

      const limits = Script.getSubscriptionLimits(user.subscriptionTier)
      return limits.trendIntegration
    } catch (error) {
      logError('Error checking trend access', { userId, error: error.message })
      return false
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Calculate estimated duration from script data
   * @param {Object} script - Script object
   * @returns {Number} Duration in seconds
   */
  calculateEstimatedDuration(script) {
    if (script.customDuration) return script.customDuration

    const durationMap = {
      '15_seconds': 15,
      '30_seconds': 30,
      '60_seconds': 60,
      '90_seconds': 90,
      '3_minutes': 180,
      '5_minutes': 300,
      '10_minutes': 600,
    }

    return durationMap[script.targetDuration] || 60
  }

  /**
   * Calculate complexity score from script data
   * @param {Object} script - Script object
   * @returns {Number} Complexity score
   */
  calculateComplexityFromData(script) {
    if (!script.aiGeneration?.generatedScript) return 0

    let score = 0
    const generatedScript = script.aiGeneration.generatedScript

    // Base score from scenes
    if (generatedScript.scenes) score += generatedScript.scenes.length * 10

    // Brand mentions complexity
    if (generatedScript.brandMentions) score += generatedScript.brandMentions.length * 5

    // Visual elements
    if (generatedScript.textOverlays) score += generatedScript.textOverlays.length * 3
    if (generatedScript.audioSuggestions) score += 10

    // Variations
    if (script.aiGeneration.scriptVariations)
      score += script.aiGeneration.scriptVariations.length * 15

    return Math.min(score, 100)
  }

  /**
   * Get Dashboard Statistics
   * @param {String} userId - User ID
   * @returns {Object} Dashboard stats
   */
  async getDashboardStats(userId) {
    try {
      const [
        totalScripts,
        generatedScripts,
        linkedToDeals,
        completedScripts,
        thisMonthScripts,
        averageComplexity,
      ] = await Promise.all([
        Script.countDocuments({ userId, isDeleted: false }),
        Script.countDocuments({ userId, 'aiGeneration.status': 'completed', isDeleted: false }),
        Script.countDocuments({ userId, 'dealConnection.isLinked': true, isDeleted: false }),
        Script.countDocuments({ userId, status: 'completed', isDeleted: false }),
        Script.countDocuments({
          userId,
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
          isDeleted: false,
        }),
        this.getAverageComplexityScore(userId),
      ])

      return {
        totalScripts,
        generatedScripts,
        linkedToDeals,
        completedScripts,
        thisMonthScripts,
        averageComplexity,
        generationRate: totalScripts > 0 ? Math.round((generatedScripts / totalScripts) * 100) : 0,
        dealConnectionRate:
          generatedScripts > 0 ? Math.round((linkedToDeals / generatedScripts) * 100) : 0,
      }
    } catch (error) {
      logError('Error getting dashboard stats', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Get average complexity score
   * @param {String} userId - User ID
   * @returns {Number} Average complexity score
   */
  async getAverageComplexityScore(userId) {
    try {
      const scripts = await Script.find({
        userId,
        'aiGeneration.status': 'completed',
        isDeleted: false,
      }).lean()

      if (scripts.length === 0) return 0

      const complexityScores = scripts.map((script) => this.calculateComplexityFromData(script))
      return Math.round(
        complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length
      )
    } catch (error) {
      logError('Error calculating average complexity', { userId, error: error.message })
      return 0
    }
  }

  /**
   * Regenerate Script
   * @param {String} scriptId - Script ID
   * @param {String} userId - User ID
   * @returns {Object} Updated script
   */
  async regenerateScript(scriptId, userId) {
    try {
      const script = await Script.findOne({
        _id: scriptId,
        userId,
        isDeleted: false,
      })

      if (!script) {
        throw new Error('Script not found')
      }

      // Reset generation status
      script.aiGeneration.status = 'pending'
      script.usageStats.timesGenerated += 1
      await script.save()

      // Trigger regeneration
      this.processAIGeneration(script._id).catch((error) => {
        logError('Script regeneration failed', {
          scriptId: script._id,
          error: error.message,
        })
      })

      logInfo('Script regeneration triggered', { scriptId, userId })

      return script
    } catch (error) {
      logError('Error triggering script regeneration', { scriptId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Create Script Variation
   * @param {String} scriptId - Script ID
   * @param {Object} variationData - Variation data
   * @param {String} userId - User ID
   * @returns {Object} Updated script
   */
  async createScriptVariation(scriptId, variationData, userId) {
    try {
      const script = await Script.findOne({
        _id: scriptId,
        userId,
        isDeleted: false,
      })

      if (!script) {
        throw new Error('Script not found')
      }

      if (!(await this.hasABTestingAccess(userId))) {
        throw new Error('A/B testing not available in your subscription tier')
      }

      const variation = {
        variationType: variationData.type,
        title: variationData.title,
        description: variationData.description,
        changes: variationData.changes,
        createdAt: new Date(),
        selected: false,
      }

      script.aiGeneration.scriptVariations.push(variation)
      script.usageStats.variationsCreated += 1
      await script.save()

      logInfo('Script variation created', {
        scriptId,
        variationType: variation.variationType,
        userId,
      })

      return script
    } catch (error) {
      logError('Error creating script variation', { scriptId, userId, error: error.message })
      throw error
    }
  }
}

module.exports = new ScriptGeneratorService()
