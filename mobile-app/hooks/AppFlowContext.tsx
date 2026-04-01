import React, { createContext, useContext } from 'react';

interface AppFlowContextValue {
  resetToSplash: () => void;
}

const AppFlowContext = createContext<AppFlowContextValue>({
  resetToSplash: () => {},
});

export const AppFlowProvider = AppFlowContext.Provider;

export const useAppFlow = () => useContext(AppFlowContext);
