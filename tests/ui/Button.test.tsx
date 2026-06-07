import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../../src/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("forwards onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    ["default",    "bg-primary"],
    ["secondary",  "bg-secondary"],
    ["outline",    "border"],
    ["ghost",      "hover:bg-accent"],
    ["destructive","bg-destructive"],
  ] as const)("variant=%s adds expected class fragment", (variant, frag) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole("button").className).toContain(frag);
  });

  it.each([
    ["sm",   "h-8"],
    ["lg",   "h-11"],
    ["icon", "w-9"],
  ] as const)("size=%s adds expected class fragment", (size, frag) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole("button").className).toContain(frag);
  });

  it("merges className without dropping defaults", () => {
    render(<Button className="extra">x</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("extra");
    expect(btn.className).toContain("bg-primary");
  });

  it("respects disabled attribute", () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
