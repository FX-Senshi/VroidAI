"use strict";

const {
  getTtsModel,
  getTtsVoice,
  jsonResponse,
  normalizeTtsErrorMessage,
  requestOpenAiTts
} = require("./_shared");

exports.handler = async function handler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const text = String(body.text || "").trim();
    const profile = String(body.profile || "shared-cute");

    if (!text) {
      return jsonResponse(400, { error: "text is required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(500, {
        error: "OPENAI_API_KEY is not configured on Netlify for shared TTS.",
        ttsModel: getTtsModel(),
        ttsVoice: getTtsVoice()
      });
    }

    const ttsResult = await requestOpenAiTts(text, profile);
    if (!ttsResult.ok) {
      return jsonResponse(ttsResult.status || 500, {
        error: normalizeTtsErrorMessage(ttsResult.status, ttsResult.payload),
        ttsModel: getTtsModel(),
        ttsVoice: getTtsVoice()
      });
    }

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": ttsResult.contentType,
        "Cache-Control": "no-store",
        "X-TTS-Model": ttsResult.model,
        "X-TTS-Voice": ttsResult.voice,
        "X-TTS-Profile": ttsResult.profileId
      },
      body: ttsResult.body
    };
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "TTS request failed."
    });
  }
};
