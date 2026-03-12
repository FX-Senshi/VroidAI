VRoid AI Chat

1. start-webapp.bat
PCでローカル表示します。

2. start-public-url.bat
一時的な公開URLを発行します。
URLは起動ごとに変わります。
黒い画面に https://... のURLが表示されたら、そのURLを開いてください。

APIキーを入れる場合:
- このフォルダに .env または .env.local を置きます。
- OPENAI_API_KEY=... を設定してください。
- 必要なら OPENAI_MODEL=gpt-5 のようにモデルも変えられます。

注意:
- APIキーは index.html や viewer.js に直接書かないでください。
- publish-static は静的公開用なので秘密情報は置かないでください。