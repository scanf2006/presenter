const fs = require('fs');
const path = require('path');

function createDatabaseStore() {
  let bibleDbCuvs = null;
  let bibleDbKjv = null;
  let songsDb = null;

  return {
    setBibleDbCuvs(db) {
      bibleDbCuvs = db;
    },
    setBibleDbKjv(db) {
      bibleDbKjv = db;
    },
    setSongsDb(db) {
      songsDb = db;
    },
    getBibleDb(version) {
      return version === 'kjv' ? bibleDbKjv : bibleDbCuvs;
    },
    getSongsDb() {
      return songsDb;
    },
    saveSongsDb(userDataDir) {
      if (!songsDb) return;
      // L6: Wrap in try/catch to prevent unhandled write errors.
      try {
        const data = songsDb.export();
        const songsPath = path.join(userDataDir, 'songs.db');
        fs.writeFileSync(songsPath, Buffer.from(data));
      } catch (err) {
        console.error('[SongsDB] Failed to save songs database:', err?.message || err);
      }
    },
    // M8: Close all open SQLite databases on application exit.
    closeAll() {
      try {
        if (bibleDbCuvs) {
          bibleDbCuvs.close();
          bibleDbCuvs = null;
        }
      } catch (err) {
        console.warn('[BibleDB] close CUVS failed:', err?.message || err);
      }
      try {
        if (bibleDbKjv) {
          bibleDbKjv.close();
          bibleDbKjv = null;
        }
      } catch (err) {
        console.warn('[BibleDB] close KJV failed:', err?.message || err);
      }
      try {
        if (songsDb) {
          songsDb.close();
          songsDb = null;
        }
      } catch (err) {
        console.warn('[SongsDB] close failed:', err?.message || err);
      }
    },
  };
}

async function initBibleAndSongsDatabases({
  initSqlJs,
  userDataDir,
  dataDir,
  dbStore,
  logger = console,
}) {
  const SQL = await initSqlJs();

  const cuvsPath = path.join(dataDir, 'bible_cuvs.db');
  if (fs.existsSync(cuvsPath)) {
    const data = fs.readFileSync(cuvsPath);
    dbStore.setBibleDbCuvs(new SQL.Database(data));
    logger.log('[BibleDB] Chinese CUVS loaded');
  }

  const kjvPath = path.join(dataDir, 'bible_kjv.db');
  if (fs.existsSync(kjvPath)) {
    const data = fs.readFileSync(kjvPath);
    dbStore.setBibleDbKjv(new SQL.Database(data));
    logger.log('[BibleDB] English KJV loaded');
  }

  const songsPath = path.join(userDataDir, 'songs.db');
  if (fs.existsSync(songsPath)) {
    const data = fs.readFileSync(songsPath);
    dbStore.setSongsDb(new SQL.Database(data));
  } else {
    dbStore.setSongsDb(new SQL.Database());
  }

  const songsDb = dbStore.getSongsDb();
  songsDb.run(`CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    lyrics TEXT NOT NULL,
    background_type TEXT DEFAULT '',
    background_path TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  try {
    songsDb.run(`ALTER TABLE songs ADD COLUMN background_type TEXT DEFAULT ''`);
  } catch (err) {
    console.warn('[SongsDB] add background_type column skipped:', err?.message || err);
  }
  try {
    songsDb.run(`ALTER TABLE songs ADD COLUMN background_path TEXT DEFAULT ''`);
  } catch (err) {
    console.warn('[SongsDB] add background_path column skipped:', err?.message || err);
  }
  logger.log('[SongsDB] Songs database initialized');
}

module.exports = {
  createDatabaseStore,
  initBibleAndSongsDatabases,
};
