import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import useToastMessage from '../hooks/useToastMessage';

const AppContext = createContext(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }) {
  const isElectron = typeof window.churchDisplay !== 'undefined';
  const [activeSection, setActiveSection] = useState('text');
  const { toast, showToast } = useToastMessage();

  // ── Dialog state (replaces native alert / confirm) ──
  const [dialog, setDialog] = useState(null);
  const dialogResolveRef = useRef(null);

  const showAlert = useCallback((title, body) => {
    // If called with a single arg, treat it as body-only
    const resolvedTitle = body !== undefined ? title : '';
    const resolvedBody = body !== undefined ? body : title;
    return new Promise((resolve) => {
      dialogResolveRef.current = resolve;
      setDialog({
        mode: 'alert',
        title: resolvedTitle,
        body: resolvedBody,
        resolve,
      });
    });
  }, []);

  const showConfirm = useCallback((title, body) => {
    const resolvedTitle = body !== undefined ? title : 'Confirm';
    const resolvedBody = body !== undefined ? body : title;
    return new Promise((resolve) => {
      dialogResolveRef.current = resolve;
      setDialog({
        mode: 'confirm',
        title: resolvedTitle,
        body: resolvedBody,
        resolve,
      });
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    dialogResolveRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      isElectron,
      activeSection,
      setActiveSection,
      toast,
      showToast,
      dialog,
      closeDialog,
      showAlert,
      showConfirm,
    }),
    [isElectron, activeSection, toast, showToast, dialog, closeDialog, showAlert, showConfirm]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export default AppContext;
