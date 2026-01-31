const typing_per_char = 50; // ms per character for typing simulation

function convertToDictionary(data) {
    const result = {};

    data.forEach(item => {
        const word = item.Stimuli_Word;

        // Split ANSWER and TP lists (separated by commas in norms.json)
        const answers = item.ANSWER.split(",").map(s => s.trim());
        const probabilities = item.Probability.split(",").map(Number); // convert to float

        // Pair answers with their TP values
        const paired = answers.map((ans, i) => ({
            answer: ans,
            probability: probabilities[i]
        }));

        // Sort by TP descending
        paired.sort((a, b) => b.probability - a.probability);

        // Unzip back into two arrays
        const sortedAnswers = paired.map(p => p.answer);
        const sortedProbabilities = paired.map(p => p.probability);

        // Save in dictionary
        result[word] = {
            ANSWER: sortedAnswers,
            TP: sortedProbabilities
        };
    });

    return result;
}

function generation_rt(p, Smu, Imu = 0.01, lambda = 0.8) {//Imu changed from 0.0001
    const mn = Imu + Math.exp(Smu) * (-Math.log(p));
    const sigma = mn * lambda;
    const mu = Math.pow(sigma, 2) / mn;
    const rate = 1 / mu;
    const shape = mn / mu;
    //rt = Math.max(100, 100 * jStat.gamma.sample(shape, 1 / rate));; //added a floor of 100 ms
    const rt = 100 * jStat.gamma.sample(shape, 1 / rate); //original
    return rt;
}

//Sample association and generate thinking time
function simulate_single_association_rt(ASSOC, TP, Imu, Smu, lambda, beta = 0) {
    const randomValue = Math.random();
    let cumulativeProbability = 0;

    let selected_assoc = ASSOC[0]; //Default value
    let thinking_time = generation_rt(TP[0], Smu, Imu, lambda);//Default value

    for (let i = 0; i < TP.length; i++) {
        cumulativeProbability += TP[i];
        if (randomValue <= cumulativeProbability) {
            selected_assoc = ASSOC[i]
            thinking_time = generation_rt(TP[i], Smu, Imu, lambda);
            break;
        }
    }
    return { selected_assoc, thinking_time }
}

//Chooses a cue (choosing a different cue for idiosyncratic responses)
function choose_cue(cue, cues, wordDictionary, idio, logInfo = {}) {
    let cue_entry = wordDictionary[cue];
    let usedCue = cue;
    let cueSource = "direct";

    if (!idio && cue in wordDictionary) {
        cue_entry = wordDictionary[cue];
        cueSource = "direct_match";
    } else {
        const random_cue = cues[Math.floor(Math.random() * cues.length)];
        cue_entry = wordDictionary[random_cue];
        usedCue = random_cue;
        cueSource = idio ? "idiosyncratic" : "not_in_dictionary";
    }

    // Store info for logging
    logInfo.usedCue = usedCue;
    logInfo.cueSource = cueSource;

    return cue_entry
}

//Final draw
function SMP(cue, cues, wordDictionary, pIdio, Imu, Smu, lambda, alpha, alphaSign = 1, ndTime) {
    let total_rt = ndTime;
    let final_association = "";
    const maxRejections = 20;
    let track_assoc = [];
    let track_thinking_time = [];
    let track_cue_source = [];
    let track_used_cue = [];
    let track_idio = [];
    let idio = Math.random() < pIdio;
    let k = 0;
    let finalCueSource = "";
    let finalUsedCue = "";

    for (k = 0; k < maxRejections; k++) {
        idio = Math.random() < pIdio;
        let logInfo = {};
        let cue_entry = choose_cue(cue, cues, wordDictionary, idio, logInfo);
        let ASSOC = Object.values(cue_entry)[0];
        let TP = Object.values(cue_entry)[1];
        const { selected_assoc, thinking_time } = simulate_single_association_rt(ASSOC, TP, Imu, Smu, lambda);

        track_assoc.push(selected_assoc);
        track_thinking_time.push(thinking_time);
        track_cue_source.push(logInfo.cueSource);
        track_used_cue.push(logInfo.usedCue);
        track_idio.push(idio);

        total_rt += thinking_time;
        if (alphaSign == 1) {
            if (!idio || Math.random() > alpha) {
                final_association = selected_assoc;
                finalCueSource = logInfo.cueSource;
                finalUsedCue = logInfo.usedCue;
                break;
            }
        } else {
            if (idio || Math.random() > alpha) {
                final_association = selected_assoc;
                finalCueSource = logInfo.cueSource;
                finalUsedCue = logInfo.usedCue;
                break;
            }
        }
    }

    // Fallback if maxRejections reached without finding an association
    if (final_association === "") {
        let logInfo = {};
        const fallback_entry = choose_cue(cue, cues, wordDictionary, false, logInfo);
        final_association = Object.values(fallback_entry)[0][0];
        finalCueSource = "fallback";
        finalUsedCue = logInfo.usedCue;
    }

    //calculate number of characters in final_association
    total_rt = total_rt + final_association.length * typing_per_char;

    // Build debug info
    const debugInfo = {
        originalCue: cue,
        cueInDictionary: cue in wordDictionary,
        iterations: k + 1,
        finalCueSource,
        finalUsedCue,
        track_assoc,
        track_cue_source,
        track_idio,
        pIdio,
        alpha,
        alphaSign
    };

    return { final_association, total_rt, k, idio, track_assoc, track_thinking_time, debugInfo }
}

function simulate_responses(cues, wordDictionary, pIdio, Imu, Smu, lambda, alpha, alphaSign, ndTime = 2000) {
    // cue - current cue
    // wordDictionary - created by convertToDictionary
    //Agent parameters: pIdio, Imu, Smu, lambda, alpha, alphaSign,ndTime
    //If dropped out - track RT and pIdio subjects (pIdio = pIdio_subj, Imu = mean_rt_subj, Smu = 0, lambda =1, alpha=0,alphaSign=1, ndTime=0);
    let associations = [];
    let rts = [];
    let data_current = {};
    for (let cue of cues) {
        const { final_association, total_rt, k, idio, track_assoc, track_thinking_time } = SMP(cue, cues, wordDictionary, pIdio, Imu, Smu, lambda, alpha, alphaSign, ndTime)
        data_current[cue] = [final_association, total_rt, k, idio, track_assoc, track_thinking_time];
    }
    console.log("Simulated data: ", data_current);
    return data_current;
}
