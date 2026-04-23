'use client';
import { Suspense } from 'react';
import { ExpensesPage } from '@/src/page-components/ExpensesPage';

export default function ExpensesRoute() {
	return (
		<Suspense fallback={null}>
			<ExpensesPage />
		</Suspense>
	);
}
