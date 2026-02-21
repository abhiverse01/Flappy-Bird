// --- Game Configuration & Constants ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.5;
const TERMINAL_VELOCITY = 10;
const FLAP_STRENGTH = -8;
const PIPE_WIDTH = 60;
const BIRD_SIZE = 24;

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let frames = 0;
let score = 0;
let highScore = localStorage.getItem('flappyHighScore') || 0;
let difficultySettings = {
    easy: { pipeGap: 170, pipeSpeed: 2, spawnRate: 200 },
    hard: { pipeGap: 140, pipeSpeed: 3, spawnRate: 150 },
    insane: { pipeGap: 110, pipeSpeed: 4.5, spawnRate: 120 }
};
let currentDifficulty = 'easy';

// Game Objects
let bird;
let pipes = [];
let particles = [];
let clouds = [];

// UI Elements
const menuScreen = document.getElementById('menu-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');

// --- Classes ---

class Bird {
    constructor() {
        this.x = 80;
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.rotation = 0; // Radians
        this.radius = BIRD_SIZE / 2;
        this.flapFrame = 0;
    }

    flap() {
        this.velocity = FLAP_STRENGTH;
        this.flapFrame = 10; // Animation frame counter
        // Create flap particles
        for(let i=0; i<5; i++) {
            particles.push(new Particle(this.x, this.y, 'flap'));
        }
    }

    update() {
        this.velocity += GRAVITY;
        
        // Terminal Velocity Cap
        if (this.velocity > TERMINAL_VELOCITY) this.velocity = TERMINAL_VELOCITY;
        
        this.y += this.velocity;

        // Rotation Logic: Point upwards if flapping, downwards if falling
        // Lerp rotation for smoothness
        let targetRotation = 0;
        if (this.velocity < 0) {
            targetRotation = -0.5; // Tilt up
            this.flapFrame--;
        } else if (this.velocity > 2) {
            targetRotation = Math.min(1.5, this.velocity * 0.1); // Tilt down based on speed
        }
        
        // Smooth rotation transition
        this.rotation += (targetRotation - this.rotation) * 0.1;

        // Boundaries
        if (this.y + this.radius >= canvas.height) {
            this.y = canvas.height - this.radius;
            gameOver();
        }
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Body (Yellow)
        ctx.fillStyle = '#f7dc6f';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d4ac0d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Wing (White/Orange)
        ctx.fillStyle = '#ffffff';
        let wingY = (this.flapFrame > 0) ? -4 : 2;
        ctx.beginPath();
        ctx.ellipse(-2, wingY, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ccc';
        ctx.stroke();

        // Eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(6, -4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(8, -4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(20, 5);
        ctx.lineTo(10, 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class Pipe {
    constructor(x) {
        this.x = x;
        this.width = PIPE_WIDTH;
        const settings = difficultySettings[currentDifficulty];
        this.gap = settings.pipeGap;
        this.speed = settings.pipeSpeed;
        
        // Random Gap Position
        const minPipeHeight = 50;
        const maxPipeHeight = canvas.height - this.gap - minPipeHeight;
        this.topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
        this.bottomY = this.topHeight + this.gap;
        
        this.passed = false;
    }

    update() {
        this.x -= this.speed;
        
        // Collision Detection
        // Horizontal overlap
        if (bird.x + bird.radius > this.x && bird.x - bird.radius < this.x + this.width) {
            // Vertical overlap (hit top pipe OR hit bottom pipe)
            if (bird.y - bird.radius < this.topHeight || bird.y + bird.radius > this.bottomY) {
                gameOver();
            }
        }

        // Score Update
        if (this.x + this.width < bird.x && !this.passed) {
            score++;
            scoreDisplay.innerText = score;
            this.passed = true;
        }
    }

    draw() {
        const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        gradient.addColorStop(0, '#2ecc71');
        gradient.addColorStop(0.5, '#58d68d');
        gradient.addColorStop(1, '#27ae60');

        // Top Pipe
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        
        // Top Pipe Cap
        ctx.fillRect(this.x - 5, this.topHeight - 20, this.width + 10, 20);
        ctx.strokeStyle = '#1e8449';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - 5, this.topHeight - 20, this.width + 10, 20);

        // Bottom Pipe
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.bottomY, this.width, canvas.height - this.bottomY);
        
        // Bottom Pipe Cap
        ctx.fillRect(this.x - 5, this.bottomY, this.width + 10, 20);
        ctx.strokeRect(this.x - 5, this.bottomY, this.width + 10, 20);
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === 'flap') {
            this.vx = (Math.random() * 2 - 1) * -2; // Mostly left
            this.vy = (Math.random() * 2 - 1) * 2;
            this.life = 20;
            this.color = '#fff';
            this.size = 3;
        } else if (type === 'death') {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.life = 60;
            this.color = ['#f1c40f', '#e67e22', '#e74c3c'][Math.floor(Math.random()*3)];
            this.size = Math.random() * 6 + 2;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.95; // shrink
        if(this.type === 'death') this.vy += 0.2; // gravity on death particles
    }

    draw() {
        ctx.globalAlpha = this.life / 60;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Cloud {
    constructor() {
        this.x = canvas.width + Math.random() * 200;
        this.y = Math.random() * canvas.height * 0.5;
        this.speed = Math.random() * 0.5 + 0.2;
        this.size = Math.random() * 40 + 30;
        this.opacity = Math.random() * 0.4 + 0.1;
    }

    update() {
        this.x -= this.speed;
        if (this.x < -100) {
            this.x = canvas.width + Math.random() * 200;
            this.y = Math.random() * canvas.height * 0.5;
        }
    }

    draw() {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#ffffff';
        // Draw simple cloud shape
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.arc(this.x + this.size * 0.6, this.y - this.size * 0.2, this.size * 0.7, 0, Math.PI * 2);
        ctx.arc(this.x - this.size * 0.6, this.y, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- Game Logic Functions ---

function init() {
    bird = new Bird();
    pipes = [];
    particles = [];
    clouds = [];
    score = 0;
    scoreDisplay.innerText = score;
    frames = 0;
    
    // Initialize Clouds
    for(let i=0; i<5; i++) {
        let c = new Cloud();
        c.x = Math.random() * canvas.width;
        clouds.push(c);
    }
}

function selectDifficulty(diff) {
    currentDifficulty = diff;
    document.querySelectorAll('.btn-difficulty').forEach(btn => btn.classList.remove('selected'));
    document.getElementById(`btn-${diff}`).classList.add('selected');
}

function startGame() {
    init();
    gameState = 'PLAYING';
    menuScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
}

function restartGame() {
    init();
    gameState = 'PLAYING';
    gameoverScreen.classList.add('hidden');
}

function showMenu() {
    gameState = 'MENU';
    menuScreen.classList.remove('hidden');
    gameoverScreen.classList.add('hidden');
    // Reset animation frame but don't run game loop
    // Draw a static background for menu? 
    // The menu overlay covers the canvas, but we can start the loop for visual bg effect.
    animate(); 
}

function gameOver() {
    if (gameState !== 'PLAYING') return;
    
    gameState = 'GAMEOVER';
    
    // Create Explosion
    for(let i=0; i<30; i++) {
        particles.push(new Particle(bird.x, bird.y, 'death'));
    }

    // Update High Score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }

    // Show Screen after a small delay
    setTimeout(() => {
        finalScoreEl.innerText = score;
        bestScoreEl.innerText = highScore;
        gameoverScreen.classList.remove('hidden');
    }, 500);
}

// --- Main Loop ---

function animate() {
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background (Sky)
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cloud Logic (Always render for background movement effect)
    clouds.forEach(cloud => {
        cloud.update();
        cloud.draw();
    });

    if (gameState === 'PLAYING') {
        bird.update();
        
        // Pipe Spawning
        const settings = difficultySettings[currentDifficulty];
        if (frames % settings.spawnRate === 0) {
            pipes.push(new Pipe(canvas.width));
        }

        // Pipe Update & Cleanup
        pipes.forEach(pipe => pipe.update());
        pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);

        // Increase difficulty slightly as score increases (God Mode logic)
        if (score > 0 && score % 10 === 0 && frames % 60 === 0) {
             // Optional: Dynamic difficulty increase
             // settings.pipeSpeed += 0.01; 
        }
    }

    // Draw Pipes
    pipes.forEach(pipe => pipe.draw());

    // Draw Particles
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    particles = particles.filter(p => p.life > 0);

    // Draw Bird
    if (gameState !== 'MENU') {
        bird.draw();
    } else {
        // Animate menu bird floating?
        // Keep simple for now
    }

    frames++;
    requestAnimationFrame(animate);
}

// --- Input Handling ---

document.addEventListener("keydown", function(event) {
    if (event.code === "Space") {
        if (gameState === 'PLAYING') bird.flap();
        if (gameState === 'GAMEOVER') restartGame();
        if (gameState === 'MENU') startGame();
    }
});

canvas.addEventListener('click', function() {
    if (gameState === 'PLAYING') bird.flap();
});

// Initial Start
init();
animate();
