//src/shared/memoryMonitor.js - ENHANCED VERSION
const { logInfo, logWarn, logError } = require('./utils');

/**
 * Enhanced memory monitoring with video processing support
 */
const memoryMonitor = (req, res, next) => {
  const startMemory = process.memoryUsage();
  const startTime = Date.now();
  
  // Pre-request memory check for video operations
  if (req.url.includes('/create-video') || req.url.includes('/transcribe')) {
    const preCheckResult = checkMemoryLimits();
    if (!preCheckResult.canProcess) {
      return res.status(503).json({
        success: false,
        message: 'Server memory usage too high for video processing. Please try again later.',
        code: 503,
        retryAfter: 300, // 5 minutes
        memoryStats: preCheckResult.stats,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  res.on('finish', () => {
    const endMemory = process.memoryUsage();
    const endTime = Date.now();
    
    const stats = {
      heapUsedMB: Math.round(endMemory.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(endMemory.heapTotal / 1024 / 1024),
      heapDiffMB: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024),
      processingTimeMs: endTime - startTime,
      heapUsagePercent: Math.round((endMemory.heapUsed / endMemory.heapTotal) * 100),
      rssMB: Math.round(endMemory.rss / 1024 / 1024)
    };
    
    // Enhanced logging for memory-intensive operations
    if (req.url.includes('/create-video') || req.url.includes('/create-file') || stats.heapDiffMB > 10) {
      logInfo('Memory usage after request', {
        endpoint: req.url,
        method: req.method,
        fileSize: req.file?.size ? Math.round(req.file.size / 1024 / 1024) + 'MB' : 'N/A',
        ...stats
      });
      
      // Force GC for high-memory operations
      if (stats.heapUsagePercent > 70) {
        forceGarbageCollection();
      }
    }
    
    // Critical memory warning
    if (stats.heapUsagePercent > 85) {
      logError('Memory usage critical after request', {
        endpoint: req.url,
        ...stats,
        recommendation: 'Consider server restart or reducing concurrent video processing'
      });
    }
  });
  
  next();
};

/**
 * Enhanced garbage collection with metrics
 */
const forceGarbageCollection = () => {
  if (global.gc) {
    const beforeGC = process.memoryUsage();
    global.gc();
    const afterGC = process.memoryUsage();
    
    const freed = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);
    
    logInfo('Garbage collection completed', {
      freedMB: freed,
      heapUsedAfterMB: Math.round(afterGC.heapUsed / 1024 / 1024),
      heapUsagePercent: Math.round((afterGC.heapUsed / afterGC.heapTotal) * 100)
    });
  } else {
    logWarn('Garbage collection not available - start Node.js with --expose-gc flag');
  }
};

/**
 * Enhanced memory limits checking with detailed stats
 */
const checkMemoryLimits = () => {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  
  const stats = {
    heapUsedMB,
    heapTotalMB,
    rssMB,
    heapUsedPercent: Math.round(heapUsedPercent),
    external: Math.round(usage.external / 1024 / 1024),
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
  };
  
  // Critical threshold check
  if (heapUsedPercent > 90 && heapUsedMB > 500) {
    logError('Memory usage critical', {
      ...stats,
      action: 'Blocking new operations'
    });
    
    // Emergency garbage collection
    if (global.gc) {
      global.gc();
    }
    
    return {
      canProcess: false,
      level: 'critical',
      stats
    };
  }
  
  // High threshold check
  if (heapUsedPercent > 75) {
    logWarn('Memory usage high', {
      ...stats,
      action: 'Monitoring closely'
    });
    
    return {
      canProcess: true, // Still allow but with caution
      level: 'high',
      stats
    };
  }
  
  return {
    canProcess: true,
    level: 'normal',
    stats
  };
};

/**
 * Check if system can handle file of specific size
 */
const canHandleFileSize = (fileSizeBytes) => {
  const usage = process.memoryUsage();
  const availableHeapMB = (usage.heapTotal - usage.heapUsed) / (1024 * 1024);
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  
  // Require at least 3x file size in available memory for processing
  const requiredMemoryMB = fileSizeMB * 3;
  
  const canHandle = availableHeapMB >= requiredMemoryMB;
  
  logInfo('File size memory check', {
    fileSizeMB: Math.round(fileSizeMB * 100) / 100,
    availableHeapMB: Math.round(availableHeapMB * 100) / 100,
    requiredMemoryMB: Math.round(requiredMemoryMB * 100) / 100,
    canHandle
  });
  
  return {
    canHandle,
    fileSizeMB,
    availableHeapMB,
    requiredMemoryMB
  };
};

/**
 * Memory-aware file processing helper
 */
const withMemoryManagement = async (operation, context = {}) => {
  // Pre-operation check
  const preCheck = checkMemoryLimits();
  if (!preCheck.canProcess) {
    throw new Error('Insufficient memory for operation');
  }
  
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = Date.now();
  
  try {
    // Execute operation
    const result = await operation();
    
    // Post-operation cleanup
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDiff = (endMemory - startMemory) / (1024 * 1024);
    const duration = Date.now() - startTime;
    
    logInfo('Memory-managed operation completed', {
      ...context,
      memoryUsedMB: Math.round(memoryDiff * 100) / 100,
      durationMs: duration
    });
    
    // Force GC if operation used significant memory
    if (memoryDiff > 50) { // More than 50MB
      forceGarbageCollection();
    }
    
    return result;
    
  } catch (error) {
    logError('Memory-managed operation failed', {
      ...context,
      error: error.message
    });
    
    // Cleanup on error
    forceGarbageCollection();
    throw error;
  }
};

module.exports = {
  memoryMonitor,
  forceGarbageCollection,
  checkMemoryLimits,
  canHandleFileSize,
  withMemoryManagement
};