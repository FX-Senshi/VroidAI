"use strict";

const {
  appendSessionMessages,
  buildNetlifyContexts,
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
    const sessionId = String(body.sessionId || "default-session");
    const modelName = body.modelName ? String(body.modelName) : null;
    const messages = sanitizeInputMessages(Array.isArray(body.messages) ? body.messages : []);

    if (!messages.length) {
      return jsonResponse(400, { error: "messages is required." });
    }

    const latestUserContent = getLatestUserContent(messages);
    if (!latestUserContent) {
      return jsonResponse(400, { error: "A user message is required." });
    }

    const storedUserResult = await appendSessionMessages(event, sessionId, modelName, [
      { role: "user", content: latestUserContent }
    ]);

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(500, {
        error: "OPENAI_API_KEY is not configured on Netlify.",
        storedInDatabase: storedUserResult.storedInDatabase,
        database: storedUserResult.database,
        growth: storedUserResult.growth || unavailableGrowth()
      });
    }

    const contextState = await buildNetlifyContexts(event, sessionId, messages);
    const openAiResult = await requestOpenAi(messages, contextState.savedContext, contextState.growthContext);
    if (!openAiResult.ok) {
      return jsonResponse(openAiResult.status, {
        error: normalizeOpenAiErrorMessage(openAiResult.status, openAiResult.payload),
        storedInDatabase: storedUserResult.storedInDatabase,
        database: storedUserResult.database,
        growth: storedUserResult.growth || contextState.growth || unavailableGrowth()
      });
    }

    const outputText = extractOutputText(openAiResult.payload) || "The AI returned an empty response.";
    const storedAssistantResult = await appendSessionMessages(event, sessionId, modelName, [
      { role: "assistant", content: outputText }
    ]);

    return jsonResponse(200, {
      message: outputText,
      usedImportedMemory: false,
      usedSavedMemory: Boolean(contextState.savedContext),
      usedGrowthMemory: Boolean(contextState.growthContext),
      storedInDatabase: storedAssistantResult.storedInDatabase,
      database: storedAssistantResult.database,
      growth: storedAssistantResult.growth || contextState.growth || unavailableGrowth()
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "Chat request failed.",
      storedInDatabase: false,
      growth: unavailableGrowth()
    });
  }
};
