const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5173;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonc': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.midi': 'audio/midi',
  '.mid': 'audio/midi',
  '.txt': 'text/plain; charset=utf-8'
};

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    s.listen(startPort, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  let filePath = path.join(ROOT, pathname);

  // Path traversal protection
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  // If path is a directory, look for index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If not found, check with .html extension
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>404 Not Found</title></head>
      <body style="font-family:system-ui,sans-serif;padding:2rem;line-height:1.6;">
        <h2>404 - File Not Found</h2>
        <p>Could not find <code>${pathname}</code></p>
        <p><a href="/">← Return to Home</a></p>
      </body>
      </html>
    `);
    return;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const totalSize = stat.size;

  if (req.method === 'HEAD') {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    res.end();
    return;
  }

  // HTTP Range requests for seeking in audio
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

async function start() {
  const port = await findAvailablePort(DEFAULT_PORT);
  const server = http.createServer(handleRequest);

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n> Local dev server ready:`);
    console.log(`  ➜ Local:   http://localhost:${port}/`);
    console.log(`\n  Apps:`);
    console.log(`  ➜ Main Hub:       http://localhost:${port}/index.html`);
    console.log(`  ➜ Field Recorder: http://localhost:${port}/audio-field-recorder.html`);
    console.log(`  ➜ MIDI Sequencer: http://localhost:${port}/midi-sequencer.html`);
    console.log(`  ➜ POley Player:   http://localhost:${port}/POleyPlayer.html`);
    console.log(`  ➜ Turing Machine: http://localhost:${port}/turing-machine.html`);
    console.log(`  ➜ AuraGrain MKII: http://localhost:${port}/auragrain.html`);
    console.log(`  ➜ Audio Engine:   http://localhost:${port}/audio.html`);
    console.log(`  ➜ Visuals:        http://localhost:${port}/visuals.html\n`);
  });
}

start().catch(console.error);
