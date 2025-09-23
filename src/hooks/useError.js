// src/hooks/useError.js
// Centralized error management hook

import { useCallback } from 'react';
import { useToast } from '../components/common/Toast';
import {
  classifyError,
  shouldShowUserNotification,
  getToastTypeForSeverity,
  formatErrorForLogging
} from '../utils/errorHandler';

export function useError() {
  const toast = useToast();

  /**
   * Handles an error with appropriate user feedback and logging
   * @param {Error|Object} error - The error to handle
   * @param {Object} options - Handling options
   * @param {string} options.context - Context where the error occurred
   * @param {boolean} options.showToast - Whether to show toast notification
   * @param {boolean} options.logError - Whether to log the error
   * @param {Function} options.onRetry - Retry callback for retryable errors
   * @param {string} options.fallbackMessage - Fallback message if classification fails
   */
  const handleError = useCallback((error, options = {}) => {
    const {
      context = '',
      showToast = true,
      logError = true,
      onRetry = null,
      fallbackMessage = 'Une erreur inattendue s\'est produite.'
    } = options;

    // Classify the error
    const classifiedError = classifyError(error, context);

    // Log the error if requested
    if (logError) {
      const logMessage = formatErrorForLogging(classifiedError);
      console.error(logMessage);

      // Could also send to error reporting service here
      // errorReportingService.send(classifiedError);
    }

    // Show user notification if appropriate
    if (showToast && shouldShowUserNotification(classifiedError)) {
      const toastType = getToastTypeForSeverity(classifiedError.severity);

      // Prepare action buttons for retryable errors
      const action = (classifiedError.retryable && onRetry) ? {
        retry: true,
        retryLabel: 'Réessayer',
        onRetry: () => {
          try {
            onRetry();
          } catch (retryError) {
            // If retry fails, handle the retry error
            handleError(retryError, {
              context: `${context} (retry)`,
              showToast: true,
              logError: true
            });
          }
        }
      } : null;

      // Show the toast
      toast[toastType](
        classifiedError.message || fallbackMessage,
        '',
        {
          duration: classifiedError.severity === 'HIGH' ? 0 : 5000, // Don't auto-dismiss high severity
          action
        }
      );
    }

    // Return the classified error for further processing if needed
    return classifiedError;
  }, [toast]);

  /**
   * Convenience method for handling async operations with error handling
   * @param {Function} asyncFn - The async function to execute
   * @param {Object} options - Error handling options
   * @returns {Promise} Result of the async function or throws classified error
   */
  const handleAsync = useCallback(async (asyncFn, options = {}) => {
    try {
      return await asyncFn();
    } catch (error) {
      const classifiedError = handleError(error, options);

      // Re-throw the classified error so calling code can handle it
      throw classifiedError;
    }
  }, [handleError]);

  /**
   * Wraps a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  const withErrorHandling = useCallback((fn, options = {}) => {
    return (...args) => {
      try {
        const result = fn(...args);

        // Handle promises
        if (result && typeof result.catch === 'function') {
          return result.catch(error => {
            handleError(error, options);
            throw error; // Re-throw so calling code knows it failed
          });
        }

        return result;
      } catch (error) {
        handleError(error, options);
        throw error;
      }
    };
  }, [handleError]);

  /**
   * Shows a success toast
   * @param {string} title - Success message title
   * @param {string} message - Success message details
   * @param {Object} options - Toast options
   */
  const showSuccess = useCallback((title, message = '', options = {}) => {
    toast.success(title, message, options);
  }, [toast]);

  /**
   * Shows an info toast
   * @param {string} title - Info message title
   * @param {string} message - Info message details
   * @param {Object} options - Toast options
   */
  const showInfo = useCallback((title, message = '', options = {}) => {
    toast.info(title, message, options);
  }, [toast]);

  /**
   * Shows a warning toast
   * @param {string} title - Warning message title
   * @param {string} message - Warning message details
   * @param {Object} options - Toast options
   */
  const showWarning = useCallback((title, message = '', options = {}) => {
    toast.warning(title, message, options);
  }, [toast]);

  return {
    handleError,
    handleAsync,
    withErrorHandling,
    showSuccess,
    showInfo,
    showWarning
  };
}
