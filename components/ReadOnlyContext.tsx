'use client';

import { createContext, useContext } from 'react';

/**
 * True while the SaaS owner views a customer's account. The server enforces
 * read-only on its own (lib/impersonation.ts); this only greys out the
 * buttons so the owner sees up front what is blocked.
 */
const ReadOnlyContext = createContext(false);

export const ReadOnlyProvider = ReadOnlyContext.Provider;

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
