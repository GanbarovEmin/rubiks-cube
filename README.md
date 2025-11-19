# 3D Rubik's Cube Simulation

A beautiful 3D Rubik's cube simulation with smooth animations, built with Three.js.

## Features

- **3D Visualization**: Fully interactive 3D Rubik's cube rendered with Three.js
- **Smooth Animations**: Cubic easing for fluid face rotations
- **Shuffle Button**: Randomly shuffles the cube with 25 random moves
- **Solve Button**: Reverses all shuffle moves to restore the cube to solved state
- **Interactive Controls**: Drag to rotate the camera view around the cube

## How to Use

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, or Edge)
2. Use your mouse to drag and rotate the camera around the cube
3. Click **Shuffle** to randomly scramble the cube
4. Click **Solve** to animate the cube back to its solved state

## Technical Details

- Built with Three.js for 3D rendering
- Uses OrbitControls for camera interaction
- Implements proper 3x3x3 Rubik's cube mechanics
- Tracks move history to enable solve functionality
- Smooth animations with cubic easing functions

## Browser Requirements

- Modern browser with WebGL support
- ES6 modules support
- No build process required - runs directly in the browser

