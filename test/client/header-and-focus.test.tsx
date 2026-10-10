// The header's branding links to the Checklist for anyone with access (plain branding on the access screens), and
// the focus ring follows the last kind of input: keyboard only (design.md §8).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../../src/client/components/app/AppHeader";
import { BrandingContext } from "../../src/client/lib/branding";
import { startInputModality } from "../../src/client/lib/inputModality";
import type { CurrentUser } from "../../src/shared/types";

const BRANDING = { shortName: "IFC", teamName: "IFC Media Production", appName: "Pre-Service Checklist" };
const user = (hasAccess: boolean): CurrentUser => ({ id: 1, name: "Test Volunteer", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess });
const renderHeader = (hasAccess: boolean, onNavigate = vi.fn()) => {
  render(
    <BrandingContext.Provider value={BRANDING}>
      <AppHeader user={user(hasAccess)} route="progress" onNavigate={onNavigate} onSignOut={() => {}} signingOut={false} signOutError={null} />
    </BrandingContext.Provider>,
  );
  return onNavigate;
};

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers: { "Content-Type": "application/json" } }))));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the header's branding", () => {
  it("links to the Checklist, named for screen readers, for anyone with access", () => {
    const onNavigate = renderHeader(true);
    const home = screen.getByRole("link", { name: "IFC Media Production, go to checklist" });
    expect(home.getAttribute("href")).toBe("/");
    fireEvent.click(home);
    expect(onNavigate).toHaveBeenCalledWith("checklist", "");
  });

  it("is plain branding on the access screens, where there's no checklist to go to", () => {
    renderHeader(false);
    expect(screen.queryByRole("link", { name: /go to checklist/ })).toBeNull();
    expect(screen.getByText("IFC Media Production")).toBeTruthy();
  });
});

describe("keyboard-only focus ring", () => {
  it("marks the last kind of input: pointer to start, keyboard after Tab or arrows, pointer after a click or tap", () => {
    const stop = startInputModality();
    const mode = () => document.documentElement.dataset.input;
    expect(mode()).toBe("pointer");
    fireEvent.keyDown(document, { key: "Tab" });
    expect(mode()).toBe("keyboard");
    fireEvent.pointerDown(document.body);
    expect(mode()).toBe("pointer");
    fireEvent.keyDown(document, { key: "a" }); // typing into a field reached by mouse doesn't turn rings on
    expect(mode()).toBe("pointer");
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(mode()).toBe("keyboard");
    stop();
  });
});
