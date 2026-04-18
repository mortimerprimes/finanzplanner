import { Providers } from '../providers';
import { AppLayout } from '@/components/AppLayout';

export const dynamic = 'force-dynamic';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppLayout>{children}</AppLayout>
    </Providers>
  );
}
