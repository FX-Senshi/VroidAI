"use strict";

let blobsApi = null;
try {
  blobsApi = require("@netlify/blobs");
} catch {
  blobsApi = null;
}

const STORE_NAME = "vroidai-app";
const CHAT_STATS_KEY = "meta/chat-stats.json";
const GROWTH_KEY = "meta/growth.json";
const fixedModelName = "女の子ver2.vrm";
const sessionHistoryLimit = 24;
const modelInputMessageLimit = 18;
const defaultTtsModel = "gpt-4o-mini-tts";
const defaultTtsVoice = "shimmer";
const defaultTtsProfile = "shared-cute";
const sharedTtsProfiles = {
  "shared-cute": {
    id: "shared-cute",
    label: "共通かわいい",
    instructions: "Speak in Japanese with a cute, gentle, bright young heroine voice. Keep the pace natural, soft, and easy to understand."
  },
  "shared-soft": {
    id: "shared-soft",
    label: "共通やわらかい",
    instructions: "Speak in Japanese with a soft, warm, tender young woman voice. Keep the delivery calm, natural, and friendly."
  }
};
const baseSystemPrompt = [
  "You are a friendly AI avatar inside a web app.",
  "Reply in natural Japanese unless the user clearly prefers another language.",
  "Keep responses concise and conversational."
].join("\n");
const defaultAvatarPersonalityPrompt = [
  "The avatar is a girl with a bokukko personality and uses '僕' as her first-person pronoun in Japanese.",
  "Her usual personality is quiet, gentle, and a little reserved.",
  "Even though she says '僕', her tone should still feel feminine, soft, warm, and charming in Japanese.",
  "Avoid dry, blunt, or overly masculine phrasing. Prefer gentle and naturally cute wording.",
  "When the topic matches something she loves or is good at, she becomes much more talkative, enthusiastic, and slightly excited.",
  "She especially loves FX and games, so those topics should noticeably bring out her energy.",
  "Keep this personality natural rather than exaggerated."
].join("\n");
const importedMemoryUnavailableMessage = "Netlify deploy does not have local ChatGPT export data.";
const growthTopicPatterns = [
  { topic: "FX", pattern: /(fx|為替|ドル円|ユーロ円|トレード|相場|チャート)/iu },
  { topic: "ゲーム", pattern: /(ゲーム|game|fps|rpg|steam|switch|ps5|apex|valorant|minecraft|マイクラ)/iu },
  { topic: "AI", pattern: /(ai|chatgpt|llm|openai|機械学習)/iu },
  { topic: "VRoid", pattern: /(vroid|vrm|アバター|3dモデル)/iu },
  { topic: "制作", pattern: /(制作|開発|実装|デザイン|コード|プログラム)/iu }
];

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function unavailableGrowth(message = "Growth data is unavailable on this deploy.") {
  return {
    available: false,
    message
  };
}

function unavailableDatabase(message = "Persistent chat storage is unavailable on this deploy.") {
  return {
    available: false,
    message
  };
}

function unavailableMemoryImport(message = importedMemoryUnavailableMessage) {
  return {
    available: false,
    message
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload?.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function normalizeOpenAiErrorMessage(statusCode, payload) {
  const message = payload?.error?.message || "OpenAI request failed.";

  if (statusCode === 401 && /incorrect api key/i.test(message)) {
    return "OpenAI API key is invalid. Check OPENAI_API_KEY in Netlify environment variables.";
  }

  if (statusCode === 401) {
    return "OpenAI authentication failed. Check the Netlify environment variables.";
  }

  if (statusCode === 429) {
    return "OpenAI rate limit or usage limit was reached. Please wait a little and try again.";
  }

  return message;
}

function normalizeTtsErrorMessage(statusCode, payload) {
  const message = payload?.error?.message || payload?.message || "TTS request failed.";

  if (statusCode === 401 && /incorrect api key/i.test(message)) {
    return "OpenAI API key is invalid. Check OPENAI_API_KEY in Netlify environment variables.";
  }

  if (statusCode === 401) {
    return "OpenAI authentication failed. Check the Netlify environment variables.";
  }

  if (statusCode === 429) {
    return "OpenAI TTS rate limit or usage limit was reached. Please wait a little and try again.";
  }

  return message;
}

function getTtsModel() {
  return process.env.TTS_MODEL || defaultTtsModel;
}

function getTtsVoice() {
  return process.env.TTS_VOICE || defaultTtsVoice;
}

function resolveTtsProfile(profileId) {
  const normalizedProfileId = String(profileId || defaultTtsProfile).trim().toLowerCase();
  return sharedTtsProfiles[normalizedProfileId] || sharedTtsProfiles[defaultTtsProfile];
}

async function readJsonLikeErrorPayload(response) {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return {
        error: {
          message: text
        }
      };
    }
  } catch {
    return null;
  }
}

function sanitizeInputMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content || "").trim()
    }))
    .filter((message) => message.content)
    .slice(-modelInputMessageLimit);
}

function getLatestUserContent(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && message.content) {
      return message.content;
    }
  }
  return "";
}

function normalizeSessionId(sessionId) {
  const raw = String(sessionId || "default-session").trim() || "default-session";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "default-session";
}

function getSessionKey(sessionId) {
  return `sessions/${normalizeSessionId(sessionId)}.json`;
}

function createDefaultChatStats() {
  return {
    sessionCount: 0,
    messageCount: 0,
    updatedAt: null
  };
}

function createDefaultGrowthRecord() {
  return {
    totalMessages: 0,
    totalSessions: 0,
    experiencePoints: 0,
    topicCounts: {},
    updatedAt: null
  };
}

function getBlobsStore(event) {
  if (!blobsApi?.getStore) {
    return null;
  }

  if (typeof blobsApi.connectLambda === "function" && event) {
    try {
      blobsApi.connectLambda(event);
    } catch {
      // Ignore connect failures and let the store attempt run as-is.
    }
  }

  try {
    return blobsApi.getStore({ name: STORE_NAME });
  } catch {
    return null;
  }
}

async function readJson(store, key, fallbackValue) {
  if (!store) {
    return fallbackValue;
  }

  try {
    const value = await store.get(key, { type: "json" });
    return value && typeof value === "object" ? value : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

async function writeJson(store, key, value) {
  if (!store) {
    return;
  }

  await store.set(key, JSON.stringify(value), {
    contentType: "application/json; charset=utf-8"
  });
}

async function getSessionRecord(store, sessionId) {
  const fallback = {
    sessionId: normalizeSessionId(sessionId),
    updatedAt: null,
    messages: []
  };
  const record = await readJson(store, getSessionKey(sessionId), fallback);
  return {
    sessionId: normalizeSessionId(record.sessionId || sessionId),
    updatedAt: record.updatedAt || null,
    messages: Array.isArray(record.messages)
      ? record.messages
          .map((message) => ({
            role: message?.role === "assistant" ? "assistant" : "user",
            content: String(message?.content || "").trim(),
            createdAt: message?.createdAt || null
          }))
          .filter((message) => message.content)
      : []
  };
}

async function getChatStats(store) {
  return readJson(store, CHAT_STATS_KEY, createDefaultChatStats());
}

async function getGrowthRecord(store) {
  return readJson(store, GROWTH_KEY, createDefaultGrowthRecord());
}

function getTopicMatches(text) {
  const matches = [];
  for (const candidate of growthTopicPatterns) {
    if (candidate.pattern.test(String(text || ""))) {
      matches.push(candidate.topic);
    }
  }
  return matches;
}

function buildSavedConversationMemoryContext(savedMessages, currentMessages) {
  const safeSavedMessages = Array.isArray(savedMessages) ? savedMessages : [];
  const safeCurrentMessages = Array.isArray(currentMessages) ? currentMessages : [];
  if (!safeSavedMessages.length || safeSavedMessages.length <= safeCurrentMessages.length) {
    return "";
  }

  const priorMessages = safeSavedMessages.slice(0, safeSavedMessages.length - safeCurrentMessages.length);
  if (!priorMessages.length) {
    return "";
  }

  const transcript = priorMessages.slice(-8).map((message) => {
    const speaker = message.role === "assistant" ? "AI" : "User";
    return `${speaker}: ${message.content}`;
  });

  return [
    "Previously saved conversation for this session:",
    transcript.join("\n")
  ].join("\n");
}

function getGrowthLevel(experiencePoints) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(experiencePoints) || 0) / 10)) + 1);
}

function formatGrowthStatus(record) {
  const safeRecord = record || createDefaultGrowthRecord();
  const topicCount = Object.keys(safeRecord.topicCounts || {}).length;
  const learnedMemoryCount = Object.values(safeRecord.topicCounts || {}).filter((count) => Number(count) >= 2).length;

  return {
    available: true,
    totalMessages: Number(safeRecord.totalMessages) || 0,
    totalSessions: Number(safeRecord.totalSessions) || 0,
    experiencePoints: Number(safeRecord.experiencePoints) || 0,
    level: getGrowthLevel(safeRecord.experiencePoints),
    learnedMemoryCount,
    topicCount,
    updatedAt: safeRecord.updatedAt || null,
    message: `AI growth Lv${getGrowthLevel(safeRecord.experiencePoints)} (${learnedMemoryCount} memories / ${topicCount} topics)`
  };
}

function buildGrowthMemoryContext(record) {
  const safeRecord = record || createDefaultGrowthRecord();
  const topics = Object.entries(safeRecord.topicCounts || {})
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 5);

  if (!topics.length) {
    return "";
  }

  return [
    "Long-term learned interests from prior chats:",
    ...topics.map(([topic, score]) => `- ${topic}: ${score}`)
  ].join("\n");
}

function buildPromptInput(messages, savedContext = "", growthContext = "") {
  const systemParts = [baseSystemPrompt, defaultAvatarPersonalityPrompt];
  if (savedContext) {
    systemParts.push("Use saved session context when helpful, but do not sound robotic.");
  }
  if (growthContext) {
    systemParts.push("Lean into learned favorite topics when they naturally match the user's topic.");
  }

  const input = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: systemParts.join("\n\n")
        }
      ]
    }
  ];

  if (savedContext) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: savedContext }]
    });
  }

  if (growthContext) {
    input.push({
      role: "system",
      content: [{ type: "input_text", text: growthContext }]
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

async function requestOpenAi(messages, savedContext = "", growthContext = "") {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildPromptInput(messages, savedContext, growthContext),
      store: false
    })
  });

  const payload = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

async function requestOpenAiTts(text, profileId = defaultTtsProfile) {
  const profile = resolveTtsProfile(profileId);
  const payload = {
    model: getTtsModel(),
    voice: getTtsVoice(),
    input: String(text || "").trim()
  };

  if (profile.instructions) {
    payload.instructions = profile.instructions;
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      payload: await readJsonLikeErrorPayload(response)
    };
  }

  return {
    ok: true,
    status: 200,
    body: Buffer.from(await response.arrayBuffer()).toString("base64"),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    model: getTtsModel(),
    voice: getTtsVoice(),
    profileId: profile.id
  };
}

async function appendSessionMessages(event, sessionId, modelName, newMessages) {
  const store = getBlobsStore(event);
  if (!store) {
    return {
      storedInDatabase: false,
      database: unavailableDatabase(),
      growth: unavailableGrowth()
    };
  }

  const normalizedSessionId = normalizeSessionId(sessionId);
  const sessionRecord = await getSessionRecord(store, normalizedSessionId);
  const chatStats = await getChatStats(store);
  const growthRecord = await getGrowthRecord(store);
  const wasEmptySession = sessionRecord.messages.length === 0;
  const appendedMessages = [];
  const timestamp = new Date().toISOString();

  for (const message of Array.isArray(newMessages) ? newMessages : []) {
    const content = String(message?.content || "").trim();
    if (!content) {
      continue;
    }

    const role = message?.role === "assistant" ? "assistant" : "user";
    const lastMessage = sessionRecord.messages[sessionRecord.messages.length - 1];
    if (lastMessage && lastMessage.role === role && lastMessage.content === content) {
      continue;
    }

    const entry = {
      role,
      content,
      createdAt: timestamp,
      modelName: modelName || fixedModelName
    };
    sessionRecord.messages.push(entry);
    appendedMessages.push(entry);
  }

  if (!appendedMessages.length) {
    return {
      storedInDatabase: true,
      database: {
        available: true,
        path: "Netlify Blobs",
        sessionCount: Number(chatStats.sessionCount) || 0,
        messageCount: Number(chatStats.messageCount) || 0,
        message: "Chat data stored in Netlify Blobs."
      },
      growth: formatGrowthStatus(growthRecord)
    };
  }

  sessionRecord.updatedAt = timestamp;
  await writeJson(store, getSessionKey(normalizedSessionId), sessionRecord);

  chatStats.sessionCount = Number(chatStats.sessionCount) || 0;
  chatStats.messageCount = Number(chatStats.messageCount) || 0;
  if (wasEmptySession) {
    chatStats.sessionCount += 1;
    growthRecord.totalSessions = Number(growthRecord.totalSessions) + 1;
  }
  chatStats.messageCount += appendedMessages.length;
  chatStats.updatedAt = timestamp;
  await writeJson(store, CHAT_STATS_KEY, chatStats);

  growthRecord.totalMessages = Number(growthRecord.totalMessages) + appendedMessages.length;
  growthRecord.experiencePoints = Number(growthRecord.experiencePoints) + appendedMessages.reduce(
    (total, message) => total + (message.role === "assistant" ? 1 : 3),
    0
  );
  growthRecord.topicCounts = growthRecord.topicCounts || {};
  for (const message of appendedMessages) {
    if (message.role !== "user") {
      continue;
    }
    for (const topic of getTopicMatches(message.content)) {
      growthRecord.topicCounts[topic] = Number(growthRecord.topicCounts[topic] || 0) + 1;
    }
  }
  growthRecord.updatedAt = timestamp;
  await writeJson(store, GROWTH_KEY, growthRecord);

  return {
    storedInDatabase: true,
    database: {
      available: true,
      path: "Netlify Blobs",
      sessionCount: chatStats.sessionCount,
      messageCount: chatStats.messageCount,
      message: "Chat data stored in Netlify Blobs."
    },
    growth: formatGrowthStatus(growthRecord)
  };
}

async function getHistoryPayload(event, sessionId) {
  const store = getBlobsStore(event);
  if (!store) {
    return {
      sessionId: normalizeSessionId(sessionId),
      messages: [],
      totalCount: 0,
      database: unavailableDatabase()
    };
  }

  const record = await getSessionRecord(store, sessionId);
  const totalCount = record.messages.length;

  return {
    sessionId: record.sessionId,
    messages: record.messages.slice(-sessionHistoryLimit).map((message) => ({
      role: message.role,
      content: message.content
    })),
    totalCount,
    database: {
      available: true,
      path: "Netlify Blobs",
      sessionCount: null,
      messageCount: totalCount,
      message: "Chat data restored from Netlify Blobs."
    }
  };
}

async function getStatusPayload(event) {
  const store = getBlobsStore(event);
  if (!store) {
    return {
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      ttsConfigured: Boolean(process.env.OPENAI_API_KEY),
      ttsModel: getTtsModel(),
      ttsVoice: getTtsVoice(),
      memoryImport: unavailableMemoryImport(),
      database: unavailableDatabase(),
      growth: unavailableGrowth(),
      sessionHistoryLimit
    };
  }

  const [chatStats, growthRecord] = await Promise.all([
    getChatStats(store),
    getGrowthRecord(store)
  ]);

  return {
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    ttsConfigured: Boolean(process.env.OPENAI_API_KEY),
    ttsModel: getTtsModel(),
    ttsVoice: getTtsVoice(),
    memoryImport: unavailableMemoryImport(),
    database: {
      available: true,
      path: "Netlify Blobs",
      sessionCount: Number(chatStats.sessionCount) || 0,
      messageCount: Number(chatStats.messageCount) || 0,
      updatedAt: chatStats.updatedAt || null,
      message: "Chat data stored in Netlify Blobs."
    },
    growth: formatGrowthStatus(growthRecord),
    sessionHistoryLimit
  };
}

async function buildNetlifyContexts(event, sessionId, currentMessages) {
  const store = getBlobsStore(event);
  if (!store) {
    return {
      savedContext: "",
      growthContext: "",
      database: unavailableDatabase(),
      growth: unavailableGrowth()
    };
  }

  const [sessionRecord, growthRecord, chatStats] = await Promise.all([
    getSessionRecord(store, sessionId),
    getGrowthRecord(store),
    getChatStats(store)
  ]);

  return {
    savedContext: buildSavedConversationMemoryContext(sessionRecord.messages, currentMessages),
    growthContext: buildGrowthMemoryContext(growthRecord),
    database: {
      available: true,
      path: "Netlify Blobs",
      sessionCount: Number(chatStats.sessionCount) || 0,
      messageCount: Number(chatStats.messageCount) || 0,
      updatedAt: chatStats.updatedAt || null,
      message: "Chat data stored in Netlify Blobs."
    },
    growth: formatGrowthStatus(growthRecord)
  };
}

module.exports = {
  fixedModelName,
  sessionHistoryLimit,
  jsonResponse,
  unavailableDatabase,
  unavailableGrowth,
  unavailableMemoryImport,
  extractOutputText,
  normalizeOpenAiErrorMessage,
  normalizeTtsErrorMessage,
  sanitizeInputMessages,
  getLatestUserContent,
  requestOpenAi,
  requestOpenAiTts,
  getTtsModel,
  getTtsVoice,
  appendSessionMessages,
  getHistoryPayload,
  getStatusPayload,
  buildNetlifyContexts
};
