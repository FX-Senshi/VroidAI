VRoid AI

使い方
1. 1-Open-VRoidAI.bat をダブルクリック
2. ブラウザで http://localhost:3020 を開く
3. 終了するときは 3-Stop-VRoidAI.bat を使う

一時公開URL
1. 2-Open-Public-URL.bat をダブルクリック
2. 黒い画面に表示された https://... を開く

主なファイル
- 1-Open-VRoidAI.bat
- 2-Open-Public-URL.bat
- 3-Stop-VRoidAI.bat
- index.html
- viewer.js
- server.js
- .env.local
- models
- data
- chatgpt-export

保存場所
- ChatGPT の過去データは chatgpt-export フォルダから読み込みます
- 会話履歴DBは data フォルダに保存されます

LLM の使い分け
- OpenAI を使う場合
  .env.local に OPENAI_API_KEY を入れてください
- ローカル LLM を使う場合
  1. Ollama をインストール
  2. ollama pull qwen2.5:3b
  3. .env.local に下記を設定

ローカル LLM 設定例
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b

OpenAI 設定例
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini

補足
- /api/status で現在の provider と Ollama 接続状態を確認できます
- OpenAI と Ollama の両方を設定しても、LLM_PROVIDER の値が優先されます
