"""Run a local, loopback-only preview of the same live site."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
    address = f'http://127.0.0.1:{server.server_port}/index.html'
    print(address, flush=True)
    webbrowser.open(address)
    server.serve_forever()
