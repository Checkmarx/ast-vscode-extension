(function () {
  const icons = {
    critical:
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M5.65869 0.858561C4.54829 1.64712 3.27916 2.0892 1.99079 2.18481C1.6964 2.20666 1.45637 2.44729 1.46013 2.74247C1.54648 9.51946 3.29138 10.2136 5.78337 11.2049L5.80111 11.212C5.92864 11.2627 6.07158 11.2627 6.19911 11.212L6.21684 11.2049C8.70884 10.2136 10.4537 9.51946 10.5401 2.74247C10.5439 2.44729 10.3038 2.20666 10.0094 2.18481C8.72105 2.0892 7.45193 1.64712 6.34152 0.858561C6.1377 0.713813 5.86252 0.713813 5.65869 0.858561ZM4.85361 7.90159C5.16123 8.08989 5.52944 8.18404 5.95824 8.18404C6.31806 8.18404 6.63127 8.11878 6.89787 7.98828C7.16447 7.85591 7.37514 7.67321 7.52988 7.44016C7.68462 7.20525 7.77411 6.93586 7.79835 6.63197H6.83075C6.80092 6.78671 6.74593 6.91814 6.66576 7.02628C6.58559 7.13441 6.48585 7.21737 6.36653 7.27517C6.24908 7.3311 6.11578 7.35906 5.96663 7.35906C5.75596 7.35906 5.57232 7.30313 5.41571 7.19127C5.26097 7.07755 5.14072 6.91628 5.05496 6.70747C4.9692 6.4968 4.92632 6.24512 4.92632 5.95241C4.92632 5.66344 4.9692 5.41548 5.05496 5.20854C5.14259 5.0016 5.2647 4.84313 5.42131 4.73313C5.57791 4.62127 5.75969 4.56534 5.96663 4.56534C6.21086 4.56534 6.40568 4.63525 6.5511 4.77508C6.69838 4.91304 6.7916 5.08549 6.83075 5.29243H7.79835C7.77598 4.98295 7.68462 4.71262 7.52429 4.48144C7.36396 4.2484 7.14862 4.06849 6.87829 3.94171C6.60983 3.81308 6.30128 3.74876 5.95265 3.74876C5.53317 3.74876 5.16962 3.8429 4.862 4.0312C4.55625 4.21764 4.31948 4.47865 4.15169 4.81423C3.9839 5.14795 3.9 5.53294 3.9 5.96919C3.9 6.40358 3.98203 6.78764 4.14609 7.12136C4.31202 7.45321 4.54786 7.71329 4.85361 7.90159Z" fill="#BB2A31"/> <path d="M5.95824 8.18404C5.52944 8.18404 5.16123 8.08989 4.85361 7.90159C4.54786 7.71329 4.31202 7.45321 4.14609 7.12136C3.98203 6.78764 3.9 6.40358 3.9 5.96919C3.9 5.53294 3.9839 5.14795 4.15169 4.81423C4.31948 4.47865 4.55625 4.21764 4.862 4.0312C5.16962 3.8429 5.53317 3.74876 5.95265 3.74876C6.30128 3.74876 6.60983 3.81308 6.87829 3.94171C7.14862 4.06849 7.36396 4.2484 7.52429 4.48144C7.68462 4.71262 7.77598 4.98295 7.79835 5.29243H6.83075C6.7916 5.08549 6.69838 4.91304 6.5511 4.77508C6.40568 4.63525 6.21086 4.56534 5.96663 4.56534C5.75969 4.56534 5.57791 4.62127 5.42131 4.73313C5.2647 4.84313 5.14259 5.0016 5.05496 5.20854C4.9692 5.41548 4.92632 5.66344 4.92632 5.95241C4.92632 6.24512 4.9692 6.4968 5.05496 6.70747C5.14072 6.91628 5.26097 7.07755 5.41571 7.19127C5.57232 7.30313 5.75596 7.35906 5.96663 7.35906C6.11578 7.35906 6.24908 7.3311 6.36653 7.27517C6.48585 7.21737 6.58559 7.13441 6.66576 7.02628C6.74593 6.91814 6.80092 6.78671 6.83075 6.63197H7.79835C7.77411 6.93586 7.68462 7.20525 7.52988 7.44016C7.37514 7.67321 7.16447 7.85591 6.89787 7.98828C6.63127 8.11878 6.31806 8.18404 5.95824 8.18404Z" fill="white"/> </svg>',
    high: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99067 2.18481C3.27904 2.0892 4.54817 1.64712 5.65857 0.858561C5.8624 0.713813 6.13757 0.713813 6.3414 0.858561C7.45181 1.64712 8.72093 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70872 10.2136 6.21672 11.2049L6.19899 11.212C6.07146 11.2627 5.92851 11.2627 5.80098 11.212L5.78325 11.2049C3.29126 10.2136 1.54636 9.51946 1.46 2.74247C1.45624 2.44729 1.69628 2.20666 1.99067 2.18481Z" fill="#F8788F"/> <path d="M4.17827 8.08421V3.80813H5.08234V5.57243H6.91763V3.80813H7.81962V8.08421H6.91763V6.31782H5.08234V8.08421H4.17827Z" fill="white"/> </svg>',
    medium:
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99067 2.18481C3.27904 2.0892 4.54817 1.64712 5.65857 0.858561C5.8624 0.713813 6.13757 0.713813 6.3414 0.858561C7.4518 1.64712 8.72093 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70871 10.2136 6.21672 11.2049L6.19899 11.212C6.07146 11.2627 5.92851 11.2627 5.80098 11.212L5.78325 11.2049C3.29126 10.2136 1.54636 9.51946 1.46 2.74247C1.45624 2.44729 1.69628 2.20666 1.99067 2.18481Z" fill="#F9AE4D"/> <path d="M3.65576 3.80813H4.77072L5.94831 6.68112H5.99842L7.17601 3.80813H8.29097V8.08421H7.41404V5.301H7.37854L6.27194 8.06333H5.67479L4.56819 5.29056H4.53269V8.08421H3.65576V3.80813Z" fill="white"/> </svg>',
    low: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99069 2.18481C3.27906 2.0892 4.54818 1.64712 5.65859 0.858561C5.86241 0.713813 6.13759 0.713813 6.34141 0.858561C7.45182 1.64712 8.72094 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70873 10.2136 6.21674 11.2049L6.199 11.212C6.07147 11.2627 5.92853 11.2627 5.801 11.212L5.78327 11.2049C3.29127 10.2136 1.54638 9.51946 1.46002 2.74247C1.45626 2.44729 1.6963 2.20666 1.99069 2.18481Z" fill="#419128"/> <path d="M4.70366 8.08421V3.80813H5.60773V7.33882H7.44093V8.08421H4.70366Z" fill="white"/> </svg>',
  };

  let currentSortMethod = "score";

  window.addEventListener("DOMContentLoaded", () => {
    const previousState = vscode.getState();

    if (previousState?.results) {
      renderApplications(previousState.results);
      const { rawTypes, displayNames } = extractFilterValues(
        previousState.results
      );
      const uniqueTraits = extractTraits(previousState.results);
      renderTraitFilters(uniqueTraits);
      renderTypeFilters(rawTypes, displayNames, previousState.results);
      document.getElementById("loading").classList.add("hidden");
    }

    setupSortMenu();
    setupFilterMenu();
  });

  function setupSortMenu() {
    const sortButton = document.getElementById("sortButton");
    const sortMenu = document.getElementById("sortMenu");
    const currentSortText = document.getElementById("currentSort");
    const filterMenu = document.getElementById("filterMenu");
    const filterButton = document.getElementById("filterButton");
    const filterBadge = document.getElementById("filterBadge");

    if (!sortButton || !sortMenu) {
      return;
    }

    sortButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = sortMenu.classList.toggle("show");

      filterMenu.classList.remove("show");
      filterButton.classList.remove("filter-open");
      if (filterBadge) {
        filterBadge.classList.remove("hidden");
      }

      sortButton.classList.toggle("active", isOpen);
      addIconToActiveOption();
    });

    document.addEventListener("click", (e) => {
      if (!sortButton.contains(e.target) && !sortMenu.contains(e.target)) {
        sortMenu.classList.remove("show");
        sortButton.classList.remove("active");
      }
    });

    function updateHasSelectionClass() {
      sortButton.classList.add("has-selection");
    }

    document.querySelectorAll(".sort-option").forEach((option) => {
      const sortType = option.dataset.sort;
      if (!sortType) {
        return;
      }

      option.addEventListener("click", () => {
        currentSortMethod = sortType;
        updateHasSelectionClass();

        const results = vscode.getState()?.results;
        if (results) {
          results.applicationNameIDMap = sortApplications(
            results.applicationNameIDMap,
            sortType
          );
          renderApplications(results);
        }

        sortMenu.classList.remove("show");
        sortButton.classList.remove("active");
      });
    });

    updateHasSelectionClass();
  }

  function addIconToActiveOption() {
    document.querySelectorAll(".sort-option").forEach((option) => {
      if (option.dataset.sort === currentSortMethod) {
        option.innerHTML = `<span style="display: flex; justify-content: space-between;"><span>${option.textContent
          .replace("✓", "")
          .trim()}</span><span>✓</span></span>`;
      } else {
        option.textContent = option.textContent.replace("✓", "").trim();
      }
    });
  }

  function sortApplications(applications, sortType) {
    return [...applications].sort((a, b) => {
      switch (sortType) {
        case "score":
          return b.score - a.score;
        case "az":
          return a.applicationName.localeCompare(b.applicationName);
        case "za":
          return b.applicationName.localeCompare(a.applicationName);
        default:
          return 0;
      }
    });
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "getRiskManagementResults": {
        const results = message.data;
        results.applicationNameIDMap = sortApplications(
          results.applicationNameIDMap,
          currentSortMethod
        );
        renderApplications(results);

        const { rawTypes, displayNames } = extractFilterValues(results);
        renderTypeFilters(rawTypes, displayNames, results);
        renderVulnerabilityTypeFilters(rawTypes, displayNames);
        updateFilterBadge();
        vscode.setState({ results });
        break;
      }
      case "showLoader": {
        document.getElementById("loading").classList.remove("hidden");
        document
          .getElementById("riskManagementContainer")
          .classList.add("hidden");
        break;
      }
      case "hideLoader": {
        document.getElementById("loading").classList.add("hidden");
        document
          .getElementById("riskManagementContainer")
          .classList.remove("hidden");
        break;
      }
    }
  });

  function openVulnerabilityDetails(result) {
    vscode.postMessage({
      command: "openVulnerabilityDetails",
      result: result,
    });
  }

  function getRiskName(score) {
    return score === 10
      ? "critical"
      : score >= 7
      ? "high"
      : score >= 3
      ? "medium"
      : "low";
  }

  function renderTypeFilters(rawTypes, displayNames, results) {
    const container = document.getElementById("typeFilters");
    if (!container) {
      return;
    }

    container.innerHTML = "";
    const buttons = [];

    const allButton = document.createElement("button");
    allButton.textContent = "All";
    allButton.classList.add("selected");
    allButton.onclick = () => {
      buttons.forEach((btn) => btn.classList.remove("selected"));
      allButton.classList.add("selected");
      renderApplications(results);
    };
    container.appendChild(allButton);
    buttons.push(allButton);

    for (let i = 0; i < rawTypes.length; i++) {
      const button = document.createElement("button");
      button.textContent = displayNames[i];
      const typeValue = rawTypes[i];

      button.onclick = () => {
        buttons.forEach((btn) => btn.classList.remove("selected"));
        button.classList.add("selected");

        const filteredResults = {
          ...results,
          results: results.results.filter((r) => r.type === typeValue),
        };
        renderApplications(filteredResults);
      };

      container.appendChild(button);
      buttons.push(button);
    }
  }

  function renderVulnerabilityTypeFilters(rawTypes, displayNames) {
    const submenu = document.getElementById("submenu-vuln-type");
    if (!submenu) {
      return;
    }

    submenu.innerHTML = "";

    const allItem = document.createElement("div");
    allItem.classList.add("filter-option");
    allItem.innerHTML = `
      <input type="checkbox" id="vuln-all" />
      <label for="vuln-all">All Types</label>
    `;
    submenu.appendChild(allItem);

    const allCheckbox = allItem.querySelector("input");
    const individualCheckboxes = [];

    allCheckbox.checked = true;

    for (let i = 0; i < rawTypes.length; i++) {
      const item = document.createElement("div");
      item.classList.add("filter-option");

      const id = `vuln-${rawTypes[i].replace(/\s+/g, "-")}`;
      item.innerHTML = `
        <input type="checkbox" id="${id}" data-type="${rawTypes[i]}" />
        <label for="${id}">${displayNames[i]}</label>
      `;
      submenu.appendChild(item);

      const cb = item.querySelector("input");
      cb.checked = true;
      individualCheckboxes.push(cb);
    }

    allCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      individualCheckboxes.forEach((cb) => {
        cb.checked = isChecked;
      });
    });

    individualCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        if (!cb.checked) {
          allCheckbox.checked = false;
        } else {
          const allChecked = individualCheckboxes.every((cb) => cb.checked);
          allCheckbox.checked = allChecked;
        }
      });
    });
  }

  function extractFilterValues(results) {
    if (!results || !Array.isArray(results.results)) {
      return { rawTypes: [], displayNames: [] };
    }

    const rawTypesSet = new Set();

    results.results.forEach((result) => {
      if (result.type) {
        rawTypesSet.add(result.type);
      }
    });

    const rawTypes = Array.from(rawTypesSet);

    const displayNames = rawTypes.map((type) => {
      if (type.includes(" ")) {
        return type
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }

      return type
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    });

    return { rawTypes, displayNames };
  }

  function renderApplications(results) {
    const container = document.getElementById("applicationsContainer");
    if (!container) {
      return;
    }

    window.requestAnimationFrame(() => {
      container.innerHTML = "";

      const fragment = document.createDocumentFragment();

      const sortedApplications = sortApplications(
        results.applicationNameIDMap,
        currentSortMethod
      );

      sortedApplications.forEach((app, index) => {
        const appID = "collapse" + index;
        const isFirst = index === 0 ? "show" : "";

        const matchingResults = createMatchingResults(results, app);

        const appElement = createAppElement(
          app,
          index,
          appID,
          isFirst,
          matchingResults.length
        );
        const resultsContainer = appElement.querySelector(".results");
        resultsContainer.innerHTML = "";

        matchingResults.forEach((element) =>
          resultsContainer.appendChild(element)
        );

        if (index === results.applicationNameIDMap.length - 1) {
          resultsContainer.style.maxHeight = "unset";
        }

        fragment.appendChild(appElement);
      });
      container.appendChild(fragment);
      enableBootstrapTooltips();
    });
  }

  function createAppElement(app, index, appID, isFirst, matchingResultsLenght) {
    const appElement = document.createElement("div");

    appElement.innerHTML = `
            <div>
                <button class="collapsed custom-header" type="button" data-bs-toggle="collapse" data-bs-target="#${appID}">
                    <span class="index">${index + 1}</span>
                    <span class="app-name ellipsis">${
                      app.applicationName
                    }</span>
                    <span class="results-count" data-bs-toggle="tooltip" data-bs-placement="top" title="Number of risks">${matchingResultsLenght}</span>
                    <span class="risk-score ${getRiskName(app.score)}-risk">
                        <span>${
                          icons[getRiskName(app.score)]
                        }</span> <span>${formatScore(app.score)}</span>
                    </span>
                </button>
            </div>
            <div id="${appID}" class="accordion-collapse collapse ${isFirst}" data-bs-parent="#applicationsContainer">
                <div class="accordion-body results"></div>
            </div>
        `;
    return appElement;
  }

  function createMatchingResults(results, app) {
    return results.results.map((result) => {
      const matchedScore = getMatchedScore(result, app.applicationID);

      const isNA =
        result.engine.toLowerCase() === "sca" ||
        result.engine.toLowerCase() === "kics";
      const tooltip = isNA
        ? 'title="Coming soon..." data-bs-toggle="tooltip" data-bs-placement="top"'
        : "";

      const resultElement = createResultElement(
        result,
        matchedScore,
        isNA,
        tooltip
      );

      if (!isNA) {
        resultElement.addEventListener("click", () => {
          vscode.postMessage({
            command: "openVulnerabilityDetails",
            result: result,
          });
        });
      }

      return resultElement;
    });
  }

  function getMatchedScore(result, applicationID) {
    const matchedScore = result.applicationsScores.find(
      (s) => s.applicationID === applicationID
    )?.score;
    return matchedScore || result.riskScore;
  }

  function createResultElement(result, score, isSCA, tooltip) {
    const resultElement = document.createElement("div");
    resultElement.className = `result${isSCA ? " disabled-result" : ""}`;

    score = formatScore(score);

    resultElement.innerHTML = `
            <span class="risk-score ${result.severity}-risk">
                <span>${icons[result.severity]}</span> 
                <span>${score}</span> 
            </span>
            <span class="ellipsis" ${isSCA ? tooltip : ""}> ${
      result.name
    }</span>
        `;
    return resultElement;
  }

  function formatScore(score) {
    return Number.isInteger(score) ? score + ".0" : score;
  }

  function enableBootstrapTooltips() {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  function setupFilterMenu() {
    const filterButton = document.getElementById("filterButton");
    const filterMenu = document.getElementById("filterMenu");
    const filterBadge = document.getElementById("filterBadge");
    const sortMenu = document.getElementById("sortMenu");
    const sortButton = document.getElementById("sortButton");

    if (!filterButton || !filterMenu) {
      return;
    }

    filterButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = filterMenu.classList.toggle("show");

      filterButton.classList.toggle("filter-open", isOpen);
      if (filterBadge) {
        filterBadge.classList.toggle("hidden", isOpen);
      }

      sortMenu.classList.remove("show");
      sortButton.classList.remove("active");
    });

    document.addEventListener("click", (e) => {
      if (!filterMenu.contains(e.target) && !filterButton.contains(e.target)) {
        filterMenu.classList.remove("show");
        filterButton.classList.remove("filter-open");
        if (filterBadge) {
          filterBadge.classList.remove("hidden");
        }
      }
    });

    document.getElementById("cancelFilter").addEventListener("click", () => {
      filterMenu.classList.remove("show");
      filterButton.classList.remove("filter-open");
      if (filterBadge) {
        filterBadge.classList.remove("hidden");
      }
    });

    document.querySelectorAll(".filter-category").forEach((category) => {
      category.addEventListener("click", () => {
        const key = category.dataset.toggle;
        const submenu = document.getElementById(`submenu-${key}`);
        submenu.classList.toggle("hidden");
        const label = category.textContent.trim().replace(/^[›⌄]/, "").trim();
        category.textContent = submenu.classList.contains("hidden")
          ? `› ${label}`
          : `⌄ ${label}`;
      });
    });
  }

  function extractTraits(results) {
    const traitsSet = new Set();

    results.results.forEach((r) => {
      if (r.traits && typeof r.traits === "object") {
        Object.values(r.traits).forEach((t) => traitsSet.add(t));
      }
    });

    return Array.from(traitsSet);
  }

  function renderTraitFilters(traits) {
    const submenu = document.getElementById("submenu-traits");
    if (!submenu) {
      return;
    }

    submenu.innerHTML = "";

    const allItem = document.createElement("div");
    allItem.classList.add("filter-option");
    allItem.innerHTML = `
      <input type="checkbox" id="trait-all" />
      <label for="trait-all">All Traits</label>
    `;
    submenu.appendChild(allItem);

    const allCheckbox = allItem.querySelector("input");
    const individualCheckboxes = [];

    allCheckbox.checked = false;

    traits.forEach((trait) => {
      const div = document.createElement("div");
      div.className = "filter-option";

      const id = `trait-${trait.replace(/\s+/g, "-")}`;
      div.innerHTML = `
        <input type="checkbox" id="${id}" data-value="${trait}" />
        <label for="${id}">${trait}</label>
      `;
      submenu.appendChild(div);

      const cb = div.querySelector("input");
      cb.checked = false;
      individualCheckboxes.push(cb);
    });

    allCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      individualCheckboxes.forEach((cb) => {
        cb.checked = isChecked;
      });
    });

    individualCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        if (!cb.checked) {
          allCheckbox.checked = false;
        } else {
          const allChecked = individualCheckboxes.every((cb) => cb.checked);
          allCheckbox.checked = allChecked;
        }
      });
    });
  }

  function applyFilterSelections(results) {
    const selectedTypes = Array.from(
      document.querySelectorAll(
        "#submenu-vuln-type input[type='checkbox']:checked"
      )
    )
      .filter((cb) => cb.id !== "vuln-all")
      .map((cb) => cb.dataset.type);

    const selectedTraits = Array.from(
      document.querySelectorAll(
        "#submenu-traits input[type='checkbox']:checked"
      )
    )
      .filter((cb) => cb.id !== "trait-all")
      .map((cb) => cb.dataset.value);

    const totalSelected = selectedTypes.length + selectedTraits.length;
    const filterButton = document.getElementById("filterButton");
    let badge = filterButton.querySelector(".filter-badge");

    if (totalSelected > 0) {
      filterButton.classList.add("has-selection");

      if (!badge) {
        badge = document.createElement("span");
        badge.className = "filter-badge";
        filterButton.appendChild(badge);
      }

      badge.textContent = totalSelected;
    } else {
      filterButton.classList.remove("has-selection");
      if (badge) {
        badge.remove();
      }
    }

    if (selectedTypes.length === 0 && selectedTraits.length === 0) {
      renderApplications({ ...results, results: [] });
      return;
    }

    const filteredResults = {
      ...results,
      results: results.results.filter((r) => {
        const typeMatch = selectedTypes.includes(r.type);

        const traitValues = r.traits ? Object.values(r.traits) : [];
        const traitMatch = traitValues.some((val) =>
          selectedTraits.includes(val)
        );

        const hasTypeFilter = selectedTypes.length > 0;
        const hasTraitFilter = selectedTraits.length > 0;

        return (hasTypeFilter && typeMatch) || (hasTraitFilter && traitMatch);
      }),
    };

    renderApplications(filteredResults);
  }

  document.getElementById("applyFilter").addEventListener("click", () => {
    const state = vscode.getState();
    if (state?.results) {
      applyFilterSelections(state.results);
      document.getElementById("filterMenu").classList.remove("show");
      document.getElementById("filterButton").classList.remove("filter-open");
      updateFilterBadge();
    }
  });

  function updateFilterBadge() {
    const selectedTypes = document.querySelectorAll(
      "#submenu-vuln-type input[type='checkbox']:checked"
    );
    const selectedTraits = document.querySelectorAll(
      "#submenu-traits input[type='checkbox']:checked"
    );

    const count =
      [...selectedTypes].filter((cb) => cb.id !== "vuln-all").length +
      [...selectedTraits].filter((cb) => cb.id !== "trait-all").length;

    const badge = document.getElementById("filterBadge");
    const isFilterOpen = document
      .getElementById("filterMenu")
      .classList.contains("show");

    if (badge) {
      badge.innerHTML = `<div>${count}</div>`;
      badge.classList.toggle("hidden", isFilterOpen);
    }

    const filterButton = document.getElementById("filterButton");
    if (filterButton) {
      if (count > 0) {
        filterButton.classList.add("has-selection");
      } else {
        filterButton.classList.remove("has-selection");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    enableBootstrapTooltips();
  });
})();
