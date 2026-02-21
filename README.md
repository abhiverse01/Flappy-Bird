# Flappy Bird: God Mode Edition

A modernised, physics-based reimplementation of the classic Flappy Bird built with vanilla JavaScript and HTML5 Canvas. This version features a "God Mode" code architecture, supporting 60fps rendering, dynamic difficulty, particle systems, and clean Object-Oriented Programming patterns.

## Features

*   **60fps Game Loop**: Uses `requestAnimationFrame` for smooth, jank-free rendering.
*   **Physics Engine**: Realistic gravity, velocity capping (terminal velocity), and rotation interpolation.
*   **Parallax Background**: Multi-layered clouds moving at varying speeds to create depth.
*   **Particle Systems**: Visual feedback for flapping and a "death explosion" effect.
*   **State Management**: Robust handling of Menu, Playing, and Game Over states.
*   **Local Storage**: High scores are saved locally in the browser.
*   **Responsive Controls**: Supports both Keyboard (Spacebar) and Mouse/Touch input.

### The Upgrades:
1.  **Game Engine**: Switched from `setInterval` to `requestAnimationFrame` for buttery-smooth 60fps rendering.
2.  **Physics**: Added terminal velocity, realistic acceleration, and rotation physics (the bird tilts up when flapping and noses down when falling).
3.  **Visuals**: Implemented a parallax background (clouds moving at different speeds), rendered vector-graphics style bird and pipes (no external images needed), and a particle system for death effects.
4.  **UI/UX**: A modern game state machine (Menu -> Play -> Game Over), high score tracking (saved to browser), and responsive mobile touch controls.
5.  **Code Structure**: Modular code using JavaScript Classes for the Bird, Pipes, and Particles.

## Game Logic & Physics Explanation

### 1. The Game Loop
The core of the engine relies on `requestAnimationFrame` rather than `setInterval`.
*   **Why?** `setInterval` runs asynchronously and can cause "frame stacking" if the logic takes longer than the interval to execute. `requestAnimationFrame` synchronises updates with the browser's refresh rate (usually 60Hz), ensuring smooth animation and better performance.

### 2. Bird Physics
The bird's movement is governed by a simplified Newtonian physics model.

**Gravity & Acceleration:**
Every frame, a constant gravity force is added to the bird's vertical velocity ($V_y$).
$$V_{new} = V_{old} + G$$
Where $G \approx 0.5$ pixels/frame².

**Terminal Velocity:**
Without a cap, a falling bird could accelerate infinitely, making the game unplayable. We enforce a terminal velocity ($V_{max}$):
$$V_y = \min(V_y, V_{max})$$
This ensures the bird never falls faster than the collision detection can reliably register.

**The Flap (Impulse):**
Flapping is not a continuous force; it is an instantaneous impulse. When the user presses space, the velocity is immediately set to a negative value (upward):
$$V_y = -8$$
This resets the downward momentum instantly, creating the signature "hop" feel.

**Rotation Mapping:**
The visual rotation of the bird is mapped linearly to its velocity.
*   If $V_y < 0$ (Moving Up): Bird tilts up (approx -25 degrees).
*   If $V_y > 0$ (Moving Down): Bird tilts down, proportional to speed (capped at 90 degrees).
*   **Lerping**: To prevent jerky movements, the rotation angle is interpolated (Lerped) frame-by-frame rather than set instantly.

### 3. Collision Detection
The game uses Axis-Aligned Bounding Box (AABB) collision detection simplified for circular objects.
*   The bird is treated as a circle with a radius ($r$).
*   Pipes are rectangles.
*   A collision is registered if the circle overlaps the rectangle area. For optimisation, we check the bird's centre coordinate +/- its radius against the pipe boundaries.

### 4. Difficulty Scaling
Difficulty is managed via a configuration object:
```javascript
difficultySettings = {
    easy: { pipeGap: 170, pipeSpeed: 2, spawnRate: 200 },
    // ...
}
```
*   **Pipe Gap**: The vertical space between top and bottom pipes.
*   **Pipe Speed**: The horizontal velocity of obstacles moving left.
*   **Spawn Rate**: The delay (in frames) between new pipe generation.

### 5. Object Pooling & Cleanup
To prevent memory leaks, pipes and particles are removed from their respective arrays once they leave the screen (x < -width) or their life timer expires. This keeps the array sizes small and iteration fast.

## How to Run
1.  Clone the repository.
2.  Open `index.html` in any modern web browser.
3.  Select a difficulty and click **START GAME**.

## Controls
*   **Spacebar / Click / Tap**: Flap wings.
