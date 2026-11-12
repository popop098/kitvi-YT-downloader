import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'kitvi-plugin.json'), 'utf8'));
if (manifest.apiVersion !== 1 || !/^[a-z][a-z0-9.-]+$/.test(manifest.id) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid plugin manifest.');
const files = ['kitvi-plugin.json', 'kitvi-sdk.js', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];
async function visit(relative) {
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not supported: ${entry.name}`);
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported entry: ${path}`);
  }
}
await visit('ui');
const table = new Uint32Array(256);
for (let index = 0; index < 256; index++) { let value = index; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; table[index] = value >>> 0; }
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = table[(value ^ byte) & 255] ^ value >>> 8; return (value ^ 0xffffffff) >>> 0; }
const bodies = []; const directory = []; let offset = 0; let expanded = 0;
for (const path of files) {
  if (path.includes('..') || path.startsWith('/') || path.includes('\\') || /\.(?:exe|dll|node)$/i.test(path)) throw new Error(`Disallowed package path: ${path}`);
  const name = Buffer.from(path); const data = await readFile(join(root, path)); const compressed = deflateRawSync(data, { level: 9 }); expanded += data.length;
  if (data.length > (/\.(woff2?|ttf|otf)$/i.test(path) ? 2 : 4) * 1024 * 1024) throw new Error(`Plugin file is too large: ${path}`);
  const checksum = crc32(data); const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12); header.writeUInt32LE(checksum, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
  bodies.push(header, name, compressed);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); directory.push(central, name);
  offset += header.length + name.length + compressed.length;
}
if (expanded > 16 * 1024 * 1024 || files.length > 256) throw new Error('Plugin package limit exceeded.');
const central = Buffer.concat(directory); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...bodies, central, end]); if (archive.length > 16 * 1024 * 1024) throw new Error('Plugin ZIP limit exceeded.');
const filename = `kitvi-YT-downloader-${manifest.version}.kitvi-plugin.zip`;
await mkdir(join(root, 'dist'), { recursive: true }); await writeFile(join(root, 'dist', filename), archive);
const hash = createHash('sha256').update(archive).digest('hex'); await writeFile(join(root, 'dist', 'SHA256SUMS.txt'), `${hash}  ${filename}\n`);
console.log(`${filename}\n${archive.length} bytes · ${files.length} files\nSHA256 ${hash}`);
