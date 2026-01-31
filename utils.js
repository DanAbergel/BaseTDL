// Group Sessuin ID's
const AVATAR_EXTENSION = "_avatar";
const RANDOM_AVATAR_EXTENSION = "_random_avatar";
const COMPLETE_TRAINING_EXTENTION = "_complete_training";
const COMPLETE_BREAK_EXTENTION = "_complete_break";
const TRAINING_EXTENTION = "_training";
FULL_SCREEN_EXTENTION = "_full_screen";
const ALLOCATED_GROUP_PROPERTY = "allocated_group";
const PAIRS_PROPERTY = "pairs";
const NO_RESPONSE = "NO RESPONSE";
const NO_RESPONSE_TEXT = "The other player did not write a word";
const SLOW_RESPONSE_TEXT = "Please press the space bar only after you have a response in mind";
const GROUP_DATA = "group_data";
const MODE_OSTRACIZED = "ostracized";
const SEED_WORDS_PROPERTY = "seed_words";
const ALL_MEMBER_IDS_PROPERTY = 'ALL_MEMBER_IDS';
const LEAVED_PLAYERS_PROPERTY = 'LEAVED_PLAYERS';
const MODE_ODDBALL = 'MODE_ODDBALL_PROPERTY';
const TRAINING_WORDS_PROPERTY = "training_words";
const MAIN_WORDS_PROPERTY = "main_words";
const SLOW_RESPONSE_THRESHOLD_SECONDS = 4;
const HUMAN_PLAYERS_PROPERTY = "HUMAN_PLAYERS_PROPERTY";
const BOT_PLAYERS_PROPERTY = "BOT_PLAYERS_PROPERTY";
const AVATARS_LIST = [
    "bear",
    "cat",
    "chicken",
    "deer",
    "dog_1",
    "dog_2",
    "elephant",
    "frog",
    "lion",
    "monkey",
    "panda",
    "seal",
    "tiger",
    "turtle"
]

function getWords(groupMemberId, extension = "") {
    return jatos.groupSession.get(groupMemberId + extension) || [];
}

function onOtherPlayerDrop(interval, _unused = 0, botAnswer = false) {
    // Legacy versions advanced the component here. This now causes races with the guarded flow
    // in main.html (break_condition/changeBlock). We keep this function UI-only.

    if (interval) {
        try { clearInterval(interval); } catch (e) {}
    }

    if (typeof showLog !== 'undefined' && showLog) {
        console.log('[DROP] Detected player drop. No auto-advance from onOtherPlayerDrop(); waiting for guarded break flow.');
    }

    // If you had any visual refreshes or local flags, keep them here.
    // Do NOT call jatos.startComponent / startNextComponent from this function anymore.
}


function onOtherPlayerDropReassign(attempts = 0) { //In some case (early in the game) if the other participant has dropped - reassign this one to a new group
    setTimeout(() => {
        if (jatos.isMaxActiveMemberOpen()) {
            console.log("MAX ACTIVE MEMBER OPEN");
        } else {
            console.log("Trying to reassign to a new group: " + attempts);
            jatos.reassignGroup()
                .then(() => console.log("Reassigned to a new group"))
                .catch(() => {
                    setTimeout(() => {
                        (attempts < 5) ? onOtherPlayerDropReassign(attempts + 1) : console.log("Couldn't reassign to a new group")
                    }, 10 * 1000);
                });
        }
    }, 1000);
}

function getAvatarPath(avatar_name, img_extension = ".png", img_folder = "img/avatars/") {
    return img_folder + avatar_name + img_extension;
}


function getAvatarById(groupMemberId = jatos.groupMemberId) {
    return getAvatarPath(jatos.groupSession.get(groupMemberId + AVATAR_EXTENSION))
}


function getRandomAvatarById(groupMemberId = jatos.groupMemberId) {
    return getAvatarPath(jatos.groupSession.get(groupMemberId + RANDOM_AVATAR_EXTENSION))
}


function getAllAvatars(others=false) {
    const all_properties = jatos.groupSession.getAll();
    return getAllPlayersIds(others)
        .map((id) => all_properties[id + RANDOM_AVATAR_EXTENSION])
        .filter(filename => filename !== undefined && filename !== null)
        .map(filename => getAvatarPath(filename));
}


// Removes duplicate inner arrays by comparing their JSON string representations
function removeDuplicates(arr) {
    const seen = new Set();
    return arr.filter(item => {
        const key = JSON.stringify(item);
        return !seen.has(key) && seen.add(key);
    });
}

// Function to get the html tag
function getHtmlTag(tag, class_name, tag_id, children, attributes = {}) {
    let html = "<" + tag;
    if (class_name) {
        html += " class='" + class_name + "'";
    }
    if (tag_id) {
        html += " id='" + tag_id + "'";
    }
    for (const [key, value] of Object.entries(attributes)) {
        html += " " + key + "='" + value + "'";
    }
    html += ">";
    if (children) {
        if (Array.isArray(children)) {
            children = children.join("");
        }
        html += children;
    }
    html += "</" + tag + ">";
    return html;
}


/**
 * Creates a player container (avatar, loader, optional word) for any screen side.
 * Replaces the previous Left/Right/Generic functions.
 *
 * @param {string} avatar_url - URL of the avatar image.
 * @param {string} css_class - CSS class and id to assign to the container.
 * @param {boolean} show_loading - Whether to display a loader animation.
 * @param {string} word - Optional word displayed below the avatar.
 * @param {boolean} change_font - If true, uses the "sent-word" style for the word.
 * @param {"left"|"right"} side - Determines which loader gif to use.
 * @returns {string} The HTML string for the player container.
 */
function getSinglePlayerContainerGeneric(
      avatar_url,
      css_class,
      show_loading = false,
      word = "",
      change_font = false,
      side = "left"
    )
    {
      // Create avatar image
      const avatar = getHtmlTag("img", "avatar", "avatar", null, { src: avatar_url });
      // Decide which loader to show
      const loaderSrc = side === "right" ? "./img/loaderRight.gif" : "./img/loader.gif";
      const avatar_components = [avatar];
      // Add loader if needed
      if (show_loading) {
        avatar_components.push(getHtmlTag("img", "gif_loader", "gif_loader", null, { src: loaderSrc }));
      }
      // Wrap avatar (and loader) inside a player container
      const player = getHtmlTag("div", "loading_player", "loading_player", avatar_components);
      const container_components = [player];
      // Add optional word below the avatar
      if (word) {
        const wordClass = change_font ? "stimuli_word sent-word" : "word";
        container_components.push(getHtmlTag("div", wordClass, "word", word));
      }
      // Return full container for the player
      return getHtmlTag("div", css_class, css_class, container_components);
}

function getOtherPlayersIds() {
    return jatos.groupMembers.filter(id => id !== jatos.groupMemberId).sort();
}

/**
 * Decide layout (CSS class + loader side) for other players
 * based ONLY on their index and total count.
 *
 * This function is PURE and PRESENTATIONAL.
 *
 * @param {number} idx - Index of the player (0-based)
 * @param {number} n   - Total number of other players
 * @returns {{ className: string, side: "left"|"right" }}
 */
function getOtherPlayerLayout(idx, n) {

    // ===== 1 other player =====
    if (n === 1) {
        return {
            className: "up_container",
            side: "up"
        };
    }
    // ===== 2 other players =====
    if (n === 2) {
        return idx === 0
            ? { className: "up_left_container",  side: "up_left"  }
            : { className: "up_right_container", side: "up_right" };
    }

    // ===== 3 other players =====
    if (n === 3) {
        if (idx === 0) {
            return { className: "up_container", side: "up" };
        }
        if (idx === 1) {
            return { className: "left_container", side: "left" };
        }
        return { className: "right_container", side: "right" };
    }
    // ===== Fallback (safety) =====
    return { className: "up_container", side: "top" };
}

/**
 * Improved getScreen2 — option-based, intention-driven API.
 *
 * This function is PURELY PRESENTATIONAL:
 * it renders the screen based only on its arguments,
 * without relying on groupData, turns, or implicit game logic.
 *
 * @param {Object} options
 * @param {string|Array<string>} options.center - HTML content for the center of the screen
 * @param {boolean} [options.hideOthers=false] - Whether to hide other players
 * @param {string[]} [options.others=[]] - IDs of the other players (excluding self)
 * @param {boolean[]} [options.loading=[]] - Loader flags per other player
 * @param {string[]} [options.assocs=[]] - Optional text under each other player
 *
 * @returns {string} Full screen HTML
 */
function getScreen({
    center,
    hideOthers = false,
    others = [],
    loading = [],
    assocs = []
}) {
    const player_containers = [];

    // --- Main player (bottom / center) ---
    const mainAvatar = getHtmlTag(
        "img",
        "avatar",
        "avatar",
        null,
        { src: getAvatarById(jatos.groupMemberId) }
    );

    const mainPlayer = getHtmlTag(
        "div",
        "loading_player",
        "loading_player",
        mainAvatar
    );

    player_containers.push(
        getHtmlTag("div", "down_container", "down_container", mainPlayer)
    );

    // --- Other players ---
    if (!hideOthers && others.length > 0) {

        const n = others.length;

        // Normalize inputs defensively
        const safeLoading = Array.from({ length: n }, (_, i) => !!loading[i]);
        const safeAssocs  = Array.from({ length: n }, (_, i) => assocs[i] ?? "");
        const other_players_html = [];

        others.forEach((playerId, idx) => {
            const layout = getOtherPlayerLayout(idx, n);

            other_players_html.push(
                getSinglePlayerContainerGeneric(
                    getAvatarSafe(playerId),
                    layout.className,
                    safeLoading[idx],
                    safeAssocs[idx],
                    false,
                    layout.side
                )
            );
        });

        player_containers.push(
            getHtmlTag(
                "div",
                "other_players_container",
                "other_players_container",
                other_players_html
            )
        );
    }

    // --- Center content ---
    const center_container = getHtmlTag(
        "div",
        "center_container",
        "center_container",
        center
    );

    return getHtmlTag(
        "div",
        "screen",
        "screen",
        [...player_containers, center_container]
    );
}


function numPlayersFinishParam(key, value) {
    return getPlayersIdsByStatus('present').reduce(
        (count, groupMemberId) => {
            if (groupMemberId === jatos.groupMemberId) return count;
            const v = jatos.groupSession.get(groupMemberId + key);
            const ok = (value !== "*") ? v === value : v != null;
            return ok ? count + 1 : count;
        },
        0
    );
}

function allPlayersFinishParam(key, value) {
    const numPlayersFinished = numPlayersFinishParam(key, value);
    // console.log("numPlayersFinished = ", numPlayersFinished);
    const numPresentPlayers = getPlayersIdsByStatus('present',true).length;
    // console.log("numPlayers present = ", );
    return  numPlayersFinished === numPresentPlayers;
}


function getGroupData() {
    return jatos.groupSession.get(GROUP_DATA) || [];
}


// Function to shuffle with a fixed seed
function shuffle_seed(array, seed = 1) {
    if (!Array.isArray(array)) {
        console.error('shuffle_seed: expected Array, got ->', array);
        return [];
    }
    let currentIndex = array.length, temporaryValue, randomIndex;
    seed = seed || 1;
    let random = function () {
        var x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    while (0 !== currentIndex) {
        randomIndex = Math.floor(random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

// Function to get the other players' words for the current trial
function getOtherPlayersWords() {
    let other_players_answers = [];
    const other_players_ids = getAllOtherPlayersIds();
    other_players_ids.forEach((other_player_id) => {
        const other_words = getWords(other_player_id);
        other_players_answers.push(other_words[other_words.length - 1]);
    });
    return other_players_answers;
}

function getPlayersIdsByStatus(requestedStatus, others = false) {
    let ids = []
    if(requestedStatus === "present") ids = jatos.groupChannels;
    else if(requestedStatus === "leaved") ids = jatos.groupSession.get(HUMAN_PLAYERS_PROPERTY).filter(id => !jatos.groupChannels.includes(id));
    else if(requestedStatus === "bot") ids = jatos.groupSession.get(BOT_PLAYERS_PROPERTY);
    else console.error("[BAD REQUEST ERROR] ", requestedStatus);
    if(others) ids = ids.filter(id => id !== jatos.groupMemberId);
    return ids;
}

function getPresentPlayersIds(others=false) {
    return getPlayersIdsByStatus('present', others);

}

function getLeavedPlayersIds(others=false) {
    return getPlayersIdsByStatus('leaved', others);
}

function getBotPlayersIds() {
    return getPlayersIdsByStatus('bot');
}

function getAllPlayersIds(others = false) {
    const humanIds = jatos.groupSession.get(HUMAN_PLAYERS_PROPERTY) || [];
    const botIds   = jatos.groupSession.get(BOT_PLAYERS_PROPERTY) || [];
    const ids = [...humanIds, ...botIds];
    return others ? ids.filter(id => id !== jatos.groupMemberId) : ids;
}

function getAllOtherPlayersIds() {
    return getAllPlayersIds(true);
}

function printAllPlayersStatus() {
    console.log("Present Players : ",getPlayersIdsByStatus("present"));
    console.log("Leaved Players : ",getPlayersIdsByStatus("leaved"));
    console.log("Bot Players : ",getPlayersIdsByStatus("bot"));
}

const AVATAR_FALLBACK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

// Returns the avatar path using the last filename stored in cache.
// This way the avatar remains visible even if the player leaves (the groupSession entry may disappear).
function getAvatarSafe(memberId){
    const filename = jatos.groupSession.get(memberId + RANDOM_AVATAR_EXTENSION);
    if (!filename) return AVATAR_FALLBACK;
    const p = getAvatarPath(filename);
    return p ? p : AVATAR_FALLBACK;
}

function validateErrors() {
    if (error_strike >= 5) {
        jatos.leaveGroup().then(() => {
            jatos.endStudy(
                jsPsych.data.get().json()
                , false,
                "You have made too many errors. Please contact the researcher for further instructions."
            );
        });
    }
}

// -------- Shared helpers (factorized) --------
function getPresentMembers(){
    console.assert(leavedPlayers.length > 0);
    return allPlayers.filter(id => !leavedPlayers.includes(id));
}

function isLeaver(id){
    if (!id){
        console.error("in isLeaver function id is null!!!");
        return false;
    }
    return leavedPlayers.includes(id);
}

/*******************************************************
 *  Get Manager ID
 * -----------------------------------------------------
 * Returns the first active (non-leaving) player ID sorted
 * alphabetically. This player is used as a consistent
 * “manager” reference for bot decisions.
 *
 * @returns {string|null} First available player ID or null.
 *******************************************************/
function getManagerID() {
    const activePlayers = getPlayersIdsByStatus("present");
    return activePlayers.length > 0 ? activePlayers[0] : null;
}


/**
 * Robustly updates groupSession data (non-trial version).
 * - keys_values: array of [key, valueOrFn]
 * - maxRetries: number of attempts (default: 8)
 *
 * Returns: true if success, false if failed after retries.
 */
async function updateGroupSessionRobust(keys_values, maxRetries = 8) {
    console.log("Updating group session session ===================================");
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
        try {
            const gd = jatos.groupSession.getAll();

            for (let i = 0; i < keys_values.length; i++) {
                const [key, valueOrFn] = keys_values[i];
                gd[key] = (typeof valueOrFn === "function")
                    ? valueOrFn()
                    : valueOrFn;

                console.log(`[SET GROUP DATA ROBUST] ${key} = ${gd[key]} (attempt ${attempt + 1})`);
            }

            await jatos.groupSession.setAll(gd);
            success = true;
            return true;      // SUCCESS
        }
        catch (e) {
            attempt++;
            console.error(`[SET GROUP DATA ROBUST] Error attempt ${attempt}:`, e);

            if (attempt >= maxRetries) {
                console.error(`[SET GROUP DATA ROBUST] FAILED after ${attempt} attempts`);
                return false; // FAILURE
            }

            const delay =
                Math.min(500, 25 * Math.pow(2, attempt - 1))
                + Math.floor(Math.random() * 50);

            await new Promise(r => setTimeout(r, delay));
        }
    }

    return success;
}


function getTakenAvatars() {
    const taken = [];
    // Include avatars from human players
    jatos.groupMembers.forEach(memberId => {
        if (memberId !== jatos.groupMemberId) {
            const avatar = jatos.groupSession.get(memberId + AVATAR_EXTENSION);
            if (avatar) taken.push(avatar);
        }
    });
    // Include avatars from bots
    const botIds = getBotPlayersIds();
    botIds.forEach(botId => {
        const avatar = jatos.groupSession.get(botId + AVATAR_EXTENSION);
        if (avatar) taken.push(avatar);
        const randomAvatar = jatos.groupSession.get(botId + RANDOM_AVATAR_EXTENSION);
        if (randomAvatar) taken.push(randomAvatar);
    });
    return taken;
}

function getMyGroupIndex() {
    return jatos.groupMembers.indexOf(jatos.groupMemberId);
}

function getBaseAvatarPool() {
    // Trier groupMembers pour un ordre consistant entre tous les joueurs
    const sortedMembers = [...jatos.groupMembers].sort();
    const myIndex = sortedMembers.indexOf(jatos.groupMemberId);

    // Fallback si non trouvé
    if (myIndex === -1) return AVATARS_LIST.slice(0, 4);

    // Utiliser le nombre de joueurs humains (groupMembers n'inclut pas les bots)
    const numHumanPlayers = sortedMembers.length;

    const MAX_AVATARS_PER_PLAYER = 4;
    const num_avatars_per_player = Math.min(
        Math.floor(AVATARS_LIST.length / numHumanPlayers),
        MAX_AVATARS_PER_PLAYER
    );

    const start = myIndex * num_avatars_per_player;
    const end = start + num_avatars_per_player;

    return AVATARS_LIST.slice(start, end);
}

function getAvailableAvatars(my_avatar = "") {
    const basePool = getBaseAvatarPool();
    const takenAvatars = getTakenAvatars();
    return basePool.filter(
        avatar => avatar !== my_avatar && !takenAvatars.includes(avatar)
    );
}

function assignRandomAvatar() {
    const available = getAvailableAvatars();
    console.log(available);
    if (available.length === 0) return null;
    my_random_avatar = shuffle_seed(available, 1)[0];
    return my_random_avatar;
}

async function updateRandomAvatar(id){
    console.log("updateRandomAvatar status before changing:");
    if(jatos.groupSession.get(id + RANDOM_AVATAR_EXTENSION) === undefined){
        const random_avatar = assignRandomAvatar();
        updateGroupSessionRobust([
            [
                id + RANDOM_AVATAR_EXTENSION,
                () => {
                    return random_avatar;
                },
            ]
        ]);
    }
}


function getBotByPlayerId(playerId) {
    for (const [id, botInstance] of bots) {
        if (id === playerId) return botInstance;
    }
    return null;
}

function iAmManager(){
    return getManagerID() === jatos.groupMemberId;
}
