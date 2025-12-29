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
const PLAYERS_METADATA_PROPERTY = "_players_metadata";
const SLOW_RESPONSE_THRESHOLD_SECONDS = 4;
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


function getOthersAvatars(other_players_ids) {
    const all_properties = jatos.groupSession.getAll();
    return other_players_ids
        .map((groupMemberId) => all_properties[groupMemberId + RANDOM_AVATAR_EXTENSION])
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

function getScreen(children_center, hide_other_players = false, show_loading = false, other_words = [],others = []) {
    const player_containers = [];

    // Main Player Container (center bottom)
    const main_player_avatar = getHtmlTag("img", "avatar", "avatar", null, { src: getAvatarById(jatos.groupMemberId) });
    const main_player = getHtmlTag("div", "loading_player", "loading_player", main_player_avatar);
    const main_player_container = getHtmlTag("div", "down_container", "down_container", main_player);
    let loaders = [false, false];


    player_containers.push(main_player_container);
    if (!hide_other_players) {
        const other_players_ids =  others.length === 0 ? getAllPlayersIds(true) : others;
        const other_avatars = getOthersAvatars(other_players_ids);
        const other_players = [];

        if (show_loading) {
            let group_data = getGroupData();

            // Safely read last turn (group_data may be empty at the beginning)
            let lastTurn = null;
            const last = group_data[group_data.length - 1];
            if (Array.isArray(last) && last.length > 1) {
                lastTurn = last[1];
            }

            // Set loaders only if we have a valid lastTurn and at least one other player
            if (lastTurn !== null && other_players_ids.length > 0) {
                if (lastTurn === other_players_ids[0]) {
                    loaders[0] = true;
                } else if (other_players_ids.length > 1 && lastTurn === other_players_ids[1]) {
                    loaders[1] = true;
                }
            }
        }
        if(other_avatars.length > 0) {
            if (other_players_ids.length === 1) {
                if (other_words.length > 0) {
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[0], "up_container", show_loading, other_words[0]));
                } else {
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[0], "up_container", show_loading));
                }
            } else if (other_players_ids.length === 2) {
                if (other_words.length > 0) {
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[1], "up_right_container", (show_loading && loaders[1]), other_words[1], false, "right"));
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[0], "up_left_container", (show_loading && loaders[0]), other_words[0], false, "left"));
                }
                else {
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[1], "up_right_container", (show_loading && loaders[1]), "", false, "right"));
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[0], "up_left_container", (show_loading && loaders[0]), "", false, "left"));
                }

            } else {
                if (other_words.length > 0) {
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[0], "up_container", show_loading, other_words[0]));
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[1], "right_container", show_loading, other_words[1], false, "right"));
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[2], "left_container", show_loading, other_words[2], false, "left"));
                }
                else {
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[0], "up_container", show_loading));
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[1], "right_container", show_loading, "", false, "right"));
                    other_players.push(getSinglePlayerContainerGeneric(other_avatars[2], "left_container", show_loading, "", false, "left"));
                }
            }
        }

        const other_players_container = getHtmlTag("div", "other_players_container", "other_players_container", other_players);
        player_containers.push(other_players_container);

    }
    const center_container = getHtmlTag("div", "center_container", "center_container", children_center);
    const screen = getHtmlTag("div", "screen", "screen", [...player_containers, center_container]);
    return screen;
}


function allPlayersFinishParam(key, value) {
    return getPlayersIdsByStatus('present').every(
        (groupMemberId) => {
            if (groupMemberId === jatos.groupMemberId) return true;
            return (value !== "*" ? jatos.groupSession.get(groupMemberId + key) === value : jatos.groupSession.get(groupMemberId + key) != null);
        }
    );
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
    const gs = jatos.groupSession.getAll();
    const ids = Object.entries(gs)
        .filter(([key, value]) => key.endsWith(PLAYERS_METADATA_PROPERTY) && value === requestedStatus)
        .map(([key]) => key.replace(PLAYERS_METADATA_PROPERTY, ""))  // remove suffix → extract player ID
        .sort();
    return others ? ids.filter(id => id !== jatos.groupMemberId) : ids;
}

function getPresentPlayersIds(others=false) {
    return getPlayersIdsByStatus('present', others);

}

function getLeavedPlayersIds(others=false) {
    return getPlayersIdsByStatus('leaved', others);
}

function getBotPlayersIds(others=false) {
    return getPlayersIdsByStatus('bot', others);
}

function getAllPlayersIds(others = false) {
    const gs = jatos.groupSession.getAll();
    const ids = Object.keys(gs)
        .filter(key => key.endsWith(PLAYERS_METADATA_PROPERTY))
        .map(key => key.replace(PLAYERS_METADATA_PROPERTY, ""))   // remove suffix to get the ID
        .sort();
    return others ? ids.filter(id => id !== jatos.groupMemberId) : ids;
}

function getAllOtherPlayersIds() {
    return getAllPlayersIds(true);
}

function printAllPlayersStatus() {
    const gs = jatos.groupSession.getAll();  // All group-session data
    const players = getAllPlayersIds();
    console.log("PLAYERS = ",players);
    for (const id of players) {
        key = id + PLAYERS_METADATA_PROPERTY;
        console.log("[PLAYER STATUS] ",id , " = ", gs[key]);
    }
}

const AVATAR_FALLBACK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

// Returns the avatar path using the last filename stored in cache.
// This way the avatar remains visible even if the player leaves (the groupSession entry may disappear).
function getAvatarSafe(memberId){
    const filename = avatarsCache[memberId] || jatos.groupSession.get(memberId + RANDOM_AVATAR_EXTENSION);
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

function getStatusMemberIds(status){
    const metadata = jatos.groupSession.get(PLAYERS_METADATA_PROPERTY);
    return Object.entries(metadata)
        .filter(([id, status]) => status === status)
        .map(([id]) => id);
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

async function updatePlayersMetadata(id) {
    console.log("Players status before changing:");
    printAllPlayersStatus();

    console.log("myId =", jatos.groupMemberId,
        "LeavedPlayerId =", id,
        "ManagerId =", getManagerID());
    // Only the manager is allowed to update statuses
    if (jatos.groupSession.get(id+PLAYERS_METADATA_PROPERTY) === 'present') {
        const key = id + PLAYERS_METADATA_PROPERTY;
        const newStatus = botActive ? "bot" : "leaved";
        console.log("NEW STATUS = ", newStatus);
        jatos.groupSession
            .set(key, newStatus)
            .then(() => {
                console.log(`Updated metadata for ${id}: ${newStatus}`);
                console.log("Players status after changing:");
                printAllPlayersStatus();
            })
            .catch(e => {
                console.log("Error updating metadata", e);
            });
    }
    else {
        console.log("Not manager — skipping metadata update.");
    }
    console.log("jatos.groupSession.get(id+PLAYERS_METADATA_PROPERTY) = ",jatos.groupSession.get(id+PLAYERS_METADATA_PROPERTY));
    await new Promise(resolve => setTimeout(resolve, 10000));
}

function getTakenAvatars() {
    const taken = [];
    jatos.groupMembers.forEach(memberId => {
        if (memberId !== jatos.groupMemberId) {
            const avatar = jatos.groupSession.get(memberId + AVATAR_EXTENSION);
            if (avatar) taken.push(avatar);
        }
    });
    return taken;
}

function getMyGroupIndex() {
    return jatos.groupMembers.indexOf(jatos.groupMemberId);
}

function getBaseAvatarPool() {
    const num_players = jatos.groupMembers.length;
    const num_avatars_per_player = Math.floor(AVATARS_LIST.length / num_players);
    const myIndex = getMyGroupIndex();
    if (myIndex === -1) return [];
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
    console.log('#######################');
    console.log("playerID = ",playerId);
    for (const [id, botInstance] of bots) {
        console.log(id);
        if (id === playerId) return botInstance;
    }
    return null; // si pas trouvé
}

function iAmManager(){
    return getManagerID() === jatos.groupMemberId;
}
