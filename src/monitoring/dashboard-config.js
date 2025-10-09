// src/monitoring/dashboard-config.js
// Production monitoring dashboard configuration and alerting rules

export const DASHBOARD_CONFIG = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),

  // Main dashboard panels
  panels: {
    // Real-time performance metrics
    performance: {
      title: 'Performance Metrics',
      refreshInterval: 30000, // 30 seconds
      alerts: {
        slowQueries: {
          threshold: 1000, // 1 second
          severity: 'warning',
          channels: ['console', 'slack'],
        },
        highMemoryUsage: {
          threshold: 80, // 80% memory usage
          severity: 'error',
          channels: ['slack', 'email'],
        },
      },
    },

    // Error rate monitoring
    errors: {
      title: 'Error Monitoring',
      refreshInterval: 60000, // 1 minute
      alerts: {
        highErrorRate: {
          threshold: 5, // More than 5 errors per minute
          severity: 'error',
          channels: ['slack', 'email', 'sms'],
        },
        criticalErrors: {
          keywords: ['SupabaseError', 'NETWORK_ERROR', 'CONSTRAINT_VIOLATION'],
          severity: 'critical',
          channels: ['slack', 'email', 'sms', 'pagerduty'],
        },
      },
    },

    // User interaction tracking
    user_interactions: {
      title: 'User Experience',
      refreshInterval: 120000, // 2 minutes
      alerts: {
        slowInteractions: {
          threshold: 5000, // 5 seconds for user actions
          severity: 'warning',
          channels: ['console'],
        },
      },
    },

    // Database performance
    database: {
      title: 'Database Performance',
      refreshInterval: 180000, // 3 minutes
      alerts: {
        connectionPoolExhausted: {
          threshold: 95, // 95% of connections used
          severity: 'error',
          channels: ['slack', 'pagerduty'],
        },
      },
    },
  },

  // Alerting channels configuration
  channels: {
    console: {
      enabled: true,
      format: 'json',
      level: 'info',
    },

    slack: {
      enabled: process.env.VITE_SLACK_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.VITE_SLACK_WEBHOOK_URL,
      channel: '#alerts',
      template: {
        color: (severity) => ({
          info: '#36C5F0',
          warning: '#ECB22E',
          error: '#E01E5A',
          critical: '#D10E0E',
        }[severity] || '#36C5F0'),
        fallback: (alert) => `${alert.severity}: ${alert.message}`,
        fields: [
          { title: 'Severity', value: '$severity', short: true },
          { title: 'Service', value: '$service', short: true },
          { title: 'Time', value: '$timestamp', short: true },
          { title: 'User', value: '$user', short: true },
          { title: 'URL', value: '$url', short: true },
          { title: 'Browser', value: '$browser', short: true },
        ],
      },
    },

    email: {
      enabled: process.env.VITE_ALERT_EMAIL_RECIPIENT ? true : false,
      recipient: process.env.VITE_ALERT_EMAIL_RECIPIENT,
      sender: 'noreply@brodereflow.com',
      subject: '[BRODERE-FLOW ALERT] $severity - $service',
      template: `
        <h2>$severity Alert - $service</h2>
        <p><strong>Time:</strong> $timestamp</p>
        <p><strong>Message:</strong> $message</p>
        <p><strong>User:</strong> $user</p>
        <p><strong>URL:</strong> $url</p>
        <p><strong>Browser:</strong> $browser</p>
        <p><strong>Details:</strong></p>
        <pre>$details</pre>
        <hr>
        <p><small>This alert was generated automatically by Brodère Flow monitoring system.</small></p>
      `,
    },

    sms: {
      enabled: process.env.VITE_TWILIO_SID ? true : false,
      twilioSid: process.env.VITE_TWILIO_SID,
      twilioToken: process.env.VITE_TWILIO_TOKEN,
      to: process.env.VITE_ALERT_PHONE_NUMBER,
      from: process.env.VITE_TWILIO_PHONE_NUMBER,
      message: '$severity ALERT: $service - $message',
    },

    pagerduty: {
      enabled: process.env.VITE_PAGERDUTY_INTEGRATION_KEY ? true : false,
      integrationKey: process.env.VITE_PAGERDUTY_INTEGRATION_KEY,
      severityMapping: {
        critical: 'critical',
        error: 'error',
        warning: 'warning',
      },
    },
  },

  // Time series metrics to collect
  metrics: {
    // Application performance
    'performance.page_load_time': {
      type: 'histogram',
      buckets: [100, 500, 1000, 2000, 5000, 10000],
      labels: ['page', 'user_agent'],
    },

    // API performance
    'performance.api_request_duration': {
      type: 'histogram',
      buckets: [50, 100, 200, 500, 1000, 2000, 5000],
      labels: ['method', 'endpoint', 'status'],
    },

    // Database performance
    'performance.database_query_duration': {
      type: 'histogram',
      buckets: [10, 25, 50, 100, 250, 500, 1000, 2000],
      labels: ['query_type', 'table'],
    },

    // User interactions
    'interaction.duration': {
      type: 'histogram',
      buckets: [100, 250, 500, 1000, 2500, 5000, 10000],
      labels: ['interaction_type', 'element'],
    },

    // Error tracking
    'error.count': {
      type: 'counter',
      labels: ['error_type', 'error_code', 'component'],
    },

    // Business metrics
    'business.commande_created': {
      type: 'counter',
      labels: ['machine_type', 'user', 'duration'],
    },

    // Health checks
    'health.service_up': {
      type: 'gauge',
      value: 1, // Always report as up if code is running
      labels: ['service'],
    },
  },

  // Dashboard layouts for different user roles
  layouts: {
    administrator: [
      'performance',
      'errors',
      'user_interactions',
      'database',
    ],

    developer: [
      'performance',
      'errors',
      'user_interactions',
    ],

    manager: [
      'user_interactions',
      'performance',
    ],
  },

  // Data retention policies
  retention: {
    metrics: '30d', // Keep metrics for 30 days
    logs: '7d',     // Keep logs for 7 days
    alerts: '365d', // Keep alert history for 1 year
  },

  // Health check endpoints
  healthChecks: {
    database: {
      endpoint: '/api/health/database',
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
    },

    cache: {
      endpoint: '/api/health/cache',
      interval: 30000,
      timeout: 1000,
    },
  },
};

/**
 * Generate alert message template
 * @param {Object} alert - Alert details
 * @param {Object} context - Additional context
 * @returns {Object} Compiled alert message
 */
export function generateAlertMessage(alert, context = {}) {
  const timestamp = new Date().toISOString();
  const environment = {
    service: 'Brodère Flow',
    version: '1.0.0',
    environment: import.meta.env.MODE,
    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  };

  const compiledAlert = {
    severity: alert.severity,
    message: alert.message,
    timestamp,
    service: environment.service,
    environment: environment.environment,
    appVersion: environment.appVersion,
    ...context,
  };

  // Add specific details based on alert type
  if (alert.type === 'performance') {
    compiledAlert.details = {
      metric: context.metric,
      value: context.value,
      threshold: context.threshold,
      unit: context.unit || 'ms',
    };
  }

  if (alert.type === 'error') {
    compiledAlert.details = {
      error: context.error,
      component: context.component,
      user: context.user,
      url: context.url,
      browser: context.browser,
    };
  }

  return compiledAlert;
}

/**
 * Check if alert should be triggered
 * @param {Object} alert - Alert configuration
 * @param {Object} metrics - Current metrics
 * @returns {boolean} Whether to trigger alert
 */
export function shouldTriggerAlert(alert, metrics) {
  if (alert.keywords && alert.keywords.length > 0) {
    // Keyword-based alerting for errors
    const message = (metrics.message || '').toLowerCase();
    return alert.keywords.some(keyword => message.includes(keyword.toLowerCase()));
  }

  if (alert.threshold && metrics.value !== undefined) {
    // Threshold-based alerting
    return metrics.value > alert.threshold;
  }

  return false;
}

/**
 * Send alert through configured channels
 * @param {Object} alert - Alert to send
 * @param {Object} context - Alert context
 */
export async function sendAlert(alert, context) {
  const compiledAlert = generateAlertMessage(alert, context);

  for (const [channelName, channel] of Object.entries(DASHBOARD_CONFIG.channels)) {
    if (!channel.enabled) continue;

    try {
      await sendToChannel(channelName, channel, compiledAlert);
    } catch (error) {
      console.error(`Failed to send alert to ${channelName}:`, error);
    }
  }
}

/**
 * Send alert to specific channel
 * @param {string} channelName - Channel name
 * @param {Object} channel - Channel configuration
 * @param {Object} alert - Alert to send
 */
async function sendToChannel(channelName, channel, alert) {
  switch (channelName) {
    case 'console':
      console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`, alert);
      break;

    case 'slack':
      if (!channel.webhookUrl) return;
      // Implement Slack webhook call
      break;

    case 'email':
      if (!channel.recipient) return;
      // Implement email sending
      break;

    case 'sms':
      if (!channel.to) return;
      // Implement SMS sending via Twilio
      break;

    case 'pagerduty':
      if (!channel.integrationKey) return;
      // Implement Pagerduty integration
      break;

    default:
      console.warn(`Unknown channel: ${channelName}`);
  }
}
