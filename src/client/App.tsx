import { useCallback, useEffect, useState } from "react";
import type { BrandingResponse, CurrentUser, MeResponse } from "../shared/types";
import { ApiError, getJson, postJson } from "./api";
import { AppHeader } from "./components/app/AppHeader";
import { RouteLink } from "./components/app/RouteLink";
import { SetupNotice } from "./components/app/SetupNotice";
import { Card } from "./components/ui/Card";
import { ErrorState, LoadingState } from "./components/ui/States";
import { BrandingContext, NO_BRANDING, documentTitle } from "./lib/branding";
import { AdminLayout } from "./components/admin/AdminLayout";
import { useRoute } from "./lib/router";
import { ActivityPage } from "./pages/ActivityPage";
import { ChecklistEditorPage } from "./pages/admin/ChecklistEditorPage";
import { HiddenItemsPage } from "./pages/admin/HiddenItemsPage";
import { HistoryPage } from "./pages/admin/HistoryPage";
import { ListsPage } from "./pages/admin/ListsPage";
import { MappingPage } from "./pages/admin/MappingPage";
import { OverviewPage } from "./pages/admin/OverviewPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { listRefFrom } from "./lib/useAdminList";
import { ChecklistPage } from "./pages/ChecklistPage";
import { DevSignInPage } from "./pages/DevSignInPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SignInPage } from "./pages/SignInPage";
import type { AccessChangeReason } from "./lib/useChecklist";

/** On the sign-in screen after a tap was refused because the session had ended (design.md §9). */
const UNSAVED_CHANGE_NOTICE = "You were signed out, so your last change wasn't saved. Sign in to carry on.";

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
  const [signInNotice, setSignInNotice] = useState<string | null>(null);
  const { route, search, navigate } = useRoute();

  // Who is signed in, and with what access. Re-run whenever the server says the session or access changed.
  const loadSession = useCallback(async () => {
    try {
      const { user } = await getJson<MeResponse>("/api/auth/me");
      setSession({ status: "signed_in", user });
      setSignInNotice(null);
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

    if (session.status === "signed_out") return <SignIn onSignedIn={() => void loadSession()} notice={signInNotice} />;

    const { user } = session;
    const onAccessChanged = (reason?: AccessChangeReason) => {
      if (reason === "unsaved_change") setSignInNotice(UNSAVED_CHANGE_NOTICE);
      void loadSession();
    };
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
    if (!user.hasAccess) {
      return (
        <NoAccessPage
          settingUp={user.settingUp}
          unreachable={user.unreachable}
          onRetry={() => void loadSession()}
          onSignOut={() => void signOut()}
          signingOut={signingOut}
        />
      );
    }
    switch (route) {
      case "progress":
        return (
          <>
            {user.teamMappingPending && <SetupNotice isAdmin={user.isAdmin} onNavigate={navigate} />}
            <ProgressPage user={user} onAccessChanged={onAccessChanged} />
          </>
        );
      case "admin-overview":
      case "admin-checklist":
      case "admin-hidden":
      case "admin-lists":
      case "admin-users":
      case "admin-mapping":
      case "admin-activity":
      case "admin-history":
      case "admin-settings":
        // Administrative Settings is only in an Admin's menu; this covers a typed or bookmarked URL. The server
        // refuses too.
        if (!user.isAdmin) {
          return (
            <main className="mx-auto flex max-w-app justify-center px-4 py-12 md:py-20">
              <Card className="w-full max-w-md p-6">
                <h1 className="text-page font-semibold tracking-tight">Admins only</h1>
                <p className="mt-2 text-task text-fg-muted">This area is available to Admins.</p>
                <RouteLink
                  to="checklist"
                  current={false}
                  onNavigate={navigate}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
                >
                  Go to the checklist
                </RouteLink>
              </Card>
            </main>
          );
        }
        return (
          <AdminLayout route={route} onNavigate={navigate}>
            {route === "admin-settings" ? (
              <SettingsPage onAccessChanged={onAccessChanged} onBrandingChanged={loadBranding} />
            ) : route === "admin-overview" ? (
              <OverviewPage onAccessChanged={onAccessChanged} onNavigate={navigate} />
            ) : route === "admin-activity" ? (
              <ActivityPage onAccessChanged={onAccessChanged} />
            ) : route === "admin-history" ? (
              // Keyed by the query, so opening another service starts fresh.
              <HistoryPage key={search} search={search} onAccessChanged={onAccessChanged} onNavigate={navigate} />
            ) : route === "admin-mapping" ? (
              <MappingPage onAccessChanged={onAccessChanged} />
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
          </AdminLayout>
        );
      default:
        return (
          <>
            {user.teamMappingPending && <SetupNotice isAdmin={user.isAdmin} onNavigate={navigate} />}
            <ChecklistPage user={user} onAccessChanged={onAccessChanged} />
          </>
        );
    }
  }
}
