import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-sql", async () => {
  const m = await import("../__mocks__/tauri-sql");
  return { default: m.default };
});

import Growth from "../../src/components/Growth";
import { useApp } from "../../src/store";
import type { Conversation } from "../../src/types";
import { __resetDb } from "../__mocks__/tauri-sql";

function seedHistory(history: Conversation[]) {
  useApp.setState({ history } as Partial<ReturnType<typeof useApp.getState>>);
}

beforeEach(async () => {
  __resetDb();
  await useApp.getState().init();
});
afterEach(() => { vi.clearAllMocks(); });

describe("Growth (empty state)", () => {
  it("renders the headline and zero stats", () => {
    render(<Growth />);
    expect(screen.getByText("Am I getting better?")).toBeInTheDocument();
    expect(screen.getAllByText(/^0$/).length).toBeGreaterThan(0);
  });

  it("confidence empty-state message when no scored turns", () => {
    render(<Growth />);
    expect(screen.getByText(/Say a few sentences/)).toBeInTheDocument();
  });
});

describe("Growth (with sentence reviews)", () => {
  it("renders trend with single baseline when one scored turn exists", () => {
    seedHistory([
      {
        id: "c1", topic: undefined, startedAt: 1, endedAt: 2, durationMs: 1, turns: [
          { id: "t1", role: "user", text: "hello world enough", createdAt: 1,
            review: { score: 85, original: "hello", better: "Hello", nativeLike: "Hey" } },
        ],
      },
    ]);
    render(<Growth />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText(/baseline/i)).toBeInTheDocument();
  });

  it("renders distribution bars + highlight when enough scored turns", () => {
    seedHistory([
      {
        id: "c1", topic: undefined, startedAt: 1, endedAt: 2, durationMs: 1, turns: [
          { id: "t1", role: "user", text: "good one", createdAt: 1,
            review: { score: 92, original: "good", better: "good", nativeLike: "great" } },
          { id: "t2", role: "user", text: "okay one", createdAt: 2,
            review: { score: 73, original: "okay", better: "okay", nativeLike: "fine" } },
          { id: "t3", role: "user", text: "weak one", createdAt: 3,
            review: { score: 45, original: "weak", better: "weak", nativeLike: "fine" } },
        ],
      },
    ]);
    render(<Growth />);
    // Score distribution heading
    expect(screen.getByText("Score distribution")).toBeInTheDocument();
    // Highlight title + 2 sub-cards
    expect(screen.getByText("Highlights")).toBeInTheDocument();
    expect(screen.getByText(/Best so far/)).toBeInTheDocument();
    expect(screen.getByText(/Worth revisiting/)).toBeInTheDocument();
  });
});
