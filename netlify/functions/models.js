"use strict";

const { fixedModelName, jsonResponse } = require("./_shared");

exports.handler = async function handler() {
  return jsonResponse(200, {
    models: [fixedModelName],
    defaultModel: fixedModelName
  });
};
