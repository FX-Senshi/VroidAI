const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const port = Number(process.argv[2] || 3020);
const root = __dirname;
const modelsDir = path.join(root, "models");
const systemPrompt = [
  "You are a friendly AI avatar inside a web app.",
  "Reply in natural Japanese unless the user clearly prefers another language.",
  "Keep responses concise and conversational."
].join("\n");

loadEnv(path.join(root, ".env"));
loadEnv(path.join(root, ".env.local"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".vrm": "model/gltf-binary"
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getModels() {
  if (!fs.existsSync(modelsDir)) return [];
  return fs.readdirSync(modelsDir)
    .filter((file) => file.toLowerCase().endsWith(".vrm"))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

async function handleChat(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      sendJson(res, 400, { error: "messages is required." });
      return;
    }

    const input = [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }]
      },
      ...messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: [
          {
            type: message.role === "assistant" ? "output_text" : "input_text",
            text: String(message.content || "")
          }
        ]
      }))
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input,
        store: false
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || "OpenAI request failed.";
      sendJson(res, response.status, { error: message });
      return;
    }

    const outputText = extractOutputText(payload);
    sendJson(res, 200, {
      message: outputText || "The AI returned an empty response."
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Chat request failed." });
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/status") {
    sendJson(res, 200, {
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
    });
    return;
  }

  if (url.pathname === "/api/models") {
    const models = getModels();
    sendJson(res, 200, {
      models,
      defaultModel: models.includes("ojisan.vrm") ? "ojisan.vrm" : models[0] || null
    });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    handleChat(req, res);
    return;
  }

  const relativePath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, relativePath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  const ip = getLocalIp();
  console.log(`PC browser: http://localhost:${port}`);
  console.log(`Phone browser: http://${ip}:${port}`);
  console.log(`OpenAI key configured: ${process.env.OPENAI_API_KEY ? "yes" : "no"}`);
});