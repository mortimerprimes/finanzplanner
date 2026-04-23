'use client';
import { Suspense } from 'react';
import { FixedExpensesPage } from '@/src/page-components/FixedExpensesPage';

export default function DemoFixedExpensesPage() {
	return (
		<Suspense fallback={null}>
			<FixedExpensesPage />
		</Suspense>
	);
}
