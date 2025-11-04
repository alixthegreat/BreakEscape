#!/usr/bin/env python3
"""
HTTP Server with proper cache headers for development
- JSON files: No cache (always fresh)
- JS/CSS: Short cache (1 hour)
- Static assets: Longer cache (1 day)
"""

import http.server
import socketserver
import os
from datetime import datetime, timedelta
from email.utils import formatdate
import mimetypes

PORT = 8000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        now = datetime.utcnow()
        
        # Get the file path
        file_path = self.translate_path(self.path)
        
        # Set cache headers based on file type
        if self.path.endswith('.json'):
            # JSON files: Always fresh (no cache)
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            # IMPORTANT: Override Last-Modified BEFORE calling parent end_headers()
            self.send_header('Last-Modified', formatdate(timeval=None, localtime=False, usegmt=True))
        elif self.path.endswith(('.js', '.css')):
            # JS/CSS: Cache for 1 hour (development)
            self.send_header('Cache-Control', 'public, max-age=3600')
        elif self.path.endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp')):
            # Images: Cache for 1 day
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            # HTML and other files: No cache
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        
        # Call parent to add any remaining headers (this will NOT override ours)
        super().end_headers()

if __name__ == '__main__':
    Handler = NoCacheHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Development Server running at http://localhost:{PORT}/")
        print(f"📄 Cache policy:")
        print(f"  - JSON files: No cache (always fresh)")
        print(f"  - JS/CSS: 1 hour cache")
        print(f"  - Images: 1 day cache")
        print(f"  - Other: No cache")
        print(f"\n⌨️  Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped")
