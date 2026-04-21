'use client';

import { DemoFinanceProvider } from '@/lib/finance-context';
import { ThemeProvider } from '@/src/hooks/useTheme';
import { DemoAppLayout } from '@/components/DemoAppLayout';

export const dynamic = 'force-dynamic';

export default function DemoGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DemoFinanceProvider>
        <DemoAppLayout>{children}</DemoAppLayout>
      </DemoFinanceProvider>
    </ThemeProvider>
  );
}
