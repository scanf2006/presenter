function buildSongBackgroundFromSong(song) {
  if (!song?.backgroundType || !song?.backgroundPath) return null;
  return {
    type: song.backgroundType,
    path: song.backgroundPath,
    name: song.backgroundPath.split(/[\\/]/).pop() || 'Background',
  };
}

function mergeSongWithBackground(song, background) {
  if (!song) return null;
  return {
    ...song,
    backgroundType: background?.type || '',
    backgroundPath: background?.path || '',
  };
}

function buildSongSaveInput(song) {
  if (!song) return null;
  return {
    id: song.id,
    title: song.title || '',
    author: song.author || '',
    lyrics: song.lyrics || '',
    backgroundType: song.backgroundType || '',
    backgroundPath: song.backgroundPath || '',
  };
}

function buildSongBackgroundForPayload(background) {
  if (!background?.type || !background?.path) return null;
  return {
    type: background.type,
    path: background.path,
  };
}

function buildSongQueuePayload({ song, background = null, section = null, sectionIndex = null }) {
  if (!song) return null;
  return {
    type: 'song',
    songId: song.id,
    songTitle: song.title,
    background: buildSongBackgroundForPayload(background),
    lastSectionIndex: Number.isFinite(sectionIndex) ? sectionIndex : null,
    lastSectionTitle: section?.title || '',
    lastSectionTag: section?.tag || '',
  };
}

function parseSongLyricsSections(lyrics) {
  if (!lyrics) return [];

  // compatibility: historical data may store literal "\n"
  const normalized = lyrics.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const hasMarkers = lines.some((line) => /^\s*\[(V\d*|C|B|P|E)\]/i.test(line.trim()));

  // No marker mode: split sections by blank lines.
  if (!hasMarkers) {
    const blocks = normalized
      .split(/\n\s*\n+/)
      .map((block) =>
        block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      )
      .filter((block) => block.length > 0);

    // If only one large paragraph, auto-split every 4 lines for easier projection.
    if (blocks.length === 1 && blocks[0].length > 4) {
      const single = blocks[0];
      const autoBlocks = [];
      for (let i = 0; i < single.length; i += 4) {
        autoBlocks.push(single.slice(i, i + 4));
      }
      return autoBlocks.map((block, index) => ({
        tag: `A${index + 1}`,
        title: `Section ${index + 1}`,
        lines: block,
      }));
    }

    return blocks.map((block, index) => ({
      tag: `A${index + 1}`,
      title: `Section ${index + 1}`,
      lines: block,
    }));
  }

  // Marker mode: supports [V1]/[C]/[B]/[P]/[E]
  const sections = [];
  let currentSection = { tag: '', title: 'Section 1', lines: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const tagMatch = line.match(/^\[(V\d*|C|B|P|E)\](.*)$/i);

    if (tagMatch) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }

      const tag = tagMatch[1].toUpperCase();
      const extra = tagMatch[2] ? tagMatch[2].trim() : '';
      let title;
      if (tag.startsWith('V')) title = `Verse ${tag.substring(1) || ''}`.trim();
      else if (tag === 'C') title = 'Chorus';
      else if (tag === 'B') title = 'Bridge';
      else if (tag === 'P') title = 'Intro';
      else if (tag === 'E') title = 'Outro';
      else title = tag;
      if (extra) title += ` ${extra}`;

      currentSection = { tag, title: title.trim(), lines: [] };
    } else if (line) {
      currentSection.lines.push(line);
    }
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function decodeLyricsImportBytes(bytes) {
  let content = '';
  try {
    content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (_) {
    content = '';
  }

  // If replacement char appears, retry with GB18030
  if (content.includes('\ufffd')) {
    try {
      content = new TextDecoder('gb18030', { fatal: false }).decode(bytes);
    } catch (_) {
      // ignore fallback failure, keep UTF-8 result
    }
  }

  return content;
}

function deriveSongTitleFromImportFile(fileName = '') {
  return String(fileName).replace(/\.(txt|lrc)$/i, '');
}

export {
  buildSongBackgroundFromSong,
  mergeSongWithBackground,
  buildSongSaveInput,
  buildSongBackgroundForPayload,
  buildSongQueuePayload,
  parseSongLyricsSections,
  decodeLyricsImportBytes,
  deriveSongTitleFromImportFile,
};
