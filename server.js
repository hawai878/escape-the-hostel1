const http = require("http");
const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  console.log(`${req.method} ${req.url}`);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const { prompt } = parsed;
      if (!prompt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing prompt" }));
        return;
      }

      const fullPrompt = `You are a Roblox game development assistant. Respond ONLY with valid Lua code for Roblox Studio. No explanations, no markdown, no backticks. Just raw Lua code. Create a function called GenerateContent() that builds the requested thing using Instance.new() and parents everything to workspace. Call GenerateContent() at the end.

Build this: ${prompt}`;

      const payload = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      });

      const path = `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

      const options = {
        hostname: "generativelanguage.googleapis.com",
        path,
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
          console.log("Gemini raw response:", data);
          try {
            const result = JSON.parse(data);
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const lua = text.replace(/```lua\n?|```\n?/g, "").trim();
            console.log("Lua extracted:", lua.substring(0, 100));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ lua }));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      apiReq.on("error", (err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
