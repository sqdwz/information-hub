"""Local preview with explicit SVG MIME and read-only public-data forwarding."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qsl, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent / 'dist'
CACHE = {}

class Preview(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path)
        if not path.path.startswith('/data/'):
            return super().do_GET()
        query = urlencode([(k, v) for k, v in parse_qsl(path.query) if k != 'v'])
        key = path.path + ('?' + query if query else '')
        cached = CACHE.get(key)
        try:
            if cached and monotonic() - cached[0] < 45:
                status, content_type, body = cached[1:]
            else:
                request = Request('https://new.103535.xyz' + key, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
                with urlopen(request, timeout=25) as response:
                    status, content_type, body = response.status, response.headers.get('Content-Type', 'application/json'), response.read()
                CACHE[key] = (monotonic(), status, content_type, body)
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (HTTPError, URLError, TimeoutError) as error:
            self.send_error(502, 'Public data preview unavailable')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8786)
    args = parser.parse_args()
    print(f'Local preview: http://127.0.0.1:{args.port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Preview).serve_forever()
