"use strict";

const {
  jsonResponse,
  sessionHistoryLimit,
  unavailableDatabase,
  unavailableGrowth,
  unavailableMemoryImport
} = require("./_shared");

exports.handler = async function handler() {
  return jsonResponse(200, {
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    memoryImport: unavailableMemoryImport(),
    database: unavailableDatabase(),
    growth: unavailableGrowth(),
    sessionHistoryLimit
  });
};
