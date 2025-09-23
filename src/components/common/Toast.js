// src/components/common/Toast.js
// Toast notification system for non-blocking user feedback

import React, { useState, useEffect, createContext, useContext } from 'react';
import './Toast.css';

const ToastContext = createContext();

// Toast types and their configurations
const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const TOAST_CONFIG = {
  [TOAST_TYPES.SUCCESS]: {
    icon: '✓',
    color: '#10b981',
    bgColor: '#d1fae5',
    borderColor: '#a7f3d0'
  },
  [TOAST_TYPES.ERROR]: {
    icon: '✕',
    color: '#ef4444',
    bgColor: '#fee2e2',
    borderColor: '#fecaca'
  },
  [TOAST_TYPES.WARNING]: {
    icon: '⚠',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    borderColor: '#fde68a'
  },
  [TOAST_TYPES.INFO]: {
    icon: 'ℹ',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    borderColor: '#bfdbfe'
  }
};

// Individual Toast Component
function ToastItem({ toast, onRemove }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300); // Match CSS transition
  };

  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG[TOAST_TYPES.INFO];

  return (
    <div
      className={`toast-item ${isVisible ? 'visible' : ''} ${isLeaving ? 'leaving' : ''}`}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.color
      }}
    >
      <div className="toast-content">
        <span className="toast-icon">{config.icon}</span>
        <div className="toast-text">
          <div className="toast-title">{toast.title}</div>
          {toast.message && <div className="toast-message">{toast.message}</div>}
        </div>
        <button
          className="toast-close"
          onClick={handleClose}
          aria-label="Fermer la notification"
        >
          ×
        </button>
      </div>

      {toast.action && (
        <div className="toast-actions">
          {toast.action.retry && (
            <button
              className="toast-action-btn"
              onClick={() => {
                toast.action.onRetry();
                handleClose();
              }}
            >
              {toast.action.retryLabel || 'Réessayer'}
            </button>
          )}
          {toast.action.dismiss && (
            <button
              className="toast-action-btn secondary"
              onClick={handleClose}
            >
              {toast.action.dismissLabel || 'Ignorer'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Main Toast Container Component
function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
}

// Toast Provider Component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (type, title, message = '', options = {}) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      type,
      title,
      message,
      duration: options.duration || 5000, // Default 5 seconds
      action: options.action || null
    };

    setToasts(prev => [...prev, toast]);

    // Auto-remove after duration if no action buttons
    if (!toast.action && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration + 300); // Add buffer for animation
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  const value = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    // Convenience methods
    success: (title, message, options) => addToast(TOAST_TYPES.SUCCESS, title, message, options),
    error: (title, message, options) => addToast(TOAST_TYPES.ERROR, title, message, options),
    warning: (title, message, options) => addToast(TOAST_TYPES.WARNING, title, message, options),
    info: (title, message, options) => addToast(TOAST_TYPES.INFO, title, message, options)
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// Custom hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Higher-order component for showing error toasts
export function withErrorToast(Component) {
  return function WrappedComponent(props) {
    const toast = useToast();

    const showErrorToast = (error, context = '') => {
      const classifiedError = classifyError(error, context);
      const toastType = getToastTypeForSeverity(classifiedError.severity);

      const action = classifiedError.retryable ? {
        retry: true,
        retryLabel: 'Réessayer',
        onRetry: () => {
          // This would need to be passed from the component
          console.log('Retry action triggered');
        }
      } : null;

      toast[toastType](classifiedError.message, '', {
        duration: classifiedError.severity === 'HIGH' ? 0 : 5000, // Don't auto-dismiss high severity
        action
      });
    };

    return <Component {...props} showErrorToast={showErrorToast} />;
  };
}

export default ToastContainer;
