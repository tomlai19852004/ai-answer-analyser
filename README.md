# AI Answer Analyser

Chrome extension for ChatGPT, Gemini, Google AI Overview, Google AI Mode, Perplexity, DeepSeek, Kimi, and Qwen.

After an answer appears, it checks two things:

- Self-promotion: a sentence promotes a brand and cites that brand's own site.
- Facts: each cited claim is compared with the text of the cited page. Supported means the page states it. False means the page states a different figure. Unchecked means the page could not be read or does not mention the claim.

This version compares phrases and numbers in the downloaded page text. It does not call another AI model. A page that blocks download, requires a login, or is drawn only after JavaScript runs stays unchecked.

## Live test

1. Install [Google Chrome](https://www.google.com/chrome/).
2. Clone this repository and check out the branch that contains `extension/manifest.json`.
3. Open `chrome://extensions`.
4. Turn on Developer mode.
5. Click Load unpacked and choose the `extension` folder inside this repository.
6. Open one of the sites above and ask a question that gets an answer with links.
7. A panel opens on the right. You can also click the extension icon, or select the answer text and click Analyse again.
8. After pulling a newer copy, click Reload on `chrome://extensions`.

```bash
git clone https://github.com/tomlai19852004/ai-answer-analyser.git
cd ai-answer-analyser
git checkout cursor/ai-answer-extension-f15d
```

The folder to load is `extension`, not the repository root.

## Tests

```bash
node --test test/analyse.test.js
```
