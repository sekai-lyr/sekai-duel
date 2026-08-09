import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};

function safePath(urlPath) {
    const pathname = decodeURIComponent((urlPath || "/").split("?")[0]);
    const requested = pathname === "/" ? "/index.html" : pathname;
    const resolved = path.resolve(ROOT, "." + requested);
    return resolved.startsWith(ROOT + path.sep) || resolved === ROOT ? resolved : null;
}

const server = http.createServer(async (request, response) => {
    try {
        const filePath = safePath(request.url);
        if (!filePath) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        const info = await stat(filePath);
        const finalPath = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
        const content = await readFile(finalPath);
        const extension = path.extname(finalPath).toLowerCase();
        const isCode = [".html", ".css", ".js", ".mjs", ".json"].includes(extension);
        response.writeHead(200, {
            "Content-Type": MIME[extension] || "application/octet-stream",
            // 开发版代码不缓存，避免修复后浏览器仍运行旧的 ui.js。
            "Cache-Control": isCode ? "no-store, max-age=0" : "public, max-age=86400",
        });
        response.end(content);
    } catch (error) {
        response.writeHead(error?.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(error?.code === "ENOENT" ? "Not Found" : "Server Error");
    }
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nightcord Duel Network: http://127.0.0.1:${PORT}`);
    console.log("按 Ctrl+C 停止服务器。");
});
