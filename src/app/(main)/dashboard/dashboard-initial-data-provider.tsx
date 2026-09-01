'use client';

import { createContext, useContext } from 'react';
import type { DashboardInitialData } from '@/shared/lib/server/dashboard-initial-data';

const DashboardInitialDataContext = createContext<DashboardInitialData | null>(null);

export function DashboardInitialDataProvider({
  data,
  children,
}: {
  data: DashboardInitialData | null;
  children: React.ReactNode;
}) {
  return (
    <DashboardInitialDataContext.Provider value={data}>
      {children}
    </DashboardInitialDataContext.Provider>
  );
}

export function useDashboardInitialData() {
  return useContext(DashboardInitialDataContext);
}
