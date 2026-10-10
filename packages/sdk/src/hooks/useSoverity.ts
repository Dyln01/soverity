import * as React from "react";
import type { DetectedAccount, SignInResult, SoveritySession, Scope } from "../types";
import { detectAccounts } from "../detect";

/**
 * useSoverity — headless hook behind the button. Powers framework
 * adapters (Vue/Svelte/Solid wrap it) and custom UIs.
 */

export interface UseSoverityResult {
  accounts: DetectedAccount[];
  loading: boolean;
  hasPasskey: boolean;
  signIn: (account?: DetectedAccount) => Promise<SignInResult>;
  signOut: () => void;
  session: SoveritySession | null;
}

export function useSoverity(scopes: Scope[] = ["openid"]): UseSoverityResult {
  const [accounts, setAccounts] = React.useState<DetectedAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hasPasskey, setHasPasskey] = React.useState(false);
  const [session, setSession] = React.useState<SoveritySession | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { accounts: found, hasPasskey: pk } = await detectAccounts({});
      if (cancelled) return;
      setAccounts(found);
      setHasPasskey(pk);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = React.useCallback(
    (account?: DetectedAccount) =>
      new Promise<SignInResult>((resolve) => {
        window.dispatchEvent(
          new CustomEvent("soverity:signin", {
            detail: {
              scopes,
              account: account ?? accounts[0] ?? null,
              acknowledge: (result: SignInResult) => {
                if (result?.session) setSession(result.session);
                resolve(result);
              },
            },
          }),
        );
      }),
    [accounts, scopes],
  );

  const signOut = React.useCallback(() => setSession(null), []);

  return { accounts, loading, hasPasskey, signIn, signOut, session };
}
