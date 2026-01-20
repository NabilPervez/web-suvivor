export class SoundManager {
    private ctx: AudioContext;
    private masterGain: GainNode;

    constructor() {
        // Check for window.AudioContext for cross-browser support
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Default volume
        this.masterGain.connect(this.ctx.destination);
    }

    private playTone(freq: number, type: OscillatorType, duration: number, startTime = 0) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playShoot() {
        // High pitch short blip
        this.playTone(400, 'square', 0.1);
        this.playTone(600, 'square', 0.1, 0.05);
    }

    playHit() {
        // Low thud
        this.playTone(150, 'sawtooth', 0.1);
    }

    playHurt() {
        // Discordant noise-like
        this.playTone(100, 'sawtooth', 0.3);
        this.playTone(80, 'square', 0.3, 0.05);
    }

    playPickup() {
        // Happy chime
        this.playTone(800, 'sine', 0.1);
        this.playTone(1200, 'sine', 0.2, 0.05);
    }

    playLevelUp() {
        // Ascending arpeggio
        this.playTone(440, 'triangle', 0.2, 0);
        this.playTone(554, 'triangle', 0.2, 0.1);
        this.playTone(659, 'triangle', 0.4, 0.2);
        this.playTone(880, 'triangle', 0.6, 0.3);
    }

    playGameOver() {
        // Descending sad tones
        this.playTone(300, 'triangle', 0.5, 0);
        this.playTone(250, 'triangle', 0.5, 0.4);
        this.playTone(200, 'triangle', 1.0, 0.8);
    }

    playWin() {
        // Major chord fanfare
        this.playTone(523.25, 'square', 0.2, 0); // C5
        this.playTone(659.25, 'square', 0.2, 0.2); // E5
        this.playTone(783.99, 'square', 0.2, 0.4); // G5
        this.playTone(1046.50, 'square', 1.0, 0.6); // C6
    }
}

export const soundManager = new SoundManager();
