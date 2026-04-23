'use client';
import { Suspense } from 'react';
import { SavingsPage } from '@/src/page-components/SavingsPage';

export default function SavingsRoute() {
	return (
		<Suspense fallback={null}>
			<SavingsPage />
		</Suspense>
	);
}
