// ==UserScript==
// @name         Torn War Stuff Enhanced
// @namespace    namespace
// @version      0.8.1
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
.warstuff_highlight {
  background-color: #afa5 !important;
}
`);

  GM_addStyle(`
.warstuff_traveling .status {
  color: #F287FF !important;
}
`);

  function get_faction_ids() {
    const nodes = document.querySelectorAll("UL.members-list");
    if (!nodes) {
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
  }, 15000);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.classList && node.classList.contains("faction-war")) {
          console.log("Caught a mutation");

          update_statuses();
          clear_watchers();
          extract_member_lis(
            node.querySelector("LI.enemy").closest("UL.members-list"),
          );
          extract_member_lis(
            node.querySelector("LI.your").closest("UL.members-list"),
          );
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

  async function update_statuses() {
    const faction_ids = get_faction_ids();
    for (let i = 0; i < faction_ids.length; i++) {
      update_status(faction_ids[i]);
    }
  }

  async function update_status(faction_id) {
    const status = await fetch(
      `https://api.torn.com/faction/${faction_id}?selections=basic&key=${apiKey}`,
    )
      .then((r) => r.json())
      .catch((m) => {
        console.error("[TornWarStuffEnhanced] ", m);
      });
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

  function extract_member_lis(ul) {
    const lis = ul.querySelectorAll("LI");
    lis.forEach((li) => {
      const id = li
        .querySelector(`A[href^='/profiles.php']`)
        .href.split("ID=")[1];
      member_lis.set(id, li);
    });
  }

  function create_watcher() {
    watcher = setInterval(() => {
      let needsupdate = false;
      member_lis.forEach((li, id) => {
        const state = member_status.get(id);
        if (!state) {
          return;
        }
        const status = state.status;

        const status_DIV = li.querySelector("DIV.status");
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
              needsupdate = true;
              break;
            }
            if (status.description.includes("Traveling to ")) {
              li.setAttribute("data-sortA", "4");
              status_DIV.innerText =
                "► " + status.description.split("Traveling to ")[1];
            } else if (status.description.includes("In ")) {
              li.setAttribute("data-sortA", "3");
              status_DIV.innerText = status.description.split("In ")[1];
            } else if (status.description.includes("Returning")) {
              li.setAttribute("data-sortA", "2");
              status_DIV.innerText =
                "◄ " + status.description.split("Returning to Torn from ")[1];
            } else if (status.description.includes("Traveling")) {
              li.setAttribute("data-sortA", "5");
              status_DIV.innerText = "Traveling";
            }
            break;
          case "Hospital":
            if (!status_DIV.classList.contains("hospital")) {
              li.classList.remove("warstuff_highlight");
              li.classList.remove("warstuff_traveling");
              needsupdate = true;
              break;
            }
            li.setAttribute("data-sortA", "1");
            if (status.description.includes("In a")) {
              li.classList.add("warstuff_traveling");
            } else {
              li.classList.remove("warstuff_traveling");
            }

            const hosp_time_remaining = Math.round(
              status.until - new Date().getTime() / 1000,
            );
            if (hosp_time_remaining <= 0) {
              li.classList.remove("warstuff_highlight");
              return;
            }
            const s = Math.floor(hosp_time_remaining % 60);
            const m = Math.floor((hosp_time_remaining / 60) % 60);
            const h = Math.floor(hosp_time_remaining / 60 / 60);
            const time_string = `${pad_with_zeros(h)}:${pad_with_zeros(m)}:${pad_with_zeros(s)}`;
            status_DIV.innerText = time_string;

            if (hosp_time_remaining < 300) {
              li.classList.add("warstuff_highlight");
            } else {
              li.classList.remove("warstuff_highlight");
            }
            break;

          default:
            if (!status_DIV.classList.contains("okay")) {
              needsupdate = true;
            }
            li.setAttribute("data-sortA", "0");
            li.classList.remove("warstuff_highlight");
            li.classList.remove("warstuff_traveling");
            break;
        }
      });
      if (needsupdate) {
        update_statuses();
      }
      if (sort_enemies) {
        const nodes = get_member_lists();
        for (let i = 0; i < nodes.length; i++) {
          let lis = nodes[i].querySelectorAll("LI");
          Array.from(lis)
            .sort((a, b) => {
              return (
                a.getAttribute("data-sortA") - b.getAttribute("data-sortA") ||
                a.getAttribute("data-until") - b.getAttribute("data-until")
              );
            })
            .forEach((li) => {
              nodes[i].appendChild(li);
            });
        }
      }
    }, 250);
  }

  function clear_watchers() {
    clearInterval(watcher);
    watcher = null;
  }
})();
