'use client';
import { Suspense } from 'react';
import { IncomePage } from '@/src/page-components/IncomePage';

export default function IncomeRoute() {
	return (
		<Suspense fallback={null}>
			<IncomePage />
		</Suspense>
	);
}
