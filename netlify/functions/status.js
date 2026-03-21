"use strict";

const { getStatusPayload, jsonResponse } = require("./_shared");

exports.handler = async function handler(event) {
  try {
    const payload = await getStatusPayload(event);
    return jsonResponse(200, payload);
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "Status request failed."
    });
  }
};
