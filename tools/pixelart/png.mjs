import zlib from 'node:zlib';

/** Codificador PNG mínimo (RGBA8). Sem dependências — usa só o zlib do Node. */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Canvas RGBA simples com API de pixel art. */
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4); // tudo transparente
  }

  /** cor: '#rrggbb' ou '#rrggbbaa' ou null (não desenha) */
  px(x, y, color) {
    if (!color) return;
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b, a] = parseColor(color);
    const i = (y * this.width + x) * 4;
    if (a === 255) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
      return;
    }
    // alpha blend sobre o que já existe
    const da = this.data[i + 3] / 255;
    const sa = a / 255;
    const out = sa + da * (1 - sa);
    if (out === 0) return;
    this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / out);
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / out);
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / out);
    this.data[i + 3] = Math.round(out * 255);
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color);
  }

  /** retângulo só de contorno */
  stroke(x, y, w, h, color) {
    for (let i = 0; i < w; i++) { this.px(x + i, y, color); this.px(x + i, y + h - 1, color); }
    for (let j = 0; j < h; j++) { this.px(x, y + j, color); this.px(x + w - 1, y + j, color); }
  }

  /** retângulo com cantos removidos — dá o arredondado típico de pixel art */
  roundRect(x, y, w, h, color) {
    this.rect(x, y, w, h, color);
    this.px(x, y, null);
    this.clear(x, y);
    this.clear(x + w - 1, y);
    this.clear(x, y + h - 1);
    this.clear(x + w - 1, y + h - 1);
  }

  clear(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (Math.round(y) * this.width + Math.round(x)) * 4;
    this.data[i + 3] = 0;
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, color);
      }
    }
  }

  /** copia outro canvas nesta posição */
  blit(src, dx, dy) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4;
        if (src.data[i + 3] === 0) continue;
        const o = ((dy + y) * this.width + (dx + x)) * 4;
        if (dx + x < 0 || dy + y < 0 || dx + x >= this.width || dy + y >= this.height) continue;
        this.data[o] = src.data[i];
        this.data[o + 1] = src.data[i + 1];
        this.data[o + 2] = src.data[i + 2];
        this.data[o + 3] = src.data[i + 3];
      }
    }
  }

  toPNG() {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type RGBA
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    // scanlines com filtro 0
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    let p = 0;
    for (let y = 0; y < this.height; y++) {
      raw[p++] = 0;
      for (let x = 0; x < this.width * 4; x++) raw[p++] = this.data[y * this.width * 4 + x];
    }
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function parseColor(c) {
  const h = c.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255,
  ];
}
