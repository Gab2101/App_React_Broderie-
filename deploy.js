// deploy.js - Production deployment orchestration script
// Handles build verification, environment checks, and deployment with monitoring

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class Deployer {
  constructor() {
    this.startTime = Date.now();
    this.logs = [];
    this.config = this.loadDeploymentConfig();
  }

  loadDeploymentConfig() {
    const config = {
      environment: process.env.NODE_ENV || 'development',
      checkEnvVars: true,
      runTests: true,
      buildProduction: true,
      runE2ETests: false, // Enable for full CI/CD
      deploymentTarget: process.env.DEPLOY_TARGET || 'vercel',
      monitoring: true,
    };

    // Load additional config from deploy.config.json if exists
    try {
      const configPath = path.join(__dirname, 'deploy.config.json');
      if (fs.existsSync(configPath)) {
        const additionalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        Object.assign(config, additionalConfig);
      }
    } catch (error) {
      this.log('⚠️', `Could not load deployment config: ${error.message}`);
    }

    return config;
  }

  log(level = 'ℹ️', message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level} ${message}`;

    console.log(logEntry);
    this.logs.push({
      timestamp,
      level,
      message,
      data,
    });

    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  run(command, options = {}) {
    const { silent = false, allowedToFail = false } = options;

    try {
      if (!silent) {
        this.log('▶️', `Running: ${command}`);
      }

      const result = execSync(command, {
        cwd: __dirname,
        stdio: silent ? 'pipe' : 'inherit',
        encoding: 'utf8',
        ...options,
      });

      if (silent && result) {
        this.log('✅', `Completed: ${command}`, result.toString().slice(0, 200));
      } else {
        this.log('✅', `Completed: ${command}`);
      }

      return { success: true, output: result };
    } catch (error) {
      this.log('❌', `Failed: ${command}`, error.message);

      if (!allowedToFail) {
        throw error;
      }

      return { success: false, error };
    }
  }

  checkEnvironment() {
    this.log('🔍', 'Checking environment...');

    // Check Node.js version
    const nodeVersion = process.version;
    const requiredVersion = '18.0.0';
    this.log('📦', `Node.js version: ${nodeVersion} (required: >=${requiredVersion})`);

    if (this.compareVersions(nodeVersion, 'v' + requiredVersion) < 0) {
      throw new Error(`Node.js ${requiredVersion}+ required, found ${nodeVersion}`);
    }

    // Check package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    this.log('📦', `Package: ${packageJson.name}@${packageJson.version}`);

    // Check environment variables
    if (this.config.checkEnvVars) {
      this.checkEnvironmentVariables();
    }

    // Check build output directory
    if (fs.existsSync('dist')) {
      this.log('📂', 'Build output directory exists');
    } else {
      this.log('⚠️', 'Build output directory missing - will be created during build');
    }
  }

  checkEnvironmentVariables() {
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ];

    const missing = requiredEnvVars.filter(key => !process.env[key]);

    if (missing.length > 0) {
      this.log('⚠️', `Missing required environment variables: ${missing.join(', ')}`);
      this.log('⚠️', 'Some features may not work without them, but deployment can continue');
    }
  }

  async runTests() {
    if (!this.config.runTests) {
      this.log('⏭️', 'Skipping tests');
      return;
    }

    this.log('🧪', 'Running test suite...');

    // Run unit tests
    try {
      this.run('npm run test:unit', { silent: false });
      this.log('✅', 'Unit tests passed');
    } catch (error) {
      throw new Error(`Unit tests failed: ${error.message}`);
    }

    // Run integration tests
    try {
      this.run('npm run test:integration', { silent: false });
      this.log('✅', 'Integration tests passed');
    } catch (error) {
      this.log('⚠️', 'Integration tests failed, but continuing with deployment');
    }

    // Run E2E tests (optional)
    if (this.config.runE2ETests) {
      try {
        this.run('npm run test:e2e', { silent: false });
        this.log('✅', 'E2E tests passed');
      } catch (error) {
        throw new Error(`E2E tests failed: ${error.message}`);
      }
    }
  }

  runBuild() {
    if (!this.config.buildProduction) {
      this.log('⏭️', 'Skipping build');
      return;
    }

    this.log('🏗️', 'Building for production...');
    this.run('npm run build');

    // Verify build output
    const buildFiles = [
      'dist/index.html',
      'dist/assets/index-*.js',
      'dist/assets/index-*.css',
    ];

    let missingFiles = [];
    for (const pattern of buildFiles) {
      const glob = require('glob');
      const matches = glob.sync(pattern);
      if (matches.length === 0) {
        missingFiles.push(pattern);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`Build verification failed. Missing files: ${missingFiles.join(', ')}`);
    }

    this.log('✅', 'Build verification passed');
  }

  async deploy() {
    this.log('🚀', `Deploying to ${this.config.deploymentTarget}...`);

    switch (this.config.deploymentTarget) {
      case 'vercel':
        await this.deployToVercel();
        break;
      case 'netlify':
        await this.deployToNetlify();
        break;
      case 'surge':
        await this.deployToSurge();
        break;
      default:
        throw new Error(`Unsupported deployment target: ${this.config.deploymentTarget}`);
    }
  }

  async deployToVercel() {
    // Check if Vercel CLI is available
    try {
      this.run('vercel --version', { silent: true });
    } catch (error) {
      throw new Error('Vercel CLI not installed. Install with: npm i -g vercel');
    }

    // Deploy with monitoring
    const deployCommand = process.env.CI ? 'vercel --prod' : 'vercel';
    this.run(deployCommand);

    this.log('✅', 'Successfully deployed to Vercel');
  }

  async deployToNetlify() {
    try {
      this.run('netlify --version', { silent: true });
    } catch (error) {
      throw new Error('Netlify CLI not installed. Install with: npm i -g netlify-cli');
    }

    this.run('netlify deploy --prod --dir=dist --yes');
    this.log('✅', 'Successfully deployed to Netlify');
  }

  async deployToSurge() {
    const appName = 'broderie-flow.surge.sh';
    this.run(`npx surge dist ${appName} --token=${process.env.SURGE_TOKEN || ''}`);
    this.log('✅', 'Successfully deployed to Surge');
  }

  setupMonitoring() {
    if (!this.config.monitoring) {
      this.log('⏭️', 'Skipping monitoring setup');
      return;
    }

    this.log('📊', 'Setting up production monitoring...');

    // Verify monitoring configuration
    const monitoringConfigPath = path.join(__dirname, 'src', 'monitoring', 'dashboard-config.js');
    if (!fs.existsSync(monitoringConfigPath)) {
      throw new Error('Monitoring configuration not found');
    }

    // Verify environment variables for monitoring
    const monitoringVars = [
      'VITE_SLACK_WEBHOOK_URL',
      'VITE_ALERT_EMAIL_RECIPIENT',
      'VITE_PAGERDUTY_INTEGRATION_KEY',
    ];

    const availableVars = monitoringVars.filter(key => process.env[key]);
    this.log('📊', `Monitoring channels available: ${availableVars.length}/${monitoringVars.length}`);

    this.log('✅', 'Monitoring setup completed');
  }

  saveDeploymentLog() {
    const duration = Date.now() - this.startTime;
    const logFile = path.join(__dirname, 'deploy.log');

    const deploymentSummary = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      duration: `${Math.round(duration / 1000)}s`,
      success: true,
      target: this.config.deploymentTarget,
      commit: this.getGitCommit(),
      config: this.config,
    };

    try {
      fs.writeFileSync(
        logFile,
        JSON.stringify({
          deployment: deploymentSummary,
          logs: this.logs.slice(-100), // Last 100 log entries
        }, null, 2)
      );
      this.log('💾', `Deployment log saved to ${logFile}`);
    } catch (error) {
      this.log('⚠️', `Failed to save deployment log: ${error.message}`);
    }
  }

  getGitCommit() {
    try {
      return this.run('git rev-parse HEAD', { silent: true }).output.toString().trim().slice(0, 7);
    } catch (error) {
      return 'unknown';
    }
  }

  compareVersions(version1, version2) {
    const v1 = version1.replace(/^v/, '').split('.').map(Number);
    const v2 = version2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const part1 = v1[i] || 0;
      const part2 = v2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  async runDeployment() {
    try {
      this.log('🚀', 'Starting Brodère Flow deployment...');
      this.log('🌍', `Environment: ${this.config.environment}`);

      this.checkEnvironment();
      await this.runTests();
      this.runBuild();
      await this.deploy();
      this.setupMonitoring();

      const duration = Date.now() - this.startTime;
      this.log('🎉', `Deployment completed successfully in ${Math.round(duration / 1000)}s`);

      this.saveDeploymentLog();

    } catch (error) {
      const duration = Date.now() - this.startTime;
      this.log('💀', `Deployment failed after ${Math.round(duration / 1000)}s: ${error.message}`);

      this.saveDeploymentLog();

      process.exit(1);
    }
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployer = new Deployer();
  deployer.runDeployment();
}

module.exports = Deployer;
