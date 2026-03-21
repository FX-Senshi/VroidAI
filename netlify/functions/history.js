"use strict";

const { getHistoryPayload, jsonResponse } = require("./_shared");

exports.handler = async function handler(event) {
  try {
    const sessionId = String(event?.queryStringParameters?.sessionId || "");
    const payload = await getHistoryPayload(event, sessionId);
    return jsonResponse(200, payload);
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "History request failed."
    });
  }
};
