// ==UserScript==
// @name          FF Scouter xentac
// @namespace     Violentmonkey Scripts
// @match         https://www.torn.com/*
// @version       2.3
// @author        rDacted, xentac
// @description   Shows the expected Fair Fight score against targets. Modified to work with new ffscouter.com.
// @grant         GM_xmlhttpRequest
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_deleteValue
// @grant         GM_registerMenuCommand
// @grant         GM_addStyle
// @connect       ffscouter.com
// ==/UserScript==

const FF_VERSION = 2.3;

// This is a standalone version of FF Scouter which has been integrated into TornTools
// This version is provided for TornPDA users, or those that don't use TornTools
// However I (rDacted) have quit torn, so this script is provided in an unsupported manner
// I encourage anyone to re-implement this script if they're willing to provide support to the community

// Ensure this code can only ever run once in any page
let singleton = document.getElementById("ff-scouter-run-once");
if (!singleton) {
  console.log(`FF Scouter version ${FF_VERSION} starting`);
  GM_addStyle(`
        .ff-scouter-indicator {
        position: relative;
        display: block;
        padding: 0;
        }

        .ff-scouter-vertical-line-low-upper,
        .ff-scouter-vertical-line-low-lower,
        .ff-scouter-vertical-line-high-upper,
        .ff-scouter-vertical-line-high-lower {
        content: '';
        position: absolute;
        width: 2px;
        height: 30%;
        background-color: black;
        margin-left: -1px;
        }

        .ff-scouter-vertical-line-low-upper {
        top: 0;
        left: calc(var(--arrow-width) / 2 + 33 * (100% - var(--arrow-width)) / 100);
        }

        .ff-scouter-vertical-line-low-lower {
        bottom: 0;
        left: calc(var(--arrow-width) / 2 + 33 * (100% - var(--arrow-width)) / 100);
        }

        .ff-scouter-vertical-line-high-upper {
        top: 0;
        left: calc(var(--arrow-width) / 2 + 66 * (100% - var(--arrow-width)) / 100);
    }

        .ff-scouter-vertical-line-high-lower {
        bottom: 0;
        left: calc(var(--arrow-width) / 2 + 66 * (100% - var(--arrow-width)) / 100);
        }

        .ff-scouter-arrow {
        position: absolute;
        transform: translate(-50%, -50%);
        padding: 0;
        top: 0;
        left: calc(var(--arrow-width) / 2 + var(--band-percent) * (100% - var(--arrow-width)) / 100);
        /*height: 40%;*/
        width: var(--arrow-width);
        object-fit: cover;
        pointer-events: none; /* Allow clicks to pass through */
        }
    `);

  var BASE_URL = "https://ffscouter.com";
  var BLUE_ARROW =
    "https://raw.githubusercontent.com/rDacted2/fair_fight_scouter/main/images/blue-arrow.svg";
  var GREEN_ARROW =
    "https://raw.githubusercontent.com/rDacted2/fair_fight_scouter/main/images/green-arrow.svg";
  var RED_ARROW =
    "https://raw.githubusercontent.com/rDacted2/fair_fight_scouter/main/images/red-arrow.svg";

  var rD_xmlhttpRequest;
  var rD_setValue;
  var rD_getValue;
  var rD_deleteValue;
  var rD_registerMenuCommand;

  // DO NOT CHANGE THIS
  // DO NOT CHANGE THIS
  var apikey = "###PDA-APIKEY###";
  // DO NOT CHANGE THIS
  // DO NOT CHANGE THIS
  if (apikey[0] != "#") {
    console.log("Adding modifications to support TornPDA");
    rD_xmlhttpRequest = function (details) {
      console.log("Attempt to make http request");
      if (details.method.toLowerCase() == "get") {
        return PDA_httpGet(details.url)
          .then(details.onload)
          .catch(details.onerror ?? ((e) => console.error(e)));
      } else if (details.method.toLowerCase() == "post") {
        return PDA_httpPost(
          details.url,
          details.headers ?? {},
          details.body ?? details.data ?? "",
        )
          .then(details.onload)
          .catch(details.onerror ?? ((e) => console.error(e)));
      } else {
        console.log("What is this? " + details.method);
      }
    };
    rD_setValue = function (name, value) {
      console.log("Attempted to set " + name);
      return localStorage.setItem(name, value);
    };
    rD_getValue = function (name, defaultValue) {
      var value = localStorage.getItem(name) ?? defaultValue;
      //console.log("Attempted to get " + name + " -> " + value);
      return value;
    };
    rD_deleteValue = function (name) {
      console.log("Attempted to delete " + name);
      return localStorage.removeItem(name);
    };
    rD_registerMenuCommand = function () {
      console.log("Disabling GM_registerMenuCommand");
    };
    rD_setValue("limited_key", apikey);
  } else {
    rD_xmlhttpRequest = GM_xmlhttpRequest;
    rD_setValue = GM_setValue;
    rD_getValue = GM_getValue;
    rD_deleteValue = GM_deleteValue;
    rD_registerMenuCommand = GM_registerMenuCommand;
  }

  var key = rD_getValue("limited_key", null);
  var info_line = null;

  rD_registerMenuCommand("Enter Limited API Key", () => {
    let userInput = prompt(
      "Enter Limited API Key",
      rD_getValue("limited_key", ""),
    );
    if (userInput !== null) {
      rD_setValue("limited_key", userInput);
      // Reload page
      window.location.reload();
    }
  });

  function create_text_location() {
    info_line = document.createElement("div");
    info_line.id = "ff-scouter-run-once";
    info_line.style.display = "flex"; // Use flexbox for centering
    info_line.style.cursor = "pointer"; // Change cursor to pointer
    info_line.addEventListener("click", () => {
      if (key === null) {
        const limited_key = prompt(
          "Enter Limited API Key",
          rD_getValue("limited_key", ""),
        );
        if (limited_key) {
          // Store the API key with rD_setValue
          rD_setValue("limited_key", limited_key);
          key = limited_key;
          // Reload page
          window.location.reload();
        }
      }
    });

    var h4 = $("h4")[0];
    if (h4.textContent === "Attacking") {
      h4.parentNode.parentNode.after(info_line);
    } else {
      h4.after(info_line);
    }

    return info_line;
  }

  function set_message(message, error = false) {
    while (info_line.firstChild) {
      info_line.removeChild(info_line.firstChild);
    }

    const textNode = document.createTextNode(message);
    if (error) {
      info_line.style.color = "red";
    } else {
      info_line.style.color = "";
    }
    info_line.appendChild(textNode);
  }

  function update_ff_cache(player_ids, callback) {
    if (!key) {
      return;
    }

    // Deduplicate
    player_ids = [...new Set(player_ids)];

    // Given a list of players remove any where the cache is already fresh enough
    // Then make a request for any unknown players and call the callback
    var unknown_player_ids = get_cache_misses(player_ids);

    if (unknown_player_ids.length > 0) {
      console.log(`Refreshing cache for ${unknown_player_ids.length} ids`);

      var player_id_list = unknown_player_ids.join(",");
      const url = `${BASE_URL}/api/v1/get-stats?key=${key}&targets=${player_id_list}`;

      //console.log(url);

      rD_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: function (response) {
          if (response.status == 200) {
            var ff_response = JSON.parse(response.responseText);
            //console.log(ff_response);
            if (!("error" in ff_response)) {
              var one_hour = 60 * 60 * 1000;
              var expiry = Date.now() + one_hour;

              ff_response.forEach((result) => {
                console.log(result);
                if (result.player_id) {
                  id = result.player_id;
                  // Cache the value
                  //console.log("Caching stats for " + id);
                  result.expiry = expiry;
                  rD_setValue("" + id, JSON.stringify(result));
                }
              });

              callback(player_ids);
            } else {
              console.log(
                "FF Scouter failed to get player information. Error message: " +
                  ff_response.error,
              );
            }
          } else {
            console.log(
              "Failed to make request, status code " + response.status,
            );
          }
        },
        onerror: function (e) {
          console.error("**** error ", e);
        },
        onabort: function (e) {
          console.error("**** abort ", e);
        },
        ontimeout: function (e) {
          console.error("**** timeout ", e);
        },
      });
    } else {
      callback(player_ids);
    }
  }

  function get_fair_fight_response(target_id) {
    var cached_ff_response = rD_getValue("" + target_id, null);
    try {
      cached_ff_response = JSON.parse(cached_ff_response);
    } catch {
      cached_ff_response = null;
    }

    if (cached_ff_response) {
      if (cached_ff_response.expiry > Date.now()) {
        return cached_ff_response;
      }
    }
  }

  function display_fair_fight(target_id) {
    const response = get_fair_fight_response(target_id);
    if (response.fair_fight) {
      set_fair_fight(response);
    }
  }

  function get_ff_string(ff_response) {
    const ff = ff_response.fair_fight.toFixed(2);

    const now = Date.now() / 1000;
    const age = now - ff_response.last_updated;

    var suffix = "";
    if (age > 14 * 24 * 60 * 60) {
      suffix = "?";
    }

    return `${ff}${suffix}`;
  }

  function get_ff_string_short(ff_response) {
    const ff = ff_response.fair_fight.toFixed(2);

    const now = Date.now() / 1000;
    const age = now - ff_response.last_updated;

    if (ff > 9) {
      return "high";
    }

    var suffix = "";
    if (age > 14 * 24 * 60 * 60) {
      suffix = "?";
    }

    return `${ff}${suffix}`;
  }

  function get_detailed_message(ff_response) {
    const ff_string = get_ff_string(ff_response);

    const now = Date.now() / 1000;
    const age = now - ff_response.last_updated;

    var fresh = "";

    if (age < 24 * 60 * 60) {
      // Pass
    } else if (age < 31 * 24 * 60 * 60) {
      var days = Math.round(age / (24 * 60 * 60));
      if (days == 1) {
        fresh = "(1 day old)";
      } else {
        fresh = `(${days} days old)`;
      }
    } else if (age < 365 * 24 * 60 * 60) {
      var months = Math.round(age / (31 * 24 * 60 * 60));
      if (months == 1) {
        fresh = "(1 month old)";
      } else {
        fresh = `(${months} months old)`;
      }
    } else {
      var years = Math.round(age / (365 * 24 * 60 * 60));
      if (years == 1) {
        fresh = "(1 year old)";
      } else {
        fresh = `(${years} years old)`;
      }
    }

    return `Fair Fight ${ff_string} ${fresh}`;
  }

  function set_fair_fight(ff_response) {
    const detailed_message = get_detailed_message(ff_response);
    set_message(detailed_message);
  }

  function get_members() {
    var player_ids = [];
    $(".table-body > .table-row").each(function () {
      if (!$(this).find(".fallen").length) {
        if (!$(this).find(".fedded").length) {
          $(this)
            .find(".member")
            .each(function (index, value) {
              var url = value.querySelectorAll('a[href^="/profiles"]')[0].href;
              var player_id = url.match(/.*XID=(?<player_id>\d+)/).groups
                .player_id;
              player_ids.push(parseInt(player_id));
            });
        }
      }
    });

    return player_ids;
  }

  function rgbToHex(r, g, b) {
    return (
      "#" +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    ); // Convert to hex and return
  }

  function get_ff_colour(value) {
    let r, g, b;

    // Transition from
    // blue - #2828c6
    // to
    // green - #28c628
    // to
    // red - #c62828
    if (value <= 1) {
      // Blue
      r = 0x28;
      g = 0x28;
      b = 0xc6;
    } else if (value <= 3) {
      // Transition from blue to green
      const t = (value - 1) / 2; // Normalize to range [0, 1]
      r = 0x28;
      g = Math.round(0x28 + (0xc6 - 0x28) * t);
      b = Math.round(0xc6 - (0xc6 - 0x28) * t);
    } else if (value <= 5) {
      // Transition from green to red
      const t = (value - 3) / 2; // Normalize to range [0, 1]
      r = Math.round(0x28 + (0xc6 - 0x28) * t);
      g = Math.round(0xc6 - (0xc6 - 0x28) * t);
      b = 0x28;
    } else {
      // Red
      r = 0xc6;
      g = 0x28;
      b = 0x28;
    }

    return rgbToHex(r, g, b); // Return hex value
  }

  function get_contrast_color(hex) {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Calculate brightness
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    return brightness > 126 ? "black" : "white"; // Return black or white based on brightness
  }

  function apply_fair_fight_info(player_ids) {
    const fair_fights = new Object();

    for (const player_id of player_ids) {
      var cached_ff_response = rD_getValue("" + player_id, null);
      try {
        cached_ff_response = JSON.parse(cached_ff_response);
      } catch {
        cached_ff_response = null;
      }

      if (cached_ff_response) {
        if (cached_ff_response.expiry > Date.now()) {
          fair_fights[player_id] = cached_ff_response;
        }
      }
    }

    var header_li = document.createElement("li");
    header_li.tabIndex = "0";
    header_li.classList.add("table-cell");
    header_li.classList.add("lvl");
    header_li.classList.add("torn-divider");
    header_li.classList.add("divider-vertical");
    header_li.classList.add("c-pointer");
    header_li.appendChild(document.createTextNode("FF"));

    $(".table-header > .lvl")[0].after(header_li);

    $(".table-body > .table-row > .member").each(function (index, value) {
      var url = value.querySelectorAll('a[href^="/profiles"]')[0].href;
      var player_id = url.match(/.*XID=(?<player_id>\d+)/).groups.player_id;

      var fair_fight_div = document.createElement("div");
      fair_fight_div.classList.add("table-cell");
      fair_fight_div.classList.add("lvl");

      // Lookup the fair fight score from cache
      if (fair_fights[player_id]) {
        const ff = fair_fights[player_id].fair_fight;
        const ff_string = get_ff_string_short(fair_fights[player_id]);

        const background_colour = get_ff_colour(ff);
        const text_colour = get_contrast_color(background_colour);
        fair_fight_div.style.backgroundColor = background_colour;
        fair_fight_div.style.color = text_colour;
        fair_fight_div.style.fontWeight = "bold";
        var text = document.createTextNode(ff_string);
        fair_fight_div.appendChild(text);
      }

      value.nextSibling.after(fair_fight_div);
    });
  }

  function get_cache_misses(player_ids) {
    var unknown_player_ids = [];
    for (const player_id of player_ids) {
      var cached_ff_response = rD_getValue("" + player_id, null);
      try {
        cached_ff_response = JSON.parse(cached_ff_response);
      } catch {
        cached_ff_response = null;
      }

      if (
        !cached_ff_response ||
        cached_ff_response.expiry < Date.now() ||
        cached_ff_response.age > 7 * 24 * 60 * 60
      ) {
        unknown_player_ids.push(player_id);
      }
    }

    return unknown_player_ids;
  }

  create_text_location();

  const match1 = window.location.href.match(
    /https:\/\/www.torn.com\/profiles.php\?XID=(?<target_id>\d+)/,
  );
  const match2 = window.location.href.match(
    /https:\/\/www.torn.com\/loader.php\?sid=attack&user2ID=(?<target_id>\d+)/,
  );
  const match = match1 ?? match2;
  if (match) {
    // We're on a profile page or an attack page - get the fair fight score
    var target_id = match.groups.target_id;
    update_ff_cache([target_id], function (target_ids) {
      display_fair_fight(target_ids[0]);
    });

    if (!key) {
      set_message("Limited API key needed - click to add");
    }
  } else if (
    window.location.href.startsWith("https://www.torn.com/factions.php")
  ) {
    const torn_observer = new MutationObserver(function () {
      // Find the member table - add a column if it doesn't already have one, for FF scores
      var members_list = $(".members-list")[0];
      if (members_list) {
        torn_observer.disconnect();

        var player_ids = get_members();
        update_ff_cache(player_ids, apply_fair_fight_info);
      }
    });

    torn_observer.observe(document, {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: true,
    });

    if (!key) {
      set_message("Limited API key needed - click to add");
    }
  } else {
    // console.log("Did not match against " + window.location.href);
  }

  function get_player_id_in_element(element) {
    const match = element.parentElement?.href?.match(/.*XID=(?<target_id>\d+)/);
    if (match) {
      return match.groups.target_id;
    }

    const anchors = element.getElementsByTagName("a");

    for (const anchor of anchors) {
      const match = anchor.href.match(/.*XID=(?<target_id>\d+)/);
      if (match) {
        return match.groups.target_id;
      }
    }

    if (element.nodeName.toLowerCase() === "a") {
      const match = element.href.match(/.*XID=(?<target_id>\d+)/);
      if (match) {
        return match.groups.target_id;
      }
    }

    return null;
  }

  function get_ff(target_id) {
    const response = get_fair_fight_response(target_id);
    if (response) {
      return response.fair_fight;
    }

    return null;
  }

  function ff_to_percent(ff) {
    // There are 3 key areas, low, medium, high
    // Low is 1-2
    // Medium is 2-4
    // High is 4+
    // If we clip high at 8 then the math becomes easy
    // The percent is 0-33% 33-66% 66%-100%
    const low_ff = 2;
    const high_ff = 4;
    const low_mid_percent = 33;
    const mid_high_percent = 66;
    ff = Math.min(ff, 8);
    var percent;
    if (ff < low_ff) {
      percent = ((ff - 1) / (low_ff - 1)) * low_mid_percent;
    } else if (ff < high_ff) {
      percent =
        ((ff - low_ff) / (high_ff - low_ff)) *
          (mid_high_percent - low_mid_percent) +
        low_mid_percent;
    } else {
      percent =
        ((ff - high_ff) / (8 - high_ff)) * (100 - mid_high_percent) +
        mid_high_percent;
    }

    return percent;
  }

  function show_cached_values(elements) {
    for (const [player_id, element] of elements) {
      element.classList.add("ff-scouter-indicator");
      if (!element.classList.contains("indicator-lines")) {
        element.classList.add("indicator-lines");
        element.style.setProperty("--arrow-width", "20px");

        // Ugly - does removing this break anything?
        element.classList.remove("small");
        element.classList.remove("big");

        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-low-upper" }));
        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-low-lower" }));
        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-high-upper" }));
        //$(element).append($("<div>", { class: "ff-scouter-vertical-line-high-lower" }));
      }

      const ff = get_ff(player_id);
      if (ff && ff.fair_fight) {
        const percent = ff_to_percent(ff);
        element.style.setProperty("--band-percent", percent);

        $(element).find(".ff-scouter-arrow").remove();

        var arrow;
        if (percent < 33) {
          arrow = BLUE_ARROW;
        } else if (percent < 66) {
          arrow = GREEN_ARROW;
        } else {
          arrow = RED_ARROW;
        }
        const img = $("<img>", {
          src: arrow,
          class: "ff-scouter-arrow",
        });
        $(element).append(img);
      }
    }
  }

  async function apply_ff_gauge(elements) {
    // Remove elements which already have the class
    elements = elements.filter(
      (e) => !e.classList.contains("ff-scouter-indicator"),
    );
    // Convert elements to a list of tuples
    elements = elements.map((e) => {
      const player_id = get_player_id_in_element(e);
      return [player_id, e];
    });
    // Remove any elements that don't have an id
    elements = elements.filter((e) => e[0]);

    if (elements.length > 0) {
      // Display cached values immediately
      // This is also important to ensure we only iterate the list once
      // Then update
      // Then re-display after the update
      show_cached_values(elements);
      const player_ids = elements.map((e) => e[0]);
      update_ff_cache(player_ids, () => {
        show_cached_values(elements);
      });
    }
  }

  async function apply_to_mini_profile(mini) {
    // Get the user id, and the details
    // Then in profile-container.description append a new span with the text. Win
    const player_id = get_player_id_in_element(mini);
    if (player_id) {
      const response = get_fair_fight_response(player_id);
      if (response.fair_fight) {
        // Remove any existing elements
        $(mini).find(".ff-scouter-mini-ff").remove();

        const message = get_detailed_message(response);

        const description = $(mini).find(".description");
        const desc = $("<span></span>", {
          class: "ff-scouter-mini-ff",
        });
        desc.text(message);
        $(description).append(desc);
      }
    }
  }

  const ff_gauge_observer = new MutationObserver(async function () {
    var honor_bars = $(".honor-text-wrap").toArray();
    if (honor_bars.length > 0) {
      await apply_ff_gauge($(".honor-text-wrap").toArray());
    } else {
      if (
        window.location.href.startsWith("https://www.torn.com/factions.php")
      ) {
        await apply_ff_gauge($(".member").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/companies.php")
      ) {
        await apply_ff_gauge($(".employee").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/joblist.php")
      ) {
        await apply_ff_gauge($(".employee").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/messages.php")
      ) {
        await apply_ff_gauge($(".name").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/index.php")
      ) {
        await apply_ff_gauge($(".name").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/hospitalview.php")
      ) {
        await apply_ff_gauge($(".name").toArray());
      } else if (
        window.location.href.startsWith(
          "https://www.torn.com/page.php?sid=UserList",
        )
      ) {
        await apply_ff_gauge($(".name").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/bounties.php")
      ) {
        await apply_ff_gauge($(".target").toArray());
        await apply_ff_gauge($(".listed").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/forums.php")
      ) {
        await apply_ff_gauge($(".last-poster").toArray());
        await apply_ff_gauge($(".starter").toArray());
        await apply_ff_gauge($(".last-post").toArray());
        await apply_ff_gauge($(".poster").toArray());
      } else if (
        window.location.href.startsWith("https://www.torn.com/page.php?sid=hof")
      ) {
        await apply_ff_gauge($('[class^="userInfoBox__"]').toArray());
      }
    }

    // Update any mini-profiles
    // Search for profile-mini-_userProfileWrapper___iIXVW
    var mini_profiles = $(
      '[class^="profile-mini-_userProfileWrapper_"]',
    ).toArray();
    if (mini_profiles.length > 0) {
      for (const mini of mini_profiles) {
        if (!mini.classList.contains("ff-processed")) {
          mini.classList.add("ff-processed");

          const player_id = get_player_id_in_element(mini);
          apply_to_mini_profile(mini);
          update_ff_cache([player_id], () => {
            apply_to_mini_profile(mini);
          });
        }
      }
    }
  });

  ff_gauge_observer.observe(document, {
    attributes: false,
    childList: true,
    characterData: false,
    subtree: true,
  });
}
