"use strict";

const { jsonResponse } = require("./_shared");

exports.handler = async function handler(event) {
  const sessionId = String(event?.queryStringParameters?.sessionId || "");

  return jsonResponse(200, {
    sessionId,
    messages: [],
    totalCount: 0
  });
};
