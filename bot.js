// --- BOT MEMORY (loaded once) ---
let wordDictionary = null;
let cues = null;

// Promise that resolves when norms.json is loaded
const botDataReady = fetch("norms.json")
    .then(res => res.json())
    .then(data => {
        wordDictionary = convertToDictionary(data.wordData);
        cues = Object.keys(wordDictionary);
        console.log("[Bot] Memory initialized with", cues.length, "cues");
        return true;
    })
    .catch(err => {
        console.error("Failed to load norms.json", err);
        throw err;
    });

// Async initialization - call this before creating bots
async function initBotMemory() {
    await botDataReady;
}

// --- FIXED BOT PARAMETERS ---
const BOT_PARAMS = {
    pIdio: 0.15,
    Imu: 0.2,
    Smu: 0.4,
    lambda: 0.8,
    alpha: 0.3,
    alphaSign: 1,
    ndTime: 2000  // Base thinking time (ms)
};

const MAX_RT_BOT = 10000; // ms
const MIN_RT_BOT = 2000;  // Minimum response time to seem human-like

class BaseBot {
    constructor(name) {
        this.name = name;
    }

    getAssocWord(word) {
        throw new Error("getWord() must be implemented by the child class");
    }
}

class Bot extends BaseBot {
    constructor(seed) {
        super("Bot");
        this.seed = seed;

        // Initialize memory once
        initBotMemory();
    }

    getAssocWord(cue) {
        if (!wordDictionary || !cues) {
            throw new Error("Bot memory not initialized");
        }

        // Convert cue to lowercase to match norms.json format
        const normalizedCue = cue.toLowerCase();

        const {
            final_association,
            total_rt,
            debugInfo
        } = SMP(
            normalizedCue,
            cues,
            wordDictionary,
            BOT_PARAMS.pIdio,
            BOT_PARAMS.Imu,
            BOT_PARAMS.Smu,
            BOT_PARAMS.lambda,
            BOT_PARAMS.alpha,
            BOT_PARAMS.alphaSign,
            BOT_PARAMS.ndTime
        );

        // If bot is too slow, simulate no response
        if (total_rt > MAX_RT_BOT) {
            return { association: NO_RESPONSE, rt: MAX_RT_BOT, debugInfo };
        }

        // Ensure minimum response time to seem human-like
        const adjustedRt = Math.max(total_rt, MIN_RT_BOT);

        return { association: final_association, rt: adjustedRt, debugInfo };
    }
}