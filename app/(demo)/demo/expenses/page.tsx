'use client';
import { Suspense } from 'react';
import { ExpensesPage } from '@/src/page-components/ExpensesPage';

export default function DemoExpensesPage() {
	return (
		<Suspense fallback={null}>
			<ExpensesPage />
		</Suspense>
	);
}
