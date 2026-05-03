const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const iconv = require('iconv-lite');

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function textReadabilityScore(text = '') {
  const value = String(text || '');
  if (!value) return -Infinity;
  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  const cjkCount = (value.match(/[\p{Script=Han}]/gu) || []).length;
  const latinCount = (value.match(/[A-Za-z0-9]/g) || []).length;
  return cjkCount * 2 + latinCount - replacementCount * 40;
}

function isLikelyReadableTitle(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  const cleaned = value.replace(/[^\p{Script=Han}\p{L}\p{N}\s[\]【】()（）\-_,.'":!?]/gu, '');
  return cleaned.length >= Math.max(2, Math.floor(value.length * 0.45));
}

function repairUtf8DecodedAsGbk(text = '') {
  const value = String(text || '');
  if (!value) return '';
  try {
    const gbBytes = iconv.encode(value, 'gb18030');
    const fixed = gbBytes.toString('utf8');
    return textReadabilityScore(fixed) > textReadabilityScore(value) ? fixed : value;
  } catch (_) {
    return value;
  }
}

function requestBuffer(urlString, options = {}, bodyBuffer = null) {
  return new Promise((resolve, reject) => {
    const target = new URL(urlString);
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(
      target,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

function decodeHtmlBuffer(htmlBuf) {
  if (!Buffer.isBuffer(htmlBuf) || htmlBuf.length === 0) return '';
  const probe = htmlBuf.toString('latin1', 0, Math.min(htmlBuf.length, 4096));
  const utf8Text = htmlBuf.toString('utf8');
  const big5Text = iconv.decode(htmlBuf, 'big5');
  const gbText = iconv.decode(htmlBuf, 'gb18030');
  const charsetMatch = probe.match(/charset\s*=\s*["']?\s*([a-zA-Z0-9_-]+)/i);
  const charset = String(charsetMatch?.[1] || '').toLowerCase();
  const byMeta =
    charset.includes('utf-8') || charset.includes('utf8')
      ? utf8Text
      : charset.includes('big5') || charset.includes('cp950')
        ? big5Text
        : charset.includes('gb') || charset.includes('gbk') || charset.includes('gb2312')
          ? gbText
          : big5Text;
  const candidates = [byMeta, utf8Text, big5Text, gbText];
  return candidates.sort((a, b) => textReadabilityScore(b) - textReadabilityScore(a))[0] || byMeta;
}

function stripHtmlToText(html = '') {
  return decodeHtmlEntities(String(html))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function isBlockedBlogLikeTitle(title = '') {
  const t = String(title || '');
  return /新浪|博客|blog|sina/i.test(t);
}

let hymnCatalogCache = {
  loadedAt: 0,
  items: [],
};

function normalizeTextForSearch(input = '') {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[【】[\]()（）\-_,.'":!?，。！？；：]/g, '');
}

function buildZhVariants(keyword = '') {
  const pairs = [
    ['圣', '聖'],
    ['诗', '詩'],
    ['赞', '讚'],
    ['灵', '靈'],
    ['爱', '愛'],
    ['国', '國'],
    ['乐', '樂'],
    ['门', '門'],
    ['风', '風'],
    ['云', '雲'],
    ['复', '復'],
    ['义', '義'],
    ['启', '啟'],
    ['汉', '漢'],
  ];
  const variants = new Set([String(keyword || '')]);
  for (const [s, t] of pairs) {
    const next = new Set();
    for (const v of variants) {
      if (v.includes(s)) next.add(v.split(s).join(t));
      if (v.includes(t)) next.add(v.split(t).join(s));
    }
    for (const v of next) variants.add(v);
  }
  return [...variants].map((v) => v.trim()).filter(Boolean);
}

function absolutizeChristianStudyUrl(urlPath = '') {
  const raw = String(urlPath || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `http://www.christianstudy.com${raw}`;
  return `http://www.christianstudy.com/${raw}`;
}

async function buildChristianStudyHymnCatalog() {
  const now = Date.now();
  if (now - hymnCatalogCache.loadedAt < 30 * 60 * 1000 && hymnCatalogCache.items.length) {
    return hymnCatalogCache.items;
  }

  const indexBuf = await requestBuffer('http://www.christianstudy.com/hymns.html');
  const indexHtml = decodeHtmlBuffer(indexBuf);
  const pageSet = new Set();
  const optionRe = /<option[^>]*value="([^"]+hymns[^"]+\.html?)"[^>]*>/gi;
  let optionMatch = null;
  while ((optionMatch = optionRe.exec(indexHtml))) {
    const p = String(optionMatch[1] || '').trim();
    if (!p) continue;
    if (!/^hymns_[a-z0-9_]+\.html?$/i.test(p)) continue;
    pageSet.add(p);
  }
  // Safety fallback for common buckets if option parsing fails.
  if (!pageSet.size) {
    for (let i = 1; i <= 26; i += 1) pageSet.add(`hymns_stroke_${i}.html`);
    for (const c of 'abcdefghijklmnopqrstuvwxyz'.split('')) pageSet.add(`hymns_${c}.html`);
  }

  const items = [];
  for (const page of pageSet) {
    try {
      const pageBuf = await requestBuffer(absolutizeChristianStudyUrl(page));
      const pageHtml = decodeHtmlBuffer(pageBuf);
      const rowRe = /<tr>[\s\S]*?<\/tr>/gi;
      let rowMatch = null;
      while ((rowMatch = rowRe.exec(pageHtml))) {
        const rowHtml = rowMatch[0];
        const linkMatch = rowHtml.match(
          /<td[^>]*>\s*<a[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/td>/i
        );
        if (!linkMatch) continue;
        const url = absolutizeChristianStudyUrl(linkMatch[1]);
        if (!/^https?:\/\/www\.christianstudy\.com\/data\/hymns\/text\//i.test(url)) continue;
        const title = repairUtf8DecodedAsGbk(
          decodeHtmlEntities(String(linkMatch[2] || '').replace(/<[^>]+>/g, ' '))
        )
          .replace(/\s+/g, ' ')
          .trim();
        if (!title || isBlockedBlogLikeTitle(title)) continue;
        items.push({ title, url });
      }
    } catch (_) {
      // skip broken page
    }
  }

  const dedup = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.url}|${item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(item);
  }

  hymnCatalogCache = {
    loadedAt: now,
    items: dedup,
  };
  return dedup;
}

async function searchChristianStudyHymns(keyword) {
  const terms = String(keyword || '').trim();
  if (!terms) return [];
  const payload = `terms=${encodeURIComponent(terms)}&boolean=AND&case=Insensitive`;
  const bodyUtf8 = Buffer.from(payload, 'utf8');
  const htmlBuf = await requestBuffer(
    'http://www.christianstudy.com/cgi-bin/searchhymn.cgi',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': String(bodyUtf8.length),
      },
    },
    bodyUtf8
  );
  const html = decodeHtmlBuffer(htmlBuf);
  const olMatch = html.match(/<ol>([\s\S]*?)<\/ol>/i);
  const listHtml = olMatch?.[1] || '';
  const candidates = [];
  const linkRe = /<a\s+href\s*=\s*["']?([^"'\s>]+)["']?\s*>([\s\S]*?)<\/a>/gi;
  let match = null;
  while ((match = linkRe.exec(listHtml)) && candidates.length < 50) {
    const url = String(match[1] || '').trim();
    const title = repairUtf8DecodedAsGbk(decodeHtmlEntities(match[2] || '').trim());
    if (!url || !title) continue;
    if (!/^https?:\/\/www\.christianstudy\.com\/data\/hymns\/text\//i.test(url)) continue;
    candidates.push({ title, url });
  }

  const verified = [];
  for (const item of candidates.slice(0, 20)) {
    try {
      const pageBuf = await requestBuffer(item.url);
      const pageHtml = decodeHtmlBuffer(pageBuf);
      const titleMatch = pageHtml.match(/<title>\s*([^<]+)\s*<\/title>/i);
      const pageTitle = repairUtf8DecodedAsGbk(decodeHtmlEntities(titleMatch?.[1] || ''))
        .replace(/[【】]/g, '')
        .trim();
      const hasHymnBody = /<font[^>]*size=\+2[^>]*>/i.test(pageHtml);
      if (!hasHymnBody) continue;
      if (!isLikelyReadableTitle(pageTitle)) continue;
      if (isBlockedBlogLikeTitle(pageTitle)) continue;
      verified.push({ title: pageTitle, url: item.url });
    } catch (_) {
      // skip bad entry
    }
  }
  return verified;
}

async function searchChristianStudyBySiteQuery(keyword) {
  const terms = String(keyword || '').trim();
  if (!terms) return [];
  const catalog = await buildChristianStudyHymnCatalog();
  const variants = buildZhVariants(terms).map((v) => normalizeTextForSearch(v));
  const hit = catalog.filter((item) => {
    const titleNorm = normalizeTextForSearch(item.title);
    return variants.some((v) => v && titleNorm.includes(v));
  });
  return hit.slice(0, 80);
}

async function fetchChristianStudyHymnLyrics(sourceUrl, options = {}) {
  const allowBlogMirror = options?.allowBlogMirror === true;
  const safeUrl = String(sourceUrl || '').trim();
  if (!safeUrl) return { title: '', lyrics: '' };
  const isStrictHymnPath = /^https?:\/\/www\.christianstudy\.com\/data\/hymns\/text\//i.test(safeUrl);
  const isChristianStudyDomain = /^https?:\/\/(www\.)?christianstudy\.com\//i.test(safeUrl);
  const isSinaBlogDomain = /^https?:\/\/blog\.sina\.com\.cn\//i.test(safeUrl);
  if (!allowBlogMirror && !isStrictHymnPath) {
    return { title: '', lyrics: '' };
  }
  if (allowBlogMirror && !isChristianStudyDomain && !isSinaBlogDomain) {
    return { title: '', lyrics: '' };
  }
  const htmlBuf = await requestBuffer(safeUrl);
  const html = decodeHtmlBuffer(htmlBuf);
  // Hard guard: reject redirected/non-hymn payloads (e.g. external blog pages).
  const hasHymnBody = /<font[^>]*size=\+2[^>]*>/i.test(html);
  const isLikelyExternalBlog = /blog\.sina\.com\.cn|新浪BLOG|博文目录/i.test(html);
  if (!allowBlogMirror && !hasHymnBody && isLikelyExternalBlog) {
    return { title: '', lyrics: '' };
  }
  const titleMatch = html.match(/<title>\s*([^<]+)\s*<\/title>/i);
  const title = repairUtf8DecodedAsGbk(decodeHtmlEntities(titleMatch?.[1] || ''))
    .replace(/[【】]/g, '')
    .trim();
  if (!allowBlogMirror && isBlockedBlogLikeTitle(title)) {
    return { title: '', lyrics: '' };
  }

  let lyricsBlock = '';
  const fontBlockMatch = html.match(/<font[^>]*size=\+2[^>]*>([\s\S]*?)<\/font>/i);
  if (fontBlockMatch?.[1]) {
    lyricsBlock = stripHtmlToText(fontBlockMatch[1]);
  } else {
    // Safe mode: no fallback-to-full-body. Force mode can import body text.
    if (allowBlogMirror) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      lyricsBlock = stripHtmlToText(bodyMatch?.[1] || '');
    } else {
      lyricsBlock = '';
    }
  }
  return { title, lyrics: lyricsBlock };
}

function registerBibleSongsIPC({ ipcMain, getBibleDb, getSongsDb, saveSongsDb }) {
  ipcMain.handle('bible-get-books', (_event, version) => {
    try {
      const db = getBibleDb(version);
      if (!db) return [];
      const result = db.exec(
        'SELECT SN, ShortName, FullName, ChapterNumber, NewOrOld FROM BibleID ORDER BY SN'
      );
      if (!result.length) return [];
      return result[0].values.map((row) => ({
        sn: row[0],
        shortName: row[1],
        fullName: row[2],
        chapterCount: row[3],
        isNewTestament: row[4] === 1,
      }));
    } catch (err) {
      console.error('[BibleIPC] bible-get-books error:', err?.message);
      return [];
    }
  });

  ipcMain.handle('bible-get-verses', (_event, version, bookSN, chapter) => {
    try {
      if (!Number.isFinite(bookSN) || !Number.isFinite(chapter)) return [];
      const db = getBibleDb(version);
      if (!db) return [];
      const result = db.exec(
        'SELECT VerseSN, Lection FROM Bible WHERE VolumeSN = ? AND ChapterSN = ? ORDER BY VerseSN',
        [bookSN, chapter]
      );
      if (!result.length) return [];
      return result[0].values.map((row) => ({ verse: row[0], text: row[1] }));
    } catch (err) {
      console.error('[BibleIPC] bible-get-verses error:', err?.message);
      return [];
    }
  });

  ipcMain.handle('bible-search', (_event, version, keyword) => {
    try {
      if (typeof keyword !== 'string' || !keyword.trim()) return [];
      const db = getBibleDb(version);
      if (!db) return [];
      const result = db.exec(
        `SELECT b.VolumeSN, b.ChapterSN, b.VerseSN, b.Lection, bi.ShortName, bi.FullName
         FROM Bible b JOIN BibleID bi ON b.VolumeSN = bi.SN
         WHERE b.Lection LIKE '%' || ? || '%'
         LIMIT 100`,
        [keyword]
      );
      if (!result.length) return [];
      return result[0].values.map((row) => ({
        bookSN: row[0],
        chapter: row[1],
        verse: row[2],
        text: row[3],
        shortName: row[4],
        fullName: row[5],
      }));
    } catch (err) {
      console.error('[BibleIPC] bible-search error:', err?.message);
      return [];
    }
  });

  ipcMain.handle('songs-list', () => {
    try {
      const songsDb = getSongsDb();
      if (!songsDb) return [];
      const result = songsDb.exec(
        'SELECT id, title, author, lyrics, background_type, background_path, created_at, updated_at FROM songs ORDER BY updated_at DESC'
      );
      if (!result.length) return [];
      return result[0].values.map((row) => ({
        id: row[0],
        title: row[1],
        author: row[2],
        lyrics: row[3],
        backgroundType: row[4] || '',
        backgroundPath: row[5] || '',
        createdAt: row[6],
        updatedAt: row[7],
      }));
    } catch (err) {
      console.error('[SongsIPC] songs-list error:', err?.message);
      return [];
    }
  });

  ipcMain.handle('songs-save', (_event, song) => {
    if (!song || typeof song !== 'object') return { success: false, error: 'Invalid song data.' };
    if (typeof song.title !== 'string' || !song.title.trim()) {
      return { success: false, error: 'Song title is required.' };
    }
    if (typeof song.lyrics !== 'string') {
      return { success: false, error: 'Song lyrics must be a string.' };
    }
    const songsDb = getSongsDb();
    if (!songsDb) return { success: false };
    try {
      if (song.id) {
        songsDb.run(
          "UPDATE songs SET title=?, author=?, lyrics=?, background_type=?, background_path=?, updated_at=strftime('%s','now') WHERE id=?",
          [
            song.title,
            song.author || '',
            song.lyrics,
            song.backgroundType || '',
            song.backgroundPath || '',
            song.id,
          ]
        );
      } else {
        songsDb.run(
          'INSERT INTO songs (title, author, lyrics, background_type, background_path) VALUES (?, ?, ?, ?, ?)',
          [
            song.title,
            song.author || '',
            song.lyrics,
            song.backgroundType || '',
            song.backgroundPath || '',
          ]
        );
      }
      saveSongsDb();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('songs-delete', (_event, songId) => {
    if (!Number.isFinite(songId) && typeof songId !== 'string') {
      return { success: false, error: 'Invalid song ID.' };
    }
    const songsDb = getSongsDb();
    if (!songsDb) return { success: false };
    try {
      songsDb.run('DELETE FROM songs WHERE id=?', [songId]);
      saveSongsDb();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('songs-web-search', async (_event, keyword) => {
    try {
      return await searchChristianStudyHymns(keyword);
    } catch (err) {
      console.error('[SongsIPC] songs-web-search error:', err?.message || err);
      return [];
    }
  });

  ipcMain.handle('songs-web-site-search', async (_event, keyword) => {
    try {
      return await searchChristianStudyBySiteQuery(keyword);
    } catch (err) {
      console.error('[SongsIPC] songs-web-site-search error:', err?.message || err);
      return [];
    }
  });

  ipcMain.handle('songs-web-fetch-lyrics', async (_event, sourceUrl, options) => {
    try {
      return await fetchChristianStudyHymnLyrics(sourceUrl, options);
    } catch (err) {
      console.error('[SongsIPC] songs-web-fetch-lyrics error:', err?.message || err);
      return { title: '', lyrics: '' };
    }
  });
}

module.exports = {
  registerBibleSongsIPC,
};
