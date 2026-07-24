// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripCardMenu } from "./trip-card-menu";

const renameTripAction = vi.fn();
const deleteTripAction = vi.fn();

vi.mock("@/actions/trips", () => ({
  renameTripAction: (formData: FormData) => renameTripAction(formData),
  deleteTripAction: (formData: FormData) => deleteTripAction(formData),
}));

describe("TripCardMenu (@phase6)", () => {
  beforeEach(() => {
    renameTripAction.mockClear();
    deleteTripAction.mockClear();
  });

  it("opens the overflow menu with Rename and Delete", () => {
    render(<TripCardMenu tripId="trip-1" title="Lisbon getaway" />);
    fireEvent.click(screen.getByTestId("trip-card-menu-trigger"));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toBeInTheDocument();
  });

  it("rename shows an input pre-filled with the current title", () => {
    render(<TripCardMenu tripId="trip-1" title="Lisbon getaway" />);
    fireEvent.click(screen.getByTestId("trip-card-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByTestId("trip-rename-input") as HTMLInputElement;
    expect(input.value).toBe("Lisbon getaway");
  });

  it("blurring the rename input submits the new title and tripId", () => {
    render(<TripCardMenu tripId="trip-1" title="Lisbon getaway" />);
    fireEvent.click(screen.getByTestId("trip-card-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByTestId("trip-rename-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Porto weekend" } });
    fireEvent.blur(input);
    expect(renameTripAction).toHaveBeenCalledTimes(1);
    const formData = renameTripAction.mock.calls[0][0] as FormData;
    expect(formData.get("tripId")).toBe("trip-1");
    expect(formData.get("title")).toBe("Porto weekend");
  });

  it("delete shows a plain Cancel/Confirm row with no shaming copy, and Cancel returns to idle without submitting", () => {
    render(<TripCardMenu tripId="trip-1" title="Lisbon getaway" />);
    fireEvent.click(screen.getByTestId("trip-card-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));
    expect(screen.getByText(/no undo/i)).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).toBeNull();

    fireEvent.click(screen.getByText("Cancel"));
    expect(deleteTripAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("trip-card-menu-trigger")).toBeInTheDocument();
  });

  it("confirming delete submits the tripId", () => {
    render(<TripCardMenu tripId="trip-1" title="Lisbon getaway" />);
    fireEvent.click(screen.getByTestId("trip-card-menu-trigger"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));
    fireEvent.click(screen.getByTestId("trip-delete-confirm"));
    expect(deleteTripAction).toHaveBeenCalledTimes(1);
    const formData = deleteTripAction.mock.calls[0][0] as FormData;
    expect(formData.get("tripId")).toBe("trip-1");
  });
});
