interface SearchParamsLike {
  get: (name: string) => string | null;
}

interface SearchFocusRouteTarget {
  type: string;
  id: string;
  contextMonth?: string;
}

export interface SearchFocusRequest {
  id: string;
  month: string | null;
}

const SEARCH_RESULT_ROUTES: Record<string, string> = {
  expense: '/expenses',
  income: '/income',
  'fixed-expense': '/fixed-expenses',
  debt: '/debts',
  savings: '/savings',
  transfer: '/accounts',
  'freelance-project': '/freelance',
  invoice: '/freelance',
};

export function buildSearchResultHref(result: SearchFocusRouteTarget): string {
  const route = SEARCH_RESULT_ROUTES[result.type] || '/dashboard';
  const params = new URLSearchParams({
    focusType: result.type,
    focusId: result.id,
  });

  if (result.contextMonth) {
    params.set('focusMonth', result.contextMonth);
  }

  return `${route}?${params.toString()}`;
}

export function getSearchFocus(searchParams: SearchParamsLike, expectedType: string): SearchFocusRequest | null {
  const focusType = searchParams.get('focusType');
  const focusId = searchParams.get('focusId');

  if (focusType !== expectedType || !focusId) {
    return null;
  }

  return {
    id: focusId,
    month: searchParams.get('focusMonth'),
  };
}

export function focusElementById(
  elementId: string,
  onFocused: () => void,
  maxAttempts = 10,
  delayMs = 120,
): () => void {
  let cancelled = false;
  let timeoutId: number | null = null;

  const tryFocus = (attempt: number) => {
    if (cancelled) {
      return;
    }

    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocused();
      return;
    }

    if (attempt >= maxAttempts) {
      return;
    }

    timeoutId = window.setTimeout(() => tryFocus(attempt + 1), delayMs);
  };

  timeoutId = window.setTimeout(() => tryFocus(0), delayMs);

  return () => {
    cancelled = true;
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
    }
  };
}