// The no-access page (US-02): someone not on a media team is told so; while team mapping isn't set up, everyone but
// Admins and Directors is told the app is being set up instead (the server sends settingUp).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NoAccessPage } from "../../src/client/pages/NoAccessPage";

afterEach(cleanup);

describe("no-access page", () => {
  it("says the app is for the media team", () => {
    render(<NoAccessPage onSignOut={() => {}} signingOut={false} />);
    expect(screen.getByText("This app is for the media team. If you think you should have access, contact a media team admin.")).toBeTruthy();
  });

  it("says the app is being set up, while team mapping isn't", () => {
    render(<NoAccessPage settingUp onSignOut={() => {}} signingOut={false} />);
    expect(screen.getByText("The app is being set up. Check back soon.")).toBeTruthy();
    expect(screen.queryByText(/media team admin/)).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
