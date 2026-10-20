import { close, createReadStream, createWriteStream, fstat, open, read } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { stripBom } from '@shared/logger';

/**
 * Lazy zip access for BeamNG content. Official zips are huge (common.zip is
 * ~4.5 GB, zip64), so we only ever read the central directory and stream the
 * entries we need — never load a whole archive into memory.
 */

export interface ZipEntryInfo {
  name: string;
  size: number;
  compressedSize: number;
}

/** The zip's tail held in memory: the central directory lives there (4,457 entries of the game's common.zip fit in 1 MB). */
const TAIL_BYTES = 16 * 1024 * 1024;

/**
 * yauzl reads the central directory two small reads per entry. In Electron's main process each
 * read answers a few milliseconds late (the game's 0.40 common.zip took 13 s to list, and the
 * wheel and horn lists came up empty), so the tail is read once and served from memory.
 */
class TailReader extends yauzl.RandomAccessReader {
  // A plain descriptor: a promises-API FileHandle closes itself when it is collected.
  constructor(
    private readonly path: string,
    private readonly fd: number,
    private readonly size: number,
    private readonly tail: Buffer,
  ) {
    super();
  }
  // Each entry stream opens the file itself: a stream on the shared descriptor closed it when piped.
  override _readStreamForRange(start: number, end: number): Readable {
    return createReadStream(this.path, { start, end: end - 1 });
  }
  override read(buffer: Buffer, offset: number, length: number, position: number, callback: (err: Error | null) => void): void {
    const tailStart = this.size - this.tail.length;
    if (position >= tailStart && position + length <= this.size) {
      this.tail.copy(buffer, offset, position - tailStart, position - tailStart + length);
      process.nextTick(callback, null);
      return;
    }
    read(this.fd, buffer, offset, length, position, (err) => callback(err));
  }
  // yauzl closes the reader when its last stream ends; the descriptor stays open until the ZipReader closes.
  override close(callback: (err: Error | null) => void): void {
    callback(null);
  }
}

export class ZipReader {
  private entryMap: Promise<Map<string, Entry>> | null = null;

  private constructor(
    private readonly zip: ZipFile,
    readonly path: string,
    private readonly fd: number,
  ) {}

  static async open(path: string): Promise<ZipReader> {
    const fd = await new Promise<number>((res, rej) => open(path, 'r', (err, n) => (err ? rej(err) : res(n))));
    const size = await new Promise<number>((res, rej) => fstat(fd, (err, s) => (err ? rej(err) : res(s.size))));
    const tail = Buffer.alloc(Math.min(size, TAIL_BYTES));
    await new Promise<void>((res, rej) => read(fd, tail, 0, tail.length, size - tail.length, (err) => (err ? rej(err) : res())));
    return new Promise((res, rej) => {
      yauzl.fromRandomAccessReader(new TailReader(path, fd, size, tail), size, { lazyEntries: true, autoClose: false, decodeStrings: true }, (err, zip) => {
        if (err) rej(err);
        else res(new ZipReader(zip, path, fd));
      });
    });
  }

  /** All file entries (directories skipped), read once from the central directory. */
  async entries(): Promise<ZipEntryInfo[]> {
    const map = await this.load();
    return [...map.values()].map((e) => ({ name: e.fileName, size: e.uncompressedSize, compressedSize: e.compressedSize }));
  }

  async has(name: string): Promise<boolean> {
    return (await this.load()).has(name);
  }

  async stream(name: string): Promise<Readable> {
    const entry = (await this.load()).get(name);
    if (!entry) throw new Error(`Entry not found in ${this.path}: ${name}`);
    return this.zip.openReadStreamPromise(entry);
  }

  async readBuffer(name: string, maxBytes = 64 * 1024 * 1024): Promise<Buffer> {
    const entry = (await this.load()).get(name);
    if (!entry) throw new Error(`Entry not found in ${this.path}: ${name}`);
    if (entry.uncompressedSize > maxBytes) {
      throw new Error(`Entry ${name} is ${entry.uncompressedSize} bytes (limit ${maxBytes}); stream it instead`);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of await this.zip.openReadStreamPromise(entry)) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async readText(name: string, maxBytes?: number): Promise<string> {
    return stripBom((await this.readBuffer(name, maxBytes)).toString('utf8'));
  }

  /** Stream matching entries to `outDir`, preserving relative paths. Returns written paths. */
  async extract(filter: (name: string) => boolean, outDir: string, rename: (name: string) => string = (n) => n): Promise<string[]> {
    const written: string[] = [];
    for (const [name, entry] of await this.load()) {
      if (!filter(name)) continue;
      const dest = safeJoin(outDir, rename(name));
      await mkdir(dirname(dest), { recursive: true });
      await pipeline(await this.zip.openReadStreamPromise(entry), createWriteStream(dest));
      written.push(dest);
    }
    return written;
  }

  close(): void {
    this.zip.close();
    close(this.fd, () => undefined);
  }

  /**
   * Read the central directory once. The pending promise is cached, so
   * concurrent callers share one pass over yauzl's single entry cursor.
   */
  private load(): Promise<Map<string, Entry>> {
    this.entryMap ??= this.readCentralDirectory();
    return this.entryMap;
  }

  private readCentralDirectory(): Promise<Map<string, Entry>> {
    return new Promise((res, rej) => {
      const map = new Map<string, Entry>();
      const zip = this.zip;
      const cleanup = () => {
        zip.removeListener('entry', onEntry);
        zip.removeListener('end', onEnd);
        zip.removeListener('error', onError);
      };
      const onEntry = (e: Entry) => {
        if (!e.fileName.endsWith('/')) map.set(e.fileName, e);
        zip.readEntry();
      };
      const onEnd = () => {
        cleanup();
        res(map);
      };
      const onError = (err: Error) => {
        cleanup();
        rej(err);
      };
      zip.on('entry', onEntry);
      zip.once('end', onEnd);
      zip.once('error', onError);
      zip.readEntry();
    });
  }
}

/** Join an archive-relative path under `root`, refusing anything that would escape it. */
export function safeJoin(root: string, entryName: string): string {
  if (isAbsolute(entryName) || /^[A-Za-z]:/.test(entryName)) throw new Error(`Refusing absolute entry path: ${entryName}`);
  const base = resolve(root);
  const dest = resolve(join(base, entryName));
  const rel = relative(base, dest);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Refusing entry path outside target: ${entryName}`);
  return dest;
}

/** Open, use, always close. */
export async function withZip<T>(path: string, fn: (zip: ZipReader) => Promise<T>): Promise<T> {
  const zip = await ZipReader.open(path);
  try {
    return await fn(zip);
  } finally {
    zip.close();
  }
}
