import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

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

import AppearanceHost from "../../src/components/AppearanceHost";
import { useApp } from "../../src/store";
import { __resetDb } from "../__mocks__/tauri-sql";

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
  document.documentElement.classList.remove("dark");
});
afterEach(() => { vi.clearAllMocks(); });

describe("AppearanceHost", () => {
  it("applies dark class when theme=dark", () => {
    useApp.getState().setAppearance({ theme: "dark" });
    render(<AppearanceHost><div>child</div></AppearanceHost>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes dark class when theme=light", () => {
    document.documentElement.classList.add("dark");
    useApp.getState().setAppearance({ theme: "light" });
    render(<AppearanceHost><div>child</div></AppearanceHost>);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sets data-font attribute on root", () => {
    useApp.getState().setAppearance({ font: "serif" });
    render(<AppearanceHost><div>child</div></AppearanceHost>);
    expect(document.documentElement.dataset.font).toBe("serif");
  });

  it("sets fontSize style on root", () => {
    useApp.getState().setAppearance({ fontSize: "xl" });
    render(<AppearanceHost><div>child</div></AppearanceHost>);
    expect(document.documentElement.style.fontSize).toBe("20px");
  });

  it("renders children unchanged when bgImage is empty", () => {
    const { getByText } = render(<AppearanceHost><div>child</div></AppearanceHost>);
    expect(getByText("child")).toBeInTheDocument();
  });

  it("renders a fixed bg layer when bgImage is a preset", () => {
    useApp.getState().setAppearance({ bgImage: "preset:dawn", bgOpacity: 40 });
    const { container } = render(<AppearanceHost><div>child</div></AppearanceHost>);
    const fixed = container.querySelector(".fixed.inset-0");
    expect(fixed).toBeTruthy();
  });
});
