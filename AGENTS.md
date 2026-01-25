# Scoutly - Agent Development Guide

This document provides essential information for AI agents working on the Scoutly codebase.

## Project Overview

Scoutly is an AI-powered startup discovery platform that helps users find recently funded startups and their founders. The platform uses real-time data scraping and AI-powered analysis to provide actionable startup intelligence.

**Tech Stack:**
- Frontend: React 19.2.3 + TypeScript + Vite 6.2.0
- Backend: Convex (serverless PostgreSQL)
- UI: Tailwind CSS (via CDN), Lucide React Icons
- Animations: GSAP 3.12.5
- Charts: Recharts 3.6.0
- Data Sources: Y Combinator API, Hacker News, Google Gemini AI

---

## Development Commands

### Core Commands
```bash
# Development
npm run dev          # Start Vite dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build

# Convex Backend (run in separate terminal)
npx convex dev       # Start Convex backend
npx convex deploy     # Deploy to production
npx convex push       # Push schema changes
npx convex auth       # Authenticate with Convex
```

### Database Management Scripts
```bash
# From the PR - Available scripts:
npm run cleanup_database  # Clean orphaned records
npm run seed_database      # Add sample data
npm run view_database      # Inspect database state
npm run wipe_database      # Reset all data (use with caution)
```

### Testing
**Note:** The codebase currently has no formal test files. When adding tests:
- Use Vitest (compatible with Vite)
- Test files should end with `.test.ts` or `.spec.ts`
- Run single test: `npm test -- filename.test.ts`
- Run with coverage: `npm test -- --coverage`

---

## Code Style Guidelines

### File Structure & Imports

**Import Order:**
1. React-related imports
2. Third-party libraries (lucide, convex, etc.)
3. Internal imports (use @/ alias for absolute paths)
4. Relative imports (use sparingly)

```typescript
// ✅ Correct import order
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Startup } from '../types';
import { StartupModal } from './StartupModal';
```

**Import Aliases:**
- Use `@/` for absolute imports (configured in vite.config.ts)
- Example: `import { types } from '@/types';`

### TypeScript Patterns

**Component Definitions:**
```typescript
// ✅ Preferred: Interface exports
interface ComponentProps {
  startup: Startup;
  onAction: (id: string) => void;
}

export const ComponentName: React.FC<ComponentProps> = ({ startup, onAction }) => {
  // Component logic
};
```

**Type Safety:**
- All API responses must be typed
- Use Convex generated types from `convex/_generated/api.d.ts`
- Optional fields should be clearly marked with `?`

```typescript
// ✅ Use generated types
import { Doc } from '../convex/_generated/dataModel';

type Startup = Doc<'startups'>;
```

### Naming Conventions

**Files & Components:**
- Components: PascalCase (e.g., `StartupModal.tsx`)
- Utilities: camelCase (e.g., `dateUtils.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS`)
- CSS classes: kebab-case (e.g., `.startup-card`)

**Variables:**
- Use descriptive names
- Boolean prefixes: `isLoading`, `hasError`, `canSubmit`
- Functions: verb-first (e.g., `fetchStartups`, `handleClick`)

### Error Handling

**Frontend Error Boundaries:**
```typescript
// Wrap components that might fail
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Loader />}>
    <Component />
  </Suspense>
</ErrorBoundary>
```

**API Error Handling:**
```typescript
// ✅ Convex error pattern
const result = await mutate(api.startups.create, data);
if (!result.success) {
  throw new Error(result.error);
}
```

**Async Error Patterns:**
```typescript
// ✅ Always handle async errors
const loadStartups = async () => {
  try {
    const data = await query(api.startups.list);
    setStartups(data);
  } catch (error) {
    console.error('Failed to load startups:', error);
    setError('Could not load startup data');
  } finally {
    setLoading(false);
  }
};
```

---

## Architecture Guidelines

### Convex Integration

**Database Operations:**
- All database access goes through Convex functions
- Use `useQuery` for reads, `useMutation` for writes
- Never import Convex directly in components - use service layer

```typescript
// ✅ Service layer pattern
// services/convexService.ts
export const useStartups = () => {
  return useQuery(api.startups.list);
};

// Component usage
const startups = useStartups();
```

**Schema Updates:**
1. Modify `convex/schema.ts`
2. Run `npx convex dev` to generate types
3. Update related queries/mutations
4. Push with `npx convex push`

### Component Architecture

**State Management:**
- Use React hooks for local state
- Use Convex for global/shared state
- Avoid prop drilling - use context or custom hooks

**Component Patterns:**
```typescript
// ✅ Compound component pattern
export const Dashboard = () => {
  return (
    <div>
      <Dashboard.Header />
      <Dashboard.Content />
      <Dashboard.Sidebar />
    </div>
  );
};

Dashboard.Header = () => { /* ... */ };
Dashboard.Content = () => { /* ... */ };
```

### Data Flow

**Scraping Pipeline:**
1. Scrapers (`convex/scrapers/`) fetch from external APIs
2. Processors (`convex/processors/`) clean and deduplicate
3. Queries (`convex/queries/`) expose data to frontend
4. Frontend uses service hooks (`services/`) to consume data

---

## UI/UX Standards

### Styling Guidelines

**Color Palette:**
- Primary: Black (#000000) for backgrounds
- Surface: #111, #333 for cards/panels
- Accent: Emerald (#10b981, #34d399) for CTAs
- Text: #ededed (off-white) for readability

**Component Styling:**
- Use Tailwind classes for layout and utilities
- Custom CSS for complex animations (GSAP)
- Consistent spacing: multiples of 0.5rem
- Responsive design: Mobile-first approach

```typescript
// ✅ Consistent component structure
<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
  <div className="flex justify-between items-center mb-3">
    <h3 className="text-xl font-bold text-white">{title}</h3>
  </div>
  {/* Content */}
</div>
```

### Animation Standards

**GSAP Usage:**
- Use GSAP for complex animations (starfield, transitions)
- Keep animations performant (prefer opacity/transform)
- Respect prefers-reduced-motion

```typescript
// ✅ GSAP animation pattern
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to('.star-field', {
      rotation: 360,
      duration: 200,
      ease: 'none',
      repeat: -1
    });
  }, container);

  return () => ctx.revert();
}, []);
```

---

## Performance Guidelines

### Optimization Requirements

**Bundle Size:**
- Use dynamic imports for heavy components
- Lazy load Convex data
- Optimize images/assets

**Database Queries:**
- Use Convex indexes efficiently
- Paginate large datasets
- Cache frequently accessed data

**Frontend Performance:**
- Memoize expensive calculations
- Use React.lazy for code splitting
- Implement virtual scrolling for long lists

### Security Considerations

**Data Validation:**
- Validate all user inputs
- Sanitize data from external APIs
- Use Convex validation rules

**Environment Variables:**
- Never commit API keys
- Use `VITE_` prefix for frontend variables
- Backend keys go in Convex dashboard

---

## Common Patterns

### API Integration

**Convex Action Pattern:**
```typescript
export const fetchStartups = action({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const response = await fetch('https://api.example.com');
    const data = await response.json();
    return ctx.db.insert('startups', data);
  }
});
```

**Frontend Hook Pattern:**
```typescript
export const useStartups = (filters?: Filters) => {
  return useQuery(api.startups.list, filters || {});
};
```

### Component Patterns

**Modal Pattern:**
```typescript
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ 
  isOpen, 
  onClose,
  children 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-xl p-6 max-w-lg w-full">
        {children}
      </div>
    </div>
  );
};
```

---

## Git Workflow

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Be descriptive about what changed and why
- Reference issue numbers when applicable

### Branch Strategy
- Main branch: `master`
- Feature branches: `feature/feature-name`
- Fix branches: `fix/issue-description`
- Release branches: `release/version`

---

## Environment Setup

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Set up Convex
npx convex auth
npx convex dev

# 3. Start frontend
npm run dev

# 4. Set environment variables in .env.local
VITE_CONVEX_URL=your-convex-url
```

### Required Environment Variables
```bash
# Frontend (prefix with VITE_)
VITE_CONVEX_URL=https://your-project.convex.cloud
VITE_GEMINI_API_KEY=your-gemini-key

# Backend (set in Convex dashboard)
FIRECRAWL_API_KEY=your-firecrawl-key
HUNTER_API_KEY=your-hunter-key
```

---

## Debugging

### Common Issues
1. **Convex Connection**: Check `VITE_CONVEX_URL` is set correctly
2. **Generated Types**: Run `npx convex dev` to regenerate types
3. **Database Not Updated**: Use `npx convex push` after schema changes
4. **Import Errors**: Check file paths and use `@/` alias

### Debugging Tools
- Convex Dashboard: localhost:8000 during dev
- React DevTools for component debugging
- Network tab for API calls
- Console for Convex operation logs

---

## File Quick Reference

### Essential Files
- `convex/schema.ts`: Database schema definition
- `convex/queries/startups.ts`: Frontend data access
- `services/convexService.ts`: React hooks wrapper
- `components/DashboardRefactored.tsx`: Main UI component
- `types.ts`: TypeScript type definitions
- `vite.config.ts`: Build and alias configuration

### When Adding Features
1. Update types in `types.ts`
2. Add Convex functions in `convex/`
3. Create service hooks in `services/`
4. Build UI components in `components/`
5. Update documentation

---

## Best Practices Summary

### DO ✅
- Use TypeScript for all new code
- Handle all async operations properly
- Follow the established import order
- Use semantic HTML elements
- Write meaningful commit messages
- Test in multiple screen sizes
- Use Convex for all data operations

### DON'T ❌
- Commit API keys or secrets
- Use `any` type without justification
- Skip error handling
- Write inline styles (use Tailwind classes)
- Ignore accessibility (ARIA labels, etc.)
- Create deeply nested component structures
- Modify generated Convex files directly

---

This guide serves as the primary reference for agents working on Scoutly. Keep it updated as the codebase evolves.