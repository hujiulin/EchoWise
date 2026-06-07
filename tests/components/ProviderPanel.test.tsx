import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const m = await import("../__mocks__/tauri-sql");
  return { default: m.default };
});

import ProviderPanel from "../../src/components/ProviderPanel";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("ProviderPanel", () => {
  it("renders provider preset buttons", () => {
    render(<ProviderPanel />);
    // 'OpenAI' substring appears in 'OpenAI' button + 'Azure OpenAI' button + helper text.
    // Use the more specific subtitle text 'Direct API' to disambiguate.
    expect(screen.getByText("Direct API")).toBeInTheDocument();
    expect(screen.getByText("Your Azure resource")).toBeInTheDocument();
  });

  it("switching to Azure swaps the visible fields", async () => {
    const user = userEvent.setup();
    render(<ProviderPanel />);
    // Click the "Your Azure resource" preset button (parent button)
    await user.click(screen.getByText("Your Azure resource").closest("button")!);
    expect(screen.getByText("Azure endpoint")).toBeInTheDocument();
    expect(screen.getByText(/API version/)).toBeInTheDocument();
    expect(screen.queryByText("Base URL")).toBeNull();
  });

  it("relabels model fields to 'deployment' under Azure", async () => {
    const user = userEvent.setup();
    render(<ProviderPanel />);
    await user.click(screen.getByText("Your Azure resource").closest("button")!);
    expect(screen.getByText(/LLM deployment/)).toBeInTheDocument();
  });

  it("typing in API key updates draft", async () => {
    const user = userEvent.setup();
    render(<ProviderPanel />);
    const key = screen.getByPlaceholderText(/sk-/);
    await user.type(key, "sk-abc");
    expect(key).toHaveValue("sk-abc");
  });

  it("Save button is enabled, Test connection requires apiKey", () => {
    render(<ProviderPanel />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  });

  it("Saving with name persists memory", async () => {
    const user = userEvent.setup();
    render(<ProviderPanel />);
    await user.type(screen.getByPlaceholderText(/e.g\. Alex/), "Alex");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(useApp.getState().memory.name).toBe("Alex");
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});
