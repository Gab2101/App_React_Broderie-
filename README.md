# Automatisation Broderie - Development Guide

A React-based embroidery production management system for Pubos. This application automates embroidery workflow management, machine scheduling, and production tracking.

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm or yarn
- Supabase account (or access to company project)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BTMC1/App_React_Broderie-.git
   cd App_React_Broderie-
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```

   Add your Supabase credentials to `.env.local`:
   ```env
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`.

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components (buttons, badges)
│   └── layout/          # Layout components (navbar, banner)
├── Pages/               # Main application pages
│   └── Admin/           # Admin section pages
│       ├── Commandes/   # Order management
│       ├── Machines/    # Machine management
│       ├── Planning/    # Production planning
│       └── Parametres/  # System configuration
├── context/             # React Context providers
├── utils/               # Utility functions and services
├── styles/              # CSS stylesheets
└── App.js              # Main application component
```

## 🛠️ Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Create production build
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

### Key Technologies

- **Frontend**: React 19.1.0 with React Router
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: React Context API
- **Styling**: Custom CSS with component-specific stylesheets
- **Drag & Drop**: React Beautiful DnD

### Architecture Patterns

- **Component Structure**: Feature-based organization under `Pages/Admin/`
- **State Management**: Context API for global state (EtiquettesContext)
- **API Layer**: Centralized services in `utils/` and page-specific services
- **Styling**: Modular CSS with separate stylesheets per component

## 🗄️ Database Schema

### Core Tables
- `commandes` - Order information (dates, machine, status, duration, urgency)
- `machines` - Machine specifications (heads, speed, type)
- `articleTags` - Article tags with cleaning duration rules
- `broderieTags` - Embroidery parameter tags

### Key Calculations
- **Embroidery Duration**: `(stitches ÷ speed) ÷ number_of_heads`
- **Cleaning Duration**: `(duration_per_article_type) × quantity`
- **Total Time**: `embroidery_duration + cleaning_duration`
- **Urgency Score**: `1-5 scale based on delivery date`

## 🔧 Development Guidelines

### Code Style
- Use functional components with hooks
- Follow React best practices
- Maintain consistent naming conventions
- Keep components small and focused

### Adding New Features
1. Create components in appropriate directories
2. Add API calls to service files
3. Update routing in `App.js` if needed
4. Add corresponding stylesheets

### Testing
- Use React Testing Library for component tests
- Run `npm test` to execute test suite
- Aim for good test coverage on critical business logic

## 🚀 Deployment

### Environment Variables
```env
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Build Process
```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

### Vercel Deployment
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## 📚 Additional Resources

- [React Documentation](https://reactjs.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Router Documentation](https://reactrouter.com/)

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Internal project - Property of Pubos
