// ==UserScript==
// @name         Moar Attack Buttons
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds a button to each weapon for faster fight initiation
// @author       xentac
// @match        https://www.torn.com/page.php?sid=attack*
// @grant        none
// @run-at document-end
// ==/UserScript==

(function () {
  "use strict";

  // Constants for script identification and selection
  const CUSTOM_BTN_CLASS = "script-bridge-trigger";
  const COMBAT_BTN_SELECTOR =
    '[class*="modal____"] [class*="dialogWrapper___"] button[type="submit"]';

  /**
   * Finds the primary target button and triggers its click handler,
   * then cleans up all script-generated buttons.
   */
  function executeCombatSequence() {
    const targetButton = document.querySelector(COMBAT_BTN_SELECTOR);
    for (const c of targetButton.classList) {
      if (c.startsWith("btnTimer__")) {
        console.warn(
          '[Bridge Script] Target button ("Start fight" or "Join Fight") has a timer.',
        );
        return;
      }
    }

    if (targetButton) {
      targetButton.click();
    } else {
      console.warn(
        '[Bridge Script] Target button ("Start fight" or "Join Fight") was not found in the DOM.',
      );
      return;
    }

    // Cleanup: Purge all buttons created by this script
    document
      .querySelectorAll(`.${CUSTOM_BTN_CLASS}`)
      .forEach((btn) => btn.remove());
  }

  /**
   * Iterates through available figure containers and injects the trigger overlay.
   */
  async function injectOverlays() {
    // Target weapon figures safely by their built-in prefix naming convention
    const found = await waitForElement(
      '[aria-describedby*="label_attacker_"] [class*="weaponImage___"]',
      10_000,
    );

    if (!found) {
      return;
    }

    const figures = document.querySelectorAll(
      '[aria-describedby*="label_attacker_"] [class*="weaponImage___"]',
    );

    figures.forEach((figure) => {
      // Avoid duplicate injections if the DOM re-evaluates
      if (figure.querySelector(`.${CUSTOM_BTN_CLASS}`)) return;

      // Ensure the parent container supports relative positioning context
      if (window.getComputedStyle(figure).position === "static") {
        figure.style.position = "relative";
      }

      // Construct structural overlay button
      const overlayBtn = document.createElement("button");
      overlayBtn.className = CUSTOM_BTN_CLASS;
      overlayBtn.textContent = "Fight";

      // Inline styling to ensure visual layout visibility directly over the figure asset
      Object.assign(overlayBtn.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "9999",
        padding: "4px 8px",
        fontSize: "11px",
        color: "#fff",
        border: "1px solid #666",
        borderRadius: "3px",
        cursor: "pointer",
        backgroundColor: "rgba(51, 51, 51, 0.4)",
      });

      overlayBtn.addEventListener("click", (e) => {
        //e.stopPropagation(); // Stop event bubbling to underlying React elements
        executeCombatSequence();
      });

      figure.appendChild(overlayBtn);
    });
  }

  function waitForElement(selector, timeoutMs = 15_000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) {
        return resolve(existing);
      }

      const observer = new MutationObserver((_, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      if (timeoutMs > 0) {
        setTimeout(() => {
          observer.disconnect();
          log.debug(`Timeout waiting for element selector: '${selector}'`);
          resolve(null);
        }, timeoutMs);
      }
    });
  }

  // Initial check
  injectOverlays();
})();
