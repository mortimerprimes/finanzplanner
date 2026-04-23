'use client';
import { Suspense } from 'react';
import { FreelancePage } from '@/src/page-components/FreelancePage';

export default function FreelanceRoute() {
	return (
		<Suspense fallback={null}>
			<FreelancePage />
		</Suspense>
	);
}
