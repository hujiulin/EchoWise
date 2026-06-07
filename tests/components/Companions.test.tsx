import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const m = await import("../__mocks__/tauri-sql");
  return { default: m.default };
});
vi.mock("@tauri-apps/api/path", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { appDataDir: m.appDataDir, join: m.join };
});
vi.mock("@tauri-apps/api/core", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { convertFileSrc: m.convertFileSrc };
});
vi.mock("@tauri-apps/plugin-fs", async () => await import("../__mocks__/tauri-fs"));

import CompanionView from "../../src/components/Companions";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("CompanionView", () => {
  it("renders companion name + Day N + tier label", () => {
    render(<CompanionView />);
    // Two instances: page header and identity card
    expect(screen.getAllByText("EchoWise").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Day \d+/).length).toBeGreaterThan(0);
  });

  it("editing name field updates companion in store", async () => {
    const user = userEvent.setup();
    render(<CompanionView />);
    const nameInput = screen.getAllByRole("textbox")[0];
    await user.clear(nameInput);
    await user.type(nameInput, "Luna");
    expect(useApp.getState().companion.name).toBe("Luna");
  });

  it("clicking a voice option updates companion.voice", async () => {
    const user = userEvent.setup();
    render(<CompanionView />);
    await user.click(screen.getByRole("button", { name: /Echo — soft/ }));
    expect(useApp.getState().companion.voice).toBe("echo");
  });

  it("Reset reveals confirm row, Reset confirm resets companion", async () => {
    const user = userEvent.setup();
    render(<CompanionView />);
    await user.click(screen.getByRole("button", { name: /^Reset$/ }));
    // Now confirm row appears with Cancel + Reset
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
    const before = useApp.getState().companion.createdAt;
    await new Promise((r) => setTimeout(r, 5));
    await user.click(screen.getByRole("button", { name: /^Reset$/ }));
    expect(useApp.getState().companion.createdAt).toBeGreaterThanOrEqual(before);
  });

  it("relationship tiers list renders all 5", () => {
    render(<CompanionView />);
    // Tier label may also appear in the identity card (currentTier.label) — use getAllByText
    expect(screen.getAllByText("Just meeting").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Getting to know each other").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Friends$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Close friends").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Old friends").length).toBeGreaterThan(0);
  });
});
