# Contributing to Worm3 Puzzle

Thank you for your interest in contributing to Worm3 Puzzle! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear descriptive title**
- **Detailed description** of the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (browser, OS, Node version)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear descriptive title**
- **Detailed description** of the proposed feature
- **Use cases** and examples
- **Mockups or diagrams** if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following the coding standards
4. **Test thoroughly** to ensure nothing breaks
5. **Commit your changes** with clear, descriptive messages
6. **Push to your fork** and submit a pull request

#### Pull Request Guidelines

- Follow the existing code style and conventions
- Keep changes focused - one feature/fix per PR
- Update documentation if needed
- Add comments for complex logic
- Ensure the build passes: `npm run build`
- Write clear commit messages

#### Commit Message Format

```
<type>: <subject>

<body>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```
feat: add undo/redo functionality for cube moves

Implemented a move history stack that allows users to undo
and redo their cube rotations using keyboard shortcuts.
```

## Development Setup

1. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/Worm3-puzzle.git
cd Worm3-puzzle
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Make changes and test in your browser at `http://localhost:5173`

## Coding Standards

### JavaScript/React

- Use **functional components** with hooks
- Follow **React best practices**
- Use **meaningful variable names**
- Add **comments** for complex algorithms
- Keep **components focused** and single-purpose
- Use **destructuring** where appropriate
- Prefer **const** over **let**, avoid **var**

### File Organization

- Components in `src/` directory
- Styles in corresponding `.css` files
- Keep files focused and manageable in size
- Use clear, descriptive file names

### Code Style

- Use **2 spaces** for indentation
- Use **semicolons**
- Use **single quotes** for strings (unless template literals)
- Max line length: **100 characters** (flexible)
- Add trailing commas in multi-line objects/arrays

## Testing

Currently, the project doesn't have automated tests, but you should:

- Manually test all cube rotations
- Verify UI responsiveness
- Test in multiple browsers (Chrome, Firefox, Safari)
- Check for console errors
- Ensure smooth animations and performance

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments for complex functions
- Document any new dependencies
- Update this CONTRIBUTING.md if you change the contribution process

## Questions?

Feel free to open an issue with the `question` label if you need help or clarification.

## Attribution

Contributors will be acknowledged in the project. Thank you for helping make Worm3 Puzzle better!
