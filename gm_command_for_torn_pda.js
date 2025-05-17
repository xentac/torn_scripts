// ==UserScript==
// @name         GM_registerMenuCommand for torn.com
// @namespace    namespace
// @version      0.1
// @description  Define a GM_registerMenuCommand for torn.com
// @author       xentac
// @license      MIT
// @match        https://www.torn.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// ==/UserScript==
//
console.log("[GFT] init");

if (document.querySelector(".settings-menu .gmregistermenucommandran")) {
  return;
}

ran_element = document.createElement("div");
ran_element.style.visibility = "hidden";
ran_element.className = "gmregistermenucommandran";
document.querySelector(".settings-menu").appendChild(ran_element);

_orig_GM_registerMenuCommand = GM_registerMenuCommand;
GM_registerMenuCommand = function (name, callback, options_or_accessKey) {
  console.log("[GFT] GM_registerMenuCommand was called");
  const menu = document.querySelector(".settings-menu");
  const li = document.createElement("li");
  li.className = "link";
  const a = document.createElement("a");
  a.href = "#";
  const iconDiv = document.createElement("div");
  iconDiv.className = "icon-wrapper";
  const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
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

  return _orig_GM_registerMenuCommand(name, callback, options_or_accessKey);
};

console.log("[GFT] overrode GM_registerMenuCommand");
