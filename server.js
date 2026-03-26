// server.js — Gemini version (free!)
const http = require("http");
const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  console.log(`${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", message: "Gemini proxy is running!" }));
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      const { prompt } = parsed;
      if (!prompt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing prompt field" }));
        return;
      }

      if (!GEMINI_API_KEY) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "GEMINI_API_KEY not set on server" }));
        return;
      }

      const fullPrompt = `You are a Roblox game development assistant.
When asked to generate game elements, respond ONLY with valid Lua code for Roblox Studio.
Use Roblox API: Instance.new, workspace, game.Players, etc.
Do not include any explanation or markdown — just raw Lua code.
Always wrap output in a function called GenerateContent() that creates and parents instances to workspace, then call GenerateContent() at the end.

User request: ${prompt}`;

      const payload = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      });

      const path = `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

      const options = {
        hostname: "generativelanguage.googleapis.com",
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const apiReq = https.request(options, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => (data += chunk));
        apiRes.on("end", () => {
          try {
            console.log("Gemini response:", data);
            const result = JSON.parse(data);
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const lua = text.replace(/```lua\n?|```\n?/g, "").trim();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ lua }));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to parse response: " + e.message }));
          }
        });
      });

      apiReq.on("error", (err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "API request failed: " + err.message }));
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Gemini proxy running on port ${PORT}`);
});
