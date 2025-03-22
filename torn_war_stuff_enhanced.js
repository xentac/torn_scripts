// ==UserScript==
// @name         Torn War Stuff Enhanced
// @namespace    namespace
// @version      1.1.2
// @description  Show travel status and hospital time and sort by hospital time on war page. Fork of https://greasyfork.org/en/scripts/448681-torn-war-stuff
// @author       xentac
// @license      MIT
// @match        *.torn.com/factions.php*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// ==/UserScript==

(async function () {
  ("use strict");

  let apiKey =
    localStorage.getItem("xentac-torn_war_stuff_enhanced-apikey") ??
    "###PDA-APIKEY###";
  const sort_enemies = true;
  const CONTENT = "data-twse-content";
  const TRAVELING = "data-twse-traveling";
  const HIGHLIGHT = "data-twse-highlight";

  try {
    GM_registerMenuCommand("Set Api Key", function () {
      checkApiKey(false);
    });
  } catch (error) {
    // This is fine, but we need to handle torn pda too
  }

  function checkApiKey(checkExisting = true) {
    if (
      !checkExisting ||
      apiKey === null ||
      apiKey.indexOf("PDA-APIKEY") > -1 ||
      apiKey.length != 16
    ) {
      let userInput = prompt(
        "Please enter a PUBLIC Api Key, it will be used to get basic faction information:",
        apiKey ?? "",
      );
      if (userInput !== null && userInput.length == 16) {
        apiKey = userInput;
        localStorage.setItem(
          "xentac-torn_war_stuff_enhanced-apikey",
          userInput,
        );
      } else {
        console.error(
          "[TornWarStuffEnhanced] User cancelled the Api Key input.",
        );
      }
    }
  }

  GM_addStyle(`
.members-list li:has(div.status[data-twse-highlight="true"]) {
  background-color: #afa5 !important;
}
`);

  GM_addStyle(`
.members-list div.status[data-twse-traveling="true"]::after {
  color: #F287FF !important;
}
`);

  GM_addStyle(`
.members-list div.status {
  position: relative !important;
  color: transparent !important;
}
.members-list div.status::after {
  content: attr(data-twse-content);
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% - 10px);
  height: 100%;
  background: inherit;
  display: flex;
  right: 10px;
  justify-content: flex-end;
  align-items: center;
}
.members-list .ok.status::after {
    color: var(--user-status-green-color);
}


.members-list .not-ok.status::after {
    color: var(--user-status-red-color);
}

.members-list .abroad.status::after, .members-list .traveling.status::after {
    color: var(--user-status-blue-color);
}
`);

  let running = true;

  function get_faction_ids() {
    const nodes = document.querySelectorAll("UL.members-list");
    if (nodes.length != 2) {
      return [];
    }
    const enemy_faction_id = nodes[0]
      .querySelector(`A[href^='/factions.php']`)
      .href.split("ID=")[1];
    const your_faction_id = nodes[1]
      .querySelector(`A[href^='/factions.php']`)
      .href.split("ID=")[1];
    return [enemy_faction_id, your_faction_id];
  }

  function get_member_lists() {
    return document.querySelectorAll("ul.members-list");
  }

  setInterval(() => {
    update_statuses();

    // Backup in case the observer doesn't work
    if (watcher == null) {
      extract_all_member_lis();
      create_watcher();
    }
  }, 5000);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.classList && node.classList.contains("faction-war")) {
          console.log("Caught a mutation");

          update_statuses();
          extract_all_member_lis();
          create_watcher();
        }
      }
    }
  });

  function pad_with_zeros(n) {
    if (n < 10) {
      return "0" + n;
    }
    return n;
  }

  const wrapper = document.body; //.querySelector('#mainContainer')
  observer.observe(wrapper, { subtree: true, childList: true });

  const member_status = new Map();
  const member_lis = new Map();
  let watcher = null;

  let last_request = null;
  const MIN_TIME_SINCE_LAST_REQUEST = 9000;

  async function update_statuses() {
    if (!running) {
      return;
    }
    if (
      last_request &&
      new Date() - last_request < MIN_TIME_SINCE_LAST_REQUEST
    ) {
      return;
    }
    last_request = new Date();
    const faction_ids = get_faction_ids();
    for (let i = 0; i < faction_ids.length; i++) {
      if (!update_status(faction_ids[i])) {
        return;
      }
    }
  }

  async function update_status(faction_id) {
    let error = false;
    const status = await fetch(
      `https://api.torn.com/faction/${faction_id}?selections=basic&key=${apiKey}&comment=TornWarStuffEnhanced`,
    )
      .then((r) => r.json())
      .catch((m) => {
        console.error("[TornWarStuffEnhanced] ", m);
        error = true;
      });
    if (error) {
      return true;
    }
    if (status.error) {
      console.log(
        "[TornWarStuffEnhanced] Received error from torn API ",
        status.error,
      );
      if (
        [0, 1, 2, 3, 4, 6, 7, 10, 12, 13, 14, 16, 18, 21].includes(status.error)
      ) {
        console.log(
          "[TornWarStuffEnhanced] Received a non-recoverable error. Giving up.",
        );
        running = false;
        return false;
      }
      if ([5, 8, 9].includes(status.error.code)) {
        // 5: Too many requests error code
        // 8: IP block
        // 9: API disabled
        // Try again in 30 + MIN_TIME_SINCE_LAST_REQUEST seconds
        console.log("[TornWarStuffEnhanced] Retrying in 40 seconds.");
        last_request = new Date() + 30000;
      }
      return false;
    }
    if (!status.members) {
      return false;
    }
    for (const [k, v] of Object.entries(status.members)) {
      v.status.description = v.status.description
        .replace("South Africa", "SA")
        .replace("Cayman Islands", "CI")
        .replace("United Kingdom", "UK")
        .replace("Argentina", "Arg")
        .replace("Switzerland", "Switz");
      member_status.set(k, v);
    }
  }

  function extract_all_member_lis() {
    get_member_lists().forEach((ul) => {
      extract_member_lis(ul);
    });
  }

  function extract_member_lis(ul) {
    const lis = ul.querySelectorAll("LI");
    lis.forEach((li) => {
      const id = li
        .querySelector(`A[href^='/profiles.php']`)
        .href.split("ID=")[1];
      member_lis.set(id, li);
    });
  }

  let prom = null;

  async function create_watcher() {
    if (prom) {
      return prom;
    }
    prom = (async function () {
      clear_watchers();
      watcher = setInterval(() => {
        if (!running) {
          return;
        }
        member_lis.forEach((li, id) => {
          const state = member_status.get(id);
          const status_DIV = li.querySelector("DIV.status");
          if (!state) {
            // Make sure the user sees something before we've downloaded state
            status_DIV.setAttribute(CONTENT, status_DIV.innerText);
            return;
          }
          const status = state.status;

          li.setAttribute("data-until", status.until);
          switch (status.state) {
            case "Abroad":
            case "Traveling":
              if (
                !(
                  status_DIV.classList.contains("traveling") ||
                  status_DIV.classList.contains("abroad")
                )
              ) {
                status_DIV.setAttribute(CONTENT, status_DIV.innerText);
                break;
              }
              if (status.description.includes("Traveling to ")) {
                li.setAttribute("data-sortA", "4");
                const content =
                  "► " + status.description.split("Traveling to ")[1];
                status_DIV.setAttribute(CONTENT, content);
              } else if (status.description.includes("In ")) {
                li.setAttribute("data-sortA", "3");
                const content = status.description.split("In ")[1];
                status_DIV.setAttribute(CONTENT, content);
              } else if (status.description.includes("Returning")) {
                li.setAttribute("data-sortA", "2");
                const content =
                  "◄ " + status.description.split("Returning to Torn from ")[1];
                status_DIV.setAttribute(CONTENT, content);
              } else if (status.description.includes("Traveling")) {
                li.setAttribute("data-sortA", "5");
                const content = "Traveling";
                status_DIV.setAttribute(CONTENT, content);
              }
              break;
            case "Hospital":
            case "Jail":
              if (
                !(
                  status_DIV.classList.contains("hospital") ||
                  status_DIV.classList.contains("jail")
                )
              ) {
                status_DIV.setAttribute(CONTENT, status_DIV.innerText);
                status_DIV.setAttribute(TRAVELING, "false");
                status_DIV.setAttribute(HIGHLIGHT, "false");
                break;
              }
              li.setAttribute("data-sortA", "1");
              if (status.description.includes("In a")) {
                status_DIV.setAttribute(TRAVELING, "true");
              } else {
                status_DIV.setAttribute(TRAVELING, "false");
              }

              const hosp_time_remaining = Math.round(
                status.until - new Date().getTime() / 1000,
              );
              if (hosp_time_remaining <= 0) {
                status_DIV.setAttribute(HIGHLIGHT, "false");
                return;
              }
              const s = Math.floor(hosp_time_remaining % 60);
              const m = Math.floor((hosp_time_remaining / 60) % 60);
              const h = Math.floor(hosp_time_remaining / 60 / 60);
              const time_string = `${pad_with_zeros(h)}:${pad_with_zeros(m)}:${pad_with_zeros(s)}`;

              if (status_DIV.getAttribute(CONTENT) != time_string) {
                status_DIV.setAttribute(CONTENT, time_string);
              }

              if (hosp_time_remaining < 300) {
                status_DIV.setAttribute(HIGHLIGHT, "true");
              } else {
                status_DIV.setAttribute(HIGHLIGHT, "false");
              }
              break;

            default:
              status_DIV.setAttribute(CONTENT, status_DIV.innerText);
              li.setAttribute("data-sortA", "0");
              status_DIV.setAttribute(TRAVELING, "false");
              status_DIV.setAttribute(HIGHLIGHT, "false");
              break;
          }
        });
        if (sort_enemies) {
          const nodes = get_member_lists();
          for (let i = 0; i < nodes.length; i++) {
            let lis = nodes[i].querySelectorAll("LI");
            let sorted_lis = Array.from(lis).sort((a, b) => {
              return (
                a.getAttribute("data-sortA") - b.getAttribute("data-sortA") ||
                a.getAttribute("data-until") - b.getAttribute("data-until")
              );
            });
            let sorted = true;
            for (let j = 0; j < sorted_lis.length; j++) {
              if (nodes[i].children[j] !== sorted_lis[j]) {
                sorted = false;
                break;
              }
            }
            if (!sorted) {
              sorted_lis.forEach((li) => {
                nodes[i].appendChild(li);
              });
            }
          }
        }
      }, 250);
      prom = null;
    })();

    return prom;
  }

  function clear_watchers() {
    clearInterval(watcher);
    watcher = null;
  }
})();
