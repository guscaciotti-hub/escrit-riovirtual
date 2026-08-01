import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const DIST = resolve(__dirname, '..', 'dist');
const OUT = resolve(__dirname, '..', 'preview-standalone.html');

const assets = readdirSync(`${DIST}/assets`);
const jsName = assets.find((f) => f.endsWith('.js'));
const cssName = assets.find((f) => f.endsWith('.css'));

const css = readFileSync(`${DIST}/assets/${cssName}`, 'utf8');
const tmj = readFileSync(`${DIST}/assets/maps/office.tmj`, 'utf8');
const rawJs = readFileSync(`${DIST}/assets/${jsName}`, 'utf8');

// Bulletproof: o bundle vira base64 (só [A-Za-z0-9+/=]), impossível conter
// qualquer sequência que feche o <script>. Decodifica e executa como módulo.
const b64 = Buffer.from(rawJs, 'utf8').toString('base64');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Escritório Virtual · Evoluze</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__OFFICE_MAP__ = ${tmj};</script>
<script>
(function () {
  var b64 = "${b64}";
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var src = new TextDecoder('utf-8').decode(bytes);
  var s = document.createElement('script');
  s.type = 'module';
  s.textContent = src;
  document.body.appendChild(s);
})();
</script>
</body>
</html>`;

writeFileSync(OUT, html);
console.log('OK ->', OUT, (Buffer.byteLength(html) / 1024 / 1024).toFixed(2), 'MB');
