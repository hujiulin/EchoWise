import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPanel from "../../src/components/AboutPanel";

describe("AboutPanel", () => {
  it("shows product name + tagline + version", () => {
    render(<AboutPanel />);
    expect(screen.getByText("EchoWise")).toBeInTheDocument();
    expect(screen.getByText("Just talk.")).toBeInTheDocument();
    expect(screen.getByText(/Version/)).toBeInTheDocument();
  });

  it("links to source, issues, license", () => {
    render(<AboutPanel />);
    expect(screen.getByText("Source code")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("License")).toBeInTheDocument();
  });

  it("shows philosophy copy", () => {
    render(<AboutPanel />);
    expect(screen.getByText(/AI companion/i)).toBeInTheDocument();
  });
});
