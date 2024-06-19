
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let bird = {
    x: 50,
    y: 150,
    width: 68,
    height: 48,
    gravity: 0.3,
    lift: -4,
    velocity: 0
};

let pipes = [];
let score = 0;
let gap = 260;
let pipeSpeed = 2;
let difficulty = "easy";
let gameInterval;
let isGameOver = false;

document.addEventListener("keydown", function(event) {
    if (event.code === "Space") {
        bird.velocity = bird.lift;
    }
});

function startGame(selectedDifficulty) {
    document.querySelector('.difficulty').style.display = 'none';
    difficulty = selectedDifficulty;
    switch (difficulty) {
        case 'easy':
            gap = 260;
            pipeSpeed = 2;
            break;
        case 'hard':
            gap = 195;
            pipeSpeed = 3;
            break;
        case 'advanced':
            gap = 130;
            pipeSpeed = 4;
            break;
    }
    resetGame();
    startCountdown();
}

function resetGame() {
    bird.y = 150;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    isGameOver = false;
    clearInterval(gameInterval);
}

function startCountdown() {
    let countdown = 3;
    let countdownInterval = setInterval(function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "48px Arial";
        ctx.fillText(countdown, canvas.width / 2 - 10, canvas.height / 2);
        countdown--;
        if (countdown < 0) {
            clearInterval(countdownInterval);
            gameInterval = setInterval(updateGame, 1000 / 60);
        }
    }, 1000);
}

function updateGame() {
    if (isGameOver) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver();
    }

    if (pipes.length === 0 || pipes[pipes.length - 1].x < 100) {
        let pipeHeight = Math.floor(Math.random() * (canvas.height - gap - 200)) + 50;
        pipes.push({ x: canvas.width, y: pipeHeight });
    }

    pipes.forEach((pipe, index) => {
        pipe.x -= pipeSpeed;
        if (pipe.x + 50 < 0) {
            pipes.splice(index, 1);
            score++;
        }
        ctx.fillStyle = createGradient(pipe.x, 50);
        ctx.fillRect(pipe.x, 0, 50, pipe.y);
        ctx.fillRect(pipe.x, pipe.y + gap, 50, canvas.height - pipe.y - gap);

        if (bird.x + bird.width > pipe.x && bird.x < pipe.x + 50 &&
            (bird.y < pipe.y || bird.y + bird.height > pipe.y + gap)) {
            gameOver();
        }
    });

    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(bird.x + bird.width / 2, bird.y + bird.height / 2, bird.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "24px Arial";
    ctx.fillText("Score: " + score, 10, 30);
}

function createGradient(x, width) {
    let gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, "#006400");
    gradient.addColorStop(1, "#00FF00");
    return gradient;
}

function gameOver() {
    isGameOver = true;
    clearInterval(gameInterval);
    ctx.font = "48px Arial";
    ctx.fillText("Game Over", canvas.width / 2 - 150, canvas.height / 2);
}
