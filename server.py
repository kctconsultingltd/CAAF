#!/usr/bin/env python3
"""
Simple local development server for testing the website.
Run this script and open http://localhost:8000 in your browser.
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# Change to the directory where this script is located
os.chdir(Path(__file__).parent)

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    print(f"Press Ctrl+C to stop the server")
    
    # Optional: automatically open browser
    webbrowser.open(f"http://localhost:{PORT}/")
    
    httpd.serve_forever()
