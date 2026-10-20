import fs from "fs";
import path from "path";

import {
  FONT_FAMILY,
  getLineHeight,
  getVerticalOffset,
  registerCustomFontMetrics,
} from "@excalidraw/common";

import { parseFontFile } from "../../fonts/fontParser";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/fonts");

describe("customFonts", () => {
  const readFixture = (name: string): Buffer => {
    return fs.readFileSync(path.join(FIXTURES_DIR, name));
  };

  it("loads and parses TestSans-Regular.ttf, TestSans-Regular.woff, TestSans-Regular.woff2, TestThai-Regular.ttf", async () => {
    const ttf = await parseFontFile(
      readFixture("TestSans-Regular.ttf"),
      "TestSans-Regular.ttf",
    );
    const woff = await parseFontFile(
      readFixture("TestSans-Regular.woff"),
      "TestSans-Regular.woff",
    );
    const woff2 = await parseFontFile(
      readFixture("TestSans-Regular.woff2"),
      "TestSans-Regular.woff2",
    );
    const thai = await parseFontFile(
      readFixture("TestThai-Regular.ttf"),
      "TestThai-Regular.ttf",
    );

    expect(ttf.format).toBe("ttf");
    expect(woff.format).toBe("woff");
    expect(woff2.format).toBe("woff2");
    expect(thai.format).toBe("ttf");

    expect(ttf.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(woff.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(woff2.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(thai.id).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("asserts matching metrics (unitsPerEm, ascender, descender) across TTF, WOFF, WOFF2", async () => {
    const ttf = await parseFontFile(readFixture("TestSans-Regular.ttf"));
    const woff = await parseFontFile(readFixture("TestSans-Regular.woff"));
    const woff2 = await parseFontFile(readFixture("TestSans-Regular.woff2"));

    expect(ttf.metrics.unitsPerEm).toBe(1000);
    expect(woff.metrics.unitsPerEm).toBe(ttf.metrics.unitsPerEm);
    expect(woff2.metrics.unitsPerEm).toBe(ttf.metrics.unitsPerEm);

    expect(ttf.metrics.ascender).toBe(928);
    expect(woff.metrics.ascender).toBe(ttf.metrics.ascender);
    expect(woff2.metrics.ascender).toBe(ttf.metrics.ascender);

    expect(ttf.metrics.descender).toBe(-244);
    expect(woff.metrics.descender).toBe(ttf.metrics.descender);
    expect(woff2.metrics.descender).toBe(ttf.metrics.descender);

    expect(ttf.metrics.lineGap).toBe(33);
    expect(woff.metrics.lineGap).toBe(ttf.metrics.lineGap);
    expect(woff2.metrics.lineGap).toBe(ttf.metrics.lineGap);

    expect(ttf.metrics.lineHeight).toBeCloseTo(1.205, 3);
    expect(woff.metrics.lineHeight).toBeCloseTo(ttf.metrics.lineHeight, 3);
    expect(woff2.metrics.lineHeight).toBeCloseTo(ttf.metrics.lineHeight, 3);
  });

  it("calculates baseline vertical offset and lineHeight for Thai string 'ภาษาไทย กิ้'", async () => {
    const thaiBuffer = readFixture("TestThai-Regular.ttf");
    const thaiFont = await parseFontFile(thaiBuffer, "TestThai-Regular.ttf");

    registerCustomFontMetrics(thaiFont.id, thaiFont.metrics);

    expect(thaiFont.metrics.unitsPerEm).toBe(2100);
    expect(thaiFont.metrics.ascender).toBe(2241);
    expect(thaiFont.metrics.descender).toBe(-674);

    const calculatedLineHeight = (2241 - -674 + 0) / 2100;
    expect(thaiFont.metrics.lineHeight).toBeCloseTo(calculatedLineHeight, 3);

    const lineHeight = getLineHeight(FONT_FAMILY.Excalifont, thaiFont.id);
    expect(lineHeight).toBeCloseTo(calculatedLineHeight, 3);

    const fontSize = 24;
    const lineHeightPx = fontSize * lineHeight;
    const verticalOffset = getVerticalOffset(
      FONT_FAMILY.Excalifont,
      fontSize,
      lineHeightPx,
      thaiFont.id,
    );

    const fontSizeEm = fontSize / thaiFont.metrics.unitsPerEm;
    const expectedLineGap =
      (lineHeightPx -
        fontSizeEm * thaiFont.metrics.ascender +
        fontSizeEm * thaiFont.metrics.descender) /
      2;
    const expectedOffset =
      fontSizeEm * thaiFont.metrics.ascender + expectedLineGap;

    expect(verticalOffset).toBeCloseTo(expectedOffset, 4);

    const thaiText = "ภาษาไทย กิ้";
    expect(thaiText.length).toBe(11);
    expect(verticalOffset).toBeGreaterThan(0);
    expect(verticalOffset).toBeLessThan(lineHeightPx);
  });

  it("rejects malformed buffer inputs", async () => {
    const truncatedBuffer = new Uint8Array([0x00, 0x01, 0x00]);
    await expect(parseFontFile(truncatedBuffer)).rejects.toThrow(
      "Corrupt font header: buffer is truncated (less than 12 bytes)",
    );

    const invalidSignature = new Uint8Array([
      0xaa, 0xbb, 0xcc, 0xdd, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    await expect(parseFontFile(invalidSignature)).rejects.toThrow(
      "Unsupported or invalid font format signature: 0xaabbccdd",
    );

    const corruptWoff = new Uint8Array(44);
    const view = new DataView(corruptWoff.buffer);
    view.setUint32(0, 0x774f4646);
    view.setUint32(4, 0x00010000);
    view.setUint32(8, 44);
    view.setUint16(12, 10);
    view.setUint32(16, 100);
    await expect(parseFontFile(corruptWoff)).rejects.toThrow(
      "Corrupt WOFF header: table directory truncated",
    );
  });
});
