import { createBrowserClient } from '@supabase/ssr'
import { SELF_HOST_MODE } from '@/lib/deployment'

const SELF_HOST_DISABLED_ERROR = new Error('Supabase browser access is disabled in self-host mode; use the same-origin backend API.')

function selfHostCompatibilityClient() {
  const query = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'order', 'limit', 'range', 'filter', 'match', 'ilike']) {
      builder[method] = (..._args: unknown[]) => builder;
    }
    builder.single = async () => ({ data: null, error: SELF_HOST_DISABLED_ERROR });
    builder.maybeSingle = async () => ({ data: null, error: SELF_HOST_DISABLED_ERROR });
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: SELF_HOST_DISABLED_ERROR }).then(resolve);
    return builder;
  };
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (_table: string) => query(),
  };
}

export function createClient() {
  if (SELF_HOST_MODE) return selfHostCompatibilityClient() as never;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  
  return createBrowserClient(url, key)
}
