import fs from "fs";
import path from "path";

import { FONT_FAMILY, KEYS } from "@excalidraw/common";

import { Excalidraw } from "../..";
import { API } from "../../tests/helpers/api";
import { Keyboard } from "../../tests/helpers/ui";
import { act, fireEvent, render, waitFor } from "../../tests/test-utils";

const { h } = window;

(global as any).ResizeObserver =
  (global as any).ResizeObserver ||
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

describe("FontPicker", () => {
  it("should be able to open font picker", async () => {
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    Keyboard.keyPress(KEYS.T);

    const fontPickerTrigger = queryByTestId("font-family-show-fonts");

    expect(fontPickerTrigger).not.toBeNull();

    act(() => {
      fontPickerTrigger!.click();
    });
  });

  describe("top picks drag & drop", () => {
    const SLOT_SIZE = 32;
    const SLOT_SPAN = 40;

    // jsdom has no layout — lay the strip slots out horizontally, and
    // everything else (the list rows) well below the strip
    beforeEach(() => {
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect",
      ).mockImplementation(function (this: HTMLElement) {
        const index = this.dataset.topPickIndex;
        if (index != null) {
          return new DOMRect(
            Number(index) * SLOT_SPAN,
            0,
            SLOT_SIZE,
            SLOT_SIZE,
          );
        }
        if (this.classList.contains("top-picks-dnd")) {
          return new DOMRect(0, 0, SLOT_SPAN * 2 + SLOT_SIZE, SLOT_SIZE);
        }
        return new DOMRect(0, 300, SLOT_SIZE, SLOT_SIZE);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const slotCenter = (index: number) => ({
      clientX: index * SLOT_SPAN + SLOT_SIZE / 2,
      clientY: SLOT_SIZE / 2,
    });

    const drag = async (
      source: HTMLElement,
      from: { clientX: number; clientY: number },
      to: { clientX: number; clientY: number },
    ) => {
      fireEvent.pointerDown(source, { pointerId: 1, button: 0, ...from });
      // wait out the sloppy-click grace period
      await new Promise((resolve) => setTimeout(resolve, 120));
      fireEvent.pointerMove(window, { pointerId: 1, ...to });
      fireEvent.pointerUp(window, { pointerId: 1, ...to });
      // let the post-drop click suppression lapse
      await new Promise((resolve) => setTimeout(resolve, 120));
    };

    const getStripFamilies = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          ".FontPicker__top-picks [data-top-pick-index]",
        ),
      ).map((button) => button.title);

    const openFontPicker = async () => {
      const utils = await render(<Excalidraw handleKeyboardGlobally={true} />);
      Keyboard.keyPress(KEYS.T);
      act(() => {
        utils.queryByTestId("font-family-show-fonts")!.click();
      });
      await waitFor(() =>
        expect(
          document.querySelector('.dropdown-menu.fonts [title="Lilita One"]'),
        ).not.toBeNull(),
      );
      return utils;
    };

    it("pins a font dragged from the list, replacing the hovered slot", async () => {
      const { container } = await openFontPicker();

      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Lilita One"]',
      )!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(1));

      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY.Excalifont,
          FONT_FAMILY["Lilita One"],
          FONT_FAMILY["Comic Shanns"],
        ]),
      );
      expect(getStripFamilies(container)).toEqual([
        "Hand-drawn",
        "Lilita One",
        "Code",
      ]);
      // pinning doesn't pick the font
      expect(h.state.currentItemFontFamily).not.toBe(FONT_FAMILY["Lilita One"]);
    });

    it("refuses pinning an already pinned font", async () => {
      await openFontPicker();

      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Nunito"]',
      )!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(0));

      expect(h.state.fontTopPicks).toBe(null);
    });

    it("reorders picks dragged within the strip", async () => {
      const { container } = await openFontPicker();

      const firstPick = container.querySelector<HTMLElement>(
        '.FontPicker__top-picks [data-top-pick-index="0"]',
      )!;
      await drag(firstPick, slotCenter(0), slotCenter(2));

      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY.Nunito,
          FONT_FAMILY["Comic Shanns"],
          FONT_FAMILY.Excalifont,
        ]),
      );
      expect(getStripFamilies(container)).toEqual([
        "Normal",
        "Code",
        "Hand-drawn",
      ]);
    });

    it("pads a short customized list with unpicked defaults", async () => {
      const { container } = await openFontPicker();

      act(() => {
        API.setAppState({ fontTopPicks: [FONT_FAMILY["Lilita One"]] });
      });
      await waitFor(() =>
        expect(getStripFamilies(container)).toEqual([
          "Lilita One",
          "Hand-drawn",
          "Normal",
        ]),
      );

      // padded defaults count as pinned
      const row = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Nunito"]',
      )!;
      await drag(row, { clientX: 16, clientY: 316 }, slotCenter(0));
      expect(h.state.fontTopPicks).toEqual([FONT_FAMILY["Lilita One"]]);

      // dropping on a padded slot persists the full strip
      const code = document.querySelector<HTMLElement>(
        '.dropdown-menu.fonts [title="Comic Shanns"]',
      )!;
      await drag(code, { clientX: 16, clientY: 316 }, slotCenter(1));
      await waitFor(() =>
        expect(h.state.fontTopPicks).toEqual([
          FONT_FAMILY["Lilita One"],
          FONT_FAMILY["Comic Shanns"],
          FONT_FAMILY.Nunito,
        ]),
      );
    });

    it("resets customized picks from the tip's reset link", async () => {
      await openFontPicker();

      const getResetLink = () =>
        document.querySelector<HTMLElement>(
          ".FontPicker__tip .top-picks-dnd__tip-reset",
        );
      // nothing to reset while the picks are the defaults
      expect(getResetLink()).toBe(null);

      act(() => {
        API.setAppState({
          fontTopPicks: [FONT_FAMILY["Lilita One"], FONT_FAMILY.Nunito],
        });
      });
      await waitFor(() => expect(getResetLink()).not.toBe(null));

      act(() => {
        getResetLink()!.click();
      });

      expect(h.state.fontTopPicks).toBe(null);
      expect(h.state.openPopup).toBe("fontFamily");
      await waitFor(() => expect(getResetLink()).toBe(null));
    });
  });

  describe("custom font upload", () => {
    const FIXTURES_DIR = path.resolve(__dirname, "../../tests/fixtures/fonts");

    const openFontPicker = async () => {
      const utils = await render(<Excalidraw handleKeyboardGlobally={true} />);
      Keyboard.keyPress(KEYS.T);
      act(() => {
        utils.queryByTestId("font-family-show-fonts")!.click();
      });
      await waitFor(() =>
        expect(document.querySelector(".dropdown-menu.fonts")).not.toBeNull(),
      );
      return utils;
    };

    const getFileInput = () =>
      document.querySelector<HTMLInputElement>(
        ".FontPicker__custom-font-upload input[type='file']",
      )!;

    const getCustomRows = () =>
      document.querySelectorAll<HTMLElement>(
        '[data-testid="font-picker-item-custom"]',
      );

    const getCurrentFontRef = () =>
      (h.state as unknown as { currentItemFontRef: string | null })
        .currentItemFontRef;

    const getElementFontRef = () =>
      (h.elements[0] as unknown as { fontRef?: string | null }).fontRef ?? null;

    it("uploads an OTF font, lists it, and applies it to the selection", async () => {
      await openFontPicker();

      const buffer = fs.readFileSync(
        path.join(FIXTURES_DIR, "TestSans-Regular.otf"),
      );
      const file = new File([new Uint8Array(buffer)], "TestSans-Regular.otf", {
        type: "font/otf",
      });
      // jsdom's File predates Blob.arrayBuffer
      Object.defineProperty(file, "arrayBuffer", {
        value: () =>
          Promise.resolve(
            buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength,
            ),
          ),
      });
      const rowsBefore = getCustomRows().length;

      await act(async () => {
        fireEvent.change(getFileInput(), { target: { files: [file] } });
      });

      await waitFor(() => expect(getCustomRows().length).toBe(rowsBefore + 1));

      const rows = Array.from(getCustomRows());
      const uploaded = rows.find((row) => row.title === "TestSans-Regular");
      expect(uploaded).toBeDefined();

      await waitFor(() =>
        expect(getCurrentFontRef()).toMatch(/^sha256:[a-f0-9]{64}$/),
      );

      act(() => {
        uploaded!.click();
      });
      expect(getCurrentFontRef()).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("keeps the custom font applied after the picker closes", async () => {
      const { container } = await render(
        <Excalidraw handleKeyboardGlobally={true} />,
      );

      const text = API.createElement({
        type: "text",
        id: "text-custom-font",
        x: 0,
        y: 0,
        width: 200,
        height: 25,
        text: "Hello Custom 123",
        fontFamily: FONT_FAMILY.Excalifont,
        fontSize: 20,
      });
      act(() => {
        API.setElements([text]);
        API.setAppState({ selectedElementIds: { [text.id]: true } });
      });

      act(() => {
        container
          .querySelector<HTMLElement>('[data-testid="font-family-show-fonts"]')!
          .click();
      });
      await waitFor(() =>
        expect(document.querySelector(".dropdown-menu.fonts")).not.toBeNull(),
      );

      const buffer = fs.readFileSync(
        path.join(FIXTURES_DIR, "TestSans-Regular.otf"),
      );
      const file = new File([new Uint8Array(buffer)], "TestSans-Regular.otf", {
        type: "font/otf",
      });
      Object.defineProperty(file, "arrayBuffer", {
        value: () =>
          Promise.resolve(
            buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength,
            ),
          ),
      });

      await act(async () => {
        fireEvent.change(getFileInput(), { target: { files: [file] } });
      });

      await waitFor(() =>
        expect(getCurrentFontRef()).toMatch(/^sha256:[a-f0-9]{64}$/),
      );
      const appliedRef = getCurrentFontRef();
      expect(getElementFontRef()).toBe(appliedRef);

      // closing the picker must not restore the pre-open snapshot and drop the
      // freshly applied custom font
      act(() => {
        container
          .querySelector<HTMLElement>('[data-testid="font-family-show-fonts"]')!
          .click();
      });
      await waitFor(() => expect(h.state.openPopup).not.toBe("fontFamily"));

      expect(getElementFontRef()).toBe(appliedRef);
    });

    it("rejects font files larger than 20 MiB", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await openFontPicker();

      const rowsBefore = getCustomRows().length;
      const oversized = new File(
        [new Uint8Array(20 * 1024 * 1024 + 1)],
        "Huge.ttf",
        { type: "font/ttf" },
      );

      await act(async () => {
        fireEvent.change(getFileInput(), { target: { files: [oversized] } });
      });

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("exceeds maximum allowed size of 20MB"),
        ),
      );
      expect(getCustomRows().length).toBe(rowsBefore);
      expect(getCurrentFontRef() ?? null).toBeNull();
      // the user must see why nothing happened, not just a console line
      await waitFor(() =>
        expect(h.state.toast?.message).toBe("Font file is larger than 20MB"),
      );

      errorSpy.mockRestore();
    });

    it("shows a toast when the font file cannot be parsed", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await openFontPicker();

      const garbage = new File([new Uint8Array([1, 2, 3, 4, 5])], "Bad.ttf", {
        type: "font/ttf",
      });
      Object.defineProperty(garbage, "arrayBuffer", {
        value: () => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]).buffer),
      });

      await act(async () => {
        fireEvent.change(getFileInput(), { target: { files: [garbage] } });
      });

      await waitFor(() =>
        expect(h.state.toast?.message).toBe("Could not read this font file"),
      );
      expect(getCurrentFontRef() ?? null).toBeNull();

      errorSpy.mockRestore();
    });
  });
});
