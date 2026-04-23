'use client';
import { Suspense } from 'react';
import { AccountsPage } from '@/src/page-components/AccountsPage';

export default function DemoAccountsPage() {
	return (
		<Suspense fallback={null}>
			<AccountsPage />
		</Suspense>
	);
}
