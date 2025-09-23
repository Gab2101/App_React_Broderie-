// src/components/common/ErrorBoundary.jsx
// React Error Boundary for graceful error handling

import React from 'react';
import { classifyError, formatErrorForLogging } from '../../utils/errorHandler';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now() + Math.random()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Classify and log the error
    const classifiedError = classifyError(error, 'React Error Boundary');

    // Log detailed error information
    const logMessage = formatErrorForLogging({
      ...classifiedError,
      context: `React Error Boundary - ${classifiedError.context}`,
      componentStack: errorInfo.componentStack
    });

    console.error(logMessage);
    console.error('Component Stack:', errorInfo.componentStack);

    // Store error details for debugging
    this.setState({
      error,
      errorInfo
    });

    // Could send to error reporting service
    // errorReportingService.send({
    //   ...classifiedError,
    //   componentStack: errorInfo.componentStack,
    //   errorId: this.state.errorId
    // });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo, classifiedError);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
          reload: this.handleReload,
          errorId: this.state.errorId
        });
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">Une erreur s'est produite</h2>
            <p className="error-boundary-message">
              Une erreur inattendue s'est produite dans cette section de l'application.
            </p>

            <div className="error-boundary-actions">
              <button
                className="error-boundary-btn primary"
                onClick={this.handleRetry}
              >
                Réessayer
              </button>
              <button
                className="error-boundary-btn secondary"
                onClick={this.handleReload}
              >
                Recharger la page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-boundary-details">
                <summary>Détails de l'erreur (développement)</summary>
                <pre className="error-boundary-stack">
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Hook for using error boundary in functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error) => {
    setError(error);
  }, []);

  // If there's an error, throw it to trigger the error boundary
  if (error) {
    throw error;
  }

  return { captureError, resetError };
}

export default ErrorBoundary;
