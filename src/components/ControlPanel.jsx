import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import appPkg from '../../package.json';
import { AppProvider, useAppContext } from '../contexts/AppContext';
import { LicenseProvider } from '../contexts/LicenseContext';
import { ProjectorProvider } from '../contexts/ProjectorContext';
import { QueueProvider, useQueueContext } from '../contexts/QueueContext';
import { TextEditorProvider, useTextEditorContext } from '../contexts/TextEditorContext';
import useSectionNavigation from '../hooks/useSectionNavigation';
import TopBar from './control-panel/TopBar';
import SidebarQueue from './control-panel/SidebarQueue';
import MainContentArea from './control-panel/MainContentArea';
import PreviewPanel from './control-panel/PreviewPanel';
import LegalModal from './control-panel/LegalModal';
import ToastOverlay from './control-panel/ToastOverlay';
import AppDialog from './control-panel/AppDialog';

const APP_VERSION = appPkg.version;

/**
 * Inner component that consumes all contexts and provides only the
 * section-navigation orchestration that bridges them.
 */
function ControlPanelInner() {
  const { toast, autosaveToast, dialog, closeDialog, setActiveSection } = useAppContext();
  const { setActiveQueueIndex, activeQueueIndex, projectorQueue, mediaQueueHomeToken } =
    useQueueContext();
  const { handleClearProjector, resetFreeTextEditor } = useTextEditorContext();

  // ── Section navigation ──
  const {
    songsListOpenToken,
    bibleCatalogOpenToken,
    mediaHomeOpenToken,
    openDisplays,
    openText,
    openSongs,
    openBible,
    openMedia,
  } = useSectionNavigation({
    setActiveQueueIndex,
    setActiveSection,
    resetFreeTextEditor,
  });

  // ── Next queue title for preview ──
  const nextQueueTitle = useMemo(() => {
    if (projectorQueue.length === 0) return 'No content';
    const nextIndex =
      (activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0) >= projectorQueue.length
        ? projectorQueue.length - 1
        : activeQueueIndex >= 0
          ? activeQueueIndex + 1
          : 0;
    return projectorQueue[nextIndex]?.title || 'No content';
  }, [projectorQueue, activeQueueIndex]);

  return (
    <div className="app-container">
      <TopBar appVersion={APP_VERSION} onClear={handleClearProjector} />
      <SidebarQueue
        openDisplays={openDisplays}
        openText={openText}
        openSongs={openSongs}
        openBible={openBible}
        openMedia={openMedia}
      />
      <MainContentArea
        songsListOpenToken={songsListOpenToken}
        bibleCatalogOpenToken={bibleCatalogOpenToken}
        mediaHomeOpenToken={Math.max(mediaHomeOpenToken || 0, mediaQueueHomeToken || 0)}
      />
      <PreviewPanel nextQueueTitle={nextQueueTitle} />
      <LegalModal />
      <ToastOverlay toast={toast} />
      <ToastOverlay toast={autosaveToast} slot="autosave" />
      <AppDialog dialog={dialog} onClose={closeDialog} />
    </div>
  );
}

/**
 * ControlPanel is now a thin shell that sets up context providers.
 * All shared state lives in the five contexts; ControlPanelInner handles
 * only section-navigation orchestration that bridges them.
 */
function ControlPanel() {
  return (
    <AppProvider>
      <ControlPanelProviders />
    </AppProvider>
  );
}

/**
 * Intermediate component that wires up the ref-bridge so QueueProvider
 * can call `applyTextPayloadToEditor` (owned by TextEditorProvider).
 *
 * Provider nesting: License > Projector > Queue > TextEditor > Inner
 * The ref-bridge feeds applyTextPayloadToEditor from TextEditorContext
 * back up to QueueProvider to break the circular dependency.
 */
function ControlPanelProviders() {
  const applyTextRef = useRef(() => {});
  const stableApplyText = useCallback((payload) => applyTextRef.current(payload), []);

  return (
    <LicenseProvider>
      <ProjectorProvider>
        <QueueProvider applyTextPayloadToEditor={stableApplyText}>
          <TextEditorProvider>
            <ApplyTextBridge applyTextRef={applyTextRef} />
            <ControlPanelInner />
          </TextEditorProvider>
        </QueueProvider>
      </ProjectorProvider>
    </LicenseProvider>
  );
}

/**
 * Tiny bridge component that keeps the ref in sync with
 * applyTextPayloadToEditor from TextEditorContext.
 */
function ApplyTextBridge({ applyTextRef }) {
  const { applyTextPayloadToEditor } = useTextEditorContext();
  useEffect(() => {
    applyTextRef.current = applyTextPayloadToEditor;
  }, [applyTextRef, applyTextPayloadToEditor]);
  return null;
}

export default ControlPanel;
