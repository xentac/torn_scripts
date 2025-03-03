// ==UserScript==
// @name         torn.com No dark text in forum
// @namespace    xentac
// @version      20250303.2
// @description  torn.com No Dark Text - Removes all dark text in the forum, so it's readable in dark mode
// @author       xentac [3354782]
// @match        *.torn.com/forums.php*
// ==/UserScript==

"use strict";

function removeDarkStyling(node) {
  //console.log(node);
  if (node.querySelectorAll) {
    var spans = node.querySelectorAll(".post span");

    for (var i = 0; i < spans.length; i++) {
      const elem = spans[i];
      console.log(elem.style.color);
      if (elem.style.color == "rgb(51, 51, 51)") {
        elem.style.color = null;
      }
    }
  }
}

function react(mutation) {
  mutation.addedNodes.forEach(removeDarkStyling);
}

function reactAll(mutations) {
  mutations.forEach(react);
}

(function () {
  const target = document.querySelector("#forums-page-wrap");
  const observer = new MutationObserver(reactAll);
  observer.observe(target, { childList: true, subtree: true });
  //observer.disconnect();
})();
