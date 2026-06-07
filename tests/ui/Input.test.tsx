import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Input, Label } from "../../src/components/ui/Input";

function Controlled() {
  const [v, setV] = useState("");
  return (
    <>
      <Label htmlFor="t">Field</Label>
      <Input id="t" value={v} onChange={(e) => setV(e.target.value)} />
      <div data-testid="echo">{v}</div>
    </>
  );
}

describe("Input + Label", () => {
  it("renders and accepts typing", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByLabelText("Field"), "hello");
    expect(screen.getByTestId("echo")).toHaveTextContent("hello");
  });

  it("base style classes applied", () => {
    render(<Input />);
    const el = screen.getByRole("textbox");
    expect(el.className).toContain("rounded-md");
    expect(el.className).toContain("h-9");
  });

  it("merges custom className", () => {
    render(<Input className="custom" />);
    expect(screen.getByRole("textbox").className).toContain("custom");
  });
});
