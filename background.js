// Background Script for Gate Exchange Symbol Switcher
// 处理API调用以避免CORS问题

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchContracts") {
    fetchContractsData()
      .then((data) => {
        sendResponse({ success: true, data: data });
      })
      .catch((error) => {
        console.error("Background fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回true表示异步响应
    return true;
  }

  if (request.action === "fetchSpotTickers") {
    fetchSpotTickersData()
      .then((data) => {
        sendResponse({ success: true, data: data });
      })
      .catch((error) => {
        console.error("Background fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回true表示异步响应
    return true;
  }
});

// 获取Gate合约数据
async function fetchContractsData() {
  try {
    const response = await fetch(
      "https://api.gateio.ws/api/v4/futures/usdt/tickers"
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 提取需要的字段并处理数据
    const processedData = data.map((ticker) => ({
      symbol: ticker.contract.replace("_USDT", ""), // 币种名称
      change_percentage_24h: parseFloat(ticker.change_percentage || 0), // 24小时涨跌幅
      volume_24h: parseFloat(ticker.volume_24h_quote || 0), // 24小时交易额
      funding_rate: parseFloat(ticker.funding_rate || 0), // 当前资金费率
      raw_name: ticker.contract, // 保存原始名称用于跳转
    }));

    return processedData;
  } catch (error) {
    console.error("Failed to fetch contracts data:", error);
    throw error;
  }
}

// 获取Gate现货数据
async function fetchSpotTickersData() {
  try {
    const response = await fetch("https://api.gateio.ws/api/v4/spot/tickers");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 只处理USDT交易对
    const usdtPairs = data.filter((ticker) =>
      ticker.currency_pair.endsWith("_USDT")
    );

    // 提取需要的字段并处理数据
    const processedData = usdtPairs.map((ticker) => ({
      symbol: ticker.currency_pair.replace("_USDT", ""), // 币种名称
      change_percentage_24h: parseFloat(ticker.change_percentage || 0), // 24小时涨跌幅
      volume_24h: parseFloat(ticker.quote_volume || 0), // 24小时交易额(quote_volume)
      raw_name: ticker.currency_pair, // 保存原始名称用于跳转
    }));

    return processedData;
  } catch (error) {
    console.error("Failed to fetch spot tickers data:", error);
    throw error;
  }
}
