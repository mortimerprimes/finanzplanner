'use client';
import { Suspense } from 'react';
import { SavingsPage } from '@/src/page-components/SavingsPage';

export default function DemoSavingsPage() {
	return (
		<Suspense fallback={null}>
			<SavingsPage />
		</Suspense>
	);
}
