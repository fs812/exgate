# Gate Exchange Symbol Switcher

一个 Chrome 插件，用于在 Gate 交易所的交易界面快速切换不同的加密货币品种。

## 功能特性

- 🚀 快速币种切换：使用 `Command + ↓` 组合键在 Gate 交易所界面快速切换到其他币种
- 🍎 macOS 优化：专为 macOS 用户设计的键盘快捷键
- 🎯 智能匹配：自动识别当前正在查看的币种并切换到目标币种

## 支持的页面

该插件在以下页面生效：

- `https://www.gate.com/zh/futures/USDT/{symbol}_USDT`

其中 `{symbol}` 是币种名称，如 BTC、ETH 等。

## 安装方法

### 开发者模式安装

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择此项目的根目录

### 使用方法

1. 访问 Gate 交易所的期货交易页面，例如：
   - `https://www.gate.com/zh/futures/USDT/BTC_USDT`
   - `https://www.gate.com/zh/futures/USDT/SOL_USDT`
2. 按下 `Command + ↓` 组合键切换到 ETH

## 项目结构

```
exgate/
├── manifest.json       # Chrome插件配置文件
├── content.js         # 内容脚本，处理键盘事件和页面操作
├── icons/            # 插件图标目录
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md         # 项目说明文档
```

## 开发说明

### 当前实现

- ✅ 监听 `Command + ↓` 组合键
- ✅ 自动识别当前币种
- ✅ 切换到 ETH 币种
- ✅ 阻止默认键盘行为

### 未来扩展

- [ ] 实现完整的币种列表循环
- [ ] 添加反向切换功能（上一个币种）
- [ ] 支持自定义币种列表
- [ ] 添加快捷键设置界面

## 技术说明

- **Manifest Version**: 3（最新的 Chrome 插件标准）
- **权限**: `activeTab`（仅在当前标签页使用）
- **匹配模式**: Gate 交易所期货交易页面
- **键盘监听**: 使用 `metaKey`（Mac 的 Command 键）+ `ArrowDown`

## 注意事项

- 此插件仅在 macOS 系统上测试，使用 Command 键
- 需要在 Gate 交易所的指定页面才能生效
- 当前版本仅支持切换到 ETH，后续版本将支持更多币种

## 许可证

本项目仅供个人学习和使用。
