import React, { createContext, useContext, useState, useMemo } from 'react';
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

  const value = useMemo(
    () => ({
      isElectron,
      activeSection,
      setActiveSection,
      toast,
      showToast,
    }),
    [isElectron, activeSection, toast, showToast]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export default AppContext;
