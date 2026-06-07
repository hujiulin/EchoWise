import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const m = await import("../__mocks__/tauri-sql");
  return { default: m.default };
});
vi.mock("@tauri-apps/plugin-updater", async () => await import("../__mocks__/tauri-updater"));
vi.mock("@tauri-apps/plugin-process", async () => await import("../__mocks__/tauri-process"));

import AboutPanel from "../../src/components/AboutPanel";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";
import {
  __setChunkSizes,
  __setNextUpdate,
} from "../__mocks__/tauri-updater";

beforeEach(async () => {
  __resetDb();
  __setNextUpdate(null);
  __setChunkSizes([1024]);
  useApp.setState({
    updateStatus: "idle",
    latestUpdate: undefined,
    updateProgress: undefined,
    updateError: undefined,
    lastUpdateCheck: undefined,
  } as Partial<ReturnType<typeof useApp.getState>>);
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("AboutPanel — identity & links", () => {
  it("shows product name + tagline + version", () => {
    render(<AboutPanel />);
    expect(screen.getAllByText("EchoWise").length).toBeGreaterThan(0);
    expect(screen.getByText("Just talk.")).toBeInTheDocument();
    expect(screen.getAllByText(/Version/).length).toBeGreaterThan(0);
  });

  it("links to source, issues, license", () => {
    render(<AboutPanel />);
    expect(screen.getByText("Source code")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("License")).toBeInTheDocument();
  });

  it("shows philosophy copy", () => {
    render(<AboutPanel />);
    expect(screen.getByText(/AI companion/i)).toBeInTheDocument();
  });
});

describe("AboutPanel — updater states", () => {
  it("renders idle state with version + Check for updates button", () => {
    render(<AboutPanel />);
    // "Version 0.1.0" appears in both identity card and updater row
    expect(screen.getAllByText(/^Version /).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Check for updates/ })).toBeInTheDocument();
    expect(screen.getByText(/Never checked yet/)).toBeInTheDocument();
  });

  it("clicking Check for updates calls store + shows up-to-date when no update", async () => {
    const user = userEvent.setup();
    render(<AboutPanel />);
    await user.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText(/latest version/i)).toBeInTheDocument();
  });

  it("renders 'available' state with version + release notes + Install button", async () => {
    useApp.setState({
      updateStatus: "available",
      latestUpdate: {
        version: "0.2.0", currentVersion: "0.1.0",
        notes: "- shiny new feature\n- bugfix",
      },
    } as Partial<ReturnType<typeof useApp.getState>>);
    render(<AboutPanel />);
    expect(screen.getByText(/Update available — v0.2.0/)).toBeInTheDocument();
    expect(screen.getByText(/shiny new feature/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Install update/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Not now/ })).toBeInTheDocument();
  });

  it("Install update click triggers download flow and reaches 'installed'", async () => {
    __setNextUpdate({ version: "0.2.0", currentVersion: "0.1.0" });
    __setChunkSizes([500, 500]);
    useApp.setState({
      updateStatus: "available",
      latestUpdate: { version: "0.2.0", currentVersion: "0.1.0" },
    } as Partial<ReturnType<typeof useApp.getState>>);
    const user = userEvent.setup();
    render(<AboutPanel />);
    await user.click(screen.getByRole("button", { name: /Install update/ }));
    // Eventually reaches installed
    expect(await screen.findByText(/Update installed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restart now/ })).toBeInTheDocument();
  });

  it("Not now dismisses and returns to idle", async () => {
    useApp.setState({
      updateStatus: "available",
      latestUpdate: { version: "0.2.0", currentVersion: "0.1.0" },
    } as Partial<ReturnType<typeof useApp.getState>>);
    const user = userEvent.setup();
    render(<AboutPanel />);
    await user.click(screen.getByRole("button", { name: /Not now/ }));
    expect(useApp.getState().updateStatus).toBe("idle");
    expect(screen.getByRole("button", { name: /Check for updates/ })).toBeInTheDocument();
  });

  it("error state shows message and Try again button", () => {
    useApp.setState({
      updateStatus: "error",
      updateError: "Network unreachable",
    } as Partial<ReturnType<typeof useApp.getState>>);
    render(<AboutPanel />);
    expect(screen.getByText("Update failed")).toBeInTheDocument();
    expect(screen.getByText(/Network unreachable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });
});
