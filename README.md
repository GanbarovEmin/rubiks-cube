# 3D Rubik's Cube Simulation

An elegant Rubik's cube playground that pairs a premium liquid-glass HUD with silky Three.js animations.

## Features

- **Liquid Glass HUD** – pearlescent background, frosted-glass status chips, and premium buttons inspired by iOS.
- **Move Counter** – glass indicator tracks every manual twist so you instantly see your solve progress.
- **Hint Button (`Подсказка`)** – highlights the exact layer to turn, flashing an on-cube glow when you're stuck.
- **Shuffle / Solve** – scramble with randomized moves and instantly unwind via reversible move history.
- **Speed Presets** – toggle Slow / Normal / Fast to pick your preferred animation tempo.
- **Keyboard & Pointer Controls** – drag stickers, orbit the camera, or use `R L U D F B` (+ `Shift` for inverse).
- **Settings Panel** – toggle drag vs gizmo controls, pick animation speed, flip sound on/off, and switch between light or dark themes with session persistence.

## How to Use

1. Open `index.html` in a modern WebGL-capable browser.
2. Drag the background to orbit the camera or drag stickers to twist layers.
3. Click **Shuffle** to randomize, **Solve** to undo the scramble, and **Подсказка** to glow the next recommended turn.
4. Watch the status and move counter HUD elements update live inside the liquid-glass panels.

## Technical Details

- Three.js + OrbitControls handle rendering and navigation.
- Balanced move history keeps the solve stack accurate and powers the hint suggestion.
- Hint overlays use transient translucent planes that auto-dismiss after a short duration.
- No bundler required: vanilla HTML + JS served statically.

## Testing

The repository uses Node's built-in test runner for lightweight smoke checks:

```bash
npm test
```

This validates the presence of the HUD scaffolding, hint workflow wiring, and README documentation, ensuring regressions are caught automatically.

## Browser Requirements

- Modern browser with WebGL support
- ES6 support (for template literals and modern syntax)

