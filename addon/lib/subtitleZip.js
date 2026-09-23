import zlib from 'zlib';
import { logger } from './logger.js';

// Legacy single-byte code pages that subtitle uploaders still use for
// languages that do not fit in Latin-1. Keyed by two-letter language code.
const LANGUAGE_CODEPAGES = {
  el: 'windows-1253',
  ru: 'windows-1251',
  uk: 'windows-1251',
  bg: 'windows-1251',
  sr: 'windows-1251',
  mk: 'windows-1251',
  tr: 'windows-1254',
  he: 'windows-1255',
  ar: 'windows-1256',
  fa: 'windows-1256',
  ur: 'windows-1256',
  pl: 'windows-1250',
  cs: 'windows-1250',
  sk: 'windows-1250',
  hu: 'windows-1250',
  ro: 'windows-1250',
  hr: 'windows-1250',
  sl: 'windows-1250',
  bs: 'windows-1250',
  sq: 'windows-1250',
  th: 'windows-874',
  vi: 'windows-1258',
  lt: 'windows-1257',
  lv: 'windows-1257',
  et: 'windows-1257',
  zh: 'gb18030',
  ja: 'shift_jis',
  ko: 'euc-kr',
};

const DEFAULT_CODEPAGE = 'windows-1252';

export function extractSrtFromZip(buffer, languageHint = null) {
  const entries = readCentralDirectory(buffer) ?? readLocalHeaders(buffer);
  if (!entries?.length) return null;

  const srtEntries = entries
    .filter(entry => /\.srt$/i.test(entry.filename))
    .sort((a, b) => b.uncompressedSize - a.uncompressedSize);

  for (const entry of srtEntries) {
    const data = readEntryData(buffer, entry);
    if (!data) continue;
    return decodeSubtitleText(data, languageHint);
  }

  return null;
}

/**
 * Decode raw subtitle bytes to a string.
 *
 * Order: UTF-16 BOM, then strict UTF-8 (with or without BOM), then the legacy
 * code page for the language the subtitle was listed under, then Windows-1252.
 * The old behaviour (fall back to latin1) turned Greek, Cyrillic, Turkish and
 * similar single-byte files into mojibake that players could no longer repair,
 * because the re-encoded output was valid UTF-8 of the wrong characters.
 */
export function decodeSubtitleText(buffer, languageHint = null) {
  if (!buffer?.length) return '';

  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return stripBom(decodeWith(buffer, 'utf-16le') ?? buffer.toString('utf8'));
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      return stripBom(decodeWith(buffer, 'utf-16be') ?? buffer.toString('utf8'));
    }
  }

  const utf8 = decodeWith(buffer, 'utf-8', { fatal: true });
  if (utf8 != null) return stripBom(utf8);

  const codepage = codepageForLanguage(languageHint);
  const legacy = decodeWith(buffer, codepage) ?? decodeWith(buffer, DEFAULT_CODEPAGE);
  if (legacy != null) return stripBom(legacy);

  return stripBom(buffer.toString('latin1'));
}

export function codepageForLanguage(languageHint) {
  const code = String(languageHint || '').trim().toLowerCase().slice(0, 2);
  return LANGUAGE_CODEPAGES[code] || DEFAULT_CODEPAGE;
}

function decodeWith(buffer, encoding, options = {}) {
  try {
    return new TextDecoder(encoding, { ...options, ignoreBOM: true }).decode(buffer);
  } catch {
    return null;
  }
}

function readCentralDirectory(buffer) {
  const eocdOffset = findEocdOffset(buffer);
  if (eocdOffset < 0) return null;

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (cdOffset + cdSize > buffer.length) return null;

  const entries = [];
  let offset = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const filename = buffer
      .slice(offset + 46, offset + 46 + filenameLen)
      .toString('utf8');

    entries.push({
      filename,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + filenameLen + extraLen + commentLen;
  }

  return entries;
}

function findEocdOffset(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function readLocalHeaders(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;

    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const filenameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const filename = buffer
      .slice(offset + 30, offset + 30 + filenameLen)
      .toString('utf8');

    const dataStart = offset + 30 + filenameLen + extraLen;
    if (!compressedSize) return entries.length ? entries : null;

    entries.push({
      filename,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset: offset,
      dataStart,
    });

    offset = dataStart + compressedSize;
  }
  return entries;
}

function readEntryData(buffer, entry) {
  let dataStart = entry.dataStart;

  if (dataStart == null) {
    const headerOffset = entry.localHeaderOffset;
    if (headerOffset + 30 > buffer.length) return null;
    if (buffer.readUInt32LE(headerOffset) !== 0x04034b50) return null;

    const filenameLen = buffer.readUInt16LE(headerOffset + 26);
    const extraLen = buffer.readUInt16LE(headerOffset + 28);
    dataStart = headerOffset + 30 + filenameLen + extraLen;
  }

  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) return null;
  const compressed = buffer.slice(dataStart, dataEnd);

  try {
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return zlib.inflateRawSync(compressed);
  } catch (err) {
    logger.warn(`Zip inflate failed: ${err.message}`);
  }
  return null;
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
