import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "../../src/components/Settings";
import { useApp } from "../../src/store";

describe("Settings (tabbed shell)", () => {
  beforeEach(() => {
    // settingsTab now lives in the store; reset it so tests that assert the
    // default panel aren't sensitive to leakage from prior test files.
    useApp.setState({ settingsTab: "appearance" });
  });

  it("renders sub-nav with three tabs", () => {
    render(<Settings />);
    expect(screen.getByRole("button", { name: /Appearance/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI provider/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /About/ })).toBeInTheDocument();
  });

  it("defaults to Appearance panel", () => {
    render(<Settings />);
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("switching tabs swaps the right pane", async () => {
    const user = userEvent.setup();
    render(<Settings />);
    await user.click(screen.getByRole("button", { name: /About/ }));
    expect(screen.getAllByText("EchoWise").length).toBeGreaterThan(0);
    expect(screen.queryByText("Theme")).toBeNull();
  });
});
