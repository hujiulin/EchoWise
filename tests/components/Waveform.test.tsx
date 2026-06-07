import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Waveform from "../../src/components/Waveform";

describe("Waveform", () => {
  it("renders the requested number of bars", () => {
    const { container } = render(<Waveform currentLevel={0.5} bars={12} />);
    expect(container.querySelectorAll("span").length).toBe(12);
  });

  it("default bar count is 18", () => {
    const { container } = render(<Waveform currentLevel={0} />);
    expect(container.querySelectorAll("span").length).toBe(18);
  });

  it("forwards className", () => {
    const { container } = render(<Waveform currentLevel={0} className="custom-cls" />);
    expect((container.firstChild as HTMLElement).className).toContain("custom-cls");
  });
});
