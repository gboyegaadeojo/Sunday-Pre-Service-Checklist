import { useEffect, useState } from "react";

// Installing the app (Stage 13, requirements C42), with no app store. Chrome and Edge (Android and desktop) offer it
// through the beforeinstallprompt event, caught here as early as possible (main.tsx) and kept until someone presses
// "Install app". iPhone has no such offer: there it's Share › Add to Home Screen, so the app shows how. Nothing is
// offered once the app is running installed.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let offer: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

/** Started once from main.tsx: remembers the browser's install offer, and forgets it once the app is installed. */
export function startInstallWatch(): () => void {
  const onOffer = (e: Event) => {
    e.preventDefault(); // keep it for the app's own button instead of the browser's mini-bar
    offer = e as InstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    offer = null;
    installedNow = true;
    notify();
  };
  window.addEventListener("beforeinstallprompt", onOffer);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onOffer);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Running as the installed app (home screen or app window), where there's nothing to install. */
const runningInstalled = () =>
  installedNow ||
  (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone or iPad (an iPad can call itself a Mac, but has a touch screen). */
const onIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** "prompt": the browser can install it now; "ios": show how to add it to the home screen; null: nothing to offer. */
export type InstallWay = "prompt" | "ios" | null;

export function useInstall(): { way: InstallWay; install: () => Promise<void> } {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const way: InstallWay = runningInstalled() ? null : offer ? "prompt" : onIos() ? "ios" : null;
  const install = async () => {
    const event = offer;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") offer = null; // the browser offers it once
    notify();
  };
  return { way, install };
}

/** Forgets everything (tests). */
export function resetInstall() {
  offer = null;
  installedNow = false;
}
