import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../../src/components/ui/Badge";

describe("Badge", () => {
  it("renders default variant", () => {
    render(<Badge>new</Badge>);
    expect(screen.getByText("new").className).toContain("bg-primary");
  });

  it.each([
    ["secondary", "bg-secondary"],
    ["outline",   "border"],
    ["success",   "emerald"],
  ] as const)("variant=%s applies class fragment", (variant, frag) => {
    render(<Badge variant={variant}>x</Badge>);
    expect(screen.getByText("x").className).toMatch(new RegExp(frag));
  });

  it("merges custom className", () => {
    render(<Badge className="my-class">y</Badge>);
    expect(screen.getByText("y").className).toContain("my-class");
  });
});
