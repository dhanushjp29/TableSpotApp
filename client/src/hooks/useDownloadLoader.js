import { createContext, useContext } from "react";

export const DownloadLoaderContext = createContext(null);

export function useDownloadLoader() {
  const context = useContext(DownloadLoaderContext);
  if (!context) {
    throw new Error(
      "useDownloadLoader must be used within a DownloadLoaderProvider"
    );
  }
  return context;
}
