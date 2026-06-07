import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../src/components/ui/Card";

describe("Card family", () => {
  it("Card renders div with shadow + border classes", () => {
    const { container } = render(<Card>body</Card>);
    expect(container.firstChild).toHaveClass("rounded-xl");
    expect(container.firstChild).toHaveClass("border");
  });

  it("CardHeader/Title/Description compose visually", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>T</CardTitle>
          <CardDescription>D</CardDescription>
        </CardHeader>
      </Card>
    );
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("CardContent + CardFooter render children", () => {
    render(
      <Card>
        <CardContent>content</CardContent>
        <CardFooter>footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
  });
});
