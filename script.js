// Create overlay first
const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.top = '0';
overlay.style.left = '0';
overlay.style.width = '100%';
overlay.style.height = '100%';
overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
overlay.style.backdropFilter = 'blur(10px)';
overlay.style.display = 'flex';
overlay.style.justifyContent = 'center';
overlay.style.alignItems = 'center';
overlay.style.zIndex = '1000';
overlay.style.cursor = 'pointer';
overlay.style.fontFamily = "'Poppins', sans-serif";
overlay.style.color = '#9BA0BC';
overlay.innerHTML = `
    <div style="text-align: center; padding: 20px;">
        <h2 style="font-size: 24px; margin-bottom: 10px; color: #8B95C9;">Click or Touch to Start</h2>
        <p style="font-size: 16px; opacity: 0.8;">Experience interactive musical physics</p>
    </div>
`;
document.body.appendChild(overlay);

// Get canvas and context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Audio setup with Tone.js
let audioInitialized = false;
let synth;
let reverb;
let delay;
let bassSynth;

// Add collision counter
let totalCollisions = 0;

// Initialize audio on user interaction
async function startAudio() {
    console.log('startAudio called');
    try {
        if (!audioInitialized) {
            console.log('Starting Tone.js...');
            await Tone.start();
            console.log('Tone.js started, initializing audio...');
            initAudio();
            audioInitialized = true;
            overlay.style.display = 'none';
            console.log('Audio initialized successfully');
        }
    } catch (error) {
        console.error('Error starting audio:', error);
    }
}

// Add event listeners for audio initialization
document.addEventListener('click', startAudio);
document.addEventListener('touchstart', startAudio, { passive: false });
overlay.addEventListener('click', startAudio);
overlay.addEventListener('touchstart', startAudio, { passive: false });

// Prevent default touch behaviors
canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
}, { passive: false });

// Musical scale in C major across multiple octaves
const C_MAJOR_SCALE = [
    "C2", "D2", "E2", "F2", "G2", "A2", "B2",
    "C3", "D3", "E3", "F3", "G3", "A3", "B3",
    "C4", "D4", "E4", "F4", "G4", "A4", "B4"
];

// Define chord progressions in C major
const CHORD_PROGRESSIONS = {
    I: ["C3", "E3", "G3"],    // C major
    IV: ["F3", "A3", "C4"],   // F major
    V: ["G3", "B3", "D4"],    // G major
    vi: ["A3", "C4", "E4"]    // A minor
};

// Keep track of last chord time
let lastChordTime = 0;
const CHORD_INTERVAL = 2000; // Minimum time between chords in milliseconds

// Initialize audio with Tone.js
function initAudio() {
    try {
        console.log('Creating synth...');
        // Create a polyphonic synth with chime-like settings
        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: 'sine',
                partials: [1, 0.1, 0.05, 0.02]  // Even fewer harmonics for purer tone
            },
            envelope: {
                attack: 0.15,     // Longer attack for softer onset
                decay: 1.2,       // Longer decay
                sustain: 0.05,    // Lower sustain for more ethereal fade
                release: 1.8      // Longer release for ethereal tail
            }
        }).toDestination();

        // Create bass synth for deep notes
        bassSynth = new Tone.Synth({
            oscillator: {
                type: 'sine',
                partials: [1, 0.2, 0.05]  // Even simpler harmonics
            },
            envelope: {
                attack: 0.12,    // Longer attack
                decay: 0.4,      // Same decay
                sustain: 0.15,   // Lower sustain
                release: 0.8     // Same release
            }
        }).toDestination();

        console.log('Creating effects...');
        // Create large reverb effect
        reverb = new Tone.Reverb({
            decay: 15.0,        // Even longer decay
            wet: 0.95,          // More reverb mix
            preDelay: 0.4       // More pre-delay for spaciousness
        }).toDestination();

        // Create subtle delay effect
        delay = new Tone.FeedbackDelay({
            delayTime: "8n",
            feedback: 0.15,    // Less feedback for cleaner sound
            wet: 0.4          // More delay mix
        }).connect(reverb);

        // Add a high shelf filter to enhance sparkle
        const highShelf = new Tone.Filter({
            frequency: 4000,   // Higher frequency
            type: "highshelf",
            gain: 2           // Less gain for gentler highs
        }).toDestination();

        // Add a low shelf filter to enhance warmth
        const lowShelf = new Tone.Filter({
            frequency: 200,    // Lower frequency
            type: "lowshelf",
            gain: 2           // Less gain for gentler lows
        }).toDestination();

        // Add a notch filter to reduce mids
        const notch = new Tone.Filter({
            frequency: 800,
            type: "notch",
            Q: 2.5            // Sharper notch
        }).toDestination();

        // Add a second notch filter for wider mid reduction
        const notch2 = new Tone.Filter({
            frequency: 1500,   // Higher frequency for second notch
            type: "notch",
            Q: 2.0
        }).toDestination();

        // Connect synth to effects chain
        synth.connect(notch);      // First notch filter
        synth.connect(notch2);     // Second notch filter
        synth.connect(lowShelf);   // Then enhance lows
        synth.connect(highShelf);  // And highs
        synth.connect(delay);
        synth.connect(reverb);

        // Set overall volume
        Tone.Destination.volume.value = -24; // Even lower volume
        
        // Test sound
        console.log('Playing test note...');
        synth.triggerAttackRelease("C3", "2n", Tone.now(), 0.2); // Longer note, lower velocity
        
        console.log('Audio initialization complete');
    } catch (error) {
        console.error('Error in initAudio:', error);
    }
}

// Create collision sound using Tone.js
function createCollisionSound(velocity, x, y) {
    if (!audioInitialized) {
        console.log('Audio not initialized yet');
        return;
    }
    
    try {
        totalCollisions++;
        
        // Play deep bass note every 16 collisions
        if (totalCollisions % 16 === 0) {
            bassSynth.triggerAttackRelease("C2", "4n", Tone.now(), 0.6);
            console.log('Playing bass note');
        }

        const currentTime = Date.now();
        const shouldPlayChord = currentTime - lastChordTime > CHORD_INTERVAL && Math.random() < 0.3;

        if (shouldPlayChord) {
            // Play a chord
            const chordTypes = ['I', 'IV', 'V', 'vi'];
            const selectedChord = chordTypes[Math.floor(Math.random() * chordTypes.length)];
            const chordNotes = CHORD_PROGRESSIONS[selectedChord];
            
            // Play chord with slightly lower volume
            const chordVolume = Math.min(0.12, Math.abs(velocity) * 0.0015);
            chordNotes.forEach((note, i) => {
                // Stagger the notes slightly for a more natural sound
                synth.triggerAttackRelease(note, "2n", Tone.now() + i * 0.02, chordVolume);
            });
            
            lastChordTime = currentTime;
            console.log(`Playing ${selectedChord} chord`);
        }

        // Calculate base note index from x position (0-6 for the basic scale)
        const baseNoteIndex = Math.floor((x / canvas.width) * 7);
        
        // Use velocity to determine octave shift (0, 7, or 14 for octaves 2, 3, or 4)
        const velocityNormalized = Math.abs(velocity) * 0.01;
        let octaveShift = 0;
        
        if (velocityNormalized > 0.6) {
            octaveShift = 14; // Highest octave for fast collisions
        } else if (velocityNormalized > 0.3) {
            octaveShift = 7;  // Middle octave for medium collisions
        }
        
        // Combine base note and octave shift
        const noteIndex = baseNoteIndex + octaveShift;
        const note = C_MAJOR_SCALE[noteIndex];
        
        // Calculate volume based on velocity (very gentle)
        const volume = Math.min(0.2, Math.abs(velocity) * 0.002);  // Lower maximum volume and sensitivity
        
        // Play the main collision note
        console.log(`Playing note ${note} with volume ${volume}`);
        synth.triggerAttackRelease(note, "2n", Tone.now(), volume);
    } catch (error) {
        console.error('Error in createCollisionSound:', error);
    }
}

// Mouse position tracking
let mouseX = 0;
let mouseY = 0;
const MOUSE_INFLUENCE_RADIUS = 120;
const REPULSION_STRENGTH = 5.0;
const MAX_SPEED = 3.5;

// Create balls with different pastel colors
const colors = [
    '#B4D4F7',  // Deeper Soft Blue
    '#FFB5B5',  // Deeper Soft Pink
    '#B5E6B5',  // Deeper Soft Green
    '#FFE0B5',  // Deeper Soft Yellow
    '#E0B5FF',  // Deeper Soft Purple
    '#FFB5E0'   // Deeper Soft Rose
];
const balls = [];
const numBalls = 16;

// Set canvas size to match container
function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Set canvas dimensions to match container's actual size
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#F8F9FF');
    gradient.addColorStop(1, '#FFF5F9');
    
    // Apply gradient to canvas background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    console.log('Canvas resized:', canvas.width, canvas.height);
    
    // Clear existing balls and create new ones if canvas is properly sized
    if (canvas.width > 0 && canvas.height > 0) {
        initializeBalls();
    }
}

// Initialize balls
function initializeBalls() {
    // Clear existing balls
    balls.length = 0;
    
    // Create new balls with slightly smaller size range for better spacing
    for (let i = 0; i < numBalls; i++) {
        const radius = 15 + Math.random() * 15;  // Slightly smaller balls to accommodate more
        const x = radius + Math.random() * (canvas.width - 2 * radius);
        const y = radius + Math.random() * (canvas.height - 2 * radius);
        const color = colors[Math.floor(Math.random() * colors.length)];
        balls.push(new Ball(x, y, radius, color));
    }
    console.log('Balls initialized:', balls.length);
}

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
        this.dx = (Math.random() - 0.5) * 2.0;
        this.dy = (Math.random() - 0.5) * 2.0;
        this.lastCollisionTime = 0;
        this.collisionCooldown = 0.05;
        this.opacity = 1;
        this.isHovered = false;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Create minimal gradient fill for each ball
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.adjustColor(this.color, -5)); // Very subtle edge darkening
        
        // Clean, minimal fill
        ctx.fillStyle = gradient;
        ctx.globalAlpha = this.isHovered ? 1 : 0.95;
        
        // Draw the ball
        ctx.fill();
        
        // Add subtle outline for definition
        ctx.strokeStyle = this.adjustColor(this.color, -10);
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Reset opacity
        ctx.globalAlpha = 1;
        
        ctx.closePath();
    }

    // Helper method to adjust color brightness
    adjustColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
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

        // Reduced drag for more sustained movement
        this.dx *= 0.999;
        this.dy *= 0.999;

        // Limit speed after all forces are applied
        this.limitSpeed();

        // Bounce off walls
        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
            this.dx = -this.dx;
            if (audioInitialized) {
                createCollisionSound(Math.abs(this.dx) * 100, this.x, this.y);
            }
        }
        if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
            this.dy = -this.dy;
            if (audioInitialized) {
                createCollisionSound(Math.abs(this.dy) * 100, this.x, this.y);
            }
        }

        // Keep balls within bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x + this.dx));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y + this.dy));

        // Ball-to-ball collision detection
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
                if (audioInitialized) {
                    const currentTime = Tone.now();
                if (currentTime - this.lastCollisionTime > this.collisionCooldown) {
                    const relativeVelocity = Math.sqrt(
                        Math.pow(this.dx - ball.dx, 2) + 
                        Math.pow(this.dy - ball.dy, 2)
                    );
                    const avgX = (this.x + ball.x) / 2;
                        createCollisionSound(relativeVelocity * 100, avgX, 0);
                    this.lastCollisionTime = currentTime;
                    }
                }
            }
        });

        this.draw();
    }

    // Limit speed to maximum value
    limitSpeed() {
        const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        if (speed > MAX_SPEED) {
            this.dx = (this.dx / speed) * MAX_SPEED;
            this.dy = (this.dy / speed) * MAX_SPEED;
        }
    }
}

// Animation loop
function animate() {
    if (!canvas.width || !canvas.height) {
        console.log('Canvas not properly sized, retrying...');
        resizeCanvas();
        return;
    }
    
    // Redraw gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#F0F2FF'); // Slightly darker background
    gradient.addColorStop(1, '#FFF0F5'); // Slightly darker background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    balls.forEach(ball => {
        ball.update(balls);
    });

    requestAnimationFrame(animate);
}

// Call resize on load and window resize
window.addEventListener('load', () => {
    console.log('Window loaded');
    resizeCanvas();
animate(); 
    updateInteractionText();
});

window.addEventListener('resize', () => {
    console.log('Window resized');
    resizeCanvas();
});

// Create interaction text element
const interactionTextContainer = document.createElement('div');
interactionTextContainer.id = 'interaction-text';
interactionTextContainer.style.position = 'fixed';
interactionTextContainer.style.bottom = '2rem';
interactionTextContainer.style.left = '50%';
interactionTextContainer.style.transform = 'translateX(-50%)';
interactionTextContainer.style.textAlign = 'center';
interactionTextContainer.style.color = '#9BA0BC';
interactionTextContainer.style.fontSize = '1rem';
interactionTextContainer.style.fontFamily = "'Poppins', sans-serif";
interactionTextContainer.style.textShadow = '0 1px 2px rgba(0,0,0,0.05)';
document.body.appendChild(interactionTextContainer);

// Update interaction text
function updateInteractionText() {
    const textElement = document.getElementById('interaction-text');
    if (textElement) {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            textElement.textContent = "Touch to interact with the balls. Each collision creates a unique musical note.";
        } else {
            textElement.textContent = "Move your mouse to interact with the balls. Each collision creates a unique musical note.";
        }
    }
} 