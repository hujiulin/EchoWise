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

import Sidebar from "../../src/components/Sidebar";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("Sidebar", () => {
  it("renders 4 primary nav buttons", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /Conversation/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Growth/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Companion/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Settings/ })).toBeInTheDocument();
  });

  it("clicking a nav item sets view", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: /Growth/ }));
    expect(useApp.getState().view).toBe("growth");
  });

  it("shows companion name + 'Day N together'", () => {
    render(<Sidebar />);
    // Brand label + companion chip both say "EchoWise"
    expect(screen.getAllByText("EchoWise").length).toBeGreaterThan(0);
    expect(screen.getByText(/Day \d+ together/)).toBeInTheDocument();
  });

  it("clicking the bottom companion chip opens Companion view", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    // The companion chip is the last button
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);
    expect(useApp.getState().view).toBe("companion");
  });

  it("renders brand + slogan", () => {
    render(<Sidebar />);
    expect(screen.getByText("Just talk.")).toBeInTheDocument();
  });
});
