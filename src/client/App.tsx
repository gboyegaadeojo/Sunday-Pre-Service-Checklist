import { useCallback, useEffect, useState } from "react";
import type { BrandingResponse, CurrentUser, MeResponse } from "../shared/types";
import { ApiError, getJson, postJson } from "./api";
import { AppHeader } from "./components/app/AppHeader";
import { EmptyState, ErrorState, LoadingState } from "./components/ui/States";
import { BrandingContext, NO_BRANDING, documentTitle } from "./lib/branding";
import { AdminTabs } from "./components/admin/AdminTabs";
import { useRoute } from "./lib/router";
import { ActivityPage } from "./pages/ActivityPage";
import { ChecklistEditorPage } from "./pages/admin/ChecklistEditorPage";
import { HiddenItemsPage } from "./pages/admin/HiddenItemsPage";
import { HistoryPage } from "./pages/admin/HistoryPage";
import { ListsPage } from "./pages/admin/ListsPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { listRefFrom } from "./lib/useAdminList";
import { ChecklistPage } from "./pages/ChecklistPage";
import { DevSignInPage } from "./pages/DevSignInPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SignInPage } from "./pages/SignInPage";

// The developer test-user sign-in is chosen at build time: production builds keep only SignInPage.
const SignIn = import.meta.env.DEV ? DevSignInPage : SignInPage;

type Session =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "signed_out" }
  | { status: "signed_in"; user: CurrentUser };

export function App() {
  const [session, setSession] = useState<Session>({ status: "loading" });
  // undefined while loading. Loads alongside the session, so neither waits on the other.
  const [branding, setBranding] = useState<BrandingResponse | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { route, search, navigate } = useRoute();

  // Who is signed in, and with what access. Re-run whenever the server says the session or access changed.
  const loadSession = useCallback(async () => {
    try {
      const { user } = await getJson<MeResponse>("/api/auth/me");
      setSession({ status: "signed_in", user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSession({ status: "signed_out" });
      else setSession({ status: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Also re-run after an admin saves new branding (Settings), so the header and tab title update at once.
  const loadBranding = useCallback(() => {
    getJson<BrandingResponse>("/api/branding")
      .then(setBranding)
      .catch(() => setBranding((b) => b ?? NO_BRANDING)); // branding is cosmetic; never block the app on it
  }, []);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    if (branding) document.title = documentTitle(branding);
  }, [branding]);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await postJson("/api/auth/sign-out");
      setSession({ status: "signed_out" });
    } catch (err) {
      setSignOutError((err as Error).message);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <BrandingContext.Provider value={branding ?? NO_BRANDING}>
      {branding === undefined ? <LoadingState label="Loading…" /> : renderSession()}
    </BrandingContext.Provider>
  );

  function renderSession() {
    if (session.status === "loading") return <LoadingState label="Loading…" />;

    if (session.status === "error") {
      return (
        <main className="px-4 py-16">
          <ErrorState
            title="Couldn't load the app"
            message={session.message}
            onRetry={() => {
              setSession({ status: "loading" });
              void loadSession();
            }}
          />
        </main>
      );
    }

    if (session.status === "signed_out") return <SignIn onSignedIn={() => void loadSession()} />;

    const { user } = session;
    const onAccessChanged = () => void loadSession();
    return (
      <>
        <AppHeader
          user={user}
          route={route}
          onNavigate={navigate}
          onSignOut={() => void signOut()}
          signingOut={signingOut}
          signOutError={signOutError}
        />
        {renderPage(user, onAccessChanged)}
      </>
    );
  }

  function renderPage(user: CurrentUser, onAccessChanged: () => void) {
    if (!user.hasAccess) return <NoAccessPage onSignOut={() => void signOut()} signingOut={signingOut} />;
    switch (route) {
      case "progress":
        return <ProgressPage user={user} onAccessChanged={onAccessChanged} />;
      case "admin-checklist":
      case "admin-hidden":
      case "admin-lists":
      case "admin-users":
      case "admin-activity":
      case "admin-history":
      case "settings":
        // The Admin link and the Settings menu item are hidden for non-admins; this covers a typed or
        // bookmarked URL. The server refuses too.
        if (!user.isAdmin) {
          return (
            <main className="mx-auto max-w-app px-4 py-10 md:px-6">
              <EmptyState title="Admins only" message="This area is available to Admins." />
            </main>
          );
        }
        // Settings is opened from the user menu, so it has no Admin tabs.
        if (route === "settings") return <SettingsPage onAccessChanged={onAccessChanged} onBrandingChanged={loadBranding} />;
        return (
          <>
            <AdminTabs route={route} onNavigate={navigate} />
            {route === "admin-activity" ? (
              <ActivityPage onAccessChanged={onAccessChanged} />
            ) : route === "admin-history" ? (
              // Keyed by the query, so opening another service starts fresh.
              <HistoryPage key={search} search={search} onAccessChanged={onAccessChanged} onNavigate={navigate} />
            ) : route === "admin-users" ? (
              <UsersPage me={user} onAccessChanged={onAccessChanged} onNavigate={navigate} />
            ) : route === "admin-lists" ? (
              <ListsPage onAccessChanged={onAccessChanged} onNavigate={navigate} />
            ) : route === "admin-hidden" ? (
              // Keyed by the query, so switching lists starts fresh.
              <HiddenItemsPage key={search} listRef={listRefFrom(search)} onAccessChanged={onAccessChanged} onNavigate={navigate} />
            ) : (
              <ChecklistEditorPage key={search} listRef={listRefFrom(search)} onAccessChanged={onAccessChanged} onNavigate={navigate} />
            )}
          </>
        );
      default:
        return <ChecklistPage user={user} onAccessChanged={onAccessChanged} />;
    }
  }
}
