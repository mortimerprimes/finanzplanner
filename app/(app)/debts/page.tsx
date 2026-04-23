'use client';
import { Suspense } from 'react';
import { DebtsPage } from '@/src/page-components/DebtsPage';

export default function DebtsRoute() {
	return (
		<Suspense fallback={null}>
			<DebtsPage />
		</Suspense>
	);
}
