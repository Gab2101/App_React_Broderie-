// Diagnostics component for production debugging
import React, { useState, useEffect } from 'react';
import supabase from '../../lib/supabaseClient';

export default function Diagnostics() {
  const [diagnostics, setDiagnostics] = useState({
    environment: {},
    supabase: { connected: false, version: null },
    environmentVars: {},
    performance: {}
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run diagnostics if explicitly shown
    if (!isVisible) return;

    const runDiagnostics = async () => {
      const env = import.meta.env;
      const startTime = performance.now();

      // Environment info
      const environment = {
        mode: env.MODE,
        dev: env.DEV,
        prod: env.PROD,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      // Environment variables (only the ones that should be present)
      const environmentVars = {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || 'Missing',
        supabaseUrl: env.VITE_SUPABASE_URL || '(missing)',
        anonKey: env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing'
      };

      // Supabase connection test
      let supabaseStatus = { connected: false, version: null };
      try {
        const { data, error } = await supabase.auth.getSession();
        supabaseStatus.connected = !error;
        supabaseStatus.version = 'v2'; // Assume v2
      } catch (error) {
        supabaseStatus.error = error.message;
      }

      // Performance metrics
      const performanceMetrics = {
        loadTime: performance.now() - startTime,
        memoryUsage: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown'
      };

      setDiagnostics({
        environment,
        supabase: supabaseStatus,
        environmentVars,
        performance: performanceMetrics
      });
    };

    runDiagnostics();
  }, [isVisible]);

  // Only show diagnostics button in development or if explicitly enabled
  const showDiagnosticsButton = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has('diagnostics');

  if (!showDiagnosticsButton) return null;

  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          padding: '10px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        🔍 Debug
      </button>

      {isVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 9998,
          padding: '20px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>Production Diagnostics</h2>
            <button onClick={() => setIsVisible(false)} style={{ float: 'right' }}>✕</button>
            <div style={{ clear: 'both' }}></div>

            <h3>Environment</h3>
            <pre>{JSON.stringify(diagnostics.environment, null, 2)}</pre>

            <h3>Environment Variables</h3>
            <pre>{JSON.stringify(diagnostics.environmentVars, null, 2)}</pre>

            <h3>Supabase Connection</h3>
            <pre>{JSON.stringify(diagnostics.supabase, null, 2)}</pre>

            <h3>Performance</h3>
            <pre>{JSON.stringify(diagnostics.performance, null, 2)}</pre>

            <h3>Recent Console Logs</h3>
            <p>(Check browser console for detailed error logs)</p>
          </div>
        </div>
      )}
    </>
  );
}
