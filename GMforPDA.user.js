// ==UserScript==
// @name         GMforPDA
// @namespace    https://github.com/Kwack-Kwack/GMforPDA
// @version      1.0
// @description  A userscript that allows GM_ functions to be called in tornPDA. Simply replace the underscore (_) with a period (.) eg GM.addStyle
// @author       Kwack [2190604]
// @match        https://*
// ==/UserScript==

/** NOTES:
 *  - These fixes are not perfect, and may not work in all cases. If you find a bug, please report it in the PDA discord.
 *  - Both dot notation (GM.addStyle) and underscore notation (GM_addStyle) are supported.
 *  - Whilst this script supplies vanilla JS counterparts to the GM_ functions, it cannot prepare your script to run on
 *    mobile devices. Viewports are different, the page looks different, some selectors do change so your script may have to
 *    be adapted to run properly. You can reach out to me in the PDA discord if you'd like some assistance with this.
 *  - The storage functions (getValue/setValue/deleteValue/listValues) are global and not script-specific. Other scripts will
 *    use the same storage keys as you, so use a unique key to prevent this issue.
 *  - The xmlhttpRequest function in TamperMonkey is quite complex, and I've only implemented the most basic functionality. It
 *    only supports the keys `url`, `method`, `data`, `body`, `headers`, `onload` and `onerror`. If you need more functionality,
 *    you can use the PDA_httpGet and PDA_httpPost functions directly.
 */

const ver = 0.2;

if (!window.flutter_inappwebview)
  throw new Error(
    "GMforPDA requires flutter_inappwebview to be defined. Ensure this script is running inside of PDA.",
  );

window.GM = {
  /**
   * To enforce a script version, throw an error if window.GM.ver !== [desired version]
   * To enforce only a major version (minor, unbreaking changes permitted) just use Math.floor(window.GM.ver) !== [desired major version]
   */
  ver,

  /**
   * @param {string} key The key to the specified value.
   * @param {string} defaultValue The value to be returned if there is no value associated with the specified key
   * @returns {string} Returns the value associated with the specified key, or the default value if there is no value associated with the specified key.
   */
  getValue(key, defaultValue) {
    return localStorage.getItem(key) ?? defaultValue;
  },

  /**
   * @param {string} key The key to store the value under. This is global and NOT script-specific. Use a unique storage key to prevent potential clashes with other scripts.
   * @param {string} value The value to store under the specified key.
   * @returns {void}
   */
  setValue(key, value) {
    localStorage.setItem(key, value);
  },

  /**
   * @param {string} key Removes a key-value pair from storage.
   * @returns {void}
   */
  deleteValue(key) {
    localStorage.removeItem(key);
  },

  /**
   * @returns {string[]} Returns an array of all keys in storage.
   */
  listValues() {
    return Object.values(localStorage);
  },

  /**
   *
   * @param {string} style The CSS to be added to the page, as a string.
   * @returns {void}
   */
  addStyle(style) {
    if (!style) return;
    const s = document.createElement("style");
    s.type = "text/css";
    s.innerHTML = style;

    document.head.appendChild(s);
  },

  /**
   *
   * @description Only works if the document is focused.
   * @param {string} text The text to be copied to the clipboard.
   * @returns {void}
   */
  setClipboard(text) {
    if (!document.hasFocus()) throw new DOMException("Document is not focused");
    navigator.clipboard.writeText(text);
  },

  /**
   *
   * @param details The details passed to the request.
   * @param {"GET" | "POST"} details.method The HTTP method to use.
   * @param {string} details.url The URL to send the request to.
   * @param {string} details.data The body of the request, for POST requests
   * @param {Object} details.headers The headers to send with the request, as an object. eg { "Content-Type": "application/json" }
   * @param {function} details.onload The function to be called when the request is successful. The response is passed as an argument.
   * @param {function} details.onerror The function to be called when the request fails. The error is passed as an argument.
   * @returns {Promise} A promise that resolves when the request is successful, and rejects when the request fails. Access response body via `response.responseText` (property, not method).
   */
  async xmlhttpRequest(details) {
    try {
      if (!details || typeof details !== "object")
        throw new TypeError("Invalid details passed to GM.xmlHttpRequest");
      let { url, method, data, body, headers, onload, onerror } = details;
      if (!url || !(typeof url === "string" || url instanceof URL))
        throw new TypeError("Invalid url passed to GM.xmlHttpRequest");
      if (method && typeof method !== "string")
        throw new TypeError("Invalid method passed to GM.xmlHttpRequest");
      if (!method || method.toLowerCase() === "get") {
        const h = headers ?? {};
        h["X-GMforPDA"] = "Sent from PDA via GMforPDA";
        return await PDA_httpGet(url, h ?? {})
          .then(onload ?? ((x) => x))
          .catch(onerror ?? ((e) => console.error(e)));
      } else if (method.toLowerCase() === "post") {
        const h = headers ?? {};
        h["X-GMforPDA"] = "Sent from PDA via GMforPDA";
        url = url instanceof URL ? url.href : url;
        return await PDA_httpPost(url, h ?? {}, body ?? data ?? "")
          .then(onload ?? ((x) => x))
          .catch(onerror ?? ((e) => console.error(e)));
      } else throw new TypeError("Invalid method passed to GM.xmlHttpRequest");
    } catch (e) {
      /** Should these be switched, since the console is inverted in PDA? */
      console.error(
        "An uncaught error occured in GM.xmlHttpRequest - please report this in the PDA discord if this is unexpected. The error is above ^ ",
      );
      console.error(e instanceof Error ? e : JSON.stringify(e));
      throw e instanceof Error ? e : new Error(e);
    }
  },

  /**
   *
   * @param  {...any} args Either an object with the following properties, or the properties themselves in order:
   * @param {string} text The text to be displayed in the alert.
   * @param {string} title The title of the alert.
   * @param {function} onclick The function to be called when the alert is clicked.
   * @param {function} ondone The function to be called when the alert is closed.
   */
  notification(...args) {
    let text, title, onclick, ondone;
    if (typeof args[0] === "string") {
      [text, title, , onclick] = args;
    } else {
      ({ text, title, onclick, ondone } = args[0]);
    }
    const alert =
      (title
        ? `Notification from script ${title}:`
        : "Notification from unnamed source:") +
      "\n" +
      text;
    if (confirm(alert)) onclick?.();
    return ondone?.();
  },

  /**
   *
   * @param {string} url the URL to open in a new tab
   */
  openInTab(url) {
    if (!url) throw TypeError("No URL provided to GM.openInTab");
    window.open(url, "_blank");
  },
  registerMenuCommand(name, callback, options_or_accessKey) {
    console.log("GM_registerMenuCommand was called");
    const menu = document.querySelector(".settings-menu");
    const li = document.createElement("li");
    li.className = "link";
    const a = document.createElement("a");
    a.href = "#";
    const iconDiv = document.createElement("div");
    iconDiv.className = "icon-wrapper";
    const svgIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    svgIcon.setAttribute("class", "default");
    svgIcon.setAttribute("fill", "#fff");
    svgIcon.setAttribute("stroke", "transparent");
    svgIcon.setAttribute("stroke-width", "0");
    svgIcon.setAttribute("width", "16");
    svgIcon.setAttribute("height", "16");
    svgIcon.setAttribute("viewBox", "0 0 640 512");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M36.8 192l566.3 0c20.3 0 36.8-16.5 36.8-36.8c0-7.3-2.2-14.4-6.2-20.4L558.2 21.4C549.3 8 534.4 0 518.3 0L121.7 0c-16 0-31 8-39.9 21.4L6.2 134.7c-4 6.1-6.2 13.2-6.2 20.4C0 175.5 16.5 192 36.8 192zM64 224l0 160 0 80c0 26.5 21.5 48 48 48l224 0c26.5 0 48-21.5 48-48l0-80 0-160-64 0 0 160-192 0 0-160-64 0zm448 0l0 256c0 17.7 14.3 32 32 32s32-14.3 32-32l0-256-64 0z",
    );
    const span = document.createElement("span");
    span.textContent = name;
    svgIcon.appendChild(path);
    iconDiv.appendChild(svgIcon);
    a.appendChild(iconDiv);
    a.appendChild(span);
    li.appendChild(a);
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.click();
      callback(options_or_accessKey);
    });
    const logoutButton = menu.querySelector("li.logout");
    if (logoutButton) {
      menu.insertBefore(li, logoutButton);
    } else {
      menu.appendChild(li);
    }
  },

  /** Yes these constants achieve nothing - it's here to prevent scripts throwing errors.
   *  I haven't seen many scripts require this function work as expected, it's normally just for logging purposes and
   *  crash reports, hence why the constants are here.
   *  If you're a script developer and you're looking to use this function, use a different method.
   *  `GM_info.script.version` could just be `const version = "0.1.1"` at the top of your script instead.
   */
  info: {
    script: {
      description: "This information is unavailable in TornPDA",
      excludes: [],
      includes: [],
      matches: [],
      name: undefined,
      namespace: undefined,
      resources: {},
      "run-at": undefined,
      version: undefined,
    },
    scriptMetaStr: "This information is unavailable in TornPDA",
    scriptHandler: `TornPDA, using GMforPDA version ${ver}`,
    version: ver,
  },
};

/** Add underscore variants to window object as well */
Object.entries(GM).forEach(([k, v]) => (window[`GM_${k}`] = v));
