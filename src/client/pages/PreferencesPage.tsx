import { Card } from "../components/ui/Card";
import { MonitorIcon, MoonIcon, SunIcon } from "../components/ui/Icons";
import { type SegmentOption, SegmentedControl } from "../components/ui/SegmentedControl";
import { useBranding } from "../lib/branding";
import { type Theme, type ThemePreference, useThemePreference } from "../lib/theme";

/**
 * A small picture of a theme, drawn with that theme's own tokens (an element with data-theme uses that theme's
 * colours; styles.css), so it never drifts from the real thing.
 */
function ThemePreview({ theme, className = "" }: { theme: Theme; className?: string }) {
  return (
    <span aria-hidden="true" data-theme={theme} className={`block overflow-hidden bg-bg p-1.5 ${className}`}>
      <span className="block h-1.5 rounded-sm bg-panel" />
      <span className="mt-1.5 block rounded-sm border border-line bg-card p-1.5">
        <span className="block h-1 w-3/4 rounded-full bg-fg-muted/60" />
        <span className="mt-1.5 block h-1 rounded-full bg-line">
          <span className="block h-1 w-1/2 rounded-full bg-accent" />
        </span>
      </span>
    </span>
  );
}

const OPTIONS: SegmentOption<ThemePreference>[] = [
  {
    value: "dark",
    label: "Dark",
    icon: <MoonIcon className="size-4 shrink-0 text-fg-muted" />,
    preview: <ThemePreview theme="dark" className="h-16 rounded-control border border-line" />,
  },
  {
    value: "light",
    label: "Light",
    icon: <SunIcon className="size-4 shrink-0 text-fg-muted" />,
    preview: <ThemePreview theme="light" className="h-16 rounded-control border border-line" />,
  },
  {
    value: "system",
    label: "System",
    icon: <MonitorIcon className="size-4 shrink-0 text-fg-muted" />,
    // Half and half: it shows whichever the device is set to.
    preview: (
      <span aria-hidden="true" className="grid h-16 grid-cols-2 overflow-hidden rounded-control border border-line">
        <ThemePreview theme="dark" className="h-full" />
        <ThemePreview theme="light" className="h-full" />
      </span>
    ),
  },
];

const THEME_NAME: Record<Theme, string> = { dark: "Dark", light: "Light" };

// My Preferences (US-08a, requirements v1.20): personal settings for this device, for everyone signed in. Today
// that's Appearance. A choice applies at once, with no Save button. Church-wide settings are in Administrative
// Settings › Church settings, not here.
export function PreferencesPage() {
  const { preference, setPreference, theme } = useThemePreference();
  const { teamName, appName } = useBranding();
  const name = teamName ?? appName;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header>
        <h1 className="text-page font-semibold tracking-tight">My Preferences</h1>
        <p className="text-sm text-fg-muted">Manage your personal appearance and display preferences.</p>
      </header>

      <Card className="p-4 md:p-5">
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-fg-muted">Choose how {name ?? "the app"} looks on this device.</p>
        <div className="mt-4">
          <SegmentedControl label="Appearance" options={OPTIONS} value={preference} onChange={setPreference} />
        </div>
        <p role="status" className="mt-3 text-meta text-fg-muted">
          {preference === "system"
            ? `Following your device: ${THEME_NAME[theme]}. It changes when your device does.`
            : `${THEME_NAME[theme]} on this device${preference === "dark" ? " (the default)" : ""}.`}
        </p>
      </Card>
    </main>
  );
}
