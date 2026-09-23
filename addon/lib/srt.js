// Minimal SRT parse and serialize helpers shared by the subtitle pipeline.

const TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/;

export function parseSrt(text) {
  const blocks = [];
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;

    let indexValue = null;
    const indexCandidate = lines[i].trim();
    if (/^\d+$/.test(indexCandidate)) {
      indexValue = Number(indexCandidate);
      i++;
    }

    if (i >= lines.length) break;
    const timestamp = lines[i];
    if (!timestamp.includes('-->')) {
      i++;
      continue;
    }
    i++;

    const textLines = [];
    while (i < lines.length && lines[i].trim()) {
      textLines.push(lines[i]);
      i++;
    }

    blocks.push({
      index: indexValue ?? blocks.length + 1,
      timestamp: timestamp.trim(),
      text: textLines.join('\n'),
    });
  }

  return blocks;
}

export function serializeSrt(blocks) {
  return blocks
    .map((block, idx) => `${idx + 1}\n${block.timestamp}\n${block.text}\n`)
    .join('\n');
}

/**
 * Parse "HH:MM:SS,mmm --> HH:MM:SS,mmm" into start and end milliseconds.
 * Returns null when the line is not a usable timestamp pair.
 */
export function parseTimestampRange(timestamp) {
  const parts = String(timestamp || '').split('-->');
  if (parts.length !== 2) return null;
  const start = parseTimestamp(parts[0]);
  const end = parseTimestamp(parts[1]);
  if (start == null || end == null) return null;
  return { start, end };
}

export function formatTimestampRange(start, end) {
  return `${formatTimestamp(start)} --> ${formatTimestamp(end)}`;
}

function parseTimestamp(value) {
  // Ignore SRT position hints such as "X1:100 X2:200" that some tools append.
  const token = String(value || '').trim().split(/\s+/)[0];
  const match = token.match(TIMESTAMP);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms.padEnd(3, '0'));
}

function formatTimestamp(ms) {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(millis).padStart(3, '0')}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}
