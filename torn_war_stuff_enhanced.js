// ==UserScript==
// @name         Torn War Stuff Enhanced
// @namespace    namespace
// @version      0.8
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

  setInterval(() => {
    const node = document.querySelector("DIV.faction-war");
    if (node) {
      replaceInfo(
        node,
        node.querySelectorAll("LI.enemy"),
        node.querySelector("LI.enemy").closest("UL.members-list"),
      );
      replaceInfo(
        node,
        node.querySelectorAll("LI.your"),
        node.querySelector("LI.your").closest("UL.members-list"),
      );
    }
  }, 15000);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.classList && node.classList.contains("faction-war")) {
          replaceInfo(
            node,
            node.querySelectorAll("LI.enemy"),
            node.querySelector("LI.enemy").closest("UL.members-list"),
          );
          replaceInfo(
            node,
            node.querySelectorAll("LI.your"),
            node.querySelector("LI.your").closest("UL.members-list"),
          );
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

  const hospital_timers = new Map();

  async function replaceInfo(node, enemy_LIs, enemy_UL) {
    hospital_timers.forEach((k, v) => {
      clearInterval(v);
      hospital_timers[k] = undefined;
    });
    const enemy_faction_id = enemy_LIs[0]
      .querySelector(`A[href^='/factions.php']`)
      .href.split("ID=")[1];
    const enemy_basic = await fetch(
      `https://api.torn.com/faction/${enemy_faction_id}?selections=basic&key=${apiKey}`,
    )
      .then((r) => r.json())
      .catch((m) => {
        console.error("[TornWarStuffEnhanced] ", m);
      });
    enemy_LIs.forEach((li) => {
      const status_DIV = li.querySelector("DIV.status");
      const enemy_id = li
        .querySelector(`A[href^='/profiles.php']`)
        .href.split("ID=")[1];
      const enemy_status = enemy_basic.members[enemy_id].status;
      li.setAttribute("data-until", enemy_status.until);
      enemy_status.description = enemy_status.description
        .replace("South Africa", "SA")
        .replace("Cayman Islands", "CI")
        .replace("United Kingdom", "UK")
        .replace("Argentina", "Arg")
        .replace("Switzerland", "Switz");
      switch (enemy_status.state) {
        case "Abroad":
        case "Traveling":
          if (enemy_status.description.includes("Traveling to ")) {
            li.setAttribute("data-sortA", "4");
            status_DIV.innerText =
              "► " + enemy_status.description.split("Traveling to ")[1];
          } else if (enemy_status.description.includes("In ")) {
            li.setAttribute("data-sortA", "3");
            status_DIV.innerText = enemy_status.description.split("In ")[1];
          } else if (enemy_status.description.includes("Returning")) {
            li.setAttribute("data-sortA", "2");
            status_DIV.innerText =
              "◄ " +
              enemy_status.description.split("Returning to Torn from ")[1];
          } else if (enemy_status.description.includes("Traveling")) {
            li.setAttribute("data-sortA", "5");
            status_DIV.innerText = "Traveling";
          }
          break;
        case "Hospital":
          li.setAttribute("data-sortA", "1");
          if (hospital_timers[enemy_id]) {
            clearInterval(hospital_timers[enemy_id]);
            hospital_timers[enemy_id] = null;
          }
          if (enemy_status.description.includes("In a ")) {
            li.classList.add("warstuff_traveling");
          } else {
            li.classList.remove("warstuff_traveling");
          }
          hospital_timers[enemy_id] = setInterval(() => {
            if (status_DIV.classList.contains("okay")) {
              li.classList.remove("warstuff_highlight");
              status_DIV.innerText = "Okay";
              return;
            }
            const hosp_time_remaining = Math.round(
              enemy_status.until - new Date().getTime() / 1000,
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
          }, 250);
          break;
        default:
          li.setAttribute("data-sortA", "0");
          break;
      }
    });
    if (sort_enemies) {
      Array.from(enemy_LIs)
        .sort((a, b) => {
          return (
            a.getAttribute("data-sortA") - b.getAttribute("data-sortA") ||
            a.getAttribute("data-until") - b.getAttribute("data-until")
          );
        })
        .forEach((li) => enemy_UL.appendChild(li));
    }
  }
})();
