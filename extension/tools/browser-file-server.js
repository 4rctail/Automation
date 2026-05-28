const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "localhost";
const port = 8787;
const dataDir = path.resolve(__dirname, "..", "local-data");
const files = {
  "/BrowserSelect.txt": path.join(dataDir, "BrowserSelect.txt"),
  "/BrowserInstruction.txt": path.join(dataDir, "BrowserInstruction.txt")
};

fs.mkdirSync(dataDir, { recursive: true });

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && (req.url === "/BrowserSelect.txt" || req.url === "/BrowserInstruction.txt")) {
    readBody(req, (err, body) => {
      if (err) return sendText(res, 500, `Read failed: ${err.message}`);
      fs.writeFile(files[req.url], body, "utf8", (writeErr) => {
        if (writeErr) return sendText(res, 500, `Write failed: ${writeErr.message}`);
        sendText(res, 200, "ok\n");
      });
    });
    return;
  }

  if (req.method === "GET" && req.url === "/BrowserInstruction.txt") {
    fs.readFile(files[req.url], "utf8", (err, data) => {
      if (err && err.code === "ENOENT") return sendText(res, 200, "# BrowserInstruction.txt\n");
      if (err) return sendText(res, 500, `Read failed: ${err.message}`);
      sendText(res, 200, data);
    });
    return;
  }

  sendText(res, 404, "Not found\n");
});

server.listen(port, host, () => {
  console.log(`Browser file server listening at http://${host}:${port}`);
  console.log(`Writing files to ${dataDir}`);
});

function readBody(req, callback) {
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => callback(null, body));
  req.on("error", callback);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
