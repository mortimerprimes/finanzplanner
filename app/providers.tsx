'use client';

import { ThemeProvider } from '@/src/hooks/useTheme';
import { FinanceProvider } from '@/lib/finance-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FinanceProvider>
        {children}
      </FinanceProvider>
    </ThemeProvider>
  );
}
