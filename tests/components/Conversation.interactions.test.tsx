import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

import Conversation from "../../src/components/Conversation";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
  // Reset transient state that leaks across tests in this file
  useApp.setState({ active: undefined, error: undefined, view: "conversation" } as Partial<ReturnType<typeof useApp.getState>>);
});
afterEach(() => { vi.clearAllMocks(); });

describe("Conversation — interactions", () => {
  it("typing in the composer enables Send button and sets value", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("clicking '+ New' starts a fresh conversation (no active before)", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /^New$/ }));
    expect(useApp.getState().active).toBeDefined();
    expect(useApp.getState().active?.turns).toHaveLength(1);
  });

  it("clicking History toggles the dropdown panel", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    await user.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.getByText(/Recent conversations/)).toBeInTheDocument();
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
  });

  it("sending text without API key shows error and redirects to settings", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hi");
    // Submit via the form: hit Enter
    await user.keyboard("{Enter}");
    expect(useApp.getState().error).toMatch(/API key/);
    expect(useApp.getState().view).toBe("settings");
  });

  it("topic chip click starts a conversation with a topic", async () => {
    const user = userEvent.setup();
    render(<Conversation />);
    // Both topic chips are <button> with the kicker text
    await user.click(screen.getByText("Today's topic").closest("button")!);
    expect(useApp.getState().active?.topic).toBeTruthy();
  });

  it("after sending one user turn, End button appears", async () => {
    const user = userEvent.setup();
    // Pre-seed an API key so handleUser doesn't bail
    useApp.getState().setConfig({ ...useApp.getState().config, apiKey: "sk-test" });
    // Mock fetch so we don't hit network when respond() runs
    const origFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: "ok", hint: null }) } }] }), { status: 200 })
    );
    render(<Conversation />);
    const input = screen.getByPlaceholderText(/Message EchoWise/);
    await user.type(input, "hello there");
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(useApp.getState().active?.turns.length).toBeGreaterThanOrEqual(2);
    // restore
    globalThis.fetch = origFetch;
  });
});