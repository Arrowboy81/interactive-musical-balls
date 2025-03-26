const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Audio setup
let audioContext;
let masterGainNode;
let reverbNode;
let drumLoopInterval;

// Musical scale in C major (frequencies in Hz)
const C_MAJOR_SCALE = {
    C: 261.63,  // Middle C
    D: 293.66,  // D
    E: 329.63,  // E
    F: 349.23,  // F
    G: 392.00,  // G
    A: 440.00,  // A
    B: 493.88   // B
};

// Drum samples
const DRUM_SAMPLES = {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]  // Kick on every beat (4/4)
};

// Create reverb impulse response
function createReverbImpulse() {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds of reverb
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    // Create a simple exponential decay
    for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (sampleRate * 0.5));
        leftChannel[i] = (Math.random() * 2 - 1) * decay;
        rightChannel[i] = (Math.random() * 2 - 1) * decay;
    }

    return impulse;
}

// Initialize audio
function initAudio() {
    if (audioContext) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGainNode = audioContext.createGain();
    
    // Create and set up reverb
    reverbNode = audioContext.createConvolver();
    reverbNode.buffer = createReverbImpulse();
    
    // Create reverb mix control
    const reverbGain = audioContext.createGain();
    reverbGain.gain.value = 0.5; // Increased from 0.3 to 0.5 for more reverb
    
    // Connect nodes
    masterGainNode.connect(audioContext.destination);
    masterGainNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(audioContext.destination);
    
    masterGainNode.gain.value = 0.1;
}

// Create collision sound
function createCollisionSound(velocity, x, y) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const delay = audioContext.createDelay();
    const delayGain = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    
    // Set up compressor for warmer sound
    compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
    compressor.knee.setValueAtTime(30, audioContext.currentTime);
    compressor.ratio.setValueAtTime(12, audioContext.currentTime);
    compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
    compressor.release.setValueAtTime(0.25, audioContext.currentTime);
    
    // Set up delay for subtle echo effect
    delay.delayTime.setValueAtTime(0.15, audioContext.currentTime);
    delayGain.gain.setValueAtTime(0.1, audioContext.currentTime);
    delayGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);
    
    // Set up filter for warmer sound
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.4);
    filter.Q.setValueAtTime(4, audioContext.currentTime);
    
    // Use sine wave for purer tone, with slight detuning for richness
    oscillator.type = 'sine';
    
    // Select note based on position and velocity
    const scaleNotes = Object.values(C_MAJOR_SCALE);
    const noteIndex = Math.floor((x / canvas.width) * scaleNotes.length);
    const selectedNote = scaleNotes[noteIndex % scaleNotes.length];
    
    // Add slight pitch variation based on velocity
    const velocityFactor = 1 + (Math.abs(velocity) * 0.0001);
    const frequency = selectedNote * velocityFactor;
    
    // Add slight detuning for richer sound
    oscillator.frequency.setValueAtTime(frequency * 1.001, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.999, audioContext.currentTime + 0.3);
    
    // Calculate volume based on velocity (longer sustain)
    const volume = Math.min(0.12, Math.abs(velocity) * 0.01);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
    gainNode.gain.setTargetAtTime(volume * 0.4, audioContext.currentTime + 0.1, 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.2);
    
    // Connect nodes with new processing chain
    oscillator.connect(filter);
    filter.connect(compressor);
    compressor.connect(gainNode);
    compressor.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(masterGainNode);
    gainNode.connect(masterGainNode);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1.2);
}

// Create drum sounds
function createDrumSound(type) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    switch(type) {
        case 'kick':
            oscillator.type = 'sine';
            // Lower starting frequency for deeper sound
            oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
            // Slower frequency drop for more sustain
            oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.8);
            
            // Set up filter for more character
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, audioContext.currentTime);
            filter.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.8);
            filter.Q.setValueAtTime(10, audioContext.currentTime);
            
            // Longer sustain with slower decay
            gainNode.gain.setValueAtTime(0.375, audioContext.currentTime);
            gainNode.gain.setTargetAtTime(0.375 * 0.5, audioContext.currentTime + 0.1, 0.3);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(masterGainNode);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.8);
            break;
    }
}

// Start drum loop
function startDrumLoop() {
    if (drumLoopInterval) return;
    
    const BPM = 100;
    const beatDuration = 60 / BPM;
    const stepDuration = beatDuration / 4; // 16th notes
    
    let step = 0;
    
    drumLoopInterval = setInterval(() => {
        if (DRUM_SAMPLES.kick[step]) createDrumSound('kick');
        
        step = (step + 1) % 16;
    }, stepDuration * 1000);
}

// Add start button
const startButton = document.createElement('button');
startButton.textContent = 'Start Beat';
startButton.style.position = 'fixed';
startButton.style.top = '20px';
startButton.style.left = '20px';
startButton.style.zIndex = '1000';
startButton.style.padding = '10px 20px';
startButton.style.fontSize = '16px';
startButton.style.fontFamily = "'Poppins', sans-serif";
startButton.style.fontWeight = '500';
startButton.style.cursor = 'pointer';
startButton.style.backgroundColor = '#4ECDC4';
startButton.style.border = 'none';
startButton.style.borderRadius = '5px';
startButton.style.color = 'white';
document.body.appendChild(startButton);

// Add stop button
const stopButton = document.createElement('button');
stopButton.textContent = 'Stop Beat';
stopButton.style.position = 'fixed';
stopButton.style.top = '20px';
stopButton.style.left = '120px'; // Position it to the right of the start button
stopButton.style.zIndex = '1000';
stopButton.style.padding = '10px 20px';
stopButton.style.fontSize = '16px';
stopButton.style.fontFamily = "'Poppins', sans-serif";
stopButton.style.fontWeight = '500';
stopButton.style.cursor = 'pointer';
stopButton.style.backgroundColor = '#FF3B30'; // Red color for stop
stopButton.style.border = 'none';
stopButton.style.borderRadius = '5px';
stopButton.style.color = 'white';
stopButton.style.display = 'none'; // Initially hidden
document.body.appendChild(stopButton);

// Function to stop the drum loop
function stopDrumLoop() {
    if (drumLoopInterval) {
        clearInterval(drumLoopInterval);
        drumLoopInterval = null;
        stopButton.style.display = 'none';
        startButton.style.display = 'block';
    }
}

startButton.addEventListener('click', () => {
    initAudio();
    startDrumLoop();
    startButton.style.display = 'none';
    stopButton.style.display = 'block';
});

stopButton.addEventListener('click', stopDrumLoop);

// Mouse position tracking
let mouseX = 0;
let mouseY = 0;
const MOUSE_INFLUENCE_RADIUS = 100;
const REPULSION_STRENGTH = 3.75; // Increased from 2.5 to 3.75 (50% faster)
const MAX_SPEED = 2.25; // Increased from 1.5 to 2.25 (50% faster)

// Set canvas size to match container
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

// Initial resize and event listener
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Track mouse movement
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

class Ball {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.dx = (Math.random() - 0.5) * 0.75;
        this.dy = (Math.random() - 0.5) * 0.75;
        this.lastCollisionTime = 0;
        this.collisionCooldown = 0.1;
        this.opacity = 1;
        this.isHovered = false;
    }

    // Limit speed to maximum value
    limitSpeed() {
        const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        if (speed > MAX_SPEED) {
            this.dx = (this.dx / speed) * MAX_SPEED;
            this.dy = (this.dy / speed) * MAX_SPEED;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Modern flat design with subtle shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = this.isHovered ? 12 : 6;
        ctx.shadowOffsetX = this.isHovered ? 3 : 1;
        ctx.shadowOffsetY = this.isHovered ? 3 : 1;
        
        // Solid fill with slight transparency
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.isHovered ? 0.9 : 1;
        
        // Draw the ball
        ctx.fill();
        
        // Reset shadow and opacity
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = 1;
        
        ctx.closePath();
    }

    update(balls) {
        // Mouse interaction
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < MOUSE_INFLUENCE_RADIUS) {
            const angle = Math.atan2(dy, dx);
            const force = (MOUSE_INFLUENCE_RADIUS - distance) / MOUSE_INFLUENCE_RADIUS * REPULSION_STRENGTH;
            this.dx += Math.cos(angle) * force;
            this.dy += Math.sin(angle) * force;
            this.isHovered = true;
        } else {
            this.isHovered = false;
        }

        // Update opacity based on hover state
        this.opacity = this.isHovered ? 0.8 : 1;

        // Add more drag to prevent excessive speeds
        this.dx *= 0.998; // Adjusted from 0.997 to 0.998 for less drag
        this.dy *= 0.998;

        // Limit speed after all forces are applied
        this.limitSpeed();

        // Bounce off walls
        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
            this.dx = -this.dx;
        }
        if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
            this.dy = -this.dy;
        }

        // Keep balls within bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x + this.dx));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y + this.dy));

        // Collision detection with other balls
        balls.forEach(ball => {
            if (ball === this) return;

            const dx = ball.x - this.x;
            const dy = ball.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.radius + ball.radius) {
                // Collision detected - calculate new velocities
                const angle = Math.atan2(dy, dx);
                const sin = Math.sin(angle);
                const cos = Math.cos(angle);

                // Rotate velocities
                const vx1 = this.dx * cos + this.dy * sin;
                const vy1 = this.dy * cos - this.dx * sin;
                const vx2 = ball.dx * cos + ball.dy * sin;
                const vy2 = ball.dy * cos - ball.dx * sin;

                // Elastic collision
                const finalVx1 = vx2;
                const finalVx2 = vx1;

                // Rotate velocities back
                this.dx = finalVx1 * cos - vy1 * sin;
                this.dy = vy1 * cos + finalVx1 * sin;
                ball.dx = finalVx2 * cos - vy2 * sin;
                ball.dy = vy2 * cos + finalVx2 * sin;

                // Move balls apart to prevent sticking
                const overlap = (this.radius + ball.radius - distance) / 2;
                this.x -= overlap * cos;
                this.y -= overlap * sin;
                ball.x += overlap * cos;
                ball.y += overlap * sin;

                // Play collision sound
                const currentTime = audioContext ? audioContext.currentTime : 0;
                if (currentTime - this.lastCollisionTime > this.collisionCooldown) {
                    const relativeVelocity = Math.sqrt(
                        Math.pow(this.dx - ball.dx, 2) + 
                        Math.pow(this.dy - ball.dy, 2)
                    );
                    // Use the average position of the two colliding balls
                    const avgX = (this.x + ball.x) / 2;
                    createCollisionSound(relativeVelocity, avgX, 0);
                    this.lastCollisionTime = currentTime;
                }
            }
        });

        this.draw();
    }
}

// Create balls with different colors
const colors = [
    '#4A90E2', // Apple Blue
    '#A2AAAD', // Space Gray
    '#FF9500', // Amber
    '#D1D1D6', // Silver
    '#FFD60A', // Yellow
    '#34C759'  // Green
];
const balls = [];
const numBalls = 8;

// Initialize balls
for (let i = 0; i < numBalls; i++) {
    const radius = 20 + Math.random() * 20;
    const x = radius + Math.random() * (canvas.width - 2 * radius);
    const y = radius + Math.random() * (canvas.height - 2 * radius);
    const color = colors[Math.floor(Math.random() * colors.length)];
    balls.push(new Ball(x, y, radius, color));
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    balls.forEach(ball => {
        ball.update(balls);
    });

    requestAnimationFrame(animate);
}

animate(); 