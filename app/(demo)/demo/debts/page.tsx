'use client';
import { Suspense } from 'react';
import { DebtsPage } from '@/src/page-components/DebtsPage';

export default function DemoDebtsPage() {
	return (
		<Suspense fallback={null}>
			<DebtsPage />
		</Suspense>
	);
}
