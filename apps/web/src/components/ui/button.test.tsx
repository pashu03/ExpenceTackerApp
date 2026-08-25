import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("keeps native button semantics and its accessible name", () => {
    render(<Button type="submit">Save expense</Button>);

    expect(screen.getByRole("button", { name: "Save expense" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});

