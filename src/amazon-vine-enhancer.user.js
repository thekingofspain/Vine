// ==UserScript==
// @name         Amazon Vine UI Enhancer
// @namespace    https://github.com/FiniteLooper/UserScripts
// @version      0.6.0
// @description  Minor UI improvements to browsing items on Amazon Vine
// @author       Chris Barr
// @homepageURL  https://github.com/FiniteLooper/UserScripts
// @updateURL    https://github.com/FiniteLooper/UserScripts/raw/main/src/amazon-vine-enhancer.user.js
// @match        https://*.amazon.com/vine/vine-items*
// @match        https://*.amazon.ca/vine/vine-items*
// @match        https://*.amazon.co.uk/vine/vine-items*
// @match        https://*.amazon.de/vine/vine-items*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

/*
TODO:
 * customizable highlight list
 * Customizable grid size
*/

(function () {
  "use strict";

  //=========================================================================
  //Variables used for multiple sections ====================================

  //Stuff for local storage of words to dim when an item description contains them
  const storageKeyWordList = "VINE_UI_ENHANCER_DIMMED_WORD_LIST";
  let wordList = [];

  const storedWords = localStorage.getItem(storageKeyWordList);
  if (storedWords === null) {
    [
      //Hair stuff
      "wig",
      "hair extension",
      "dreadlock extension",
      "ponytail extension",
      "crochet hair",
      "baby hair",
      "braiding hair",
      "eyelash extension",
      "false eyelash",

      //Printer ink/toner
      "ink cartridge",
      "ink refill",
      "toner",

      //Cakes & party decorations
      "cake topper",
      "cupcake wrapper",
      "cake decoration",
      "party decoration",

      //Misc.
      "castor oil",
      "shower pan liner",
      "anti-colic bottle",
      "tub spout",
    ]
      .reverse()
      .forEach((w) => addWordToList(w));
  } else {
    wordList = JSON.parse(storedWords);
  }

  //Detect if any StyleBot styles are being injected,
  //for Amazon Vine users this typically means they are using Thorvarium's styles: https://github.com/Thorvarium/vine-styling
  //if so we may want to do a few things differently for compatibility between these two things
  const clientAlsoUsingStyleBot = !!document.querySelector('style[id^="stylebot-"]');

  //Grab the body BG color in case any custom themes are applied to the site
  const bodyBgColor = getComputedStyle(document.body).backgroundColor;

  //grab the border color, style, and size
  const border = getComputedStyle(document.querySelector('[data-a-name="vine-items"]')).border;

  //The top bar with the buttons and the search
  const btnAndSearchEl = document.querySelector('[data-a-name="vine-items"] .vvp-items-button-and-search-container');

  //=========================================================================
  //Styles needed for various features
  GM_addStyle(
    [
      //Hide the "recently viewed items" and the footer underneath all the vine items
      //This make the page easier to scroll around on and speeds up the page since it will never load the data dynamically now
      `#rhf, #navFooter{display: none !important;}`,
      //Slightly taller popup modal window to the ETV is always visible =========
      `.a-popover-modal-fixed-height{height: 550px !important;} .a-popover-inner{padding-bottom: 112px !important;}`,
      //Side categories: bolded selected items and show nesting better ==========
      `a.selectedNode{font-weight: bold;}
      a.selectedNode:hover{color: inherit !important;}
      .child-node{
        padding-left: 10px;
        margin-left: 0;
        border-left: ${border};
      }`,
      //Sticky footer pagination
      `#vvp-items-grid-container > [role="navigation"] {
        position:sticky;
        bottom:0;
        padding-top: 5px;
        background-color: ${bodyBgColor};
        border-top: ${border};
        z-index: 30;
      }`,
      //Sticky top bar with search
      `[data-a-name="vine-items"] .vvp-items-button-and-search-container {
        position: sticky;
        top: 0;
        z-index: 1;
        background-color: ${bodyBgColor};
        border-bottom: ${border};
        z-index: 30;
      }`,
      //Sticky side bar with categories
      `#vvp-browse-nodes-container {
        align-self: start;
        position: sticky;
      }`,
      //Fade/Dim tiles
      `.dimmed-tile {
        opacity: .25;
        transition: opacity 300ms;
      }
      .dimmed-tile:hover { opacity: 1; }`,
      //Settings
      `.btn-open-settings {
        position:absolute;
        bottom: 1px;
        right: 0;
      }
      .btn-open-settings .a-btn-text{padding: 0 6px;}
      #settings-dialog{
        padding-top: 32px;
      }
      #btn-close-settings{
        position: absolute;
        top: 2px;
        right: 2px;
      }
      #word-list-display{
        margin: 0 0 1rem 0;
        padding: 0;
        list-style: none;
        overflow-y: scroll;
        max-height: 150px;
        border: 1px solid #EEE;
      }
      #word-list-display li{padding: 2px;}
      #word-list-display li:nth-child(odd) {background-color: #F9F9F9;}
      #word-list-display li .a-button-text{line-height: 1.25rem; padding: 0 0.25rem;}
      `,
    ].join("")
  );

  //=========================================================================
  //Sticky top bar with search ==============================================

  //Steal the margin value and use it as padding instead for the header so we can have a colored BG
  const btnAndSearchStyles = getComputedStyle(btnAndSearchEl);
  btnAndSearchEl.style.padding = btnAndSearchStyles.margin;
  btnAndSearchEl.style.margin = "0 !important";

  //=========================================================================
  //Sticky side bar with categories =========================================
  const elCategories = document.querySelector("#vvp-browse-nodes-container");

  //Set the sticky top position of the categories to the height of the top bar
  //unless the categories are taller than the screen
  if (elCategories.offsetHeight + btnAndSearchEl.offsetHeight <= document.documentElement.clientHeight) {
    elCategories.style.top = `${btnAndSearchEl.offsetHeight}px`;
  }

  //=========================================================================
  //When searching...
  if (document.location.search.includes("search=")) {
    //Put the RFY/AFA/AI area buttons back - why are they hidden during a search anyway?
    const areaButtonContainer = document.querySelector("#vvp-items-button-container");
    if (areaButtonContainer.innerHTML.trim() === "") {
      areaButtonContainer.innerHTML = `
      <span id="vvp-items-button--recommended" class="a-button a-button-normal a-button-toggle" role="radio"><span class="a-button-inner"><a href="vine-items?queue=potluck" class="a-button-text">Recommended for you</a></span></span>
      <span id="vvp-items-button--all" class="a-button a-button-normal a-button-toggle" role="radio"><span class="a-button-inner"><a href="vine-items?queue=last_chance" class="a-button-text">Available for all</a></span></span>
      <span id="vvp-items-button--seller" class="a-button a-button-normal a-button-toggle" role="radio"><span class="a-button-inner"><a href="vine-items?queue=encore" class="a-button-text">Additional items</a></span></span>`;
    }

    //pressing "show all" will return you to the AI section instead of RFY
    const showAllLink = document.querySelector("#vvp-browse-nodes-container>p>a");
    showAllLink.href = showAllLink.href.replace(/\?queue=\w+$/, "?queue=encore");
  }

  //=========================================================================
  //Pagination when left/right arrow keys are pressed =======================
  document.body.addEventListener("keyup", (ev) => {
    if (document.activeElement.tagName.toLowerCase() !== "input") {
      //Only do this if you are not currently in an input field
      if (ev.key === "ArrowLeft") {
        const el = document.querySelector(".a-pagination li:first-child a");
        el.focus();
        el.click();
      } else if (ev.key === "ArrowRight") {
        const el = document.querySelector(".a-pagination li:last-child a");
        el.focus();
        el.click();
      }
    }
  });

  //=========================================================================
  //Fade/Dim items with descriptions that match something in the word list defined at the top
  function dimTileWithDescriptionWordInList(itemElement) {
    const description = itemElement.querySelector(".vvp-item-product-title-container .a-truncate-full").innerText.toLowerCase();
    if (wordList.some((listItem) => description.includes(listItem))) {
      itemElement.classList.add("dimmed-tile");
    }
  }

  //=========================================================================
  //Add links/buttons to replace ASIN number for products that are broken with infinite spinners

  const detailsButtonGridSize = clientAlsoUsingStyleBot ? 6 : 8;
  const extraButtonGridSize = clientAlsoUsingStyleBot ? 3 : 2;
  const extraButtonWidth = clientAlsoUsingStyleBot ? "25%" : "17%"; //match the amazon grid system sizes

  GM_addStyle(
    [
      `.vvp-item-tile-content{ position: relative; }
      .vvp-details-btn{
        border-top-right-radius:0 !important;
        border-bottom-right-radius:0 !important;
      }
      .get-etv-link, .fix-asin-link {
        height: auto !important;
        position: absolute;
        bottom:0;
      }
      .get-etv-link {
        border-radius:0 !important;
        right: ${extraButtonWidth};
      }
      .fix-asin-link {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
        right:0;
      }
      .get-etv-link .a-button-text, .fix-asin-link .a-button-text{
        padding:0;
      }
      .get-etv-link.a-button-disabled, .get-etv-link.a-button-disabled .a-button-text{
        cursor: not-allowed !important;
        filter: saturate(50%);
      }`,
      `.etv-display{
        font-size: 12px;
        margin: 0 !important;
      }`,

      clientAlsoUsingStyleBot
        ? `.a-button-inner{height: auto !important}`
        : `
        .etv-display{
          position: absolute;
          right: ${extraButtonWidth};
          bottom: 55px;
          width: auto !important;
        }`,
    ].join("")
  );

  if (clientAlsoUsingStyleBot) {
    //When also using StyleBot, the all buttons need less padding so they can fit
    GM_addStyle(".vvp-item-tile .a-button-text{padding:5px 2px;}");
  }

  function addTileLinks(itemElement) {
    const tileContentEl = itemElement.querySelector(".vvp-item-tile-content");
    const detailsButtonEl = itemElement.querySelector(".vvp-details-btn");
    const inputEl = detailsButtonEl.querySelector("input.a-button-input");
    const isParent = /true/i.test(inputEl.getAttribute("data-is-parent-asin"));

    //Use an Amazon grid class to size the "see details" button
    detailsButtonEl.classList.add(`a-button-span${detailsButtonGridSize}`);
    if (clientAlsoUsingStyleBot) {
      //less text in the details button when using StyleBot styles so the extra buttons can fit better
      detailsButtonEl.querySelector(".a-button-text").innerText = "details";
    }

    //Add a link to check the ETV
    const getEtvLink = document.createElement("button");
    getEtvLink.setAttribute("type", "button");
    getEtvLink.setAttribute("class", `get-etv-link a-button a-button-primary a-button-span${extraButtonGridSize}`);
    getEtvLink.innerHTML = `<div class='a-button-text'>💵</div>`;

    const etvLinkClickFn = async (ev) => {
      ev.preventDefault();

      //Only one click per button
      getEtvLink.classList.remove("a-button-primary");
      getEtvLink.classList.add("a-button-disabled");
      getEtvLink.removeEventListener("click", etvLinkClickFn);

      const etvDisplayEl = document.createElement("div");
      etvDisplayEl.className = "etv-display";
      etvDisplayEl.innerText = "loading...";
      tileContentEl.insertBefore(etvDisplayEl, detailsButtonEl);

      const recommendationId = encodeURIComponent(inputEl.getAttribute("data-recommendation-id"));
      const asin = inputEl.getAttribute("data-asin");
      let url = `${location.origin}/vine/api/recommendations/${recommendationId}/item/${asin}?imageSize=180`;
      const req = await fetch(url);
      const response = await req.json();
      const data = response.result;

      if (data) {
        const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: data.taxCurrency });
        etvDisplayEl.innerText = `ETV: ${currencyFormatter.format(data.taxValue)}`;
      } else {
        etvDisplayEl.innerText = "Error getting ETV!";
      }
    };

    if (isParent) {
      getEtvLink.title = "Has variations, see the details";
      getEtvLink.classList.remove("a-button-primary");
      getEtvLink.classList.add("a-button-disabled");
      getEtvLink.setAttribute("disabled", "");
    } else {
      getEtvLink.title = "Get ETV";
      getEtvLink.addEventListener("click", etvLinkClickFn);
    }

    tileContentEl.append(getEtvLink);

    //Add a link to fix the infinite load issue
    const fixLink = document.createElement("button");
    fixLink.setAttribute("type", "button");
    fixLink.className = `fix-asin-link a-button a-button-primary a-button-span${extraButtonGridSize}`;
    fixLink.innerHTML = `<span class='a-button-text'>🔃</span>`;
    fixLink.title = "Fix infinite spinner error";
    tileContentEl.append(fixLink);

    fixLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      const newASIN = prompt("Open the product page, copy the ASIN number, and put it here...");
      if (newASIN !== "") {
        inputEl.setAttribute("data-is-parent-asin", "false");
        inputEl.setAttribute("data-asin", newASIN);
        inputEl.focus();
      }
    });
  }

  //=========================================================================
  //=========================================================================
  //Settings Dialog
  const showSettingsBtnEl = document.createElement("button");
  showSettingsBtnEl.type = "button";
  showSettingsBtnEl.title = "Vine UI Enhancer Settings";
  showSettingsBtnEl.className = "btn-open-settings a-button";
  showSettingsBtnEl.innerHTML = `<div class='a-button-text'>⚙️</div>`;
  btnAndSearchEl.appendChild(showSettingsBtnEl);
  showSettingsBtnEl.addEventListener("click", (ev) => {
    ev.preventDefault();
    settingsDialog.showModal();
    renderList();
  });

  const settingsDialog = document.createElement("dialog");
  settingsDialog.id = "settings-dialog";
  settingsDialog.innerHTML = `
    <button type="button" class="a-button" id="btn-close-settings"><div class='a-button-text'>&times;</div></button>
    <h1>Vine UI Enhancer Settings</h1>
    <h3>Dim Items Containing these words/phrases</h3>
    <small>(reload page to see changes)</small>
    <ul id="word-list-display"></ul>
    <input type="text" id="txt-add-word-list">
    <button type="button" class="a-button a-button-primary" id="btn-add-word-list"><div class='a-button-text'>Add Word</div></button>
    <br><br>
    <button type="button" class="a-button" id="btn-show-top-words"><div class='a-button-text'>Show the top 10 words on this page</div></button>
  `;
  document.body.append(settingsDialog);
  settingsDialog.querySelector("#btn-close-settings").addEventListener("click", () => {
    settingsDialog.close();
  });

  const ulWordListEl = settingsDialog.querySelector("#word-list-display");
  const txtWordListEl = settingsDialog.querySelector("#txt-add-word-list");

  function addWordFromUI() {
    const word = txtWordListEl.value.trim().toLowerCase();
    if (word.length > 0 && !wordList.includes(word)) {
      addWordToList(word);
      txtWordListEl.value = "";
    }
  }
  settingsDialog.querySelector("#btn-add-word-list").addEventListener("click", addWordFromUI);
  txtWordListEl.addEventListener("keyup", (ev) => {
    if (ev.key === "Enter") addWordFromUI();
  });

  function renderList() {
    ulWordListEl.innerHTML = wordList
      .map(
        (w) =>
          `<li><button type="button" class="a-button" title="Remove '${w}'" data-word="${w}"><div class='a-button-text'>X</div></button> ${w}</li>`
      )
      .join("\n");
    ulWordListEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeWordFromList(btn.getAttribute("data-word"));
      });
    });
  }
  function addWordToList(word) {
    wordList.unshift(word);
    renderList();
    localStorage.setItem(storageKeyWordList, JSON.stringify(wordList));
  }
  function removeWordFromList(word) {
    const idx = wordList.indexOf(word);
    wordList.splice(idx, 1);
    renderList();
    localStorage.setItem(storageKeyWordList, JSON.stringify(wordList));
  }

  //Show the top most common words
  settingsDialog.querySelector("#btn-show-top-words").addEventListener("click", (ev) => {
    ev.preventDefault();
    const ignoreWords = ["the", "and", "for", "with", "to", "of", "in", "-", "&"];
    const allWords = [...document.querySelectorAll(".a-truncate-full")]
      //Split anything with space, commas, dashes, semicolons into any array
      .flatMap((el) => el.innerText.toLowerCase().split(/[,;\s-]/g))
      //remove anything from the ignore list, anything that is just a number, or anything 1 character long
      .filter((w) => !ignoreWords.includes(w) && w.length > 1 && !/^\d+(\.\d+)?$/.test(w));

    const wordMap = {};
    allWords.forEach((i) => (wordMap[i] = (wordMap[i] || 0) + 1));
    const topWords = Object.keys(wordMap)
      .map((k) => ({ word: k, count: wordMap[k] }))
      .sort((a, b) => a.count - b.count) //sort by count
      .reverse() //largest numbers at the top
      .slice(0, 10);

    let displayString = "";
    topWords.forEach((x) => {
      displayString += `[${x.count}] - ${x.word}\n`;
    });

    alert(displayString);
  });

  //=========================================================================
  //Loop over each product tile and run functions for each one
  document.querySelectorAll("#vvp-items-grid > .vvp-item-tile").forEach((itemElement) => {
    dimTileWithDescriptionWordInList(itemElement);
    addTileLinks(itemElement);
  });
})();
