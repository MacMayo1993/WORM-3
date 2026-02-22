# WORM-3 Development Guide

## Getting Started

### Prerequisites

- **Node.js**: Version 18.x (specified in `.nvmrc`)
- **npm**: Comes with Node.js
- **Git**: For version control

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/MacMayo1993/WORM-3.git
cd WORM-3

# Install Node.js 18 (if using nvm)
nvm use

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will start at `http://localhost:5173`.

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

```
WORM-3/
├── .devcontainer/          # VS Code dev container configuration
├── .github/
│   ├── workflows/          # GitHub Actions CI/CD
│   └── ISSUE_TEMPLATE/     # Issue templates
├── public/                 # Static assets (deployed as-is)
│   ├── .nojekyll           # Disable Jekyll on GitHub Pages
│   └── *.svg               # Static SVG files
├── src/
│   ├── utils/              # Utility functions and constants
│   ├── game/               # Game logic (cube state, rotations, win detection)
│   ├── manifold/           # Topology visualization components
│   ├── 3d/                 # Three.js 3D components
│   ├── components/         # UI components (menus, screens, overlays)
│   ├── __tests__/          # Test files
│   ├── App.jsx             # Main application
│   ├── App.css             # Styling
│   └── main.jsx            # Entry point
├── dist/                   # Build output (gitignored)
├── ARCHITECTURE.md         # Architecture documentation
├── DEVELOPMENT.md          # This file
├── CHANGELOG.md            # Version history
├── README.md               # Project overview
└── package.json            # Dependencies and scripts
```

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style (see Code Style section)
   - Test your changes locally
   - Update documentation if needed

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(game): add undo/redo functionality
fix(cube): resolve rotation animation glitch
docs(readme): add installation instructions
refactor(components): extract menu components to separate files
```

## Code Style

### File Organization

- **One component per file**: Each React component should be in its own file
- **Named exports for utilities**: Use named exports for utility functions
- **Default exports for components**: Use default export for React components
- **Colocate related files**: Keep related files in the same directory

### Naming Conventions

- **Components**: PascalCase (`CubeAssembly.jsx`, `WormholeTunnel.jsx`)
- **Utilities**: camelCase (`constants.js`, `smartRouting.js`)
- **Constants**: UPPER_SNAKE_CASE (`COLORS`, `ANTIPODAL_COLOR`)
- **Hooks**: camelCase with `use` prefix (`useGameState.js`)

### Code Formatting

The project uses Prettier for consistent formatting. Configuration in `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 140,
  "arrowParens": "always"
}
```

Run formatter:
```bash
npx prettier --write "src/**/*.{js,jsx}"
```

### Component Structure

```jsx
// Imports
import React, { useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '../utils/constants.js';

// Component
export default function MyComponent({ prop1, prop2 }) {
  // State declarations
  const [state, setState] = useState(initialValue);

  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // Event handlers
  const handleClick = () => {
    // Handler logic
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## Testing

### Running Tests

```bash
# Run tests (when implemented)
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

Place test files in `src/__tests__/` directory:

```javascript
// src/__tests__/cubeState.test.js
import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';

describe('makeCubies', () => {
  it('creates a 3x3x3 cube with correct structure', () => {
    const cubies = makeCubies(3);
    expect(cubies.length).toBe(3);
    expect(cubies[0].length).toBe(3);
    expect(cubies[0][0].length).toBe(3);
  });

  it('initializes stickers with correct colors', () => {
    const cubies = makeCubies(3);
    const cornerCubie = cubies[0][0][0];
    expect(cornerCubie.stickers.NX).toBeDefined();
    expect(cornerCubie.stickers.NY).toBeDefined();
    expect(cornerCubie.stickers.NZ).toBeDefined();
  });
});
```

## Debugging

### Browser DevTools

1. Open browser developer tools (F12)
2. Use React DevTools extension for component inspection
3. Use Three.js Inspector for 3D scene debugging

### Common Issues

**Rotation animation glitches:**
- Check `animState` in React DevTools
- Verify rotation matrix calculations in `cubeRotation.js`

**Tunnel rendering issues:**
- Inspect `manifoldMap` structure
- Check antipodal mapping in `manifoldLogic.js`

**Performance problems:**
- Use React Profiler to identify slow components
- Check for unnecessary re-renders with React DevTools
- Monitor frame rate in browser DevTools

## Building for Production

### Local Build

```bash
npm run build
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Serves the production build at `http://localhost:4173`.

### GitHub Pages Deployment

Deployment is automatic via GitHub Actions when pushing to `main` branch.

**Manual deployment:**
```bash
# Build the project
npm run build

# Deploy to GitHub Pages (if configured)
npm run deploy
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Update documentation
6. Submit a pull request

### Code Review Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated (if applicable)
- [ ] No console errors or warnings
- [ ] Performance impact considered
- [ ] Accessibility maintained
- [ ] Mobile compatibility verified

## Troubleshooting

### Installation Issues

**Node version mismatch:**
```bash
nvm install 18
nvm use 18
```

**Dependency conflicts:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Issues

**Vite build fails:**
- Clear Vite cache: `rm -rf node_modules/.vite`
- Rebuild: `npm run build`

**Missing dependencies:**
```bash
npm install
```

## Resources

- [React Documentation](https://react.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Vite Documentation](https://vitejs.dev/)
- [Projective Plane Mathematics](https://en.wikipedia.org/wiki/Projective_plane)

## Support

- **Issues**: [GitHub Issues](https://github.com/MacMayo1993/WORM-3/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MacMayo1993/WORM-3/discussions)
- **Documentation**: See [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md)
