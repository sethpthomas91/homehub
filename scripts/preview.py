#!/usr/bin/env python3
"""Local preview server that mirrors the Nginx routing for homehub.

Usage:
    python3 scripts/preview.py           # http://localhost:8080
    python3 scripts/preview.py 9000      # custom port
"""

import http.server
import mimetypes
import signal
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

ROUTE_TABLE = [
    ("/games",     REPO_ROOT / "apps" / "games"),
    ("/dashboard", REPO_ROOT / "apps" / "dashboard"),  # cross-path fix for ../dashboard/fonts.css
    ("/",          REPO_ROOT / "apps" / "dashboard"),
]

INDEX_FILES = {
    REPO_ROOT / "apps" / "games":     "index.html",
    REPO_ROOT / "apps" / "dashboard": "home-hub.html",
}

MIME_TYPES = {
    ".html":  "text/html; charset=utf-8",
    ".css":   "text/css; charset=utf-8",
    ".js":    "application/javascript",
    ".json":  "application/json",
    ".woff2": "font/woff2",
    ".woff":  "font/woff",
    ".png":   "image/png",
    ".svg":   "image/svg+xml",
    ".ico":   "image/x-icon",
}


class PreviewHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} {fmt % args}")

    def do_GET(self):
        # Strip query string
        path = self.path.split("?")[0]

        # Match longest prefix first
        root = None
        rel = None
        for prefix, directory in ROUTE_TABLE:
            if path == prefix or path.startswith(prefix + "/") or prefix == "/":
                stripped = path[len(prefix):] if prefix != "/" else path
                stripped = stripped.lstrip("/")
                root = directory
                rel = stripped
                break

        if root is None:
            self._send_error(404, "Not found")
            return

        # Resolve to a real path
        if rel:
            target = (root / rel).resolve()
        else:
            target = root.resolve()

        # Directory: fall back to index file
        if target.is_dir():
            index_name = INDEX_FILES.get(root, "index.html")
            target = target / index_name

        # Path traversal guard
        try:
            target.relative_to(root)
        except ValueError:
            self._send_error(403, "Forbidden")
            return

        if not target.exists():
            self._send_error(404, f"Not found: {target.name}")
            return

        suffix = target.suffix.lower()
        content_type = MIME_TYPES.get(suffix, "application/octet-stream")

        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error(self, code, message):
        body = f"{code} {message}".encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    url = f"http://localhost:{port}"

    server = http.server.HTTPServer(("", port), PreviewHandler)

    def shutdown(sig, frame):
        print("\nShutting down...")
        server.shutdown()

    signal.signal(signal.SIGINT, shutdown)

    print(f"HomeHub preview server running at {url}")
    print(f"  /        → apps/dashboard/ (home-hub.html)")
    print(f"  /games   → apps/games/ (index.html)")
    print(f"  /dashboard → apps/dashboard/ (cross-path fix)")
    print(f"Press Ctrl+C to stop.\n")

    subprocess.Popen(["open", url])
    server.serve_forever()


if __name__ == "__main__":
    main()
