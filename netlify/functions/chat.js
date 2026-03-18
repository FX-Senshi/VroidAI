"use strict";

const {
  extractOutputText,
  getLatestUserContent,
  jsonResponse,
  normalizeOpenAiErrorMessage,
  requestOpenAi,
  sanitizeInputMessages,
  unavailableGrowth
} = require("./_shared");

exports.handler = async function handler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const messages = sanitizeInputMessages(Array.isArray(body.messages) ? body.messages : []);

    if (!messages.length) {
      return jsonResponse(400, { error: "messages is required." });
    }

    const latestUserContent = getLatestUserContent(messages);
    if (!latestUserContent) {
      return jsonResponse(400, { error: "A user message is required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(500, {
        error: "OPENAI_API_KEY is not configured on Netlify.",
        storedInDatabase: false,
        growth: unavailableGrowth()
      });
    }

    const openAiResult = await requestOpenAi(messages);
    if (!openAiResult.ok) {
      return jsonResponse(openAiResult.status, {
        error: normalizeOpenAiErrorMessage(openAiResult.status, openAiResult.payload),
        storedInDatabase: false,
        growth: unavailableGrowth()
      });
    }

    const outputText = extractOutputText(openAiResult.payload) || "The AI returned an empty response.";
    return jsonResponse(200, {
      message: outputText,
      usedImportedMemory: false,
      usedSavedMemory: false,
      usedGrowthMemory: false,
      storedInDatabase: false,
      growth: unavailableGrowth()
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "Chat request failed.",
      storedInDatabase: false,
      growth: unavailableGrowth()
    });
  }
};
