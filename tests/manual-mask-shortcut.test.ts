import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualMaskShortcut } from "../src/providers/chatgpt/manual-mask-shortcut";

afterEach(() => {
  document.body.innerHTML = "";
  document
    .querySelectorAll("#prompt-mask-manual-shortcut")
    .forEach((element) => element.remove());
});

describe("manual mask shortcut", () => {
  it("shows an accessible icon at the composer's upper-right edge", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({
      top: 300,
      right: 800,
      bottom: 360,
      left: 200,
      width: 600,
      height: 60,
      x: 200,
      y: 300,
      toJSON: () => ({}),
    });
    const shortcut = new ManualMaskShortcut(vi.fn(), {
      shadowMode: "open",
    });

    shortcut.show(composer, 7);

    expect(shortcut.control.textContent).toBe("[•••]");
    expect(shortcut.control.getAttribute("aria-label")).toBe(
      "Maskuj zaznaczenie",
    );
    expect(shortcut.element.style.top).toBe("258px");
    expect(shortcut.element.style.left).toBe("752px");
    expect(shortcut.element.style.display).toBe("block");
    shortcut.unmount();
  });

  it("runs once for a trusted activation and ignores synthetic activation", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const trustedMask = vi.fn();
    const trusted = new ManualMaskShortcut(trustedMask, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });
    trusted.show(composer, 9);

    trusted.control.click();
    trusted.control.click();

    expect(trustedMask).toHaveBeenCalledOnce();
    expect(trustedMask).toHaveBeenCalledWith(9);
    expect(trusted.element.style.display).toBe("none");
    trusted.unmount();

    const untrustedMask = vi.fn();
    const untrusted = new ManualMaskShortcut(untrustedMask, {
      shadowMode: "open",
    });
    untrusted.show(composer, 10);
    untrusted.control.click();
    expect(untrustedMask).not.toHaveBeenCalled();
    untrusted.unmount();
  });

  it("recognizes events from its isolated control", () => {
    const shortcut = new ManualMaskShortcut(vi.fn(), {
      shadowMode: "open",
    });
    shortcut.mount();
    const observed = vi.fn<(preserved: boolean) => void>();
    document.addEventListener(
      "pointerup",
      (event) => observed(shortcut.containsEvent(event)),
      { once: true },
    );

    shortcut.control.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, composed: true }),
    );

    expect(observed).toHaveBeenCalledWith(true);
    shortcut.unmount();
  });
});
