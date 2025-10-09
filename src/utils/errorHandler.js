// src/utils/errorHandler.js
// Centralized error handling and classification system

export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC',
  AUTHENTICATION: 'AUTHENTICATION',
  PERMISSION: 'PERMISSION',
  UNKNOWN: 'UNKNOWN'
};

export const ERROR_SEVERITY = {
  LOW: 'LOW',       // Minor issues, user can continue
  MEDIUM: 'MEDIUM', // Important but recoverable
  HIGH: 'HIGH',     // Critical, requires attention
  CRITICAL: 'CRITICAL' // System-breaking
};

/**
 * Classifies an error based on its properties and context
 * @param {Error|Object} error - The error object
 * @param {string} context - Additional context about where the error occurred
 * @returns {Object} Classified error with type, severity, and user message
 */
export function classifyError(error, context = '') {
  // Handle Supabase errors
  if (error?.code || error?.details || error?.hint) {
    return classifySupabaseError(error, context);
  }

  // Handle network errors
  if (error?.name === 'NetworkError' || error?.message?.includes('fetch')) {
    return {
      type: ERROR_TYPES.NETWORK,
      severity: ERROR_SEVERITY.MEDIUM,
      message: 'Problème de connexion réseau. Vérifiez votre connexion internet.',
      originalError: error,
      retryable: true,
      context
    };
  }

  // Handle validation errors
  if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      message: error.message || 'Données invalides.',
      originalError: error,
      retryable: false,
      context
    };
  }

  // Handle authentication errors
  if (error?.message?.includes('auth') || error?.status === 401) {
    return {
      type: ERROR_TYPES.AUTHENTICATION,
      severity: ERROR_SEVERITY.HIGH,
      message: 'Session expirée. Veuillez vous reconnecter.',
      originalError: error,
      retryable: false,
      context
    };
  }

  // Handle permission errors
  if (error?.status === 403 || error?.message?.includes('permission')) {
    return {
      type: ERROR_TYPES.PERMISSION,
      severity: ERROR_SEVERITY.HIGH,
      message: 'Permissions insuffisantes pour cette action.',
      originalError: error,
      retryable: false,
      context
    };
  }

  // Default unknown error
  return {
    type: ERROR_TYPES.UNKNOWN,
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Une erreur inattendue s\'est produite.',
    originalError: error,
    retryable: false,
    context
  };
}

/**
 * Classifies Supabase-specific errors
 * @param {Object} error - Supabase error object
 * @param {string} context - Additional context
 * @returns {Object} Classified error
 */
function classifySupabaseError(error, context) {
  const { code, message, details } = error;

  // Network/connection errors
  if (code === 'PGRST301' || message?.includes('connection')) {
    return {
      type: ERROR_TYPES.NETWORK,
      severity: ERROR_SEVERITY.MEDIUM,
      message: 'Problème de connexion à la base de données.',
      originalError: error,
      retryable: true,
      context
    };
  }

  // Duplicate key errors
  if (code === '23505' || message?.includes('duplicate')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      message: 'Cette entrée existe déjà.',
      originalError: error,
      retryable: false,
      context
    };
  }

  // Foreign key constraint errors
  if (code === '23503' || message?.includes('foreign key')) {
    return {
      type: ERROR_TYPES.BUSINESS_LOGIC,
      severity: ERROR_SEVERITY.MEDIUM,
      message: 'Impossible de supprimer : cette donnée est utilisée ailleurs.',
      originalError: error,
      retryable: false,
      context
    };
  }

  // Check constraint violations
  if (code === '23514' || message?.includes('check constraint')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      severity: ERROR_SEVERITY.LOW,
      message: 'Données invalides : vérifiez les valeurs saisies.',
      originalError: error,
      retryable: false,
      context
    };
  }

  // Default Supabase error
  return {
    type: ERROR_TYPES.UNKNOWN,
    severity: ERROR_SEVERITY.MEDIUM,
    message: message || 'Erreur de base de données.',
    originalError: error,
    retryable: false,
    context
  };
}

/**
 * Formats an error for logging purposes
 * @param {Object} classifiedError - Error from classifyError
 * @returns {string} Formatted error string for logging
 */
export function formatErrorForLogging(classifiedError) {
  const { type, severity, message, context, originalError } = classifiedError;
  const timestamp = new Date().toISOString();

  return `[${timestamp}] ${type} (${severity}) - ${message} ${context ? `(${context})` : ''}\nOriginal: ${originalError?.message || 'Unknown error'}`;
}

/**
 * Determines if an error should trigger a user notification
 * @param {Object} classifiedError - Error from classifyError
 * @returns {boolean} Whether to show notification to user
 */
export function shouldShowUserNotification(classifiedError) {
  const { severity, type } = classifiedError;

  // Always show high and critical errors
  if (severity === ERROR_SEVERITY.HIGH || severity === ERROR_SEVERITY.CRITICAL) {
    return true;
  }

  // Show medium errors except for network issues (handled separately)
  if (severity === ERROR_SEVERITY.MEDIUM && type !== ERROR_TYPES.NETWORK) {
    return true;
  }

  // Show low severity validation errors
  if (severity === ERROR_SEVERITY.LOW && type === ERROR_TYPES.VALIDATION) {
    return true;
  }

  return false;
}

/**
 * Gets appropriate toast type for error severity
 * @param {string} severity - Error severity
 * @returns {string} Toast type ('error', 'warning', 'info')
 */
export function getToastTypeForSeverity(severity) {
  switch (severity) {
    case ERROR_SEVERITY.CRITICAL:
    case ERROR_SEVERITY.HIGH:
      return 'error';
    case ERROR_SEVERITY.MEDIUM:
      return 'warning';
    case ERROR_SEVERITY.LOW:
      return 'info';
    default:
      return 'error';
  }
}

// ============================================================================
// DEV-FRIENDLY ERROR HANDLING UTILITIES (THROW INSTEAD OF RETURN)
// ============================================================================

/**
 * Custom error class for Supabase operations with rich context
 */
export class SupabaseError extends Error {
  constructor(operation, error) {
    super(`[Supabase ${operation}] ${error.message}`);
    this.name = 'SupabaseError';
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
    this.statusCode = error.statusCode;
    this.operation = operation;
  }
}

/**
 * Asserts that a Supabase operation succeeded, throwing a detailed error if not
 * @param {Object} response - Supabase response { data, error }
 * @param {string} operation - Descriptive operation name for error context
 * @returns {*} The response data if successful
 * @throws {SupabaseError} If operation failed, with rich error context
 */
export function assertNoSupabaseError(response, operation = 'operation') {
  if (response.error) {
    throw new SupabaseError(operation, response.error);
  }
  return response.data;
}

/**
 * Wraps async Supabase operations with error assertion
 * @param {Promise} promise - Promise that resolves to Supabase response
 * @param {string} operation - Descriptive operation name
 * @returns {*} Operation result data
 * @throws {SupabaseError} If operation failed
 */
export async function assertSupabase(promise, operation) {
  const response = await promise;
  return assertNoSupabaseError(response, operation);
}

// ============================================================================
// PRODUCTION MONITORING & ERROR TRACKING
// ============================================================================

/**
 * Initialize production monitoring
 */
export function initMonitoring() {
  // Track page load performance
  window.addEventListener('load', () => {
    const loadTime = performance.now();
    if (import.meta.env.PROD && loadTime > 3000) {
      console.warn(`Slow page load: ${loadTime.toFixed(2)}ms`);
    }
  });

  // Track unhandled errors
  window.addEventListener('error', (event) => {
    console.error('[Production Error]', event.error);
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Production Promise Rejection]', event.reason);
  });

  console.info('🔍 Production monitoring initialized');
}

/**
 * Report error to monitoring (expandable for external services)
 */
export function reportError(error, context = {}) {
  console.error('[Error Report]', error, context);
}

/**
 * Report performance metrics
 */
export function reportPerformance(metrics) {
  console.info('[Performance]', metrics);
}

/**
 * Track user interactions
 */
export function trackInteraction(action, details = {}) {
  if (!import.meta.env.PROD) {
    console.debug('[Interaction]', action, details);
  }
}
