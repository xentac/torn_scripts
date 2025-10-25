// ==UserScript==
// @name         torn.com Remove all styling on torn.com
// @namespace    xentac
// @version      20251025.1
// @description  torn.com So we can "make the page go faster"
// @author       xentac [3354782]
// @match        https://www.torn.com/*
// @license MIT
// ==/UserScript==

"use strict";

function removeStyling(node) {
  //console.log(node);
  if (node.querySelectorAll) {
    node
      .querySelectorAll("[style]")
      .forEach((el) => el.removeAttribute("style"));
    node
      .querySelectorAll("[class]")
      .forEach((el) => el.removeAttribute("class"));
  }
}

function react(mutation) {
  mutation.addedNodes.forEach(removeDarkStyling);
}

function reactAll(mutations) {
  mutations.forEach(react);
}

(function () {
  const target = document;
  removeStyling(target);
  const observer = new MutationObserver(reactAll);
  observer.observe(target, { childList: true, subtree: true });
  //observer.disconnect();
})();
