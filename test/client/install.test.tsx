// Installing the app (Stage 13, requirements C42): "Install app" where the browser offers it (Chrome, Edge), "Add to
// Home Screen" with a how-to on iPhone and iPad, nothing once it runs installed; in the name menu and on the sign-in
// screen.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInScreen } from "../../src/client/components/app/SignInScreen";
import { UserMenu } from "../../src/client/components/app/UserMenu";
import { resetInstall, startInstallWatch } from "../../src/client/lib/install";
import type { CurrentUser } from "../../src/shared/types";

const USER: CurrentUser = { id: 2, name: "Test Volunteer", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess: true };

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});
let stop = () => {};
beforeEach(() => {
  resetInstall();
  stop = startInstallWatch();
});
afterEach(() => {
  stop();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const openMenu = () => {
  render(<UserMenu user={USER} route="checklist" onNavigate={() => {}} onSignOut={() => {}} signingOut={false} signOutError={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Account: Test Volunteer" }));
  return screen.getByRole("menu");
};
/** The browser offering to install, as Chrome and Edge do. */
function offerInstall(outcome: "accepted" | "dismissed" = "accepted") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}
const onIphone = () => vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");

describe("in the name menu", () => {
  it("offers nothing when the browser can't install it", () => {
    const menu = openMenu();
    expect(within(menu).queryByRole("menuitem", { name: /Install app|Add to Home Screen/ })).toBeNull();
  });

  it("offers Install app when the browser can, and hands it to the browser", async () => {
    const event = offerInstall();
    expect(event.defaultPrevented).toBe(true); // kept for the app's own button
    const menu = openMenu();
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Install app" }));
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    // Installed: nothing more to offer.
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Account: Test Volunteer" }));
    expect(screen.queryByRole("menuitem", { name: "Install app" })).toBeNull();
  });

  it("shows how to add it to the home screen on iPhone", () => {
    onIphone();
    const menu = openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Add to Home Screen" }));
    const howTo = screen.getByRole("dialog", { name: "Add to Home Screen" });
    expect(howTo.textContent).toContain("Tap the Share button");
    expect(howTo.textContent).toContain("Scroll down and tap Add to Home Screen");
    fireEvent.click(within(howTo).getByRole("button", { name: "Done" }));
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });

  it("offers nothing once it runs installed", () => {
    onIphone();
    vi.stubGlobal("matchMedia", vi.fn((q: string) => ({ matches: q === "(display-mode: standalone)", addEventListener() {}, removeEventListener() {} })));
    offerInstall();
    const menu = openMenu();
    expect(within(menu).queryByRole("menuitem", { name: /Install app|Add to Home Screen/ })).toBeNull();
  });
});

describe("on the sign-in screen", () => {
  it("offers it before signing in too", async () => {
    const event = offerInstall();
    render(<SignInScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    });
    expect(event.prompt).toHaveBeenCalledOnce();
  });
});
