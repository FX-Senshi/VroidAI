"use strict";

const {
  getTtsProvider,
  getTtsModel,
  getTtsVoice,
  getVoicevoxBaseUrl,
  getVoicevoxSpeaker,
  jsonResponse,
  normalizeTtsErrorMessage,
  normalizeVoicevoxErrorMessage,
  requestOpenAiTts,
  requestVoicevoxTts
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

    const provider = getTtsProvider();

    if (provider === "openai" && !process.env.OPENAI_API_KEY) {
      return jsonResponse(500, {
        error: "OPENAI_API_KEY is not configured on Netlify for shared TTS.",
        ttsProvider: provider,
        ttsModel: getTtsModel(),
        ttsVoice: getTtsVoice()
      });
    }

    if (provider === "voicevox" && !getVoicevoxBaseUrl()) {
      return jsonResponse(500, {
        error: "VOICEVOX_BASE_URL is not configured on Netlify for shared TTS.",
        ttsProvider: provider,
        ttsModel: getTtsModel(),
        ttsVoice: getTtsVoice()
      });
    }

    let ttsResult = null;
    if (provider === "openai") {
      ttsResult = await requestOpenAiTts(text, profile);
    } else if (provider === "voicevox") {
      ttsResult = await requestVoicevoxTts(text, profile);
    } else {
      return jsonResponse(400, {
        error: `Unsupported TTS provider '${provider}'.`,
        ttsProvider: provider
      });
    }

    if (!ttsResult.ok) {
      return jsonResponse(ttsResult.status || 500, {
        error: provider === "voicevox"
          ? normalizeVoicevoxErrorMessage(ttsResult.status, ttsResult.payload)
          : normalizeTtsErrorMessage(ttsResult.status, ttsResult.payload),
        ttsProvider: provider,
        ttsModel: getTtsModel(),
        ttsVoice: getTtsVoice(),
        voicevoxBaseUrl: provider === "voicevox" ? getVoicevoxBaseUrl() : undefined,
        voicevoxSpeaker: provider === "voicevox" ? getVoicevoxSpeaker() : undefined
      });
    }

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": ttsResult.contentType,
        "Cache-Control": "no-store",
        "X-TTS-Provider": provider,
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
