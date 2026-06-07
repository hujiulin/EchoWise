import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Logo from "../../src/components/Logo";

describe("Logo", () => {
  it("renders svg with aria-label", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg")!;
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("aria-label")).toBe("EchoWise");
  });
  it("respects size prop", () => {
    const { container } = render(<Logo size={64} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("height")).toBe("64");
  });
  it("uses currentColor so it inherits theme", () => {
    const { container } = render(<Logo />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("stroke")).toBe("currentColor");
  });
});
