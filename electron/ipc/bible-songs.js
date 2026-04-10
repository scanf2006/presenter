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
}

module.exports = {
  registerBibleSongsIPC,
};
