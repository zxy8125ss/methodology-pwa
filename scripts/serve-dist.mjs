/**
 * 静态预览服务器 —— 用于本地验证构建产物，也可作为 sites 部署的启动命令
 *
 * 用法：npm run preview:server
 * 或：node scripts/serve-dist.mjs
 */

import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const ROOT = resolve(process.cwd(), process.env.SERVE_DIR ?? 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function resolveFile(pathname) {
  // 去掉查询串与哈希
  const clean = decodeURIComponent(pathname.split('?')[0].split('#')[0]);
  const safe = normalizePath(clean);

  const candidates = safe.endsWith('/')
    ? [join(ROOT, safe, 'index.html')]
    : [join(ROOT, safe), join(ROOT, `${safe}.html`), join(ROOT, safe, 'index.html')];

  for (const candidate of candidates) {
    if (!candidate.startsWith(ROOT)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* 继续尝试下一个候选 */
    }
  }
  return null;
}

/** 归一化路径，阻止 ../ 穿越 */
function normalizePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const safe = [];
  for (const part of parts) {
    if (part === '..') {
      safe.pop();
    } else if (part !== '.') {
      safe.push(part);
    }
  }
  return `/${safe.join('/')}`;
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  let file = await resolveFile(url);

  // SPA 回退：非静态资源路径一律返回 index.html
  if (!file) {
    const ext = extname(url.split('?')[0]);
    if (!ext) {
      file = join(ROOT, 'index.html');
    }
  }

  if (!file) {
    // dist 缺失或路径未命中：返回诊断信息而非 404，
    // 便于部署环境判断是构建失败还是路由问题
    const diag = await diagnose();
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(diag);
    return;
  }

  try {
    const data = await readFile(file);
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(data);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Error');
  }
});

/** 生成诊断信息，列出 dist 目录实际内容 */
async function diagnose() {
  const lines = [
    '方法论 PWA 静态服务已启动',
    `服务目录：${ROOT}`,
    `请求路径：${'${new URL(serverAddress).pathname}'}`,
    '',
    'dist 目录内容：',
  ];
  try {
    const entries = await readdir(ROOT, { withFileTypes: true });
    for (const entry of entries.slice(0, 50)) {
      lines.push(`  ${entry.isDirectory() ? '[dir] ' : '[file]'} ${entry.name}`);
    }
    if (entries.length === 0) {
      lines.push('  （空目录 —— 构建未成功，请检查构建日志）');
    }
  } catch (err) {
    lines.push(`  读取失败：${err instanceof Error ? err.message : String(err)}`);
  }
  return lines.join('\n');
}

const serverAddress = 'http://localhost';

server.listen(PORT, HOST, () => {
  console.log(`静态预览服务器已启动：http://${HOST}:${PORT}`);
  console.log(`服务目录：${ROOT}`);
});
