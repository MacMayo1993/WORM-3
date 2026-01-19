# Changelog

All notable changes to the WORM-3 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive code refactoring and modularization
- `ARCHITECTURE.md` - Detailed architecture and topology documentation
- `DEVELOPMENT.md` - Development setup and guidelines
- Enhanced `README.md` with badges, demo link, and "How to Play" section
- `CHANGELOG.md` - Version history tracking
- `.prettierrc` - Code formatting configuration
- Test infrastructure (`src/__tests__/`)
- PR template (`.github/pull_request_template.md`)
- Enhanced issue templates (enhancement, question)

### Changed
- **Major Refactoring**: Split monolithic `App.jsx` (4,459 lines) into modular structure (973 lines)
- Organized code into logical directories:
  - `src/utils/` - Constants, audio, routing
  - `src/game/` - Core game logic
  - `src/manifold/` - Topology visualization
  - `src/3d/` - Three.js components
  - `src/components/` - UI components
- Updated `.gitignore` with better documentation for Vite build output
- Improved code maintainability and testability

### Fixed
- Code organization for better navigation and debugging
- Module separation for easier testing
- Import paths now use explicit `.js` extensions for better ES module compatibility

## [1.0.0] - 2024-XX-XX (Previous Release)

### Added
- Interactive 3D Rubik's Cube with Three.js
- Antipodal topology visualization
- Manifold grid background with projective plane mapping
- Wormhole tunnel network visualization
- Flip mode for antipodal sticker pairing
- Chaos mode with 4 difficulty levels
- Multiple win conditions (Rubik's, Sudokube, Ultimate)
- Visual modes (Classic, Grid, Sudokube, Wireframe)
- Exploded view for cube inspection
- Keyboard controls for speedcube solving
- Tutorial system (welcome, first flip)
- Victory screens with statistics
- Retro 70s aesthetic styling
- GitHub Pages deployment automation
- Support for 3×3, 4×4, and 5×5 cubes
- Interactive menus and settings
- Help documentation
- Progress tracking and metrics
- Audio feedback and haptic vibrations

### Technical
- React 18 with modern hooks
- @react-three/fiber for Three.js integration
- @react-three/drei for helper components
- Vite build system
- GitHub Actions CI/CD pipeline
- ESLint configuration
- Node 18 requirement

## [0.1.0] - Initial Prototype

### Added
- Basic cube rendering
- Simple rotation mechanics
- Initial topology concepts

---

## Version History

- **[Unreleased]**: Current development work (refactoring and documentation)
- **[1.0.0]**: First public release with full game mechanics
- **[0.1.0]**: Initial prototype

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to contribute to this project.
