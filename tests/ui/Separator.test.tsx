import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "../../src/components/ui/Separator";

describe("Separator", () => {
  it("renders thin horizontal rule by default", () => {
    const { container } = render(<Separator />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-px");
    expect(el.className).toContain("w-full");
  });

  it("forwards className", () => {
    const { container } = render(<Separator className="my-3" />);
    expect((container.firstChild as HTMLElement).className).toContain("my-3");
  });
});
