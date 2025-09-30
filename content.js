// Gate Exchange Symbol Switcher Content Script
// 监听macOS的Command + 下箭头组合键

(function () {
  "use strict";

  // 全局变量
  let contractsData = [];
  let otherMarketData = []; // 存储另一个市场的数据用于对比
  let currentSortField = "change_percentage_24h";
  let currentSortOrder = "desc"; // 'asc' 或 'desc'
  let isDrawerOpen = false;
  let dataLoaded = false; // 数据是否已加载
  let isLoading = false; // 是否正在加载数据
  let currentSymbol = null; // 当前选中的币种
  let favoriteSymbols = { futures: [], spot: [] }; // 自选币种
  let showOnlyFavorites = { futures: false, spot: false }; // 是否只显示自选币种
  let searchKeyword = ""; // 搜索关键词

  // localStorage键名常量
  const STORAGE_KEYS = {
    FUTURES_DATA: "gate_futures_data",
    SPOT_DATA: "gate_spot_data",
    CURRENT_SYMBOL: "gate_current_symbol",
    SORT_FIELD: "gate_sort_field",
    SORT_ORDER: "gate_sort_order",
    FUTURES_TIMESTAMP: "gate_futures_timestamp",
    SPOT_TIMESTAMP: "gate_spot_timestamp",
    FAVORITES_FUTURES: "gate_favorites_futures",
    FAVORITES_SPOT: "gate_favorites_spot",
    SHOW_FAVORITES_FUTURES: "gate_show_favorites_futures",
    SHOW_FAVORITES_SPOT: "gate_show_favorites_spot",
    SEARCH_KEYWORD: "gate_search_keyword",
  };

  // 缓存过期时间（30分钟）
  const CACHE_EXPIRE_TIME = 30 * 60 * 1000;

  // 检测当前页面类型
  function getPageType() {
    const url = window.location.href;
    if (url.includes("/futures/USDT/")) {
      return "futures";
    } else if (url.includes("/trade/")) {
      return "spot";
    }
    return null;
  }

  // 从当前URL获取当前币种
  function getCurrentSymbol() {
    const url = window.location.href;
    const pageType = getPageType();

    if (pageType === "futures") {
      const match = url.match(/\/futures\/USDT\/([^_]+)_USDT/);
      return match ? match[1] : null;
    } else if (pageType === "spot") {
      const match = url.match(/\/trade\/([^_]+)_USDT/);
      return match ? match[1] : null;
    }

    return null;
  }

  // localStorage相关函数
  function saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  function loadFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      return null;
    }
  }

  function isCacheValid(pageType = null) {
    if (!pageType) pageType = getPageType();

    const timestampKey =
      pageType === "futures"
        ? STORAGE_KEYS.FUTURES_TIMESTAMP
        : STORAGE_KEYS.SPOT_TIMESTAMP;
    const timestamp = loadFromLocalStorage(timestampKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_EXPIRE_TIME;
  }

  function loadCachedData(pageType = null) {
    if (!pageType) pageType = getPageType();
    if (!isCacheValid(pageType)) return false;

    const dataKey =
      pageType === "futures"
        ? STORAGE_KEYS.FUTURES_DATA
        : STORAGE_KEYS.SPOT_DATA;
    const cachedData = loadFromLocalStorage(dataKey);
    const cachedSymbol = loadFromLocalStorage(STORAGE_KEYS.CURRENT_SYMBOL);
    const cachedSortField = loadFromLocalStorage(STORAGE_KEYS.SORT_FIELD);
    const cachedSortOrder = loadFromLocalStorage(STORAGE_KEYS.SORT_ORDER);
    const cachedSearchKeyword = loadFromLocalStorage(STORAGE_KEYS.SEARCH_KEYWORD);

    if (cachedData) {
      contractsData = cachedData;
      // 加载自选数据
      loadFavoriteSymbols();
      // 优先使用URL中的币种，如果URL中没有币种才使用缓存的币种
      const urlSymbol = getCurrentSymbol();
      currentSymbol = urlSymbol || cachedSymbol;
      currentSortField = cachedSortField || "change_percentage_24h";
      currentSortOrder = cachedSortOrder || "desc";
      searchKeyword = cachedSearchKeyword || "";
      dataLoaded = true;

      // 加载另一个市场的数据用于对比
      loadOtherMarketData();

      return true;
    }
    return false;
  }

  function saveCachedData(pageType = null) {
    if (!pageType) pageType = getPageType();

    const dataKey =
      pageType === "futures"
        ? STORAGE_KEYS.FUTURES_DATA
        : STORAGE_KEYS.SPOT_DATA;
    const timestampKey =
      pageType === "futures"
        ? STORAGE_KEYS.FUTURES_TIMESTAMP
        : STORAGE_KEYS.SPOT_TIMESTAMP;

    saveToLocalStorage(dataKey, contractsData);
    saveToLocalStorage(STORAGE_KEYS.CURRENT_SYMBOL, currentSymbol);
    saveToLocalStorage(STORAGE_KEYS.SORT_FIELD, currentSortField);
    saveToLocalStorage(STORAGE_KEYS.SORT_ORDER, currentSortOrder);
    saveToLocalStorage(STORAGE_KEYS.SEARCH_KEYWORD, searchKeyword);
    saveToLocalStorage(timestampKey, Date.now());
  }

  // 加载另一个市场的数据用于对比
  function loadOtherMarketData() {
    const currentPageType = getPageType();
    const otherPageType = currentPageType === "futures" ? "spot" : "futures";

    console.log(
      `loadOtherMarketData: current=${currentPageType}, other=${otherPageType}`
    );

    // 检查另一个市场的缓存是否有效
    if (!isCacheValid(otherPageType)) {
      otherMarketData = [];
      console.log(`loadOtherMarketData: ${otherPageType} cache is invalid`);
      return false;
    }

    const dataKey =
      otherPageType === "futures"
        ? STORAGE_KEYS.FUTURES_DATA
        : STORAGE_KEYS.SPOT_DATA;
    const cachedData = loadFromLocalStorage(dataKey);

    if (cachedData) {
      otherMarketData = cachedData;
      console.log(
        `从缓存加载了 ${otherMarketData.length} 个${
          otherPageType === "futures" ? "合约" : "现货"
        }数据用于对比`
      );
      // 输出前几个币种用于调试
      if (otherMarketData.length > 0) {
        console.log(
          `otherMarketData前5个币种: ${otherMarketData
            .slice(0, 5)
            .map((item) => item.symbol)
            .join(", ")}`
        );
      }
      return true;
    }

    otherMarketData = [];
    console.log(`loadOtherMarketData: no cached data for ${otherPageType}`);
    return false;
  }

  // 检查币种是否在两个市场都存在
  function hasMultipleMarkets(symbol) {
    if (!otherMarketData || otherMarketData.length === 0) {
      console.log(`hasMultipleMarkets(${symbol}): no otherMarketData`);
      return false;
    }
    const found = otherMarketData.some((item) => item.symbol === symbol);
    console.log(
      `hasMultipleMarkets(${symbol}): ${
        found ? "found" : "not found"
      } in otherMarketData (${otherMarketData.length} items)`
    );
    return found;
  }

  // 自选币种相关函数
  function loadFavoriteSymbols() {
    const futuresFavorites =
      loadFromLocalStorage(STORAGE_KEYS.FAVORITES_FUTURES) || [];
    const spotFavorites =
      loadFromLocalStorage(STORAGE_KEYS.FAVORITES_SPOT) || [];
    const showFuturesFavorites =
      loadFromLocalStorage(STORAGE_KEYS.SHOW_FAVORITES_FUTURES) || false;
    const showSpotFavorites =
      loadFromLocalStorage(STORAGE_KEYS.SHOW_FAVORITES_SPOT) || false;

    favoriteSymbols.futures = futuresFavorites;
    favoriteSymbols.spot = spotFavorites;
    showOnlyFavorites.futures = showFuturesFavorites;
    showOnlyFavorites.spot = showSpotFavorites;
  }

  function saveFavoriteSymbols() {
    saveToLocalStorage(STORAGE_KEYS.FAVORITES_FUTURES, favoriteSymbols.futures);
    saveToLocalStorage(STORAGE_KEYS.FAVORITES_SPOT, favoriteSymbols.spot);
    saveToLocalStorage(
      STORAGE_KEYS.SHOW_FAVORITES_FUTURES,
      showOnlyFavorites.futures
    );
    saveToLocalStorage(
      STORAGE_KEYS.SHOW_FAVORITES_SPOT,
      showOnlyFavorites.spot
    );
  }

  function isFavorite(symbol, pageType = null) {
    if (!pageType) pageType = getPageType();
    return favoriteSymbols[pageType].includes(symbol);
  }

  function toggleFavorite(symbol, pageType = null) {
    if (!pageType) pageType = getPageType();
    const favorites = favoriteSymbols[pageType];
    const index = favorites.indexOf(symbol);

    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(symbol);
    }

    saveFavoriteSymbols();
    updateContractsList();
    updateDrawerTitle();
  }

  function toggleShowOnlyFavorites(pageType = null) {
    if (!pageType) pageType = getPageType();
    showOnlyFavorites[pageType] = !showOnlyFavorites[pageType];
    saveFavoriteSymbols();
    updateContractsList();
    updateDrawerTitle();
  }

  function getFilteredContractsData() {
    const pageType = getPageType();
    let filteredData = contractsData;

    // 首先按自选过滤
    if (showOnlyFavorites[pageType]) {
      filteredData = filteredData.filter((contract) =>
        isFavorite(contract.symbol, pageType)
      );
    }

    // 然后按搜索关键词过滤
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      filteredData = filteredData.filter((contract) =>
        contract.symbol.toLowerCase().includes(keyword)
      );
    }

    return filteredData;
  }

  // 切换到指定币种
  function switchToSymbol(symbol) {
    // 更新当前币种状态
    currentSymbol = symbol;
    saveCachedData();

    const pageType = getPageType();
    let newUrl;

    if (pageType === "futures") {
      const baseUrl = "https://www.gate.com/zh/futures/USDT/";
      newUrl = `${baseUrl}${symbol}_USDT`;
    } else if (pageType === "spot") {
      const baseUrl = "https://www.gate.com/zh/trade/";
      newUrl = `${baseUrl}${symbol}_USDT`;
    }

    // 使用 window.location.href 来导航到新URL
    if (newUrl) {
      window.location.href = newUrl;
    }
  }

  // 获取当前币种在列表中的索引（基于过滤后的数据）
  function getCurrentSymbolIndex() {
    if (!currentSymbol) return -1;
    const filteredData = getFilteredContractsData();
    if (filteredData.length === 0) return -1;
    return filteredData.findIndex(
      (contract) => contract.symbol === currentSymbol
    );
  }

  // 获取上一个币种（循环导航）
  function getPreviousSymbol() {
    const filteredData = getFilteredContractsData();
    if (filteredData.length === 0) return null;

    const currentIndex = getCurrentSymbolIndex();
    if (currentIndex < 0) return filteredData[0].symbol;

    // 循环导航：如果是第一个，跳到最后一个
    const prevIndex =
      currentIndex === 0 ? filteredData.length - 1 : currentIndex - 1;
    return filteredData[prevIndex].symbol;
  }

  // 获取下一个币种（循环导航）
  function getNextSymbol() {
    const filteredData = getFilteredContractsData();
    if (filteredData.length === 0) return null;

    const currentIndex = getCurrentSymbolIndex();
    if (currentIndex < 0) return filteredData[0].symbol;

    // 循环导航：如果是最后一个，跳到第一个
    const nextIndex =
      currentIndex === filteredData.length - 1 ? 0 : currentIndex + 1;
    return filteredData[nextIndex].symbol;
  }

  // 键盘事件处理器
  function handleKeyDown(event) {
    // ESC键切换抽屉显示/隐藏
    if (event.code === "Escape") {
      event.preventDefault();
      toggleDrawer();
      console.log(`Drawer ${isDrawerOpen ? "opened" : "closed"} by ESC key`);
      return;
    }

    // 检查是否是macOS的Command + 箭头键组合
    if (
      event.metaKey &&
      (event.code === "ArrowDown" || event.code === "ArrowUp")
    ) {
      event.preventDefault(); // 阻止默认行为

      // 如果没有数据，尝试从缓存加载
      if (!dataLoaded) {
        loadCachedData();
      }

      // 确保有数据和当前币种
      if (contractsData.length === 0) {
        console.log("No contracts data available for navigation");
        return;
      }

      // 如果没有当前币种，使用URL中的币种
      if (!currentSymbol) {
        currentSymbol = getCurrentSymbol();
        if (currentSymbol) {
          saveCachedData();
        }
      }

      let targetSymbol = null;
      if (event.code === "ArrowDown") {
        targetSymbol = getNextSymbol();
        console.log(`Navigating to next symbol: ${targetSymbol}`);
      } else if (event.code === "ArrowUp") {
        targetSymbol = getPreviousSymbol();
        console.log(`Navigating to previous symbol: ${targetSymbol}`);
      }

      if (targetSymbol) {
        switchToSymbol(targetSymbol);
      } else {
        console.log(
          "No symbols available for navigation (filtered list may be empty)"
        );
        showTooltip("没有可导航的币种");
      }
    }
  }

  // 获取数据（根据页面类型）
  async function fetchData() {
    const pageType = getPageType();
    if (pageType === "futures") {
      return await fetchContractsData();
    } else if (pageType === "spot") {
      return await fetchSpotData();
    }
  }

  // 获取Gate合约数据
  async function fetchContractsData() {
    // 防止重复加载
    if (isLoading) {
      return;
    }

    // 尝试从localStorage加载缓存数据
    if (!dataLoaded && loadCachedData("futures")) {
      console.log(`从缓存加载了 ${contractsData.length} 个合约数据`);
      sortContractsData(currentSortField, currentSortOrder);
      updateContractsList();
      updateDrawerTitle();
      return;
    }

    isLoading = true;

    // 显示加载状态
    const container = document.getElementById("contracts-list-container");
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <div>正在加载数据...</div>
        </div>
      `;
    }

    try {
      // 通过background script获取数据以避免CORS问题
      const response = await chrome.runtime.sendMessage({
        action: "fetchContracts",
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch data");
      }

      // 使用从background script返回的处理后数据
      contractsData = response.data;
      dataLoaded = true; // 标记数据已加载

      // 优先使用URL中的币种，确保当前页面的币种为准
      const urlSymbol = getCurrentSymbol();
      if (urlSymbol) {
        currentSymbol = urlSymbol;
      }

      // 保存到localStorage
      saveCachedData("futures");

      // 加载另一个市场的数据用于对比
      loadOtherMarketData();

      // 应用当前排序设置（如果是首次加载，则使用默认排序）
      sortContractsData(currentSortField, currentSortOrder);
      updateContractsList();
      updateDrawerTitle(); // 更新标题显示币种数量

      console.log(`已缓存 ${contractsData.length} 个合约数据`);
    } catch (error) {
      console.error("Failed to fetch contracts data:", error);

      // 显示错误提示给用户
      if (container) {
        container.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #dc3545;">
            <div>数据加载失败</div>
            <div style="font-size: 12px; margin-top: 5px;">${error.message}</div>
            <button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">重新加载页面</button>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  // 获取Gate现货数据
  async function fetchSpotData() {
    // 防止重复加载
    if (isLoading) {
      return;
    }

    // 尝试从localStorage加载缓存数据
    if (!dataLoaded && loadCachedData("spot")) {
      console.log(`从缓存加载了 ${contractsData.length} 个现货数据`);
      sortContractsData(currentSortField, currentSortOrder);
      updateContractsList();
      updateDrawerTitle();
      return;
    }

    isLoading = true;

    // 显示加载状态
    const container = document.getElementById("contracts-list-container");
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <div>正在加载数据...</div>
        </div>
      `;
    }

    try {
      // 通过background script获取数据以避免CORS问题
      const response = await chrome.runtime.sendMessage({
        action: "fetchSpotTickers",
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch data");
      }

      // 使用从background script返回的处理后数据
      contractsData = response.data;
      dataLoaded = true;

      // 优先使用URL中的币种，确保当前页面的币种为准
      const urlSymbol = getCurrentSymbol();
      if (urlSymbol) {
        currentSymbol = urlSymbol;
      }

      // 缓存数据到localStorage
      saveCachedData("spot");

      // 加载另一个市场的数据用于对比
      loadOtherMarketData();

      console.log(`成功获取了 ${contractsData.length} 个现货数据`);

      // 排序并更新显示
      sortContractsData(currentSortField, currentSortOrder);
      updateContractsList();
      updateDrawerTitle();
    } catch (error) {
      console.error("Failed to fetch spot data:", error);

      // 显示错误提示给用户
      if (container) {
        container.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #dc3545;">
            <div>数据加载失败</div>
            <div style="font-size: 12px; margin-top: 5px;">${error.message}</div>
            <button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">重新加载页面</button>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  // 排序合约数据
  function sortContractsData(field, order) {
    currentSortField = field;
    currentSortOrder = order;

    // 保存排序状态到localStorage
    if (dataLoaded) {
      saveCachedData();
    }

    contractsData.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (order === "asc") {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }

  // 创建左侧抽屉
  function createDrawer() {
    if (document.getElementById("gate-contracts-drawer")) {
      return;
    }

    const drawer = document.createElement("div");
    drawer.id = "gate-contracts-drawer";
    drawer.tabIndex = -1; // 允许通过 JavaScript 设置焦点，但不参与 tab 导航
    drawer.style.cssText = `
      position: fixed;
      top: 40px;
      left: -450px;
      bottom: 0px;
      width: 450px;
      background: #fff;
      box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      transition: left 0.3s ease;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      outline: none;
    `;

    // 创建头部
    const header = document.createElement("div");
    header.style.cssText = `
      padding: 8px 0 8px 0;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      flex-shrink: 0;
    `;

    const title = document.createElement("h3");
    title.id = "contracts-drawer-title";
    title.style.cssText = `
      margin: 0 0 10px 0;
      padding: 0 15px;
      font-size: 16px;
      font-weight: 600;
      color: #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // 创建按钮容器
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    // 创建刷新按钮
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "刷新";
    refreshBtn.style.cssText = `
      background: #007bff !important;
      color: #ffffff !important;
      border: none !important;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    `;

    // 额外确保文字颜色
    refreshBtn.style.setProperty("color", "#ffffff", "important");

    refreshBtn.addEventListener("mouseenter", () => {
      refreshBtn.style.backgroundColor = "#0056b3";
      refreshBtn.style.setProperty("color", "#ffffff", "important");
    });

    refreshBtn.addEventListener("mouseleave", () => {
      refreshBtn.style.backgroundColor = "#007bff";
      refreshBtn.style.setProperty("color", "#ffffff", "important");
    });

    refreshBtn.addEventListener("click", () => {
      refreshContractsData();
    });

    // 创建顶部按钮
    const topBtn = document.createElement("button");
    topBtn.textContent = "顶部";
    topBtn.style.cssText = `
      background: #28a745 !important;
      color: #ffffff !important;
      border: none !important;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    `;

    // 额外确保文字颜色
    topBtn.style.setProperty("color", "#ffffff", "important");

    topBtn.addEventListener("mouseenter", () => {
      topBtn.style.backgroundColor = "#1e7e34";
      topBtn.style.setProperty("color", "#ffffff", "important");
    });

    topBtn.addEventListener("mouseleave", () => {
      topBtn.style.backgroundColor = "#28a745";
      topBtn.style.setProperty("color", "#ffffff", "important");
    });

    topBtn.addEventListener("click", () => {
      scrollToTop();
    });

    // 将按钮添加到容器
    buttonContainer.appendChild(refreshBtn);
    buttonContainer.appendChild(topBtn);

    // 创建标题区域
    const pageType = getPageType();

    // 标题左侧部分
    const titleLeft = document.createElement("div");
    titleLeft.style.cssText = `
      display: flex;
      align-items: center;
      flex: 1;
    `;

    // 标题文本
    const titleText = document.createElement("span");
    titleText.textContent = pageType === "spot" ? "现货币种" : "合约币种";
    titleText.style.cssText = `
      margin-right: 10px;
      font-size: 16px;
      font-weight: 600;
    `;

    // 切换按钮组
    const toggleContainer = document.createElement("div");
    toggleContainer.style.cssText = `
      display: flex;
      align-items: center;
      background: #f0f0f0;
      border-radius: 15px;
      padding: 2px;
    `;

    // 全部按钮
    const allBtn = document.createElement("button");
    allBtn.id = "show-all-btn";
    allBtn.textContent = "全部";
    allBtn.style.cssText = `
      background: ${!showOnlyFavorites[pageType] ? "#2196f3" : "transparent"};
      color: ${!showOnlyFavorites[pageType] ? "white" : "#666"};
      border: none;
      border-radius: 12px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
      margin-right: 2px;
      transition: all 0.2s ease;
    `;

    // 自选按钮
    const favBtn = document.createElement("button");
    favBtn.id = "show-favorites-btn";
    favBtn.textContent = "自选";
    favBtn.style.cssText = `
      background: ${showOnlyFavorites[pageType] ? "#2196f3" : "transparent"};
      color: ${showOnlyFavorites[pageType] ? "white" : "#666"};
      border: none;
      border-radius: 12px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // 添加点击事件
    allBtn.addEventListener("click", () => {
      if (showOnlyFavorites[pageType]) {
        toggleShowOnlyFavorites(pageType);
      }
    });

    favBtn.addEventListener("click", () => {
      if (!showOnlyFavorites[pageType]) {
        toggleShowOnlyFavorites(pageType);
      }
    });

    toggleContainer.appendChild(allBtn);
    toggleContainer.appendChild(favBtn);

    titleLeft.appendChild(titleText);
    titleLeft.appendChild(toggleContainer);

    title.appendChild(titleLeft);
    title.appendChild(buttonContainer);

    // 创建列表头部（排序按钮）
    const listHeader = document.createElement("div");
    const isSpot = pageType === "spot";

    listHeader.style.cssText = `
      display: grid;
      grid-template-columns: ${
        isSpot ? "40px 1fr 80px 80px" : "40px 1fr 80px 80px 80px"
      };
      padding: 0 15px 0 0;
      font-size: 12px;
      font-weight: 600;
      color: #666;
    `;

    // 自选列头
    const favoriteHeader = document.createElement("div");
    favoriteHeader.textContent = "自选";
    favoriteHeader.style.cssText = `
      text-align: center;
      cursor: default;
    `;

    const symbolHeader = document.createElement("div");
    symbolHeader.textContent = "币种";
    symbolHeader.style.cursor = "default";

    const changeHeader = createSortButton("涨跌幅", "change_percentage_24h");
    const volumeHeader = createSortButton("交易额", "volume_24h");

    listHeader.appendChild(favoriteHeader);
    listHeader.appendChild(symbolHeader);
    listHeader.appendChild(changeHeader);
    listHeader.appendChild(volumeHeader);

    // 只有合约页面才显示资金费率
    if (!isSpot) {
      const fundingHeader = createSortButton("资金费率", "funding_rate");
      listHeader.appendChild(fundingHeader);
    }

    header.appendChild(title);
    header.appendChild(listHeader);

    // 创建搜索框容器
    const searchContainer = document.createElement("div");
    searchContainer.style.cssText = `
      padding: 8px 15px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    `;

    // 创建搜索输入框
    const searchInput = document.createElement("input");
    searchInput.id = "search-input";
    searchInput.type = "text";
    searchInput.placeholder = "搜索币种符号...";
    searchInput.value = searchKeyword;
    searchInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    `;

    // 搜索框焦点效果
    searchInput.addEventListener("focus", () => {
      searchInput.style.borderColor = "#007bff";
    });

    searchInput.addEventListener("blur", () => {
      searchInput.style.borderColor = "#ddd";
    });

    // 搜索功能
    searchInput.addEventListener("input", (e) => {
      searchKeyword = e.target.value;
      saveCachedData(); // 保存搜索关键词
      updateContractsList();
      updateDrawerTitle();
    });

    // 清除搜索的快捷键 (ESC)
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // 阻止事件冒泡，避免关闭抽屉
        searchInput.value = "";
        searchKeyword = "";
        saveCachedData();
        updateContractsList();
        updateDrawerTitle();
        searchInput.blur(); // 移除焦点
      }
    });

    searchContainer.appendChild(searchInput);

    // 创建列表容器
    const listContainer = document.createElement("div");
    listContainer.id = "contracts-list-container";
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 0;
      line-height: 32px;
    `;

    drawer.appendChild(header);
    drawer.appendChild(searchContainer);
    drawer.appendChild(listContainer);
    document.body.appendChild(drawer);

    return drawer;
  }

  // 创建排序按钮
  function createSortButton(text, field) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "sort-button"; // 添加特定class
    button.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #666;
      padding: 0;
      text-align: right;
      position: relative;
      width: 100%;
    `;

    button.addEventListener("click", () => {
      const newOrder =
        currentSortField === field && currentSortOrder === "desc"
          ? "asc"
          : "desc";
      sortContractsData(field, newOrder);
      updateContractsList();
      updateSortButtons();
    });

    return button;
  }

  // 更新排序按钮样式
  function updateSortButtons() {
    const headers = document.querySelectorAll(
      "#gate-contracts-drawer button.sort-button"
    );
    headers.forEach((button) => {
      button.style.color = "#666";
      // 移除箭头
      button.textContent = button.textContent.replace("▲", "").replace("▼", "");
    });

    // 高亮当前排序字段
    const fieldMap = {
      change_percentage_24h: "涨跌幅",
      volume_24h: "交易额",
      funding_rate: "资金费率",
    };

    const currentFieldText = fieldMap[currentSortField];
    headers.forEach((button) => {
      if (button.textContent.includes(currentFieldText)) {
        button.style.color = "#007bff";
        button.textContent =
          currentFieldText + (currentSortOrder === "desc" ? "▼" : "▲");
      }
    });
  }

  // 更新合约列表
  function updateContractsList() {
    const container = document.getElementById("contracts-list-container");
    if (!container) return;

    container.innerHTML = "";
    const pageType = getPageType();
    const isSpot = pageType === "spot";
    const filteredData = getFilteredContractsData();

    filteredData.forEach((contract) => {
      const item = document.createElement("div");
      const isCurrentSymbol = contract.symbol === currentSymbol;

      item.style.cssText = `
        display: grid;
        grid-template-columns: ${
          isSpot ? "40px 1fr 80px 80px" : "40px 1fr 80px 80px 80px"
        };
        padding: 0 15px 0 0;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s ease;
        align-items: center;
        ${
          isCurrentSymbol
            ? "background-color: #dff0ff; border-left: 3px solid #2196f3;"
            : ""
        }
      `;

      item.addEventListener("mouseenter", () => {
        if (!isCurrentSymbol) {
          item.style.backgroundColor = "#e8f5ff";
        }
      });

      item.addEventListener("mouseleave", () => {
        if (isCurrentSymbol) {
          item.style.backgroundColor = "#dff0ff";
        } else {
          item.style.backgroundColor = "transparent";
        }
      });

      item.addEventListener("click", () => {
        switchToSymbol(contract.symbol);
        toggleDrawer(); // 切换后关闭抽屉
      });

      // 币种名称
      const symbolEl = document.createElement("div");
      const hasMultiMarkets = hasMultipleMarkets(contract.symbol);
      symbolEl.textContent = hasMultiMarkets
        ? `${contract.symbol} 💰`
        : contract.symbol;
      symbolEl.style.cssText = `
        font-weight: 600;
        color: #333;
        font-size: 14px;
      `;

      // 涨跌幅
      const changeEl = document.createElement("div");
      const changeValue = contract.change_percentage_24h;
      changeEl.textContent = `${changeValue.toFixed(2)}%`;
      changeEl.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        text-align: right;
        color: ${changeValue >= 0 ? "#28a745" : "#dc3545"};
      `;

      // 交易额（格式化为K/M/B）
      const volumeEl = document.createElement("div");
      volumeEl.textContent = formatNumber(contract.volume_24h);
      volumeEl.style.cssText = `
        font-size: 12px;
        color: #666;
        text-align: right;
      `;

      // 自选按钮（第一列）
      const favoriteEl = document.createElement("div");
      const isFav = isFavorite(contract.symbol, pageType);
      favoriteEl.innerHTML = isFav ? "★" : "★";
      favoriteEl.style.cssText = `
        font-size: 16px;
        color: ${isFav ? "#ff9d00" : "#ccc"};
        text-align: center;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
      `;

      // 自选按钮点击事件（阻止冒泡，避免触发行点击）
      favoriteEl.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(contract.symbol, pageType);
      });

      // 自选按钮hover效果
      favoriteEl.addEventListener("mouseenter", () => {
        favoriteEl.style.transform = "scale(1.2)";
      });

      favoriteEl.addEventListener("mouseleave", () => {
        favoriteEl.style.transform = "scale(1)";
      });

      item.appendChild(favoriteEl);
      item.appendChild(symbolEl);
      item.appendChild(changeEl);
      item.appendChild(volumeEl);

      // 只有合约页面才显示资金费率
      if (!isSpot) {
        // 资金费率
        const fundingEl = document.createElement("div");
        const fundingValue = contract.funding_rate * 100;
        fundingEl.textContent = `${fundingValue.toFixed(4)}%`;
        fundingEl.style.cssText = `
          font-size: 12px;
          color: ${fundingValue >= 0 ? "#28a745" : "#dc3545"};
          text-align: right;
        `;
        item.appendChild(fundingEl);
      }

      container.appendChild(item);
    });

    updateSortButtons();
  }

  // 格式化数字（K/M/B）
  function formatNumber(num) {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + "B";
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + "M";
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + "K";
    }
    return num.toFixed(0);
  }

  // 切换抽屉显示/隐藏
  function toggleDrawer() {
    const drawer = document.getElementById("gate-contracts-drawer");
    if (!drawer) return;

    isDrawerOpen = !isDrawerOpen;
    drawer.style.left = isDrawerOpen ? "0px" : "-450px";

    if (isDrawerOpen) {
      // 抽屉打开时设置焦点
      drawer.focus();

      // 添加外部点击监听器
      setTimeout(() => {
        document.addEventListener("click", handleOutsideClick, true);
      }, 100); // 延迟添加，避免立即触发

      // 如果首次打开且数据未加载，则获取数据
      if (!dataLoaded && !isLoading) {
        fetchData();
      } else if (dataLoaded) {
        // 如果数据已缓存，重新应用当前排序并更新列表显示
        // 确保加载了另一个市场的数据用于对比
        loadOtherMarketData();

        sortContractsData(currentSortField, currentSortOrder);
        updateContractsList();
        updateDrawerTitle(); // 更新标题显示币种数量
        
        // 更新搜索框的值
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
          searchInput.value = searchKeyword;
        }
      }
    } else {
      // 抽屉关闭时移除外部点击监听器
      document.removeEventListener("click", handleOutsideClick, true);
    }
  }

  // 处理外部点击事件
  function handleOutsideClick(event) {
    const drawer = document.getElementById("gate-contracts-drawer");
    const button = document.getElementById("gate-contracts-btn");

    if (!drawer || !isDrawerOpen) return;

    // 检查点击目标是否存在
    if (!event.target) return;

    // 检查点击是否在抽屉内部
    const isInsideDrawer = drawer.contains(event.target);

    // 检查点击是否在按钮内部（如果按钮存在）
    const isInsideButton = button && button.contains(event.target);

    // 如果点击在抽屉和按钮外部，关闭抽屉
    if (!isInsideDrawer && !isInsideButton) {
      toggleDrawer();
    }
  } // 刷新数据
  function refreshContractsData() {
    // 重置状态
    dataLoaded = false;
    isLoading = false;
    contractsData = [];

    // 清除localStorage缓存，强制重新获取数据
    const pageType = getPageType();
    const timestampKey =
      pageType === "futures"
        ? STORAGE_KEYS.FUTURES_TIMESTAMP
        : STORAGE_KEYS.SPOT_TIMESTAMP;
    localStorage.removeItem(timestampKey);

    // 重新获取数据
    fetchData();
  }

  // 更新抽屉标题
  function updateDrawerTitle() {
    const pageType = getPageType();
    const allCount = contractsData.length;
    const favoriteCount = favoriteSymbols[pageType].length;
    const filteredCount = getFilteredContractsData().length;

    // 更新全部按钮
    const allBtn = document.getElementById("show-all-btn");
    const favBtn = document.getElementById("show-favorites-btn");

    if (allBtn && favBtn) {
      // 更新按钮文本 - 如果有搜索关键词，显示过滤后的数量
      const showFilteredCount = searchKeyword.trim() !== "";
      
      if (showOnlyFavorites[pageType]) {
        allBtn.textContent = `全部(${allCount})`;
        favBtn.textContent = showFilteredCount 
          ? `自选(${filteredCount}/${favoriteCount})` 
          : `自选(${favoriteCount})`;
      } else {
        allBtn.textContent = showFilteredCount 
          ? `全部(${filteredCount}/${allCount})` 
          : `全部(${allCount})`;
        favBtn.textContent = `自选(${favoriteCount})`;
      }

      // 更新按钮状态
      if (showOnlyFavorites[pageType]) {
        allBtn.style.background = "transparent";
        allBtn.style.color = "#666";
        favBtn.style.background = "#2196f3";
        favBtn.style.color = "white";
      } else {
        allBtn.style.background = "#2196f3";
        allBtn.style.color = "white";
        favBtn.style.background = "transparent";
        favBtn.style.color = "#666";
      }

      console.log(
        `Updated drawer title - All: ${allCount}, Favorites: ${favoriteCount}, Filtered: ${filteredCount}, ShowFavorites: ${showOnlyFavorites[pageType]}, SearchKeyword: "${searchKeyword}"`
      );
    } else {
      console.log("Could not update drawer title - buttons not found");
    }
  }

  // 滚动到列表顶部
  function scrollToTop() {
    const listContainer = document.getElementById("contracts-list-container");
    if (listContainer) {
      listContainer.scrollTop = 0;
    }
  }

  // 创建圆形按钮
  function createExtensionButton() {
    // 检查是否已经存在按钮，避免重复创建
    if (document.getElementById("gate-symbol-switcher-btn")) {
      return;
    }

    // 创建按钮元素
    const button = document.createElement("div");
    button.id = "gate-symbol-switcher-btn";

    // 设置按钮样式
    button.style.cssText = `
      position: fixed;
      top: 6px;
      left: 12px;
      width: 36px;
      height: 36px;
      background-image: url('${chrome.runtime.getURL("icons/icon48.png")}');
      background-size: cover;
      background-position: center;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;

    // 添加悬停效果
    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.1)";
      button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.3)";
    });

    // 点击事件：切换抽屉显示
    button.addEventListener("click", () => {
      toggleDrawer();
    });

    // 添加到页面
    document.body.appendChild(button);
  }

  // 显示提示框
  function showTooltip(message, targetElement) {
    // 移除已存在的提示框
    const existingTooltip = document.getElementById(
      "gate-symbol-switcher-tooltip"
    );
    if (existingTooltip) {
      existingTooltip.remove();
    }

    const tooltip = document.createElement("div");
    tooltip.id = "gate-symbol-switcher-tooltip";
    tooltip.textContent = message;

    tooltip.style.cssText = `
      position: fixed;
      top: 40px;
      left: 4px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10001;
      white-space: pre-line;
      max-width: 200px;
    `;

    document.body.appendChild(tooltip);

    // 3秒后自动移除提示框
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.remove();
      }
    }, 3000);
  }

  // 添加键盘事件监听器
  document.addEventListener("keydown", handleKeyDown, true);

  // 等待页面加载完成后创建按钮和抽屉
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeExtension();
    });
  } else {
    initializeExtension();
  }

  // 初始化插件
  function initializeExtension() {
    // 加载自选数据
    loadFavoriteSymbols();

    createExtensionButton();
    createDrawer();

    // 尝试从缓存加载数据
    if (loadCachedData()) {
      console.log("从缓存加载数据成功");
    } else {
      // 如果没有缓存数据，直接从URL设置当前币种
      currentSymbol = getCurrentSymbol();
    }
  }

  // 日志记录插件已加载
  console.log("Gate Exchange Symbol Switcher loaded");
  console.log("Current symbol:", getCurrentSymbol());
  console.log("Keyboard shortcuts:");
  console.log("- Command + Up/Down Arrow: Navigate between symbols");
  console.log("- ESC: Close drawer");
})();
