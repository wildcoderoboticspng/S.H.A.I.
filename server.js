
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const ROOT = __dirname;

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "GET") {
    const pathname = new URL(
      req.url, "http://localhost"
    ).pathname;

    const files = {
      "/": ["index.html", "text/html; charset=utf-8"],
      "/index.html": ["index.html", "text/html; charset=utf-8"],
      "/shai-orb.jpg": ["shai-orb.jpg", "image/jpeg"]
    };

    const item = files[pathname];

    if (!item) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const filePath = path.join(ROOT, item[0]);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        return res.end("File not found: " + item[0]);
      }

      res.writeHead(200, {
        "Content-Type": item[1],
        "Cache-Control": "no-cache"
      });

      res.end(content);
    });

    return;
  }

  if (req.method === "POST" && req.url === "/api/ask") {
    if (!API_KEY) {
      res.writeHead(500, {
        "Content-Type": "application/json"
      });
      return res.end(JSON.stringify({
        error: "Server API key is not configured."
      }));
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 20000) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const { question } = JSON.parse(body);

        if (
          typeof question !== "string" ||
          !question.trim() ||
          question.length > 4000
        ) {
          res.writeHead(400, {
            "Content-Type": "application/json"
          });
          return res.end(JSON.stringify({
            error: "Please provide a valid question."
          }));
        }

        const aiResponse = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + API_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4.1-mini",
              instructions:
                "You are S.H.A.I, Smart Helpful AI Assistant. " +
                "Be helpful, friendly, accurate, and concise. " +
                "You are speaking aloud, so use natural language.",
              input: question.trim(),
              max_output_tokens: 500
            })
          }
        );

        const data = await aiResponse.json();

        if (!aiResponse.ok) {
          console.error("AI API error:", data);
          res.writeHead(502, {
            "Content-Type": "application/json"
          });
          return res.end(JSON.stringify({
            error: "The AI service could not answer. Check API access and billing."
          }));
        }

        const answer = (data.output || [])
          .filter(item => item.type === "message")
          .flatMap(item => item.content || [])
          .filter(item => item.type === "output_text")
          .map(item => item.text)
          .join("\n")
          .trim();

        if (!answer) {
          throw new Error("The AI returned no text.");
        }

        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({ answer }));
      } catch (error) {
        console.error(error);

        if (!res.headersSent) {
          res.writeHead(500, {
            "Content-Type": "application/json"
          });
          res.end(JSON.stringify({
            error: "Unable to process your request."
          }));
        }
      }
    });

    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`S.H.A.I running at http://localhost:${PORT}`);
});
