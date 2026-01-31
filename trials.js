// Helper to create conditional trials
const makeConditionalTrial = (conditionFn, timeline) => (
    { conditional_function: conditionFn, timeline:timeline }
);

const makeConditionalLoopingTrial = (conditionFn, timeline) => (
    { loop_function: conditionFn, timeline:timeline }
);

// Function to get the update trial
function
updateGroupSessionTrial(keys_values, maxRetries = 8) {
    return {
        type: jsPsychCallFunction,
        async: true,
        func: async function (done) {
            // Block execution for 10 seconds
            let attempt = 0;
            let success = false;
            while (attempt < maxRetries && !success) {
                try {
                    const gd = jatos.groupSession.getAll();
                    for (let i = 0; i < keys_values.length; i++) {
                        const [key, valueOrFn] = keys_values[i];
                        gd[key] = (typeof valueOrFn === 'function')
                            ? valueOrFn()
                            : valueOrFn;
                        console.log(`[SET GROUP DATA TRIAL] ${key} was set to ${gd[key]} written after ${attempt + 1} attempt(s)`);
                    }
                    await jatos.groupSession.setAll(gd);
                    success = true;
                    done();
                    break;
                } catch (e) {
                    attempt++;
                    console.error(`[SET GROUP DATA TRIAL] Error on attempt ${attempt}:`, e);
                    if (attempt >= maxRetries) {
                        console.error(`[SET GROUP DATA TRIAL] FAILED after ${attempt} attempts`);
                        done();
                        return;
                    }
                    const delay =
                        Math.min(500, 25 * Math.pow(2, attempt - 1))
                        + Math.floor(Math.random() * 50);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            if (!success) done();
        }
    };
}


// Function to get the wait trial
function getWaitTrial(wait_param, wait_msg, hide_other_player_avatar = true, counterLimit = 0) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            const wait_html = getHtmlTag(
                "div",
                "wait",
                "wait",
                wait_msg,
                hide_other_player_avatar
            );

            return getScreen({
                center: wait_html,
                hideOthers: hide_other_player_avatar,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => true),
                assocs: []
            });
        },
        choices: "NO_KEYS",
        on_load: function () {
            let counter = 0;
            let interval = setInterval(function () {
                if (counterLimit > 0) counter++;

                if (
                    jatos.groupSession.get(wait_param) ||
                    (counterLimit > 0 && counter >= counterLimit)
                ) {
                    clearInterval(interval);
                    setTimeout(function () {
                        jsPsych.finishTrial();
                    }, 100);
                }
            }, 10);
        }
    };
}

/**
 * Waits until all players reach one of the specified states for a given parameter,
 * or until a timeout occurs.
 *
 * @param {string} wait_param - The groupSession parameter to monitor.
 * @param {string} wait_msg - The message displayed while waiting.
 * @param {string} values - A single condition or an array of possible conditions (e.g. ["during", "finished"]).
 * @param {boolean} [hide_other_player_avatar=true] - Whether to hide the other player's avatar on the waiting screen.
 * @param {number} [counterLimit=600] - Maximum number of interval checks before timeout (each 100 ms).
 * @returns {object} - A jsPsych trial object that waits for synchronization between all players.
 */
function getAllFinishParamTrial(wait_param, wait_msg, values = "*", hide_other_player_avatar = true, counterLimit = 600, stimulusFn = null) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
           if (typeof stimulusFn === "function") {
                return stimulusFn();
            }
            else {
                const wait_html = getHtmlTag(
                    "div",
                    "wait",
                    "wait",
                    wait_msg,
                    hide_other_player_avatar
                );

                return getScreen({
                    center: wait_html,
                    hideOthers: hide_other_player_avatar,
                    others: getAllOtherPlayersIds(),
                    loading: getAllOtherPlayersIds().map(() => true),
                    assocs: []
                });
            }
        },
        choices: "NO_KEYS",
        on_load: function () {
            let counter = 0; // Initialize counter for skipping if the other participant is non-responsive
            let interval = setInterval(function () {
                if (counterLimit > 0) counter++;
                // Normalize condition to always be an array
                const vals = Array.isArray(values) ? values : [values];
                // Check if at least one condition is satisfied
                const allFinished = vals.some(val => allPlayersFinishParam(wait_param, val));
                if (allFinished || (counterLimit && counter >= counterLimit)) {
                    clearInterval(interval);
                    setTimeout(jsPsych.finishTrial, 100);
                }
            }, 100);
        }
    };
}


function getSendResults() {
    return {
        type: jsPsychCallFunction, // Call a function
        async: true, // Make the function asynchronous
        func: function (done) { // Define the function
            jatos.submitResultData("START_TEMP" + jsPsych.data.get().json() + "END_TEMP")
                .then(() => {
                    done(); // Finish the trial }
                })
                .catch(() => {
                    console.log('Error updating results data');
                    done(); // Finish the trial
                })
        }
    }
}


function fullScreen_condition() {
    return {
        conditional_function: function () {
            // Check if the participant clicked during the countdown
            if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
                return false;
            } else {
                return true;
            }
        },
        timeline: [fullscreenTrial()]
    }
}

function fullscreenTrial() {
    return {
        type: jsPsychFullscreen,
        fullscreen_mode: true,
        stimulus: "This experiment will be presented in fullscreen mode. Press the button to start.",
        button_label: "Start"
    }
}

// Helper to build the countdown screen HTML (word + timer + optional players)
function createStimulusHTML(word,countdown = true) {
    const stimulus_word_html = getHtmlTag("div", "stimuli_word received-word", "stimuli_word", word);
    const timer_html = countdown ? getHtmlTag("div", "timer", "timer", "0:15") : undefined;
    return [stimulus_word_html, timer_html];
}

// Helper to run and update the countdown timer in the DOM
function startTimer(durationMs) {
    const start_time = performance.now();
    const id = setInterval(function () {
        let time_left = durationMs - (performance.now() - start_time);
        let minutes = Math.floor(time_left / 1000 / 60);
        let seconds = Math.floor((time_left - minutes * 1000 * 60) / 1000);
        let seconds_str = seconds.toString().padStart(2, '0');
        let timerEl = document.querySelector('#timer');
        if (timerEl) timerEl.innerHTML = minutes + ':' + seconds_str;
        if (timerEl && time_left <= 0) {
            timerEl.innerHTML = "0:00";
            clearInterval(id);
        }
    }, 100);
    return id;
}

// Helper to handle end-of-trial cleanup and data assignment
//TODO fill the function with daniel
function saveCountdownData(data) {
    // Assign the stimulus word for data tracking

}


function getCountdownTrial(word_assoc ,time= 15) {
    /*******************************************************
     * COUNTDOWN TRIAL
     * -----------------------------------------------------
     * Shows a stimulus word and a countdown timer.
     * The participant can press SPACE ( ' ' ) to stop the countdown.
     * The trial also auto-ends after `time` seconds.
     *
     * Implementation notes:
     * - We create the screen in `stimulus()` using `createStimulus()`.
     * - We start a DOM timer in `on_start()` and keep its interval ID
     *   in a local variable `timerId` so we can clean it reliably.
     * - We clear the interval in `on_finish()` to avoid leaks.
     *******************************************************/
    return {
        type: jsPsychHtmlKeyboardResponse,
        choices: [' '], // Spacebar
        trial_duration: time * 1000,
        stimulus: () => {
            const word = (typeof word_assoc === "function") ? word_assoc() : word_assoc;
            const [stimulus_word_html, timer_html] = createStimulusHTML(word, true);
            return getScreen({
                center: [timer_html, stimulus_word_html],
                hideOthers: false,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => false),
                assocs: []
            });
        },
        on_start: function () {
            // Start the visual timer and keep the interval ID in a local var
            this.__timerId = startTimer(time * 1000);
            // Add an event listener for the spacebar key press
        },
        on_finish: function (data) {
            // Clean up interval if still running
            if (this.__timerId) {
                clearInterval(this.__timerId);
                this.__timerId = null;
            }
        }
    };
}


function getTextInputTrial(word_assoc,countdown = false) {
    let startTimer;
    let keysPressed = [];
    let keystroke_rt = [];
    // Small helpers for repeated logic
    const focusInput = (input) => setTimeout(() => input?.focus(), 100);
    const recordInput = (input, startTime) => {
        input.oninput = () => {
            enteredWord = input.value.trim();
            keysPressed.push(enteredWord);
            keystroke_rt.push(performance.now() - startTime);
        };
    };
    return {
        type: jsPsychHtmlKeyboardResponse,
        choices: ['enter'],
        trial_duration: textInput_limit * 1000,
        stimulus: () => {
            const word = (typeof word_assoc === "function") ? word_assoc() : word_assoc;
            const [stimuli_html, timer_html] = createStimulusHTML(word, countdown);
            const input_html = getHtmlTag(
                "input",
                "word_input sent-word",
                "word_input",
                null,
                { type: "text", autocomplete: "off" }
            );
            return getScreen({
                center: [stimuli_html, timer_html, input_html],
                hideOthers: false,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => false),
                assocs: []
            });
        },
        on_load: () => {
            startTimer = performance.now();
            const input = document.getElementById("word_input");
            focusInput(input);
            recordInput(input, startTimer);
        },
        on_finish: (data) => {
            const slow = performance.now() - startTimer > SLOW_RESPONSE_THRESHOLD_SECONDS * 1000;
            jsPsych.pluginAPI.clearAllTimeouts();
            if (!enteredWord) {
                enteredWord = NO_RESPONSE;
                error_strike++;
                validateErrors();
            }
            else{
                error_strike = 0;
            }
            Object.assign(data,
                { entered_word: enteredWord,
                    presses: keysPressed, keystroke_rt,
                    slow: slow
                });
        }
    };
}


function getErrorTrial(){
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            const error_html = getHtmlTag(
                "div",
                "error",
                "error",
                "YOU MUST WRITE AN ASSOCIATION"
            );

            return getScreen({
                center: error_html,
                hideOthers: false,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => false),
                assocs: []
            });
        },
        choices: "NO_KEYS",
        trial_duration: 3 * 1000,
    };
}

function getSlowErrorTrial(){
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            const error_html = getHtmlTag(
                "div",
                "slow_error",
                "slow_error",
                SLOW_RESPONSE_TEXT
            );

            return getScreen({
                center: error_html,
                hideOthers: false,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => false),
                assocs: []
            });
        },
        choices: "NO_KEYS",
        trial_duration: 3 * 1000,
    };
}


// Function to get the text input trial
// The participant can enter a word and press enter
// If the participant does not enter a word, a message is displayed for 3 seconds
function getWordExchangeTrial(word_assoc) {
    /**
     * Returns the conditional trial objects for the word exchange phase.
     * Uses concise helpers for clarity and avoids duplicated logic.
     */
    const text_input_trial = getTextInputTrial(word_assoc);
    const slow_error_condition = makeConditionalTrial(()=>{
        let data = jsPsych.data.get().last(1).values()[0];
        return data.slow;
    },[getSlowErrorTrial()]);

    // Return the sequence of conditional and update trials for the word exchange
    // If participant responded (rt not null): show text input and slow error check
    return makeConditionalTrial(
        () => {
                let data = jsPsych.data.get().last(1).values()[0];
                if(data.rt !== null){
                    return true;
                }
                else{
                    enteredWord = NO_RESPONSE;
                    return false;
                }
            }, [text_input_trial,slow_error_condition]
    );
}

/**
 * Trial displaying the player's answer and those of the other participants.
 * - The player sees the stimulus word and their last typed word.
 * - The words of the other players are also displayed.
 * - No keyboard is active.
 * - The trial lasts 5 seconds, then automatically proceeds to the next.
 */
function getDisplayAnswersTrial(word) {
    return {
        type: jsPsychHtmlKeyboardResponse, // Trial type: HTML display without keyboard interaction
        /**
         * Content to display on the screen.
         * Builds a page with:
         * - The current stimulus word
         * - The player's last word
         * - The answers of the other players
         */
        stimulus: () => {
            // Retrieve the list of the current player's words
            let assocs = {};
            getAllPlayersIds().forEach(pid => {
                const key = pid + "_" + word;
                assocs[key] = jatos.groupSession.get(key) || NO_RESPONSE;
            });

            // Create the area displaying the stimulus
            const stimulusDiv = getHtmlTag("div", "stimuli_word", "stimuli_word", word);

            // Create a non-interactive text field containing the player's last response
            const myInput = getHtmlTag("input", "word_input", null, null, { value: assocs[jatos.groupMemberId + "_" + word] });

            // Log before mapping other players' words
            // Retrieve and display the words of the other players
            const otherPlayersWords = Object.entries(assocs)
                .filter(([key]) => key !== jatos.groupMemberId + "_" + word)
                .map(([, value]) => value);

          // Assemble the complete screen (stimulus + your word + other players' words)
            return getScreen({
                center: [stimulusDiv, myInput],
                hideOthers: false,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => false),
                assocs: otherPlayersWords
            });
        },

        choices: "NO_KEYS", // Disables all keys (no keyboard interaction)
        trial_duration: 5 * 1000, // Display for 5 seconds (5000 ms)

        /**
         * Cleanup at the end of the trial.
         * Cancels any residual keyboard listener (jsPsych best practice).
         */
        on_finish: () => {
            jsPsych.pluginAPI.cancelKeyboardResponse();
        }
    };
}


///////////////////////////////////////////////////////////////////////////////////////
/**
 * Manages the process of ensuring all participants enter fullscreen mode before proceeding.
 * This function returns a timeline of jsPsych trials that:
 *   1. Marks the participant as not in fullscreen.
 *   2. Prompts the participant to enter fullscreen mode.
 *   3. Marks the participant as in fullscreen.
 *   4. Waits for all participants to enter fullscreen before continuing.
 *
 * @returns {Array} timeline - An array of jsPsych trial objects for fullscreen management.
 */
function manageFullScreenTrial() {
    let timeline = [];
    timeline.push(updateGroupSessionTrial([[jatos.groupMemberId + FULL_SCREEN_EXTENTION,false]]));
    timeline.push(fullScreen_condition());
    timeline.push(updateGroupSessionTrial([[jatos.groupMemberId + FULL_SCREEN_EXTENTION,true]]));
    timeline.push(getWaitAllPlayersTrial(FULL_SCREEN_EXTENTION, "Wait until other participant switches to full screen", false, 60 * 10));
    return timeline;
}


/**
 * Waits until all players reach the same boolean value (true) for a given parameter in groupSession.
 * For example: waiting until all players are marked as ready or fullscreen = true.
 *
 * @param {string} wait_param - The parameter key in groupSession to monitor.
 * @param {string} wait_msg - The message displayed to participants while waiting.
 * @param {boolean} [hide_other_player_avatar=true] - Whether to hide other player avatars.
 * @param {number} [counterLimit=600] - Maximum number of checks before timeout (each 100ms).
 * @returns {object} - A jsPsych trial object.
 */
function getWaitAllPlayersTrial(wait_param, wait_msg, hide_other_player_avatar = true, counterLimit = 600) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            const wait_html = getHtmlTag(
                "div",
                "wait",
                "wait",
                wait_msg,
                hide_other_player_avatar
            );

            return getScreen({
                center: wait_html,
                hideOthers: hide_other_player_avatar,
                others: getAllOtherPlayersIds(),
                loading: getAllOtherPlayersIds().map(() => true),
                assocs: []
            });
        },
        choices: "NO_KEYS",
        on_load: function() {
            let counter = 0;
            const interval = setInterval(function() {
                if (counterLimit > 0) counter++;
                const allReady = allPlayersFinishParam(wait_param, true);
                if (allReady || (counterLimit && counter >= counterLimit)) {
                    clearInterval(interval);
                    setTimeout(()=> {
                        jsPsych.finishTrial();
                    }, 100);
                }
            }, 100);
        }
    };
}


/**
 * Handles what happens during breaks between blocks.
 * Detects when a break is needed, shows the break screen and questions,
 * and advances or resets block state to keep all players synchronized.
 */
function break_condition(sync=true) {
    /*******************************************************
     * 💤 BREAK TRIAL
     * -----------------------------------------------------
     * Displays a break message for a short rest period.
     * Automatically resumes after `break_duration`.
     *******************************************************/
    const breakTrial = () => ({
        type: jsPsychHtmlKeyboardResponse,
        fullscreen_mode: true,
        stimulus: "Break time! Please take a short break. The experiment will continue shortly.",
        choices: "NO_KEYS",
        trial_duration: break_duration,
    });
    timeline = [
        updateGroupSessionTrial([[jatos.groupMemberId+COMPLETE_BREAK_EXTENTION,"entered"]]),
        breakTrial(),
        ...getQuestionsTrial(),
        getSendResults(),
        updateGroupSessionTrial([[jatos.groupMemberId+COMPLETE_BREAK_EXTENTION,"finished"]]),

    ]
    if(sync){
        timeline.push(getAllFinishParamTrial(
            COMPLETE_BREAK_EXTENTION,
            "Waiting for the other player to finish the break section.",
            "finished",
            true,
            0
        ))
    }

    return {
        timeline: timeline,
        conditional_function: () => {
            const shouldBreak = checkBreak();
            breakStates.push(shouldBreak);
            return shouldBreak;
        },
    }
}

// Helper to create a single Likert trial
function createLikertTrial(promptHtml, name) {
    return {
        type: jsPsychSurveyLikert,
        questions: [
            {
                prompt: promptHtml,
                labels: ["Not at all", "A little bit", "Moderately", "To some extent", "A lot"],
                required: true,
                scale_width: 10,
                name: name
            }
        ],
    };
}

function getFixationCrossTrial(time_seconds=1) {
    return {
        type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
        const fixation_html = getHtmlTag(
            "div",
            "fixation",
            "fixation",
            "+"
        );

        return getScreen({
            center: fixation_html,
            hideOthers: true,
            others: getAllOtherPlayersIds(),
            loading: getAllOtherPlayersIds().map(() => false),
            assocs: []
        });
    },
        choices: "NO_KEYS",
        trial_duration: time_seconds*1000,
    };
}