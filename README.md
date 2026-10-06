<p align="center"><img src="icon.svg" width="72" alt="dsh-translator"></p>

# dsh-translator

[DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) Web 插件。AI 回复的**每一段**（不含思维链）右下方会出现「翻译」按钮，点一下，就用你在 设置 → 模型 中已经配置好的模型把这一段翻译成你选的语言，译文显示在原文下方。

> English: A DSH Web plugin that adds a **Translate** button under every AI reply segment (never the chain of thought). It translates the segment with a model you already configured under Settings → Models and shows the result right below the original.

- **兼容版本**：DSH `>=0.1.7-rc.1`；Node `>=22.19`
- **插件形式**：标准 DSH bundle。`package.json` 里声明了 `dsh.bundle.patch` 和 `dsh.client`，Host 半和 Browser 半都是纯 ESM，没有运行时依赖，安装时不需要构建
- 可通过 [mikulo/dsh-plugins](https://github.com/mikulo/dsh-plugins) 插件清单一键安装

## 功能

| | |
|---|---|
| **逐段翻译** | AI 每段回复（每个回复步骤里的每个文本块）下方右侧有两个按钮：「翻译」和「替换原文」；思维链、工具调用、用户消息不显示按钮；回复还在生成时不显示，生成完才出现 |
| **替换原文** | 点「替换原文」后，译文直接显示在原文的位置（原文隐藏），按钮变为「显示原文」，再点即恢复。**只改变页面显示**：会话记录和发给模型的对话上下文仍是原文，后续对话不受影响；轮次底部的「复制」按钮复制的也仍是原文 |
| **译文排版** | 按钮和译文都在正常文档流中，排在原文之后、下一段之前，不浮动、不覆盖原文。译文按 Markdown 渲染（代码块、列表、表格与原文样式一致），左侧有一条细色条区分，下方注明目标语言、所用模型和思考强度；阿拉伯语、乌尔都语按从右到左排版 |
| **显示 / 隐藏 / 重译** | 翻译完成后「翻译」按钮变成「隐藏译文 / 显示译文」，两种显示方式可随时互相切换且不会重复请求；旁边的 ↻ 按钮可重新翻译；翻译中再点一次正在转圈的按钮即可取消 |
| **自动定位** | 点击任一按钮后，长文本展开、收起或替换导致页面高度变化时，对话区域会自动滚动到**译文的第一行**附近（隐藏译文 / 显示原文时则定位到原文第一行）；第一行本来就在屏幕内时不移动。翻译等待期间如果你自己滚动了页面，或又点了别的段落，译文返回后不会再跳转 |
| **报错** | 模型超时、模型不存在或已删除、未配置模型、API 报错（余额不足、密钥无效等）、无法连接 dsh web、插件服务端未加载时，都在按钮左侧用**红字**显示原因，失败的那个按钮变为「重试」；替换失败时原文保持显示 |
| **模型同步** | 设置页的模型列表与 设置 → 模型 中已配置的模型完全一致（与对话框里的模型选择器使用同一数据来源），按提供商分组；也可选「跟随 DSH 默认模型」 |
| **思考强度** | 默认关闭，可选 low / medium / high。不同模型支持的强度不同（例如 DeepSeek 只有 off / low / high / max），所选强度不受支持时自动换成最接近的一档，并在设置页提示 |
| **目标语言** | 默认简体中文，可选十种常用语言：简体中文、English、繁體中文、日本語、한국어、Français、Español、Deutsch、Русский、Português |
| **翻译提示词** | 可自定义，`{{target}}` 替换为目标语言，`{{text}}` 替换为原文（没写 `{{text}}` 时原文自动附加在末尾）；一键恢复默认 |
| **只翻译英文** | 默认只在含英文的段落显示按钮（中文回复里夹几个英文术语不算），可在设置中关闭 |
| **缓存** | 译文在页面内保留，滚动、切换对话后回来仍在；最近 200 条译文保存在浏览器 localStorage 中，刷新页面后也会恢复 |
| **测试** | 设置页底部可以输入一段文字直接测试当前配置 |

## 安装

### 通过 dsh-plugins 清单（推荐）

```sh
git clone https://github.com/mikulo/dsh-plugins.git
cd dsh-plugins
node install.mjs --profile web --only dsh-translator
```

### 直接安装

```sh
dsh plugin --profile web add github:mikulo/dsh-translator
```

安装后**重启 `dsh web` 并刷新页面**。

- 更新：`dsh plugin --profile web update @mikulo/dsh-translator`，然后重启 `dsh web`
- 卸载：`dsh plugin --profile web remove @mikulo/dsh-translator`

> 插件的 Browser 半会随页面热更新，Host 半必须重启 `dsh web` 才会加载新代码。服务端没有加载时，设置页和按钮旁会提示「请重启 dsh web」。

## 使用

1. 打开 **设置 → 回复翻译**，选择翻译模型（或保持「跟随 DSH 默认模型」）、思考强度和目标语言，可在底部「测试」里先试一下。
2. 在对话中，AI 回复的段落下方右侧会出现「翻译」和「替换原文」两个按钮：「翻译」把译文显示在原文下方，「替换原文」把译文显示在原文的位置（仅显示层面，对话上下文不变）。

## 设置项

| 设置 | 默认值 | 说明 |
|---|---|---|
| 翻译模型 | 跟随 DSH 默认模型 | 从 设置 → 模型 中已配置的模型里选；在那里增删模型后点「刷新」 |
| 思考强度 | 关闭 | 关闭 / low / medium / high；自动映射到模型实际支持的档位 |
| 翻译成 | 简体中文 | 十种常用语言 |
| 翻译提示词 | 内置模板 | 支持 `{{target}}`、`{{text}}`；留空保存即恢复默认 |
| 超时（秒） | 60 | 5–600 秒，超过即报「翻译超时」 |
| 只在包含英文的段落显示翻译按钮 | 开 | 关闭后所有回复段落都有按钮 |

默认提示词：

```text
将下面的文本翻译为{{target}}。要求：
- 只输出译文，不要添加任何解释、注释或前后缀；
- 保留原有的 Markdown 结构（标题、列表、表格、引用、链接）；
- 代码块、行内代码、命令、文件路径和 URL 保持原样，不要翻译；
- 专有名词和技术术语可保留原文。

{{text}}
```

## 数据保存位置

- 设置：`~/.dsh/dsh-translator.json`（设置了 `DSH_HOME` 时为 `$DSH_HOME/dsh-translator.json`）。与 DSH 自身设置分开保存，**重装或更新插件不会丢失**。
- 译文缓存：浏览器 localStorage 的 `dsh-translator.cache.v1`（最近 200 条），只在本机浏览器中。
- 翻译请求通过 DSH 自身的模型服务发出，使用你在 设置 → 模型 中配置的 API Key，插件不单独保存任何密钥。

## 工作原理

- **Host 半**（`lib/index.js`）：提供仅限本机访问的 `/api/dsh-translator/*` 接口；模型列表来自 DSH 的 `llm` 服务（`listProviders` → `listModels` → `resolveModelInfo`，与 DSH 自带的模型选择器相同）；翻译时调用一次 `llm.stream()`，只取正文文本块作为译文，丢弃思考内容。
- **Browser 半**（`lib/client.js`）：在设置中注册「回复翻译」页面；DSH 没有逐段的插槽（`conversation.chat.assistant-actions` 每轮只有一次），所以插件在每个已完成的 AI 文本块之后插入一个自己的容器，并由挂在 `shell.overlay` 中的组件通过 React portal 渲染按钮和译文。译文原文取自 DSH `MarkdownText` 组件的原始 Markdown；取不到时退回使用页面上显示的文本。

## 开发与构建

```sh
npm run build   # src/ → lib/（写入版本号并做语法检查）
npm test        # 检查 lib/ 是否最新 + Host / Browser / DOM 冒烟测试
```

- 源码在 `src/`，`lib/` 是**提交到仓库的构建产物**，修改 `src/` 后必须重新 `npm run build`。
- 没有 `prepare` / `postinstall` 等安装时构建脚本，`dsh plugin add` 直接使用仓库里的 `lib/`。

## 更新日志

### 1.0.1

- 目标语言改为十种常用语言：新增繁體中文、日本語、한국어、Deutsch，移除 हिन्दी、العربية、বাংলা、اردو。之前选了已移除语言的，会自动回到默认的简体中文。

### 1.0.0

- 首个版本：逐段「翻译」（译文显示在原文下方）与「替换原文」（译文在原处替换显示，仅改变显示、不改对话上下文）两个按钮、错误提示；设置页（模型同步、思考强度、目标语言、提示词、超时、只翻译英文、测试）。

## 许可证

[MIT](LICENSE)
