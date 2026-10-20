import fs from "fs";
import path from "path";

import { parseFontFile } from "../../fonts/fontParser";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/fonts");

describe("fontParser", () => {
  const readFixture = (name: string): Buffer => {
    return fs.readFileSync(path.join(FIXTURES_DIR, name));
  };

  it("parses TTF font and extracts correct metrics", async () => {
    const buffer = readFixture("TestSans-Regular.ttf");
    const parsed = await parseFontFile(buffer, "TestSans-Regular.ttf");

    expect(parsed.format).toBe("ttf");
    expect(parsed.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.metrics.unitsPerEm).toBe(1000);
    expect(parsed.metrics.ascender).toBe(928);
    expect(parsed.metrics.descender).toBe(-244);
    expect(parsed.metrics.lineGap).toBe(33);
    expect(parsed.metrics.lineHeight).toBeCloseTo(1.205, 3);
  });

  it("parses OTF (CFF) font and extracts correct metrics", async () => {
    const buffer = readFixture("TestSans-Regular.otf");
    const parsed = await parseFontFile(buffer, "TestSans-Regular.otf");

    expect(parsed.format).toBe("otf");
    expect(parsed.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.metrics.unitsPerEm).toBe(1000);
    expect(parsed.metrics.ascender).toBe(120);
    expect(parsed.metrics.descender).toBe(0);
  });

  it("reports OTF format for CFF signature regardless of file extension", async () => {
    const buffer = readFixture("TestSans-Regular.otf");
    const parsed = await parseFontFile(buffer, "renamed.bin");

    expect(parsed.format).toBe("otf");
  });

  it("parses WOFF font and extracts correct metrics", async () => {
    const buffer = readFixture("TestSans-Regular.woff");
    const parsed = await parseFontFile(buffer, "TestSans-Regular.woff");

    expect(parsed.format).toBe("woff");
    expect(parsed.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.metrics.unitsPerEm).toBe(1000);
    expect(parsed.metrics.ascender).toBe(928);
    expect(parsed.metrics.descender).toBe(-244);
    expect(parsed.metrics.lineGap).toBe(33);
    expect(parsed.metrics.lineHeight).toBeCloseTo(1.205, 3);
  });

  it("parses WOFF2 font and extracts correct metrics", async () => {
    const buffer = readFixture("TestSans-Regular.woff2");
    const parsed = await parseFontFile(buffer, "TestSans-Regular.woff2");

    expect(parsed.format).toBe("woff2");
    expect(parsed.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.metrics.unitsPerEm).toBe(1000);
    expect(parsed.metrics.ascender).toBe(928);
    expect(parsed.metrics.descender).toBe(-244);
    expect(parsed.metrics.lineGap).toBe(33);
    expect(parsed.metrics.lineHeight).toBeCloseTo(1.205, 3);
  });

  it("parses Thai TTF font and extracts metrics with diacritic clearance", async () => {
    const buffer = readFixture("TestThai-Regular.ttf");
    const parsed = await parseFontFile(buffer, "TestThai-Regular.ttf");

    expect(parsed.format).toBe("ttf");
    expect(parsed.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.metrics.unitsPerEm).toBe(2100);
    expect(parsed.metrics.ascender).toBe(2241);
    expect(parsed.metrics.descender).toBe(-674);
    expect(parsed.metrics.lineGap).toBe(0);
    expect(parsed.metrics.lineHeight).toBeCloseTo(2915 / 2100, 3);
  });

  it("extracts identical metrics across TTF, WOFF, and WOFF2 formats", async () => {
    const ttf = await parseFontFile(readFixture("TestSans-Regular.ttf"));
    const woff = await parseFontFile(readFixture("TestSans-Regular.woff"));
    const woff2 = await parseFontFile(readFixture("TestSans-Regular.woff2"));

    expect(ttf.metrics.unitsPerEm).toBe(woff.metrics.unitsPerEm);
    expect(ttf.metrics.unitsPerEm).toBe(woff2.metrics.unitsPerEm);

    expect(ttf.metrics.ascender).toBe(woff.metrics.ascender);
    expect(ttf.metrics.ascender).toBe(woff2.metrics.ascender);

    expect(ttf.metrics.descender).toBe(woff.metrics.descender);
    expect(ttf.metrics.descender).toBe(woff2.metrics.descender);

    expect(ttf.metrics.lineGap).toBe(woff.metrics.lineGap);
    expect(ttf.metrics.lineGap).toBe(woff2.metrics.lineGap);

    expect(ttf.metrics.lineHeight).toBe(woff.metrics.lineHeight);
    expect(ttf.metrics.lineHeight).toBe(woff2.metrics.lineHeight);

    expect(ttf.id).not.toBe(woff.id);
    expect(ttf.id).not.toBe(woff2.id);
    expect(woff.id).not.toBe(woff2.id);
  });

  it("rejects buffers exceeding 20MB", async () => {
    const oversized = new Uint8Array(20 * 1024 * 1024 + 1);
    await expect(parseFontFile(oversized)).rejects.toThrow(
      "Font file exceeds maximum allowed size of 20MB",
    );
  });

  it("rejects truncated buffer under 12 bytes", async () => {
    const truncated = new Uint8Array([0x00, 0x01, 0x00]);
    await expect(parseFontFile(truncated)).rejects.toThrow(
      "Corrupt font header: buffer is truncated (less than 12 bytes)",
    );
  });

  it("rejects buffer with unsupported signature", async () => {
    const invalid = new Uint8Array([
      0x12, 0x34, 0x56, 0x78, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    await expect(parseFontFile(invalid)).rejects.toThrow(
      "Unsupported or invalid font format signature: 0x12345678",
    );
  });

  it("rejects corrupt WOFF table directory", async () => {
    const corruptWoff = new Uint8Array(44);
    const view = new DataView(corruptWoff.buffer);
    view.setUint32(0, 0x774f4646);
    view.setUint32(4, 0x00010000);
    view.setUint32(8, 44);
    view.setUint16(12, 5);
    view.setUint32(16, 100);

    await expect(parseFontFile(corruptWoff)).rejects.toThrow(
      "Corrupt WOFF header: table directory truncated",
    );
  });

  it("accepts ArrayBuffer and Uint8Array input types", async () => {
    const buffer = readFixture("TestSans-Regular.ttf");
    const fromArrayBuffer = await parseFontFile(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
    );
    const fromUint8Array = await parseFontFile(new Uint8Array(buffer));

    expect(fromArrayBuffer.id).toBe(fromUint8Array.id);
    expect(fromArrayBuffer.metrics).toEqual(fromUint8Array.metrics);
  });
});
