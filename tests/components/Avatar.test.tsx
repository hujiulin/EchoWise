import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/api/path", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { appDataDir: m.appDataDir, join: m.join };
});
vi.mock("@tauri-apps/api/core", async () => {
  const m = await import("../__mocks__/tauri-fs");
  return { convertFileSrc: m.convertFileSrc };
});
vi.mock("@tauri-apps/plugin-fs", async () => await import("../__mocks__/tauri-fs"));

import Avatar from "../../src/components/Avatar";

describe("Avatar", () => {
  it('renders logo variant ("logo") with dark bg', () => {
    const { container } = render(<Avatar value="logo" size={40} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("bg-foreground");
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it.each(["cat", "bear", "fox", "owl", "whale", "bunny"])("renders preset:%s", (id) => {
    const { container } = render(<Avatar value={`preset:${id}`} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it('renders emoji fallback with prefix "emoji:"', () => {
    render(<Avatar value="emoji:🐶" />);
    expect(screen.getByText("🐶")).toBeInTheDocument();
  });

  it("renders raw emoji as legacy", () => {
    render(<Avatar value="🐶" />);
    expect(screen.getByText("🐶")).toBeInTheDocument();
  });

  it("fill mode applies w-full h-full classes (no fixed size)", () => {
    const { container } = render(<Avatar value="preset:cat" fill />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("w-full");
    expect(root.className).toContain("h-full");
  });

  it("upload variant renders an empty wrapper until URL resolves", async () => {
    const { container } = render(<Avatar value="upload:avatars/x.png" />);
    expect(container.firstChild).toBeTruthy();
    // Let the async effect settle to avoid act() warnings
    await new Promise((r) => setTimeout(r, 0));
  });
});
