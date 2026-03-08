import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';
import yauzl from 'yauzl';

const pipeline = promisify(stream.pipeline);

const IFMT = 0xf000;
const IFDIR = 0x4000;
const IFLNK = 0xa000;

function entryMode(entry: yauzl.Entry): number {
  return (entry.externalFileAttributes >> 16) & 0xffff;
}

function isDirectoryEntry(entry: yauzl.Entry): boolean {
  const mode = entryMode(entry);
  if ((mode & IFMT) === IFDIR) return true;
  return entry.fileName.endsWith('/');
}

function isSymlinkEntry(entry: yauzl.Entry): boolean {
  const mode = entryMode(entry);
  return (mode & IFMT) === IFLNK;
}

function shouldSkipEntry(entry: yauzl.Entry): boolean {
  const normalized = entry.fileName.replace(/\\/g, '/');
  if (normalized.startsWith('__MACOSX/')) return true;
  if (normalized.includes('/node_modules/')) return true;
  if (normalized.startsWith('node_modules/')) return true;
  return false;
}

export async function safeExtractZip(zipPath: string, targetDir: string): Promise<void> {
  await fs.promises.mkdir(targetDir, { recursive: true });
  const realTargetDir = await fs.promises.realpath(targetDir);
  const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, handle) => {
      if (err || !handle) reject(err ?? new Error('Failed to open zip file'));
      else resolve(handle);
    });
  });

  await new Promise<void>((resolve, reject) => {
    let finished = false;

    function done(err?: Error) {
      if (finished) return;
      finished = true;
      zipfile.close();
      if (err) reject(err);
      else resolve();
    }

    zipfile.on('error', done);
    zipfile.on('end', () => done());
    zipfile.on('entry', entry => {
      void (async () => {
        try {
          if (shouldSkipEntry(entry) || isSymlinkEntry(entry)) {
            zipfile.readEntry();
            return;
          }

          const destination = path.resolve(realTargetDir, entry.fileName);
          const relative = path.relative(realTargetDir, destination);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error(`Out of bounds zip entry: ${entry.fileName}`);
          }

          if (isDirectoryEntry(entry)) {
            await fs.promises.mkdir(destination, { recursive: true });
            zipfile.readEntry();
            return;
          }

          await fs.promises.mkdir(path.dirname(destination), { recursive: true });
          zipfile.openReadStream(entry, async (err, readStream) => {
            if (err || !readStream) {
              done(err ?? new Error(`Failed to open zip entry: ${entry.fileName}`));
              return;
            }

            try {
              await pipeline(readStream, fs.createWriteStream(destination));
              zipfile.readEntry();
            } catch (streamErr) {
              done(streamErr as Error);
            }
          });
        } catch (err) {
          done(err as Error);
        }
      })();
    });

    zipfile.readEntry();
  });
}
