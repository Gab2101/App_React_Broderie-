# Local Development Setup

This project is a **React/Node.js application** with a Python virtual environment for testing purposes.

## Prerequisites

1. **Node.js** (version 16 or higher) - Download from https://nodejs.org/
2. **Python** (version 3.9+) - Already available in this environment

## Quick Start

### 1. Activate Python Virtual Environment (Optional)
```bash
# Activate the Python venv (for testing purposes)
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm start
```

### 4. Open Your Browser
Navigate to: `http://localhost:3000`

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build locally

## Project Structure

- `src/` - React application source code
- `public/` - Static assets
- `package.json` - Node.js dependencies and scripts
- `vite.config.js` - Vite configuration with path aliases
- `venv/` - Python virtual environment (for testing)

## Notes

- The Python virtual environment (`venv/`) is included for testing purposes only
- All Node.js dependencies are managed through `npm`
- The app connects to Supabase for data storage
- Build issues have been resolved - the app should run without import errors

## Troubleshooting

If you encounter issues:
1. Ensure Node.js is installed and `npm` is available
2. Run `npm install` to install dependencies
3. Check that your Supabase credentials are configured in `src/supabaseClient.js`
