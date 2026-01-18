# Worm3-puzzle: Antipodal Topology via Rubik's Cube

Welcome to **Worm3-puzzle**, an interactive 3D visualization exploring the concept of **Antipodal Topology** through the lens of a Rubik's Cube. This project visualizes non-orientable manifolds and complex geometric transformations directly in your browser.

## 🚀 Features

- **Interactive 3D Puzzle**: a fully manipulatable 3D cube interface.
- **Topological Visualization**: Visual cues representing antipodal mappings and manifold structures.
- **Dynamic Physics**: Explode and rotate the cube to inspect internal geometries.
- **Modern Tech Stack**: Built with React, Three.js (@react-three/fiber), and Vite for high performance.

## 🛠️ Technology Stack

- **Core**: React 18
- **3D Engine**: Three.js, @react-three/fiber, @react-three/drei
- **Build Tool**: Vite
- **Language**: JavaScript (ES Modules)

## 🏁 Getting Started

### Prerequisites

- Node.js (v16+)
- npm (v7+)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/MacMayo1993/Worm3-puzzle.git
    cd Worm3-puzzle
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:5173`.

### Building for Production

To build the project for production:

```bash
npm run build
```

This will generate optimized files in the `dist/` directory.

## 📦 Deployment

This project is configured for automated deployment to **GitHub Pages**.

- Push changes to the `main` branch
- GitHub Actions automatically builds and deploys the site
- Access the live site at **https://macmayo1993.github.io/Worm3-puzzle/**

The deployment workflow:
1. Installs dependencies
2. Builds the project with `npm run build`
3. Deploys the `dist/` folder to GitHub Pages

## 🤝 Contributing

Contributions are welcome! Please check out our [Contribution Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report bugs, or request features.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
