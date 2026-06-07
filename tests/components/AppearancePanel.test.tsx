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

import AppearancePanel from "../../src/components/AppearancePanel";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
  // Reset appearance to defaults so per-test state doesn't bleed in
  useApp.getState().setAppearance({
    theme: "system", font: "inter", fontSize: "md", bgImage: "", bgOpacity: 20,
  });
});
afterEach(() => { vi.clearAllMocks(); });

describe("AppearancePanel", () => {
  it("shows the three section titles", () => {
    render(<AppearancePanel />);
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Typography")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
  });

  it("clicking a theme option updates store appearance", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(useApp.getState().appearance.theme).toBe("dark");
  });

  it("clicking a font option updates store appearance", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    await user.click(screen.getByRole("button", { name: /Serif/ }));
    expect(useApp.getState().appearance.font).toBe("serif");
  });

  it("clicking a size option updates store appearance", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    // Size options are buttons containing "Large" or "X-Large". Use 'Large' text under 'Aa'.
    const lg = screen.getAllByRole("button").find((b) =>
      b.querySelector("div.text-\\[10px\\]")?.textContent === "Large"
    );
    expect(lg).toBeDefined();
    await user.click(lg!);
    expect(useApp.getState().appearance.fontSize).toBe("lg");
  });

  it("clicking None clears the background", async () => {
    const user = userEvent.setup();
    useApp.getState().setAppearance({ bgImage: "preset:ocean" });
    render(<AppearancePanel />);
    await user.click(screen.getByRole("button", { name: /None/ }));
    expect(useApp.getState().appearance.bgImage).toBe("");
  });

  it("clicking a preset selects a gradient bgImage", async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);
    await user.click(screen.getByRole("button", { name: /Dawn/ }));
    expect(useApp.getState().appearance.bgImage).toBe("preset:dawn");
  });

  it("opacity slider only appears when a background is set", async () => {
    const { rerender } = render(<AppearancePanel />);
    expect(screen.queryByText(/Opacity/)).toBeNull();
    useApp.getState().setAppearance({ bgImage: "preset:dawn" });
    rerender(<AppearancePanel />);
    expect(await screen.findByText(/Opacity/)).toBeInTheDocument();
  });
});
