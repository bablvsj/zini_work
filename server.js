// 本地开发服务器 - 双击 start.bat 启动
// 注意：Vercel 部署不需要这个文件，Vercel 用 api/* 下的 serverless functions
// 本地服务器通过 require api/*.js 复用同一套逻辑，避免代码重复

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const storage = require('./lib/storage');

const PORT = 8888;
const ROOT = __dirname;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 模拟 Vercel 的 req.query
  req.query = Object.fromEntries(url.searchParams.entries());

  // 静态文件
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile('public/index.html', 'text/html', res);
  }
  if (pathname === '/tasks.js') {
    return serveFile('tasks.js', 'application/javascript', res);
  }
  if (pathname === '/favicon.ico') {
    res.writeHead(204); res.end(); return;
  }

  // API 路由 - 复用 Vercel function 文件
  if (pathname === '/api/tasks') {
    return wrapBody(req, res, require('./api/tasks'));
  }
  const taskMatch = pathname.match(/^\/api\/tasks\/(T\d+)$/);
  if (taskMatch) {
    req.query.id = taskMatch[1];
    return wrapBody(req, res, require('./api/tasks/[id]'));
  }
  if (pathname === '/api/scan') {
    return wrapBody(req, res, require('./api/scan'));
  }

  res.writeHead(404);
  res.end('Not found');
});

function serveFile(relPath, type, res) {
  fs.readFile(path.join(ROOT, relPath), (err, data) => {
    if (err) { res.writeHead(404); res.end('File not found: ' + relPath); return; }
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
    res.end(data);
  });
}

// 包装 req.body（Vercel 自动 parse，本地需要手动）
function wrapBody(req, res, handler) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { req.body = body ? JSON.parse(body) : {}; }
      catch (e) { req.body = {}; }
      // 模拟 Vercel res.json / res.status
      patchRes(res);
      handler(req, res);
    });
  } else {
    req.body = {};
    patchRes(res);
    handler(req, res);
  }
}

// 把 Vercel 风格的 res.status().json() 加到 Node 原生 res 上
function patchRes(res) {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(obj) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
}

server.listen(PORT, () => {
  console.log('');
  console.log('============================================');
  console.log('  WorkTracker 工作追踪看板');
  console.log('  访问地址: http://localhost:' + PORT);
  console.log('  数据模式: ' + (storage.USE_SUPABASE ? 'Supabase 云端' : '本地文件 tasks.js'));
  console.log('  关闭此窗口即可停止服务');
  console.log('============================================');
  console.log('');
  // 自动打开浏览器
  const cmd = process.platform === 'win32'
    ? `start "" "http://localhost:${PORT}"`
    : `open "http://localhost:${PORT}"`;
  exec(cmd);
});
