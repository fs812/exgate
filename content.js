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

  // localStorage键名常量
  const STORAGE_KEYS = {
    FUTURES_DATA: "gate_futures_data",
    SPOT_DATA: "gate_spot_data",
    CURRENT_SYMBOL: "gate_current_symbol",
    SORT_FIELD: "gate_sort_field",
    SORT_ORDER: "gate_sort_order",
    FUTURES_TIMESTAMP: "gate_futures_timestamp",
    SPOT_TIMESTAMP: "gate_spot_timestamp",
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

    if (cachedData) {
      contractsData = cachedData;
      // 优先使用URL中的币种，如果URL中没有币种才使用缓存的币种
      const urlSymbol = getCurrentSymbol();
      currentSymbol = urlSymbol || cachedSymbol;
      currentSortField = cachedSortField || "change_percentage_24h";
      currentSortOrder = cachedSortOrder || "desc";
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
    saveToLocalStorage(timestampKey, Date.now());
  }

  // 加载另一个市场的数据用于对比
  function loadOtherMarketData() {
    const currentPageType = getPageType();
    const otherPageType = currentPageType === "futures" ? "spot" : "futures";

    // 检查另一个市场的缓存是否有效
    if (!isCacheValid(otherPageType)) {
      otherMarketData = [];
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
      return true;
    }

    otherMarketData = [];
    return false;
  }

  // 检查币种是否在两个市场都存在
  function hasMultipleMarkets(symbol) {
    if (!otherMarketData || otherMarketData.length === 0) return false;
    return otherMarketData.some((item) => item.symbol === symbol);
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

  // 获取当前币种在列表中的索引
  function getCurrentSymbolIndex() {
    if (!currentSymbol || contractsData.length === 0) return -1;
    return contractsData.findIndex(
      (contract) => contract.symbol === currentSymbol
    );
  }

  // 获取上一个币种
  function getPreviousSymbol() {
    const currentIndex = getCurrentSymbolIndex();
    if (currentIndex <= 0) return null;
    return contractsData[currentIndex - 1].symbol;
  }

  // 获取下一个币种
  function getNextSymbol() {
    const currentIndex = getCurrentSymbolIndex();
    if (currentIndex < 0 || currentIndex >= contractsData.length - 1)
      return null;
    return contractsData[currentIndex + 1].symbol;
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
        console.log("No target symbol available for navigation");
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
      left: -420px;
      bottom: 0px;
      width: 420px;
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

    // 创建标题文本节点
    const pageType = getPageType();
    const titleText = document.createTextNode(
      pageType === "spot" ? "现货币种列表" : "合约币种列表"
    );
    title.appendChild(titleText);
    title.appendChild(buttonContainer);

    // 创建列表头部（排序按钮）
    const listHeader = document.createElement("div");
    const isSpot = pageType === "spot";

    listHeader.style.cssText = `
      display: grid;
      grid-template-columns: ${isSpot ? "1fr 80px 80px" : "1fr 80px 80px 80px"};
      gap: 10px;
      padding: 0 15px;
      font-size: 12px;
      font-weight: 600;
      color: #666;
    `;

    const symbolHeader = document.createElement("div");
    symbolHeader.textContent = "币种";
    symbolHeader.style.cursor = "default";

    const changeHeader = createSortButton("涨跌幅", "change_percentage_24h");
    const volumeHeader = createSortButton("交易额", "volume_24h");

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

    // 创建列表容器
    const listContainer = document.createElement("div");
    listContainer.id = "contracts-list-container";
    listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 0;
    `;

    drawer.appendChild(header);
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
      button.textContent = button.textContent
        .replace(" ↑", "")
        .replace(" ↓", "");
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
          currentFieldText + (currentSortOrder === "desc" ? " ↓" : " ↑");
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

    contractsData.forEach((contract) => {
      const item = document.createElement("div");
      const isCurrentSymbol = contract.symbol === currentSymbol;

      item.style.cssText = `
        display: grid;
        grid-template-columns: ${
          isSpot ? "1fr 80px 80px" : "1fr 80px 80px 80px"
        };
        gap: 10px;
        padding: 10px 15px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s ease;
        align-items: center;
        ${
          isCurrentSymbol
            ? "background-color: #d9e8f6; border-left: 3px solid #2196f3;"
            : ""
        }
      `;

      item.addEventListener("mouseenter", () => {
        if (!isCurrentSymbol) {
          item.style.backgroundColor = "#f8f9fa";
        }
      });

      item.addEventListener("mouseleave", () => {
        if (isCurrentSymbol) {
          item.style.backgroundColor = "#bbdefb";
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
    drawer.style.left = isDrawerOpen ? "0px" : "-420px";

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
    const title = document.getElementById("contracts-drawer-title");
    if (
      title &&
      title.firstChild &&
      title.firstChild.nodeType === Node.TEXT_NODE
    ) {
      const count = contractsData.length;
      const pageType = getPageType();
      const titleText =
        pageType === "spot"
          ? `现货币种列表(${count})`
          : `合约币种列表(${count})`;
      title.firstChild.textContent = titleText;
      console.log(`Updated drawer title with count: ${count}`);
    } else {
      console.log(
        "Could not update drawer title - element not found or no text node"
      );
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
