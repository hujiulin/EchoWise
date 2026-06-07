import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import Conversation from "../../src/components/Conversation";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("Conversation — empty state (no active conversation)", () => {
  it("renders the empty-state greeting and the two threads", () => {
    render(<Conversation />);
    // EchoWise appears in multiple places (header + greeting)
    expect(screen.getAllByText(/EchoWise/).length).toBeGreaterThan(0);
    expect(screen.getByText(/pick a thread/i)).toBeInTheDocument();
    expect(screen.getByText("Today's topic")).toBeInTheDocument();
    expect(screen.getByText("Surprise me")).toBeInTheDocument();
  });

  it("renders the top bar with History and New buttons", () => {
    render(<Conversation />);
    expect(screen.getByRole("button", { name: /History/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^New$/ })).toBeInTheDocument();
  });

  it("does not show End button when no user turns yet", () => {
    render(<Conversation />);
    expect(screen.queryByRole("button", { name: /^End$/ })).toBeNull();
  });

  it("renders the bottom composer with mic + text input", () => {
    render(<Conversation />);
    expect(screen.getByRole("button", { name: /Start recording/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message EchoWise/)).toBeInTheDocument();
  });
});
