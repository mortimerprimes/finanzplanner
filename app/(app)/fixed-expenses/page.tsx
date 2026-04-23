'use client';
import { Suspense } from 'react';
import { FixedExpensesPage } from '@/src/page-components/FixedExpensesPage';

export default function FixedExpensesRoute() {
	return (
		<Suspense fallback={null}>
			<FixedExpensesPage />
		</Suspense>
	);
}
