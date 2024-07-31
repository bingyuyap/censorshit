# CensorShit: Tweet Filtering Chrome Extension
CensorShit is a Chrome extension that filters tweets based on user-defined criteria using a local Ollama instance with the llama3.1 model. Hopefully this removes the slop from your timeline.

## Prerequisites

- Chrome browser
- Ollama installed on your local machine
- llama3.1 model downloaded for Ollama

## Setting up Ollama

Install Ollama if you haven't already. Visit Ollama's official website for installation instructions.
Download the llama3.1 model:
```
ollama pull llama3.1
```
Run Ollama with the correct CORS settings:
```
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

Keep this terminal window open while using the extension.

## Using the Extension
- Make sure Ollama is running with the correct CORS settings (step 4 above).
- Open Twitter in your Chrome browser.
- Click on the CensorShit extension icon to set your filter criteria.
- Browse Twitter as normal. Tweets matching your filter criteria will be automatically removed.
