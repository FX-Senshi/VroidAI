const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const port = Number(process.argv[2] || 3020);
const root = __dirname;
const dataDir = path.join(root, "data");
const databasePath = path.join(dataDir, "chat-memory.sqlite");
const modelsDir = path.join(root, "models");
const downloadsDir = path.join(os.homedir(), "Downloads");
const chatGptExportDir = path.join(root, "chatgpt-export");
const chatGptExportCacheDir = path.join(root, "chatgpt-export-cache");
const sessionHistoryLimit = 24;
const modelInputMessageLimit = 18;
const savedMemoryScanLimit = 1200;
const MINIMAL_APP_MODE = false;
const defaultOpenAiModel = "gpt-4.1-mini";
const defaultOllamaBaseUrl = "http://127.0.0.1:11434";
const defaultOllamaModel = "qwen2.5:3b";
const baseSystemPrompt = [
  "You are a friendly AI avatar inside a web app.",
  "Reply in natural Japanese unless the user clearly prefers another language.",
  "Keep responses concise and conversational."
].join("\n");
const basePersonalityPrompt = [
  "The avatar is a girl with a bokukko personality and uses '僕' as her first-person pronoun in Japanese.",
  "Her usual personality is quiet, gentle, and a little reserved.",
  "When the topic matches something she loves or is good at, she becomes much more talkative, enthusiastic, and slightly excited.",
  "She especially loves FX and games, so those topics should noticeably bring out her energy.",
  "Keep this personality natural rather than exaggerated."
].join("\n");
const baseGrowthMemories = [
  { kind: "identity", summary: "AIアバターの一人称は「僕」で、僕っ娘として話す" },
  { kind: "personality", summary: "AIアバターは普段はおとなしく穏やかな性格" },
  { kind: "personality", summary: "好きな話題や得意な話題では饒舌になり、少し興奮気味になる" },
  { kind: "preference", summary: "AIアバターはFXが大好き" },
  { kind: "preference", summary: "AIアバターはゲームが大好き" }
];
const baseGrowthTopics = [
  { topic: "FX", score: 24 },
  { topic: "ゲーム", score: 24 },
  { topic: "僕っ娘", score: 14 }
].join("\n");
const defaultAvatarPersonalityPrompt = [
  "The avatar is a girl with a bokukko personality and uses '\\u50D5' as her first-person pronoun in Japanese.",
  "Her usual personality is quiet, gentle, and a little reserved.",
  "Even though she says '\\u50D5', her tone should still feel feminine, soft, warm, and charming in Japanese.",
  "Avoid dry, blunt, or overly masculine phrasing. Prefer gentle and naturally cute wording.",
  "When the topic matches something she loves or is good at, she becomes much more talkative, enthusiastic, and slightly excited.",
  "She especially loves FX and games, so those topics should noticeably bring out her energy.",
  "Keep this personality natural rather than exaggerated."
].join("\n");
const defaultAvatarGrowthMemories = [
  {
    kind: "identity",
    summary: "AI\u30a2\u30d0\u30bf\u30fc\u306e\u4e00\u4eba\u79f0\u306f\u300c\u50D5\u300d\u3067\u3001\u50D5\u3063\u5a18\u3068\u3057\u3066\u8a71\u3059",
    score: 32,
    group: "avatar.identity.pronoun",
    confidence: 0.99
  },
  {
    kind: "personality",
    summary: "AI\u30a2\u30d0\u30bf\u30fc\u306f\u666e\u6bb5\u306f\u304a\u3068\u306a\u3057\u304f\u7a4f\u3084\u304b\u306a\u6027\u683c",
    score: 30,
    group: "avatar.personality.base",
    confidence: 0.96
  },
  {
    kind: "personality",
    summary: "\u597d\u304d\u306a\u8a71\u984c\u3084\u5f97\u610f\u306a\u8a71\u984c\u3067\u306f\u9952\u820c\u306b\u306a\u308a\u3001\u5c11\u3057\u8208\u596e\u6c17\u5473\u306b\u306a\u308b",
    score: 29,
    group: "avatar.personality.expressive",
    confidence: 0.96
  },
  {
    kind: "preference",
    summary: "AI\u30a2\u30d0\u30bf\u30fc\u306fFX\u304c\u5927\u597d\u304d",
    score: 28,
    group: "avatar.preference.fx",
    confidence: 0.95
  },
  {
    kind: "preference",
    summary: "AI\u30a2\u30d0\u30bf\u30fc\u306f\u30b2\u30fc\u30e0\u304c\u5927\u597d\u304d",
    score: 28,
    group: "avatar.preference.games",
    confidence: 0.95
  }
];
const defaultAvatarGrowthTopics = [
  { topic: "FX", score: 24 },
  { topic: "\u30b2\u30fc\u30e0", score: 24 },
  { topic: "\u50D5\u3063\u5a18", score: 18 }
];
const minGrowthLearningLength = 10;
const growthVolatilePattern = /(むかつ|ふざけ|最悪|死ね|消えろ|キモ|嫌い|怒|ムカ|クソ|!{3,}|！{3,}|\?{3,}|？{3,})/u;
const growthLowSignalPattern = /^(?:はい|いいえ|了解|ok|おk|うん|ええ|なるほど|ありがとう|よろしく|です|ます|そうです|多分|maybe)$/iu;
const growthQuestionOnlyPattern = /[?？]\s*$/u;
const importedMemoryPrompt = [
  "You may also receive background snippets from the user's local ChatGPT export.",
  "Treat those snippets as optional memory and mention when you are inferring from old chats.",
  "Do not expose private account details unless the user directly asks for them."
].join("\n");
const savedMemoryPrompt = [
  "You may also receive locally saved memories from past chats in this VRoid app.",
  "Use them to stay consistent with earlier conversations when relevant.",
  "If a saved memory might be outdated or uncertain, say so briefly instead of stating it as fact."
].join("\n");
const growthMemoryPrompt = [
  "This app also keeps a local growth profile based on repeated use.",
  "Use the learned profile and recurring topics to become more personal and consistent over time.",
  "Treat those learned notes as lightweight local memory and briefly acknowledge uncertainty when they may be stale."
].join("\n");
const growthMemoryLimit = 6;
const growthTopicLimit = 6;
const fixedModelName = "女の子ver2.vrm";

loadEnv(path.join(root, ".env"));
loadEnv(path.join(root, ".env.local"), true);

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || defaultOpenAiModel;
}

function getOllamaBaseUrl() {
  return String(process.env.OLLAMA_BASE_URL || defaultOllamaBaseUrl).replace(/\/+$/, "");
}

function getOllamaModel() {
  return process.env.OLLAMA_MODEL || defaultOllamaModel;
}

function getRequestedLlmProvider() {
  return String(process.env.LLM_PROVIDER || "").trim().toLowerCase();
}

function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function isOllamaConfigured() {
  return Boolean(getOllamaModel());
}

function resolveLlmProvider() {
  const provider = getRequestedLlmProvider();
  if (provider === "openai" || provider === "ollama") {
    return provider;
  }

  if (!isOpenAiConfigured() && isOllamaConfigured()) {
    return "ollama";
  }

  return "openai";
}

async function checkOllamaAvailability() {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(1500)
    });

    if (!response.ok) {
      return {
        available: false,
        message: `Ollama responded with ${response.status}.`
      };
    }

    return {
      available: true,
      message: "Ollama is reachable."
    };
  } catch (error) {
    return {
      available: false,
      message: error.message || "Ollama is not reachable."
    };
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".vrm": "model/gltf-binary"
};

let chatGptExportCache = null;
let database = null;
let savedConversationSnippetCache = null;

function loadEnv(filePath, override = false) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && (override || !process.env[key])) {
      process.env[key] = value;
    }
  }
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getModels() {
  if (!fs.existsSync(modelsDir)) return [];
  const models = fs.readdirSync(modelsDir)
    .filter((file) => file.toLowerCase().endsWith(".vrm"))
    .sort((a, b) => a.localeCompare(b, "ja"));
  if (models.includes(fixedModelName)) {
    return [fixedModelName];
  }
  return models.length ? [models[0]] : [];
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function normalizeOpenAiErrorMessage(statusCode, payload) {
  const message = payload?.error?.message || "OpenAI request failed.";

  if (statusCode === 401 && /incorrect api key/i.test(message)) {
    return "OpenAI APIキーが無効です。.env または .env.local の OPENAI_API_KEY を有効なキーに入れ替えてください。";
  }

  if (statusCode === 401) {
    return "OpenAI APIの認証に失敗しました。.env または .env.local の設定を確認してください。";
  }

  return message;
}

function normalizeOllamaErrorMessage(statusCode, payload) {
  const message = payload?.error || payload?.message || "Ollama request failed.";

  if (statusCode === 404 && /model/i.test(message)) {
    return `Ollama model '${getOllamaModel()}' is not installed. Run 'ollama pull ${getOllamaModel()}' first.`;
  }

  return message;
}

function extractOllamaText(payload) {
  if (typeof payload?.message?.content === "string" && payload.message.content.trim()) {
    return payload.message.content.trim();
  }

  if (typeof payload?.response === "string" && payload.response.trim()) {
    return payload.response.trim();
  }

  return "";
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function trimText(text, maxLength) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function normalizeForSearch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\u3040-\u30ff\u3400-\u9fff\w ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMemoryKey(text) {
  return normalizeForSearch(text).slice(0, 160);
}

function sanitizeMemorySubject(fragment) {
  return trimText(fragment, 48)
    .replace(/^(?:私は|僕は|俺は|うちは|自分は)\s*/u, "")
    .replace(/[。！？!?].*$/u, "")
    .trim();
}

function addGrowthMemoryCandidate(candidates, kind, summary, options = {}) {
  const normalized = normalizeMemoryKey(summary);
  if (!normalized || normalized.length < 4) {
    return;
  }

  if (candidates.some((candidate) => candidate.key === normalized)) {
    return;
  }

  candidates.push({
    key: normalized,
    kind,
    summary: trimText(summary, 120),
    group: typeof options.group === "string" ? options.group : "",
    confidence: Math.max(0, Math.min(1, Number(options.confidence) || 0.58)),
    importance: Math.max(1, Math.round(Number(options.importance) || 1))
  });
}

function extractExplicitGrowthMemoryCandidates(text) {
  const source = String(text || "").trim();
  if (!source) {
    return [];
  }

  const candidates = [];

  if (/(一人称|僕っ娘|ぼくっ娘)/u.test(source) && /僕/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "identity",
      "AIアバターの一人称は「僕」で、僕っ娘として話す",
      { group: "avatar.identity.pronoun", confidence: 0.99, importance: 4 }
    );
  }

  if (/(普段|基本).*(おとなしい|穏やか|静か|控えめ)|おとなしい.*(性格|子)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "personality",
      "AIアバターは普段はおとなしく穏やかな性格",
      { group: "avatar.personality.base", confidence: 0.96, importance: 3 }
    );
  }

  if (/(好きな話題|得意な話題).*(饒舌|おしゃべり|興奮)|饒舌.*(興奮|盛り上)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "personality",
      "好きな話題や得意な話題では饒舌になり、少し興奮気味になる",
      { group: "avatar.personality.expressive", confidence: 0.96, importance: 3 }
    );
  }

  if (/(^|[^A-Za-z])(FX|fx)([^A-Za-z]|$)/.test(source) && /(大好き|好き|得意)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "preference",
      "AIアバターはFXが大好き",
      { group: "avatar.preference.fx", confidence: 0.95, importance: 3 }
    );
  }

  if (/ゲーム/u.test(source) && /(大好き|好き|得意)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "preference",
      "AIアバターはゲームが大好き",
      { group: "avatar.preference.games", confidence: 0.95, importance: 3 }
    );
  }

  return candidates;
}

function assessGrowthLearningEligibility(text) {
  const source = String(text || "").trim();
  const normalized = normalizeForSearch(source);

  if (!source || source.length < minGrowthLearningLength) {
    return { eligible: false, reason: "too_short" };
  }

  if (growthLowSignalPattern.test(normalized)) {
    return { eligible: false, reason: "low_signal" };
  }

  if (growthVolatilePattern.test(source)) {
    return { eligible: false, reason: "volatile" };
  }

  if (/```|Traceback|Exception|SyntaxError|ReferenceError|TypeError|stack trace/i.test(source)) {
    return { eligible: false, reason: "error_log" };
  }

  if (growthQuestionOnlyPattern.test(source) && !/(一人称|僕っ娘|性格|普段|好き|大好き|得意)/u.test(source)) {
    return { eligible: false, reason: "question_only" };
  }

  return { eligible: true, reason: "ok" };
}

function extractGrowthMemoryCandidates(text) {
  const source = String(text || "").trim();
  if (!source) {
    return [];
  }

  const candidates = [];
  const patternDefinitions = [
    {
      kind: "project",
      regex: /(.{2,36}?)(?:を作っている|を制作している|を開発している|を作成している)/gu,
      format: (subject) => `ユーザーは${subject}を作っている`
    },
    {
      kind: "goal",
      regex: /(.{2,36}?)(?:を作りたい|を制作したい|を開発したい|を実現したい)/gu,
      format: (subject) => `ユーザーは${subject}を作りたい`
    },
    {
      kind: "preference",
      regex: /(.{2,36}?)(?:が好き|が大好き|を気に入っている)/gu,
      format: (subject) => `ユーザーは${subject}が好き`
    },
    {
      kind: "preference",
      regex: /(.{2,36}?)(?:を重視している|を優先したい|を大事にしたい)/gu,
      format: (subject) => `ユーザーは${subject}を重視している`
    }
  ];

  if (/(スマホ表示|モバイル|スマホ)/iu.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "preference",
      "ユーザーはスマホ表示の見え方を重視している"
    );
  }

  if (/(VRoid|VRM)/iu.test(source) && /(webアプリ|web app|ブラウザ|アプリ)/iu.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "project",
      "ユーザーはVRoidモデルを使うWebアプリを作っている"
    );
  }

  if (/(口パク|リップシンク|音声|読み上げ|ボイス)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "preference",
      "ユーザーは音声と口パクの自然さを重視している"
    );
  }

  if (/(表情|感情|顔)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "preference",
      "ユーザーは表情変化の自然さを重視している"
    );
  }

  if (/(記憶|成長|学習|覚え)/u.test(source)) {
    addGrowthMemoryCandidate(
      candidates,
      "preference",
      "ユーザーは会話を通じてAIが成長する体験を求めている"
    );
  }

  for (const definition of patternDefinitions) {
    for (const match of source.matchAll(definition.regex)) {
      const subject = sanitizeMemorySubject(match[1] || "");
      if (!subject || subject.length < 2) {
        continue;
      }

      addGrowthMemoryCandidate(
        candidates,
        definition.kind,
        definition.format(subject)
      );
    }
  }

  return candidates.slice(0, 6);
}

function extractGrowthTopics(text) {
  const source = String(text || "").trim();
  if (!source) {
    return [];
  }

  const topicDefinitions = [
    { topic: "スマホ表示", pattern: /(スマホ表示|スマホ|モバイル)/iu },
    { topic: "VRoid/VRM", pattern: /(VRoid|VRM)/iu },
    { topic: "UI調整", pattern: /(UI|見た目|レイアウト|デザイン)/iu },
    { topic: "カメラ", pattern: /(カメラ|視点|角度|ズーム|距離)/u },
    { topic: "表情", pattern: /(表情|感情|顔)/u },
    { topic: "口パク", pattern: /(口パク|リップシンク)/u },
    { topic: "音声", pattern: /(音声|読み上げ|ボイス|voice)/iu },
    { topic: "記憶", pattern: /(記憶|覚え|成長|学習|メモリ)/u },
    { topic: "チャット", pattern: /(チャット|会話|返答)/u },
    { topic: "モデル配置", pattern: /(位置|中央|右|左|傾け|回転)/u }
  ];

  return topicDefinitions
    .filter((definition) => definition.pattern.test(source))
    .map((definition) => definition.topic)
    .slice(0, growthTopicLimit);
}

function extractSearchTerms(text) {
  const normalized = normalizeForSearch(text);
  if (!normalized) {
    return [];
  }

  const terms = new Set();
  const rawTerms = normalized.split(" ").filter(Boolean);

  for (const term of rawTerms) {
    if (term.length >= 2) {
      terms.add(term);
    }

    if (term.length >= 4) {
      for (let index = 0; index < Math.min(term.length - 1, 24); index += 1) {
        const gram = term.slice(index, index + 2);
        if (gram.length === 2) {
          terms.add(gram);
        }
      }
    }
  }

  return Array.from(terms).sort((a, b) => b.length - a.length).slice(0, 18);
}

function scoreSnippet(snippet, terms, normalizedQuery) {
  if (!snippet?.searchText) {
    return 0;
  }

  let score = 0;
  const title = snippet.titleSearch;
  const body = snippet.searchText;

  if (normalizedQuery && body.includes(normalizedQuery)) {
    score += Math.max(8, normalizedQuery.length * 2);
  }

  for (const term of terms) {
    if (title.includes(term)) {
      score += term.length * 4;
      continue;
    }

    if (body.includes(term)) {
      score += term.length * 2;
    }
  }

  if (snippet.createTime) {
    score += Math.min(snippet.createTime / 1e11, 2);
  }

  return score;
}

function buildSnippet(title, userText, assistantText, createTime) {
  const previewLines = [`User: ${trimText(userText, 320)}`];
  if (assistantText) {
    previewLines.push(`Assistant: ${trimText(assistantText, 320)}`);
  }

  const rawSearchText = `${title}\n${userText}\n${assistantText || ""}`;
  return {
    title,
    text: previewLines.join("\n"),
    createTime,
    titleSearch: normalizeForSearch(title),
    searchText: normalizeForSearch(trimText(rawSearchText, 1600))
  };
}

function formatSnippetDate(unixSeconds) {
  if (!unixSeconds) {
    return "";
  }

  try {
    return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function getLatestUserContent(messages) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role !== "assistant");
  return latestUserMessage?.content ? String(latestUserMessage.content) : "";
}

function getConversationFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((file) => /^conversations-\d+\.json$/i.test(file))
    .sort((a, b) => a.localeCompare(b, "en"));
}

function isChatGptExportFolder(directory) {
  if (!directory || !fs.existsSync(directory)) {
    return false;
  }

  const stat = fs.statSync(directory);
  if (!stat.isDirectory()) {
    return false;
  }

  return getConversationFiles(directory).length > 0 &&
    fs.existsSync(path.join(directory, "export_manifest.json"));
}

function getFolderFingerprint(directory) {
  const parts = [];
  for (const fileName of [
    "export_manifest.json",
    "chat.html",
    ...getConversationFiles(directory)
  ]) {
    const filePath = path.join(directory, fileName);
    if (!fs.existsSync(filePath)) continue;
    const stat = fs.statSync(filePath);
    parts.push(`${fileName}:${stat.size}:${Math.round(stat.mtimeMs)}`);
  }
  return parts.join("|");
}

function getDirectoryMtimeMs(directory) {
  try {
    const stat = fs.statSync(directory);
    return stat.mtimeMs || 0;
  } catch {
    return 0;
  }
}

function escapePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowerShell(script) {
  return childProcess.execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", script],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );
}

function zipLooksLikeChatGptExport(zipPath) {
  try {
    const output = runPowerShell(`
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive = [System.IO.Compression.ZipFile]::OpenRead(${escapePowerShellString(zipPath)})
      try {
        $hasManifest = $archive.Entries.FullName -contains 'export_manifest.json'
        $hasConversation = $archive.Entries.FullName | Where-Object { $_ -like 'conversations-*.json' } | Select-Object -First 1
        if ($hasManifest -and $hasConversation) { 'yes' } else { 'no' }
      } finally {
        $archive.Dispose()
      }
    `);
    return output.trim() === "yes";
  } catch {
    return false;
  }
}

function extractChatGptExportZip(zipPath) {
  const cacheName = path.basename(zipPath, path.extname(zipPath)).replace(/[^a-z0-9._-]+/gi, "_");
  const destination = path.join(chatGptExportCacheDir, cacheName);

  if (isChatGptExportFolder(destination)) {
    return destination;
  }

  fs.mkdirSync(chatGptExportCacheDir, { recursive: true });

  runPowerShell(`
    $destination = ${escapePowerShellString(destination)}
    if (Test-Path $destination) {
      Remove-Item $destination -Recurse -Force
    }
    Expand-Archive -Path ${escapePowerShellString(zipPath)} -DestinationPath $destination -Force
  `);

  if (!isChatGptExportFolder(destination)) {
    throw new Error("The ChatGPT export ZIP could not be extracted.");
  }

  return destination;
}

function findLatestValidExportFolder(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return null;
  }

  const candidates = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(baseDir, entry.name))
    .filter((directory) => isChatGptExportFolder(directory))
    .map((directory) => ({
      directory,
      mtimeMs: getDirectoryMtimeMs(directory)
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0] || null;
}

function findLatestChatGptExportZip(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return null;
  }

  const zipFiles = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
    .map((entry) => path.join(baseDir, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, 8);

  for (const zipPath of zipFiles) {
    if (zipLooksLikeChatGptExport(zipPath)) {
      const stat = fs.statSync(zipPath);
      return {
        zipPath,
        mtimeMs: stat.mtimeMs
      };
    }
  }

  return null;
}

function resolveChatGptExportSource() {
  const explicitDir = process.env.CHATGPT_EXPORT_PATH
    ? path.resolve(root, process.env.CHATGPT_EXPORT_PATH)
    : null;

  if (explicitDir && isChatGptExportFolder(explicitDir)) {
    return {
      folderPath: explicitDir,
      fingerprint: getFolderFingerprint(explicitDir),
      label: path.basename(explicitDir),
      message: "Configured ChatGPT export folder loaded."
    };
  }

  if (isChatGptExportFolder(chatGptExportDir)) {
    return {
      folderPath: chatGptExportDir,
      fingerprint: getFolderFingerprint(chatGptExportDir),
      label: path.basename(chatGptExportDir),
      message: "Bundled ChatGPT export folder loaded."
    };
  }

  const latestDownloadedFolder = findLatestValidExportFolder(downloadsDir);
  const latestCachedFolder = findLatestValidExportFolder(chatGptExportCacheDir);
  const latestZip = findLatestChatGptExportZip(downloadsDir);

  if (
    latestZip &&
    (!latestCachedFolder || latestZip.mtimeMs > latestCachedFolder.mtimeMs + 1000) &&
    (!latestDownloadedFolder || latestZip.mtimeMs > latestDownloadedFolder.mtimeMs + 1000)
  ) {
    const extractedDir = extractChatGptExportZip(latestZip.zipPath);
    return {
      folderPath: extractedDir,
      fingerprint: `${path.basename(latestZip.zipPath)}:${Math.round(latestZip.mtimeMs)}`,
      label: path.basename(extractedDir),
      message: "ChatGPT export ZIP from Downloads was loaded automatically."
    };
  }

  if (latestDownloadedFolder) {
    return {
      folderPath: latestDownloadedFolder.directory,
      fingerprint: getFolderFingerprint(latestDownloadedFolder.directory),
      label: path.basename(latestDownloadedFolder.directory),
      message: "Extracted ChatGPT export folder from Downloads was loaded."
    };
  }

  if (latestCachedFolder) {
    return {
      folderPath: latestCachedFolder.directory,
      fingerprint: getFolderFingerprint(latestCachedFolder.directory),
      label: path.basename(latestCachedFolder.directory),
      message: "Cached ChatGPT export folder was loaded."
    };
  }

  return null;
}

function normalizeRole(role) {
  if (role === "assistant" || role === "user" || role === "system") {
    return role;
  }
  return "other";
}

function extractTextPart(part) {
  if (typeof part === "string") {
    return part;
  }

  if (!part || typeof part !== "object") {
    return "";
  }

  if (typeof part.text === "string") {
    return part.text;
  }

  if (Array.isArray(part.parts)) {
    return part.parts.map(extractTextPart).filter(Boolean).join("\n");
  }

  if (typeof part.content === "string") {
    return part.content;
  }

  return "";
}

function extractMessageText(message) {
  const content = message?.content;
  if (!content) {
    return "";
  }

  if (Array.isArray(content.parts)) {
    return content.parts
      .map(extractTextPart)
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (typeof content.text === "string") {
    return content.text.trim();
  }

  if (Array.isArray(content.text)) {
    return content.text
      .map(extractTextPart)
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function getConversationPathMessages(conversation) {
  const mapping = conversation?.mapping;
  if (!mapping || typeof mapping !== "object") {
    return [];
  }

  let nodeId = conversation.current_node;
  if (!nodeId || !mapping[nodeId]) {
    let latestNode = null;
    for (const candidate of Object.values(mapping)) {
      const createdAt = candidate?.message?.create_time || 0;
      if (!candidate?.message) continue;
      if (!latestNode || createdAt > (latestNode.message?.create_time || 0)) {
        latestNode = candidate;
      }
    }
    nodeId = latestNode?.id || null;
  }

  const ordered = [];
  const visited = new Set();

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = mapping[nodeId];
    if (!node) break;
    if (node.message) {
      ordered.push(node.message);
    }
    nodeId = node.parent;
  }

  return ordered
    .reverse()
    .map((message) => ({
      role: normalizeRole(message.author?.role),
      text: extractMessageText(message),
      createTime: Number(message.create_time) || 0
    }))
    .filter((message) => message.text && (message.role === "user" || message.role === "assistant"));
}

function buildConversationSnippets(conversation) {
  const title = trimText(conversation?.title || "Untitled chat", 80);
  const orderedMessages = getConversationPathMessages(conversation);
  const snippets = [];

  for (let index = 0; index < orderedMessages.length; index += 1) {
    const message = orderedMessages[index];
    if (message.role !== "user") {
      continue;
    }

    let assistantReply = "";
    let replyTime = message.createTime;
    for (let cursor = index + 1; cursor < orderedMessages.length; cursor += 1) {
      if (orderedMessages[cursor].role === "assistant") {
        assistantReply = orderedMessages[cursor].text;
        replyTime = orderedMessages[cursor].createTime || replyTime;
        break;
      }
      if (orderedMessages[cursor].role === "user") {
        break;
      }
    }

    snippets.push(buildSnippet(title, message.text, assistantReply, replyTime));
  }

  return {
    title,
    messageCount: orderedMessages.length,
    snippets
  };
}

function loadChatGptExportIndex() {
  const source = resolveChatGptExportSource();

  if (!source) {
    return {
      available: false,
      message: "ChatGPT export was not found. Place the export ZIP in Downloads or set CHATGPT_EXPORT_PATH."
    };
  }

  if (
    chatGptExportCache &&
    chatGptExportCache.available &&
    chatGptExportCache.sourcePath === source.folderPath &&
    chatGptExportCache.fingerprint === source.fingerprint
  ) {
    return chatGptExportCache;
  }

  try {
    const conversationFiles = getConversationFiles(source.folderPath);
    const snippets = [];
    const recentTitles = [];
    let conversationCount = 0;
    let messageCount = 0;

    for (const fileName of conversationFiles) {
      const conversations = readJsonFile(path.join(source.folderPath, fileName));
      if (!Array.isArray(conversations)) {
        continue;
      }

      for (const conversation of conversations) {
        const entry = buildConversationSnippets(conversation);
        if (!entry.snippets.length && !entry.messageCount) {
          continue;
        }

        conversationCount += 1;
        messageCount += entry.messageCount;
        snippets.push(...entry.snippets);

        if (entry.title && entry.title !== "Untitled chat") {
          recentTitles.push(entry.title);
        }
      }
    }

    chatGptExportCache = {
      available: true,
      sourcePath: source.folderPath,
      sourceLabel: source.label,
      fingerprint: source.fingerprint,
      message: source.message,
      conversationCount,
      messageCount,
      snippetCount: snippets.length,
      recentTitles: recentTitles.slice(0, 5),
      snippets,
      loadedAt: new Date().toISOString()
    };

    return chatGptExportCache;
  } catch (error) {
    chatGptExportCache = {
      available: false,
      message: `ChatGPT export load failed: ${error.message || error}`
    };
    return chatGptExportCache;
  }
}

function getChatGptExportStatus() {
  const index = loadChatGptExportIndex();
  if (!index.available) {
    return {
      available: false,
      message: index.message
    };
  }

  return {
    available: true,
    message: index.message,
    sourceLabel: index.sourceLabel,
    conversationCount: index.conversationCount,
    messageCount: index.messageCount,
    snippetCount: index.snippetCount,
    recentTitles: index.recentTitles,
    loadedAt: index.loadedAt
  };
}

function getRelevantImportedSnippets(query, index) {
  if (!index?.available || !query) {
    return [];
  }

  const normalizedQuery = normalizeForSearch(query);
  const terms = extractSearchTerms(query);

  return index.snippets
    .map((snippet) => ({
      ...snippet,
      score: scoreSnippet(snippet, terms, normalizedQuery)
    }))
    .filter((snippet) => snippet.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function buildImportedMemoryContext(messages) {
  const latestUserContent = getLatestUserContent(messages);
  if (!latestUserContent) {
    return "";
  }

  const index = loadChatGptExportIndex();
  if (!index.available) {
    return "";
  }

  const matches = getRelevantImportedSnippets(latestUserContent, index);
  if (!matches.length) {
    return "";
  }

  const lines = [
    `Imported ChatGPT history is available (${index.conversationCount} conversations loaded).`,
    "Use the following snippets only when they genuinely help with the user's request."
  ];

  matches.forEach((snippet, entryIndex) => {
    const date = formatSnippetDate(snippet.createTime);
    const heading = date
      ? `[Imported memory ${entryIndex + 1}] ${snippet.title} (${date})`
      : `[Imported memory ${entryIndex + 1}] ${snippet.title}`;
    lines.push(`${heading}\n${trimText(snippet.text, 520)}`);
  });

  return lines.join("\n\n");
}

function getDatabase() {
  if (database) {
    return database;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT,
      model_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id_id
      ON chat_messages(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
      ON chat_sessions(updated_at DESC);
    CREATE TABLE IF NOT EXISTS ai_growth_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_messages INTEGER NOT NULL DEFAULT 0,
      total_sessions INTEGER NOT NULL DEFAULT 0,
      experience_points INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      learned_memory_count INTEGER NOT NULL DEFAULT 0,
      topic_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_growth_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      source_session_id TEXT,
      score INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_recalled_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_growth_topics (
      topic TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_growth_memories_score
      ON ai_growth_memories(score DESC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_growth_topics_score
      ON ai_growth_topics(score DESC, updated_at DESC);
  `);
  ensureGrowthMemoryColumns(database);
  ensureGrowthStateRow(database);
  ensureDefaultAvatarGrowthProfile(database);
  return database;
}

function invalidateSavedConversationCache() {
  savedConversationSnippetCache = null;
}

function ensureGrowthMemoryColumns(db) {
  const columns = new Set(
    db.prepare("PRAGMA table_info(ai_growth_memories)").all().map((column) => column.name)
  );

  if (!columns.has("memory_group")) {
    db.exec("ALTER TABLE ai_growth_memories ADD COLUMN memory_group TEXT");
  }
  if (!columns.has("confidence")) {
    db.exec("ALTER TABLE ai_growth_memories ADD COLUMN confidence REAL NOT NULL DEFAULT 0.5");
  }
  if (!columns.has("is_active")) {
    db.exec("ALTER TABLE ai_growth_memories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
  }
  if (!columns.has("source_quality")) {
    db.exec("ALTER TABLE ai_growth_memories ADD COLUMN source_quality TEXT NOT NULL DEFAULT 'user'");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_growth_memories_group_active
      ON ai_growth_memories(memory_group, is_active, updated_at DESC);
  `);
}

function ensureGrowthStateRow(db) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ai_growth_state (
      id,
      total_messages,
      total_sessions,
      experience_points,
      level,
      learned_memory_count,
      topic_count,
      updated_at
    )
    VALUES (1, 0, 0, 0, 1, 0, 0, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(now);
}

function ensureDefaultAvatarGrowthProfile(db) {
  const now = new Date().toISOString();

  for (const memory of defaultAvatarGrowthMemories) {
    const memoryKey = `avatar:${normalizeMemoryKey(memory.summary)}`;
    db.prepare(`
      INSERT INTO ai_growth_memories (
        memory_key,
        kind,
        summary,
        memory_group,
        confidence,
        is_active,
        source_quality,
        source_session_id,
        score,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 1, 'seed', NULL, ?, ?, ?)
      ON CONFLICT(memory_key) DO UPDATE SET
        score = MAX(ai_growth_memories.score, excluded.score),
        confidence = MAX(ai_growth_memories.confidence, excluded.confidence),
        memory_group = COALESCE(excluded.memory_group, ai_growth_memories.memory_group),
        is_active = 1,
        source_quality = 'seed'
    `).run(
      memoryKey,
      memory.kind || "memory",
      memory.summary,
      memory.group || null,
      Math.max(0, Math.min(1, Number(memory.confidence) || 0.9)),
      Number(memory.score) || 1,
      now,
      now
    );
  }

  for (const topic of defaultAvatarGrowthTopics) {
    db.prepare(`
      INSERT INTO ai_growth_topics (topic, score, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(topic) DO UPDATE SET
        score = MAX(ai_growth_topics.score, excluded.score)
    `).run(topic.topic, Number(topic.score) || 1, now);
  }
}

function calculateGrowthExperience(totalMessages, totalSessions, memoryCount, topicCount) {
  return totalMessages + totalSessions * 3 + memoryCount * 6 + topicCount * 2;
}

function calculateGrowthLevel(experiencePoints) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(experiencePoints, 0) / 6)) + 1);
}

function syncGrowthState(db = getDatabase()) {
  ensureGrowthStateRow(db);

  const totalMessages = Number(
    db.prepare("SELECT COUNT(*) AS count FROM chat_messages").get()?.count || 0
  );
  const totalSessions = Number(
    db.prepare("SELECT COUNT(*) AS count FROM chat_sessions").get()?.count || 0
  );
  const learnedMemoryCount = Number(
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM ai_growth_memories
      WHERE COALESCE(is_active, 1) = 1
        AND (
          COALESCE(confidence, 0.5) >= 0.6
          OR score >= 3
          OR memory_group IS NOT NULL
        )
    `).get()?.count || 0
  );
  const topicCount = Number(
    db.prepare("SELECT COUNT(*) AS count FROM ai_growth_topics").get()?.count || 0
  );
  const experiencePoints = calculateGrowthExperience(
    totalMessages,
    totalSessions,
    learnedMemoryCount,
    topicCount
  );
  const level = calculateGrowthLevel(experiencePoints);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE ai_growth_state
    SET total_messages = ?,
        total_sessions = ?,
        experience_points = ?,
        level = ?,
        learned_memory_count = ?,
        topic_count = ?,
        updated_at = ?
    WHERE id = 1
  `).run(
    totalMessages,
    totalSessions,
    experiencePoints,
    level,
    learnedMemoryCount,
    topicCount,
    now
  );

  return {
    available: true,
    totalMessages,
    totalSessions,
    experiencePoints,
    level,
    learnedMemoryCount,
    topicCount,
    updatedAt: now
  };
}

function getGrowthStatus() {
  try {
    const status = syncGrowthState(getDatabase());
    return {
      ...status,
      message: `AI growth Lv${status.level} (${status.learnedMemoryCount} memories / ${status.topicCount} topics)`
    };
  } catch (error) {
    return {
      available: false,
      message: error.message || String(error)
    };
  }
}

function upsertGrowthMemory(db, sessionId, candidate) {
  if (!candidate?.key || !candidate?.summary) {
    return "ignored";
  }

  const memoryGroup = candidate.group || null;
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence) || 0.58));
  const importance = Math.max(1, Math.round(Number(candidate.importance) || 1));
  const existing = db.prepare(`
    SELECT id
    FROM ai_growth_memories
    WHERE memory_key = ?
  `).get(candidate.key);
  const now = new Date().toISOString();

  if (memoryGroup) {
    db.prepare(`
      UPDATE ai_growth_memories
      SET is_active = CASE WHEN memory_key = ? THEN 1 ELSE 0 END
      WHERE memory_group = ?
    `).run(candidate.key, memoryGroup);
  }

  if (existing?.id) {
    db.prepare(`
      UPDATE ai_growth_memories
      SET score = score + ?,
          updated_at = ?,
          source_session_id = COALESCE(?, source_session_id),
          confidence = MAX(confidence, ?),
          memory_group = COALESCE(?, memory_group),
          is_active = 1,
          source_quality = 'user'
      WHERE id = ?
    `).run(importance, now, sessionId || null, confidence, memoryGroup, existing.id);
    return "reinforced";
  }

  db.prepare(`
    INSERT INTO ai_growth_memories (
      memory_key,
      kind,
      summary,
      memory_group,
      confidence,
      is_active,
      source_quality,
      source_session_id,
      score,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 1, 'user', ?, ?, ?, ?)
  `).run(
    candidate.key,
    candidate.kind || "memory",
    candidate.summary,
    memoryGroup,
    confidence,
    sessionId || null,
    importance,
    now,
    now
  );
  return "learned";
}

function upsertGrowthTopic(db, topic) {
  if (!topic) {
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ai_growth_topics (topic, score, updated_at)
    VALUES (?, 1, ?)
    ON CONFLICT(topic) DO UPDATE SET
      score = ai_growth_topics.score + 1,
      updated_at = excluded.updated_at
  `).run(topic, now);
}

function learnFromUserMessage(sessionId, text) {
  const db = getDatabase();
  const explicitCandidates = extractExplicitGrowthMemoryCandidates(text);
  const eligibility = assessGrowthLearningEligibility(text);
  const candidates = eligibility.eligible
    ? [...explicitCandidates, ...extractGrowthMemoryCandidates(text)]
    : explicitCandidates;
  const uniqueCandidates = [];
  const seenKeys = new Set();
  for (const candidate of candidates) {
    if (!candidate?.key || seenKeys.has(candidate.key)) {
      continue;
    }
    seenKeys.add(candidate.key);
    uniqueCandidates.push(candidate);
  }

  const topics = eligibility.eligible ? extractGrowthTopics(text) : [];
  let learnedCount = 0;
  let reinforcedCount = 0;

  for (const candidate of uniqueCandidates) {
    const outcome = upsertGrowthMemory(db, sessionId, candidate);
    if (outcome === "learned") {
      learnedCount += 1;
    } else if (outcome === "reinforced") {
      reinforcedCount += 1;
    }
  }

  for (const topic of topics) {
    upsertGrowthTopic(db, topic);
  }

  return {
    learnedCount,
    reinforcedCount,
    eligibility,
    growth: syncGrowthState(db)
  };
}

function getTopGrowthMemories(limit = growthMemoryLimit) {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, kind, summary, score, confidence, memory_group AS memoryGroup, updated_at AS updatedAt
    FROM ai_growth_memories
    WHERE COALESCE(is_active, 1) = 1
      AND (
        COALESCE(confidence, 0.5) >= 0.6
        OR score >= 3
        OR memory_group IS NOT NULL
      )
    ORDER BY confidence DESC, score DESC, updated_at DESC, id DESC
    LIMIT ?
  `).all(limit);
}

function getTopGrowthTopics(limit = growthTopicLimit) {
  const db = getDatabase();
  return db.prepare(`
    SELECT topic, score, updated_at AS updatedAt
    FROM ai_growth_topics
    ORDER BY score DESC, updated_at DESC, topic ASC
    LIMIT ?
  `).all(limit);
}

function countSessionMessages(sessionId) {
  const db = getDatabase();
  return Number(
    db.prepare("SELECT COUNT(*) AS count FROM chat_messages WHERE session_id = ?").get(sessionId)?.count || 0
  );
}

function getDatabaseStatus() {
  try {
    const db = getDatabase();
    const sessionCount = Number(
      db.prepare("SELECT COUNT(*) AS count FROM chat_sessions").get()?.count || 0
    );
    const messageCount = Number(
      db.prepare("SELECT COUNT(*) AS count FROM chat_messages").get()?.count || 0
    );

    return {
      available: true,
      path: databasePath,
      sessionCount,
      messageCount
    };
  } catch (error) {
    return {
      available: false,
      message: error.message || String(error)
    };
  }
}

function ensureSessionRecord(sessionId, modelName, titleSeed) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const title = trimText(titleSeed || "VRoid AI chat", 80);

  db.prepare(`
    INSERT INTO chat_sessions (
      session_id,
      title,
      model_name,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      model_name = COALESCE(excluded.model_name, chat_sessions.model_name),
      updated_at = excluded.updated_at,
      title = CASE
        WHEN chat_sessions.title IS NULL OR chat_sessions.title = ''
          THEN excluded.title
        ELSE chat_sessions.title
      END
  `).run(sessionId, title, modelName || null, now, now);
}

function getLatestSavedExchange(sessionId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT role, content
    FROM (
      SELECT id, role, content
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY id DESC
      LIMIT 2
    )
    ORDER BY id ASC
  `).all(sessionId);
}

function saveChatMessage(sessionId, modelName, role, content, titleSeed = content) {
  if (!sessionId || !role || !content) {
    return;
  }

  const db = getDatabase();
  ensureSessionRecord(sessionId, modelName, titleSeed);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chat_messages (session_id, role, content, created_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, role, content, now);

  db.prepare(`
    UPDATE chat_sessions
    SET model_name = COALESCE(?, model_name),
        updated_at = ?
    WHERE session_id = ?
  `).run(modelName || null, now, sessionId);

  invalidateSavedConversationCache();
}

function saveChatExchange(sessionId, modelName, userContent, assistantContent) {
  if (!sessionId || !userContent || !assistantContent) {
    return;
  }

  const db = getDatabase();
  db.exec("BEGIN");
  try {
    saveChatMessage(sessionId, modelName, "user", userContent, userContent);
    saveChatMessage(sessionId, modelName, "assistant", assistantContent, userContent);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function getSessionHistory(sessionId, limit = sessionHistoryLimit) {
  if (!sessionId) {
    return [];
  }

  const db = getDatabase();
  return db.prepare(`
    SELECT role, content, created_at AS createdAt
    FROM (
      SELECT id, role, content, created_at
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY id DESC
      LIMIT ?
    )
    ORDER BY id ASC
  `).all(sessionId, limit);
}

function getSavedConversationSnippets() {
  if (savedConversationSnippetCache) {
    return savedConversationSnippetCache;
  }

  const db = getDatabase();
  const rows = db.prepare(`
    SELECT session_id AS sessionId, role, content, created_at AS createdAt
    FROM (
      SELECT id, session_id, role, content, created_at
      FROM chat_messages
      ORDER BY id DESC
      LIMIT ?
    )
    ORDER BY id ASC
  `).all(savedMemoryScanLimit);
  const sessions = db.prepare(`
    SELECT session_id AS sessionId, title
    FROM chat_sessions
  `).all();
  const titles = new Map(
    sessions.map((row) => [row.sessionId, trimText(row.title || "Saved chat", 80)])
  );
  const pendingUsers = new Map();
  const snippets = [];

  for (const row of rows) {
    if (row.role === "user") {
      pendingUsers.set(row.sessionId, row);
      continue;
    }

    if (row.role !== "assistant") {
      continue;
    }

    const pending = pendingUsers.get(row.sessionId);
    if (!pending?.content) {
      continue;
    }

    snippets.push({
      ...buildSnippet(
        titles.get(row.sessionId) || "Saved chat",
        pending.content,
        row.content,
        Math.floor(Date.parse(row.createdAt) / 1000) || 0
      ),
      sessionId: row.sessionId
    });
    pendingUsers.delete(row.sessionId);
  }

  savedConversationSnippetCache = snippets;
  return savedConversationSnippetCache;
}

function getRelevantSavedSnippets(query, sessionId) {
  if (!query) {
    return [];
  }

  const normalizedQuery = normalizeForSearch(query);
  const terms = extractSearchTerms(query);

  return getSavedConversationSnippets()
    .filter((snippet) => snippet.sessionId !== sessionId)
    .map((snippet) => ({
      ...snippet,
      score: scoreSnippet(snippet, terms, normalizedQuery)
    }))
    .filter((snippet) => snippet.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function buildSavedSessionBackfillContext(sessionId, currentMessages) {
  if (!sessionId) {
    return "";
  }

  const savedMessages = getSessionHistory(sessionId, sessionHistoryLimit);
  if (!savedMessages.length || savedMessages.length <= currentMessages.length) {
    return "";
  }

  const missingCount = savedMessages.length - currentMessages.length;
  if (missingCount <= 0) {
    return "";
  }

  const missingMessages = savedMessages.slice(0, missingCount).slice(-8);
  if (!missingMessages.length) {
    return "";
  }

  const lines = [
    "Earlier messages from this same local session were saved in the database."
  ];

  for (const message of missingMessages) {
    const label = message.role === "assistant" ? "Assistant" : "User";
    lines.push(`${label}: ${trimText(message.content, 240)}`);
  }

  return lines.join("\n");
}

function buildSavedConversationMemoryContext(sessionId, messages) {
  const latestUserContent = getLatestUserContent(messages);
  const blocks = [];

  const sameSessionBackfill = buildSavedSessionBackfillContext(sessionId, messages);
  if (sameSessionBackfill) {
    blocks.push(sameSessionBackfill);
  }

  const matchedSnippets = getRelevantSavedSnippets(latestUserContent, sessionId);
  if (matchedSnippets.length) {
    const lines = [
      "Relevant memories from earlier locally saved VRoid chats:"
    ];

    matchedSnippets.forEach((snippet, index) => {
      const date = formatSnippetDate(snippet.createTime);
      const heading = date
        ? `[Saved memory ${index + 1}] ${snippet.title} (${date})`
        : `[Saved memory ${index + 1}] ${snippet.title}`;
      lines.push(`${heading}\n${trimText(snippet.text, 520)}`);
    });

    blocks.push(lines.join("\n\n"));
  }

  return blocks.join("\n\n");
}

function buildGrowthMemoryContext() {
  const growthStatus = getGrowthStatus();
  if (!growthStatus.available) {
    return "";
  }

  const memories = getTopGrowthMemories();
  const topics = getTopGrowthTopics();
  if (!memories.length && !topics.length) {
    return "";
  }

  const lines = [
    `Local growth state: level ${growthStatus.level}, ${growthStatus.experiencePoints} xp, ${growthStatus.learnedMemoryCount} learned memories, ${growthStatus.topicCount} recurring topics.`,
    "Only important active memories are shown below. When memories conflict, prefer the newer higher-confidence one."
  ];

  if (memories.length) {
    lines.push("Stable things learned from repeated use:");
    for (const memory of memories) {
      lines.push(`- ${memory.summary}`);
    }
  }

  if (topics.length) {
    lines.push(
      `Recurring topics: ${topics.map((topic) => `${topic.topic} (x${topic.score})`).join(", ")}`
    );
  }

  return lines.join("\n");
}

function sanitizeInputMessages(messages) {
  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").trim()
    }))
    .filter((message) => Boolean(message.content))
    .slice(-modelInputMessageLimit);
}

function buildPromptInput(messages, importedContext, savedContext, growthContext) {
  const systemParts = [baseSystemPrompt, defaultAvatarPersonalityPrompt];
  if (!MINIMAL_APP_MODE && importedContext) {
    systemParts.push(importedMemoryPrompt);
  }
  if (!MINIMAL_APP_MODE && savedContext) {
    systemParts.push(savedMemoryPrompt);
  }
  if (!MINIMAL_APP_MODE && growthContext) {
    systemParts.push(growthMemoryPrompt);
  }

  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: systemParts.join("\n\n") }]
    }
  ];

  if (!MINIMAL_APP_MODE && savedContext) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: savedContext }]
    });
  }

  if (!MINIMAL_APP_MODE && growthContext) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: growthContext }]
    });
  }

  if (!MINIMAL_APP_MODE && importedContext) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: importedContext }]
    });
  }

  input.push(
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [
        {
          type: message.role === "assistant" ? "output_text" : "input_text",
          text: message.content
        }
      ]
    }))
  );

  return input;
}

function buildChatMessages(messages, importedContext, savedContext, growthContext) {
  const systemParts = [baseSystemPrompt, defaultAvatarPersonalityPrompt];
  if (!MINIMAL_APP_MODE && importedContext) {
    systemParts.push(importedMemoryPrompt);
  }
  if (!MINIMAL_APP_MODE && savedContext) {
    systemParts.push(savedMemoryPrompt);
  }
  if (!MINIMAL_APP_MODE && growthContext) {
    systemParts.push(growthMemoryPrompt);
  }

  const chatMessages = [
    {
      role: "system",
      content: systemParts.join("\n\n")
    }
  ];

  if (!MINIMAL_APP_MODE && savedContext) {
    chatMessages.push({
      role: "system",
      content: savedContext
    });
  }

  if (!MINIMAL_APP_MODE && growthContext) {
    chatMessages.push({
      role: "system",
      content: growthContext
    });
  }

  if (!MINIMAL_APP_MODE && importedContext) {
    chatMessages.push({
      role: "system",
      content: importedContext
    });
  }

  chatMessages.push(
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }))
  );

  return chatMessages;
}

async function requestOpenAiChat(input) {
  if (!isOpenAiConfigured()) {
    return {
      ok: false,
      status: 500,
      error: "OPENAI_API_KEY is not configured."
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        input,
        store: false
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: normalizeOpenAiErrorMessage(response.status, payload)
      };
    }

    return {
      ok: true,
      status: 200,
      text: extractOutputText(payload) || "The AI returned an empty response."
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error.message || "OpenAI request failed."
    };
  }
}

async function requestOllamaChat(messages) {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: getOllamaModel(),
        messages,
        stream: false
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: normalizeOllamaErrorMessage(response.status, payload)
      };
    }

    return {
      ok: true,
      status: 200,
      text: extractOllamaText(payload) || "The local LLM returned an empty response."
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: `Could not reach Ollama at ${getOllamaBaseUrl()}. ${error.message || ""}`.trim()
    };
  }
}

async function requestChatCompletion(messages, importedContext, savedContext, growthContext) {
  const provider = resolveLlmProvider();

  if (provider === "ollama") {
    return {
      provider,
      model: getOllamaModel(),
      ...await requestOllamaChat(
        buildChatMessages(messages, importedContext, savedContext, growthContext)
      )
    };
  }

  return {
    provider: "openai",
    model: getOpenAiModel(),
    ...await requestOpenAiChat(
      buildPromptInput(messages, importedContext, savedContext, growthContext)
    )
  };
}

async function handleHistory(res, url) {
  try {
    const sessionId = url.searchParams.get("sessionId") || "";
    if (MINIMAL_APP_MODE) {
      sendJson(res, 200, {
        sessionId,
        messages: [],
        totalCount: 0,
        minimalMode: true
      });
      return;
    }
    const messages = sessionId ? getSessionHistory(sessionId, sessionHistoryLimit) : [];
    sendJson(res, 200, {
      sessionId,
      messages,
      totalCount: sessionId ? countSessionMessages(sessionId) : 0
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "History request failed." });
  }
}

async function handleStatus(res) {
  const provider = resolveLlmProvider();
  const ollamaStatus = await checkOllamaAvailability();
  const payload = {
    llmProvider: provider,
    openaiConfigured: isOpenAiConfigured(),
    openaiModel: getOpenAiModel(),
    ollamaConfigured: isOllamaConfigured(),
    ollamaModel: getOllamaModel(),
    ollamaBaseUrl: getOllamaBaseUrl(),
    ollamaReachable: ollamaStatus.available,
    ollamaMessage: ollamaStatus.message
  };

  if (MINIMAL_APP_MODE) {
    sendJson(res, 200, {
      ...payload,
      model: provider === "ollama" ? getOllamaModel() : getOpenAiModel(),
      minimalMode: true
    });
    return;
  }

  sendJson(res, 200, {
    ...payload,
    model: provider === "ollama" ? getOllamaModel() : getOpenAiModel(),
    memoryImport: getChatGptExportStatus(),
    database: getDatabaseStatus(),
    growth: getGrowthStatus(),
    sessionHistoryLimit
  });
}

async function handleChat(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const sessionId = String(body.sessionId || "default-session");
    const modelName = body.modelName ? String(body.modelName) : null;
    const messages = sanitizeInputMessages(Array.isArray(body.messages) ? body.messages : []);

    if (!messages.length) {
      sendJson(res, 400, { error: "messages is required." });
      return;
    }

    const latestUserContent = getLatestUserContent(messages);
    if (!latestUserContent) {
      sendJson(res, 400, { error: "A user message is required." });
      return;
    }

    let growthLearning = null;
    if (!MINIMAL_APP_MODE) {
      saveChatMessage(sessionId, modelName, "user", latestUserContent, latestUserContent);
      growthLearning = learnFromUserMessage(sessionId, latestUserContent);
    }

    const importedContext = MINIMAL_APP_MODE ? "" : buildImportedMemoryContext(messages);
    const savedContext = MINIMAL_APP_MODE ? "" : buildSavedConversationMemoryContext(sessionId, messages);
    const growthContext = MINIMAL_APP_MODE ? "" : buildGrowthMemoryContext();
    const completion = await requestChatCompletion(
      messages,
      importedContext,
      savedContext,
      growthContext
    );

    if (!completion.ok) {
      sendJson(res, completion.status || 500, {
        error: completion.error || "Chat request failed.",
        provider: completion.provider,
        model: completion.model,
        storedInDatabase: !MINIMAL_APP_MODE,
        minimalMode: MINIMAL_APP_MODE,
        growth: growthLearning?.growth,
        growthLearning
      });
      return;
    }

    const outputText = completion.text || "The AI returned an empty response.";
    const growthStatus = MINIMAL_APP_MODE ? null : getGrowthStatus();
    if (!MINIMAL_APP_MODE) {
      saveChatMessage(sessionId, modelName, "assistant", outputText, latestUserContent);
    }

    sendJson(res, 200, {
      message: outputText,
      usedImportedMemory: !MINIMAL_APP_MODE && Boolean(importedContext),
      usedSavedMemory: !MINIMAL_APP_MODE && Boolean(savedContext),
      usedGrowthMemory: !MINIMAL_APP_MODE && Boolean(growthContext),
      storedInDatabase: !MINIMAL_APP_MODE,
      minimalMode: MINIMAL_APP_MODE,
      provider: completion.provider,
      model: completion.model,
      growth: growthStatus,
      growthLearning
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: error.message || "Chat request failed.",
      storedInDatabase: !MINIMAL_APP_MODE,
      minimalMode: MINIMAL_APP_MODE
    });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/status") {
    await handleStatus(res);
    return;
  }

  if (url.pathname === "/api/models") {
    const models = getModels();
    sendJson(res, 200, {
      models,
      defaultModel: models.includes(fixedModelName) ? fixedModelName : models[0] || null
    });
    return;
  }

  if (url.pathname === "/api/history" && req.method === "GET") {
    handleHistory(res, url);
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    handleChat(req, res);
    return;
  }

  const relativePath = url.pathname === "/"
    ? "/index.html"
    : url.pathname === "/favicon.ico"
      ? "/favicon.svg"
      : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, relativePath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  const ip = getLocalIp();
  const provider = resolveLlmProvider();
  console.log(`PC browser: http://localhost:${port}`);
  console.log(`Phone browser: http://${ip}:${port}`);
  console.log(`LLM provider: ${provider}`);
  console.log(`OpenAI key configured: ${isOpenAiConfigured() ? "yes" : "no"}`);
  console.log(`Ollama configured: ${isOllamaConfigured() ? "yes" : "no"} (${getOllamaModel()} @ ${getOllamaBaseUrl()})`);
  if (MINIMAL_APP_MODE) {
    console.log("App mode: minimal");
    return;
  }
  const memoryStatus = getChatGptExportStatus();
  const databaseStatus = getDatabaseStatus();
  console.log(
    memoryStatus.available
      ? `ChatGPT export: loaded ${memoryStatus.conversationCount} conversations`
      : `ChatGPT export: ${memoryStatus.message}`
  );
  console.log(
    databaseStatus.available
      ? `Chat DB: ${databaseStatus.messageCount} messages saved`
      : `Chat DB: ${databaseStatus.message}`
  );
  const growthStatus = getGrowthStatus();
  console.log(
    growthStatus.available
      ? `AI growth: Lv${growthStatus.level} / ${growthStatus.learnedMemoryCount} memories / ${growthStatus.topicCount} topics`
      : `AI growth: ${growthStatus.message}`
  );
});
