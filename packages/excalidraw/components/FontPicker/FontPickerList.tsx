import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEventHandler,
} from "react";

import { type FontFamilyValues } from "@excalidraw/element/types";

import { isTextElement, redrawTextBoundingBox } from "@excalidraw/element";

import {
  arrayToList,
  debounce,
  FONT_FAMILY,
  getFontFamilyString,
} from "@excalidraw/common";

import type { SceneFontAsset } from "@excalidraw/common";

import type { ValueOf } from "@excalidraw/common/utility-types";

import {
  loadCustomFontsFromStorage,
  saveCustomFontToStorage,
} from "../../data/fontStorage";
import { Fonts } from "../../fonts";
import { parseFontFile } from "../../fonts/fontParser";
import { getSelectedElements } from "../../scene";
import { t } from "../../i18n";
import {
  useApp,
  useAppProps,
  useExcalidrawAPI,
  useExcalidrawContainer,
  useStylesPanelMode,
} from "../App";
import { PropertiesPopover } from "../PropertiesPopover";
import { QuickSearch } from "../QuickSearch";
import { ScrollableList } from "../ScrollableList";
import { TopPicksTip } from "../TopPicksDnD/TopPicksTip";
import DropdownMenuGroup from "../dropdownMenu/DropdownMenuGroup";
import {
  DropDownMenuItemBadgeType,
  DropDownMenuItemBadge,
} from "../dropdownMenu/DropdownMenuItem";
import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import {
  FontFamilyCodeIcon,
  FontFamilyHeadingIcon,
  FontFamilyNormalIcon,
  FreedrawIcon,
} from "../icons";

import { useFontPickerDnD } from "./fontTopPicksDnD";
import { fontPickerKeyHandler } from "./keyboardNavHandlers";

import type { JSX } from "react";
import type { AppState } from "../../types";
import type { ExcalidrawFontFace } from "../../fonts/ExcalidrawFontFace";

const MAX_FONT_FILE_SIZE = 20 * 1024 * 1024;

const FONT_FILE_ACCEPT = ".ttf,.otf,.woff,.woff2";

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export interface FontDescriptor {
  value: number;
  icon: JSX.Element;
  text: string;
  deprecated?: true;
  badge?: {
    type: ValueOf<typeof DropDownMenuItemBadgeType>;
    placeholder: string;
  };
}

interface FontPickerListProps {
  selectedFontFamily: FontFamilyValues | null;
  hoveredFontFamily: FontFamilyValues | null;
  onSelect: (value: number) => void;
  onHover: (value: number) => void;
  onLeave: () => void;
  onOpen: () => void;
  onClose: () => void;
  /** present only while the top picks are customized */
  onResetTopPicks?: () => void;
}

export const getFontFamilyIcon = (
  fontFamily: FontFamilyValues,
): JSX.Element => {
  switch (fontFamily) {
    case FONT_FAMILY.Excalifont:
    case FONT_FAMILY.Virgil:
      return FreedrawIcon;
    case FONT_FAMILY.Nunito:
    case FONT_FAMILY.Helvetica:
      return FontFamilyNormalIcon;
    case FONT_FAMILY["Lilita One"]:
      return FontFamilyHeadingIcon;
    case FONT_FAMILY["Comic Shanns"]:
    case FONT_FAMILY.Cascadia:
      return FontFamilyCodeIcon;
    default:
      return FontFamilyNormalIcon;
  }
};

export const getFontFamilyLabel = (
  fontFamily: FontFamilyValues,
  fontFaces: ExcalidrawFontFace[],
) =>
  // prefer our config as the browser resolved names may be wrapped in quotes and such
  Object.entries(FONT_FAMILY).find(([, id]) => id === fontFamily)?.[0] ??
  fontFaces[0]?.fontFace?.family ??
  "Unknown";

export const FontPickerList = React.memo(
  ({
    selectedFontFamily,
    hoveredFontFamily,
    onSelect,
    onHover,
    onLeave,
    onOpen,
    onClose,
    onResetTopPicks,
  }: FontPickerListProps) => {
    const { container } = useExcalidrawContainer();
    const app = useApp();
    const api = useExcalidrawAPI();
    const { fonts } = app;
    const { showDeprecatedFonts } = useAppProps();
    const stylesPanelMode = useStylesPanelMode();
    // present only when the top picks are customizable
    const dnd = useFontPickerDnD();

    const [searchTerm, setSearchTerm] = useState("");
    const [customFonts, setCustomFonts] = useState<readonly SceneFontAsset[]>(
      () => {
        const fromMap = Array.from(Fonts.customFonts.values());
        const fromAppState = Object.values(app.state.fonts || {});
        const map = new Map<string, SceneFontAsset>();
        for (const asset of [...fromMap, ...fromAppState]) {
          map.set(asset.id, asset);
        }
        return Array.from(map.values());
      },
    );
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      let cancelled = false;
      loadCustomFontsFromStorage().then(async (storedAssets) => {
        if (cancelled || !storedAssets.length) {
          return;
        }
        await Promise.all(
          storedAssets.map((asset) => fonts.registerCustomFont(asset)),
        );
        if (!cancelled) {
          setCustomFonts((prev) => {
            const map = new Map<string, SceneFontAsset>();
            for (const asset of [...prev, ...storedAssets]) {
              map.set(asset.id, asset);
            }
            return Array.from(map.values());
          });
        }
      });
      return () => {
        cancelled = true;
      };
    }, [fonts]);

    // applies a custom font: stores it on the scene and sets `fontRef` on
    // selected text elements (or just the current item when nothing selected)
    const applyCustomFont = useCallback(
      (asset: SceneFontAsset) => {
        const elements = app.scene.getElementsIncludingDeleted();
        const appState = app.state;
        const nextFonts = { ...appState.fonts, [asset.id]: asset };

        const selectedTextElements = getSelectedElements(elements, appState, {
          includeBoundTextElement: true,
        }).filter(isTextElement);

        if (selectedTextElements.length) {
          for (const element of selectedTextElements) {
            app.scene.mutateElement(element, { fontRef: asset.id });
          }

          // re-measure and redraw once the custom face is available, otherwise
          // the text keeps its old bounding box and fallback glyphs
          const family = Fonts.getCustomFontFamilyName(asset.id);
          const fontString = `10px "${family}"`;
          const chars = Array.from(
            new Set(selectedTextElements.map((el) => el.originalText).join("")),
          ).join();

          Promise.resolve(app.ownerDocument.fonts.load(fontString, chars)).then(
            () => {
              for (const element of selectedTextElements) {
                const latest = app.scene.getElement(element.id);
                if (latest && isTextElement(latest)) {
                  redrawTextBoundingBox(
                    latest,
                    latest.containerId
                      ? app.scene.getElement(latest.containerId) ?? null
                      : null,
                    app.scene,
                  );
                }
              }
            },
          );
        }
        app.setAppState({
          fonts: nextFonts,
          currentItemFontRef: asset.id,
        } as unknown as AppState);
      },
      [app],
    );

    const handleFontFileUpload = useCallback(
      async (file: File) => {
        if (file.size > MAX_FONT_FILE_SIZE) {
          console.error(
            `Font file "${file.name}" exceeds maximum allowed size of 20MB`,
          );
          api?.setToast({
            message: t("fontList.uploadTooLarge"),
            closable: true,
          });
          return;
        }

        try {
          const buffer = await file.arrayBuffer();
          const parsed = await parseFontFile(buffer, file.name);
          const dataUrl = await readFileAsDataURL(file);

          const asset: SceneFontAsset = {
            id: parsed.id,
            name: file.name.replace(/\.[^/.]+$/, ""),
            format: parsed.format,
            data: dataUrl,
            metrics: parsed.metrics,
          };

          await fonts.registerCustomFont(asset);
          await saveCustomFontToStorage(asset);

          setCustomFonts((prev) =>
            prev.some((existing) => existing.id === asset.id)
              ? prev
              : [...prev, asset],
          );

          applyCustomFont(asset);
        } catch (error) {
          console.error(`Failed to load custom font "${file.name}"`, error);
          api?.setToast({
            message: t("fontList.uploadInvalid"),
            closable: true,
          });
        }
      },
      [fonts, applyCustomFont, api],
    );
    const allFonts = useMemo(
      () =>
        Array.from(Fonts.registered.entries())
          .filter(
            ([_, { metadata }]) => !metadata.private && !metadata.fallback,
          )
          .map(([familyId, { metadata, fontFaces }]) => {
            const fontDescriptor = {
              value: familyId,
              icon: getFontFamilyIcon(familyId),
              text: getFontFamilyLabel(familyId, fontFaces),
            };

            if (metadata.deprecated) {
              Object.assign(fontDescriptor, {
                deprecated: metadata.deprecated,
                badge: {
                  type: DropDownMenuItemBadgeType.RED,
                  placeholder: t("fontList.badge.old"),
                },
              });
            }

            return fontDescriptor as FontDescriptor;
          })
          .sort((a, b) =>
            a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1,
          ),
      [],
    );

    const sceneFamilies = useMemo(
      () => new Set(fonts.getSceneFamilies()),
      // cache per selected font family, so hover re-render won't mess it up
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectedFontFamily],
    );

    const sceneFonts = useMemo(
      () => allFonts.filter((font) => sceneFamilies.has(font.value)), // always show all the fonts in the scene, even those that were deprecated
      [allFonts, sceneFamilies],
    );

    const availableFonts = useMemo(
      () =>
        allFonts.filter(
          (font) =>
            !sceneFamilies.has(font.value) &&
            (showDeprecatedFonts || !font.deprecated), // skip deprecated fonts
        ),
      [allFonts, sceneFamilies, showDeprecatedFonts],
    );

    const filteredFonts = useMemo(
      () =>
        arrayToList(
          [...sceneFonts, ...availableFonts].filter((font) =>
            font.text?.toLowerCase().includes(searchTerm),
          ),
        ),
      [sceneFonts, availableFonts, searchTerm],
    );

    const hoveredFont = useMemo(() => {
      let font;

      if (hoveredFontFamily) {
        font = filteredFonts.find((font) => font.value === hoveredFontFamily);
      } else if (selectedFontFamily) {
        font = filteredFonts.find((font) => font.value === selectedFontFamily);
      }

      if (!font && searchTerm) {
        if (filteredFonts[0]?.value) {
          // hover first element on search
          onHover(filteredFonts[0].value);
        } else {
          // re-render cache on no results
          onLeave();
        }
      }

      return font;
    }, [
      hoveredFontFamily,
      selectedFontFamily,
      searchTerm,
      filteredFonts,
      onHover,
      onLeave,
    ]);

    // Create a wrapped onSelect function that preserves caret position
    const wrappedOnSelect = useCallback(
      (fontFamily: FontFamilyValues) => {
        // Save caret position before font selection if editing text
        let savedSelection: { start: number; end: number } | null = null;
        if (app.state.editingTextElement) {
          const textEditor = document.querySelector(
            ".excalidraw-wysiwyg",
          ) as HTMLTextAreaElement;
          if (textEditor) {
            savedSelection = {
              start: textEditor.selectionStart,
              end: textEditor.selectionEnd,
            };
          }
        }

        onSelect(fontFamily);

        // Restore caret position after font selection if editing text
        if (app.state.editingTextElement && savedSelection) {
          setTimeout(() => {
            const textEditor = document.querySelector(
              ".excalidraw-wysiwyg",
            ) as HTMLTextAreaElement;
            if (textEditor && savedSelection) {
              textEditor.focus();
              textEditor.selectionStart = savedSelection.start;
              textEditor.selectionEnd = savedSelection.end;
            }
          }, 0);
        }
      },
      [onSelect, app.state.editingTextElement],
    );

    const onKeyDown = useCallback<KeyboardEventHandler<HTMLDivElement>>(
      (event) => {
        const handled = fontPickerKeyHandler({
          event,
          inputRef,
          hoveredFont,
          filteredFonts,
          onSelect: wrappedOnSelect,
          onHover,
          onClose,
        });

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [hoveredFont, filteredFonts, wrappedOnSelect, onHover, onClose],
    );

    useEffect(() => {
      onOpen();

      return () => {
        onClose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sceneFilteredFonts = useMemo(
      () => filteredFonts.filter((font) => sceneFamilies.has(font.value)),
      [filteredFonts, sceneFamilies],
    );

    const availableFilteredFonts = useMemo(
      () => filteredFonts.filter((font) => !sceneFamilies.has(font.value)),
      [filteredFonts, sceneFamilies],
    );

    const FontPickerListItem = ({
      font,
      order,
    }: {
      font: FontDescriptor;
      order: number;
    }) => {
      const ref = useRef<HTMLButtonElement>(null);
      const isHovered = font.value === hoveredFont?.value;
      const isSelected = font.value === selectedFontFamily;

      useEffect(() => {
        if (!isHovered) {
          return;
        }
        if (order === 0) {
          // scroll into the first item differently, so it's visible what is above (i.e. group title)
          ref.current?.scrollIntoView?.({ block: "end" });
        } else {
          ref.current?.scrollIntoView?.({ block: "nearest" });
        }
      }, [isHovered, order]);

      return (
        <button
          ref={ref}
          type="button"
          value={font.value}
          className={getDropdownMenuItemClassName("", isSelected, isHovered)}
          title={font.text}
          // allow to tab between search and selected font
          tabIndex={isSelected ? 0 : -1}
          onClick={(e) => {
            wrappedOnSelect(Number(e.currentTarget.value));
          }}
          onMouseMove={() => {
            // don't live-preview fonts the dragged one merely passes over
            if (!dnd?.dragState && hoveredFont?.value !== font.value) {
              onHover(font.value);
            }
          }}
          onPointerDown={
            dnd ? (event) => dnd.startSourceDrag(event, font.value) : undefined
          }
        >
          <MenuItemContent
            icon={font.icon}
            badge={
              font.badge && (
                <DropDownMenuItemBadge type={font.badge.type}>
                  {font.badge.placeholder}
                </DropDownMenuItemBadge>
              )
            }
            textStyle={{
              fontFamily: getFontFamilyString({ fontFamily: font.value }),
            }}
          >
            {font.text}
          </MenuItemContent>
        </button>
      );
    };

    const groups = [];

    if (sceneFilteredFonts.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.sceneFonts")} key="group_1">
          {sceneFilteredFonts.map((font, index) => (
            <FontPickerListItem key={font.value} font={font} order={index} />
          ))}
        </DropdownMenuGroup>,
      );
    }

    if (availableFilteredFonts.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.availableFonts")} key="group_2">
          {availableFilteredFonts.map((font, index) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              order={index + sceneFilteredFonts.length}
            />
          ))}
        </DropdownMenuGroup>,
      );
    }

    const filteredCustomFonts = customFonts.filter((asset) =>
      asset.name.toLowerCase().includes(searchTerm),
    );

    return (
      <PropertiesPopover
        className="properties-content"
        container={container}
        style={{ width: "15rem" }}
        onClose={() => {
          onClose();

          // Refocus text editor when font picker closes if we were editing text
          if (app.state.editingTextElement) {
            setTimeout(() => {
              const textEditor = document.querySelector(
                ".excalidraw-wysiwyg",
              ) as HTMLTextAreaElement;
              if (textEditor) {
                textEditor.focus();
              }
            }, 0);
          }
        }}
        onPointerLeave={onLeave}
        onKeyDown={onKeyDown}
        preventAutoFocusOnTouch={!!app.state.editingTextElement}
      >
        {stylesPanelMode === "full" && (
          <QuickSearch
            ref={inputRef}
            placeholder={t("quickSearch.placeholder")}
            onChange={debounce(setSearchTerm, 20)}
          />
        )}
        <ScrollableList
          className="dropdown-menu fonts manual-hover"
          placeholder={t("fontList.empty")}
        >
          {groups.length ? groups : null}
          {filteredCustomFonts.length > 0 && (
            <DropdownMenuGroup title="Custom Fonts" key="group_custom">
              {filteredCustomFonts.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  data-testid="font-picker-item-custom"
                  className={getDropdownMenuItemClassName("", false, false)}
                  title={asset.name}
                  onClick={() => applyCustomFont(asset)}
                >
                  <MenuItemContent
                    icon={FontFamilyNormalIcon}
                    textStyle={{
                      fontFamily: Fonts.getCustomFontFamilyName(asset.id),
                    }}
                  >
                    {asset.name}
                  </MenuItemContent>
                </button>
              ))}
            </DropdownMenuGroup>
          )}
          <div className="FontPicker__custom-font-upload">
            <button
              type="button"
              data-testid="font-picker-add-font"
              className={getDropdownMenuItemClassName("", false, false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <MenuItemContent icon={FontFamilyNormalIcon}>
                Add font
              </MenuItemContent>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={FONT_FILE_ACCEPT}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  handleFontFileUpload(file);
                }
                // reset so picking the same file again re-triggers onChange
                event.target.value = "";
              }}
            />
          </div>
        </ScrollableList>
        {dnd && (
          <TopPicksTip
            className="FontPicker__tip"
            tip={t("fontList.topPicksTip")}
            onReset={onResetTopPicks}
            resetTitle={t("fontList.resetTopPicks")}
          />
        )}
      </PropertiesPopover>
    );
  },
  (prev, next) =>
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily &&
    !!prev.onResetTopPicks === !!next.onResetTopPicks,
);
