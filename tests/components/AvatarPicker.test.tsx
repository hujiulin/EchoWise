import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

import AvatarPicker from "../../src/components/AvatarPicker";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";
import { __resetFs } from "../__mocks__/tauri-fs";

beforeEach(async () => {
  __resetDb();
  __resetFs();
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("AvatarPicker", () => {
  it("renders 6 preset buttons + 1 upload button (7 total)", () => {
    render(<AvatarPicker />);
    // Each option is a button. There's also an <input type=file> (hidden).
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(7);
  });

  it("clicking a preset updates companion.avatar", async () => {
    const user = userEvent.setup();
    render(<AvatarPicker />);
    // Buttons get title attribute for each preset id
    const owlBtn = screen.getByTitle("owl");
    await user.click(owlBtn);
    expect(useApp.getState().companion.avatar).toBe("preset:owl");
  });

  it("uploading an image saves it and sets avatar to upload:<path>", async () => {
    const user = userEvent.setup();
    render(<AvatarPicker />);
    // Trigger file upload by simulating change on the hidden input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "me.png", { type: "image/png" });
    await user.upload(input, file);
    await new Promise((r) => setTimeout(r, 5));
    expect(useApp.getState().companion.avatar).toMatch(/^upload:/);
  });

  it("rejects non-image files with friendly error", async () => {
    render(<AvatarPicker />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    // Bypass the accept="image/*" guard that userEvent.upload enforces;
    // we want to test our in-component validation path explicitly.
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);
    await new Promise((r) => setTimeout(r, 5));
    expect(useApp.getState().error).toMatch(/image/i);
  });
});
