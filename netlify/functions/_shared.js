"use strict";

const fixedModelName = "女の子.vrm";
const sessionHistoryLimit = 24;
const modelInputMessageLimit = 18;
const baseSystemPrompt = [
  "You are a friendly AI avatar inside a web app.",
  "Reply in natural Japanese unless the user clearly prefers another language.",
  "Keep responses concise and conversational."
].join("\n");
const defaultAvatarPersonalityPrompt = [
  "The avatar is a girl with a bokukko personality and uses '僕' as her first-person pronoun in Japanese.",
  "Her usual personality is quiet, gentle, and a little reserved.",
  "When the topic matches something she loves or is good at, she becomes much more talkative, enthusiastic, and slightly excited.",
  "She especially loves FX and games, so those topics should noticeably bring out her energy.",
  "Keep this personality natural rather than exaggerated."
].join("\n");

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

function unavailableGrowth(message = "Netlify公開版ではAI growthはローカル版のみです。") {
  return {
    available: false,
    message
  };
}

function unavailableDatabase(message = "Netlify公開版ではローカルDB保存は使いません。") {
  return {
    available: false,
    message
  };
}

function unavailableMemoryImport(message = "Netlify公開版ではローカルChatGPTデータは使いません。") {
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
    return "OpenAI APIキーが無効です。Netlify の Environment variables に正しい OPENAI_API_KEY を入れてください。";
  }

  if (statusCode === 401) {
    return "OpenAI API の認証に失敗しました。Netlify の Environment variables を確認してください。";
  }

  if (statusCode === 429) {
    return "OpenAI API の利用上限またはレート制限に達しました。少し待ってからもう一度試してください。";
  }

  return message;
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

function buildPromptInput(messages) {
  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "AI" : "ユーザー"}: ${message.content}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: [baseSystemPrompt, defaultAvatarPersonalityPrompt].join("\n\n")
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "以下はこのアプリでの会話履歴です。",
            transcript,
            "",
            "最後のユーザー発言に対して、アバターとして自然に返答してください。"
          ].join("\n")
        }
      ]
    }
  ];
}

async function requestOpenAi(messages) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildPromptInput(messages),
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

module.exports = {
  fixedModelName,
  sessionHistoryLimit,
  jsonResponse,
  unavailableDatabase,
  unavailableGrowth,
  unavailableMemoryImport,
  extractOutputText,
  normalizeOpenAiErrorMessage,
  sanitizeInputMessages,
  getLatestUserContent,
  requestOpenAi
};
