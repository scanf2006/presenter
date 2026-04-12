import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import DisplaysSection from './sections/DisplaysSection';
import TextEditorSection from './sections/TextEditorSection';
import BibleSection from './sections/BibleSection';
import SongsSection from './sections/SongsSection';
import MediaSection from './sections/MediaSection';

/**
 * MainContentArea renders the active section based on sidebar navigation.
 * Each section is a self-contained component that reads its own state from contexts.
 *
 * Props:
 *   - songsListOpenToken:    timestamp token to force SongManager to show song list
 *   - bibleCatalogOpenToken: timestamp token to force BibleBrowser to show catalog
 *   - mediaHomeOpenToken:    timestamp token to force MediaManager to show home view
 */
function MainContentArea({ songsListOpenToken, bibleCatalogOpenToken, mediaHomeOpenToken }) {
  const { activeSection } = useAppContext();

  return (
    <div className="main-content">
      <div style={{ display: activeSection === 'displays' ? 'block' : 'none' }}>
        <DisplaysSection />
      </div>

      <div style={{ display: activeSection === 'text' ? 'block' : 'none' }}>
        <TextEditorSection />
      </div>

      <div style={{ display: activeSection === 'bible' ? 'block' : 'none' }}>
        <BibleSection bibleCatalogOpenToken={bibleCatalogOpenToken} />
      </div>

      <div style={{ display: activeSection === 'songs' ? 'block' : 'none' }}>
        <SongsSection songsListOpenToken={songsListOpenToken} />
      </div>

      <div style={{ display: activeSection === 'media' ? 'block' : 'none' }}>
        <MediaSection mediaHomeOpenToken={mediaHomeOpenToken} />
      </div>
    </div>
  );
}

export default MainContentArea;
