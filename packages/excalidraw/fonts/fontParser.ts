import type { FontAssetId, FontFormat } from "@excalidraw/common";

import loadWoff2 from "../subset/woff2/woff2-loader";

export type { FontAssetId, FontFormat };

export interface ParsedFontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineGap: number;
  lineHeight: number;
}

export interface ParsedFont {
  id: FontAssetId;
  format: FontFormat;
  metrics: ParsedFontMetrics;
}

const SFNT_TTF = 0x00010000;
const SFNT_CFF = 0x4f54544f;
const WOFF_1 = 0x774f4646;
const WOFF_2 = 0x774f4632;
const TTC = 0x74746366;

const MAX_FONT_SIZE = 20 * 1024 * 1024;

async function computeSha256(bytes: Uint8Array): Promise<FontAssetId> {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle?.digest) {
    const hash = await globalThis.crypto.subtle.digest(
      "SHA-256",
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `sha256:${hex}`;
  }

  const { createHash } = await import("crypto");
  const hex = createHash("sha256").update(bytes).digest("hex");
  return `sha256:${hex}`;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      writer.write(bytes as any);
      writer.close();
      const ab = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(ab);
    } catch (err: any) {
      try {
        const zlib = await import("zlib");
        const decompressed = zlib.inflateSync(bytes);
        return new Uint8Array(
          decompressed.buffer,
          decompressed.byteOffset,
          decompressed.byteLength,
        );
      } catch {
        throw new Error(
          `Corrupt WOFF compressed table data: ${err.message || err}`,
        );
      }
    }
  }

  try {
    const zlib = await import("zlib");
    const decompressed = zlib.inflateSync(bytes);
    return new Uint8Array(
      decompressed.buffer,
      decompressed.byteOffset,
      decompressed.byteLength,
    );
  } catch (err: any) {
    throw new Error(
      `Corrupt WOFF compressed table data: ${err.message || err}`,
    );
  }
}

async function decompressWoff1(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.byteLength < 44) {
    throw new Error(
      "Corrupt WOFF header: buffer truncated (less than 44 bytes)",
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  const totalSfntSize = view.getUint32(16);

  if (44 + numTables * 20 > bytes.byteLength) {
    throw new Error("Corrupt WOFF header: table directory truncated");
  }

  interface TableEntry {
    tag: number;
    origChecksum: number;
    origLength: number;
    data: Uint8Array;
    sfntOffset?: number;
  }

  const tables: TableEntry[] = [];
  let dirOffset = 44;

  for (let i = 0; i < numTables; i++) {
    const tag = view.getUint32(dirOffset);
    const offset = view.getUint32(dirOffset + 4);
    const compLength = view.getUint32(dirOffset + 8);
    const origLength = view.getUint32(dirOffset + 12);
    const origChecksum = view.getUint32(dirOffset + 16);
    dirOffset += 20;

    if (offset + compLength > bytes.byteLength) {
      throw new Error(
        "Corrupt WOFF table: offset and length exceed buffer size",
      );
    }

    const tableSlice = bytes.subarray(offset, offset + compLength);
    let tableData: Uint8Array;
    if (compLength < origLength) {
      tableData = await inflate(tableSlice);
      if (tableData.byteLength !== origLength) {
        throw new Error(
          "Corrupt WOFF table: decompressed length does not match origLength",
        );
      }
    } else {
      tableData = tableSlice;
    }

    tables.push({ tag, origChecksum, origLength, data: tableData });
  }

  let currentOffset = 12 + numTables * 16;
  for (const table of tables) {
    table.sfntOffset = (currentOffset + 3) & ~3;
    currentOffset = table.sfntOffset + table.origLength;
  }

  const sfntSize = Math.max(totalSfntSize, currentOffset);
  const sfntBuffer = new Uint8Array(sfntSize);
  const sfntView = new DataView(
    sfntBuffer.buffer,
    sfntBuffer.byteOffset,
    sfntBuffer.byteLength,
  );

  sfntView.setUint32(0, flavor);
  sfntView.setUint16(4, numTables);
  const maxPower2 = 2 ** Math.floor(Math.log2(numTables));
  const searchRange = maxPower2 * 16;
  const entrySelector = Math.floor(Math.log2(numTables));
  const rangeShift = numTables * 16 - searchRange;
  sfntView.setUint16(6, searchRange);
  sfntView.setUint16(8, entrySelector);
  sfntView.setUint16(10, rangeShift);

  for (let i = 0; i < numTables; i++) {
    const table = tables[i];
    const recOffset = 12 + i * 16;
    sfntView.setUint32(recOffset, table.tag);
    sfntView.setUint32(recOffset + 4, table.origChecksum);
    sfntView.setUint32(recOffset + 8, table.sfntOffset!);
    sfntView.setUint32(recOffset + 12, table.origLength);
    sfntBuffer.set(table.data, table.sfntOffset!);
  }

  return sfntBuffer;
}

function parseSfntMetrics(
  bytes: Uint8Array,
  sfntOffset: number = 0,
): ParsedFontMetrics {
  if (sfntOffset + 12 > bytes.byteLength) {
    throw new Error(
      "Corrupt SFNT header: buffer truncated (less than 12 bytes)",
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(sfntOffset + 4);

  if (sfntOffset + 12 + numTables * 16 > bytes.byteLength) {
    throw new Error("Corrupt SFNT header: table directory truncated");
  }

  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const recOffset = sfntOffset + 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(recOffset),
      view.getUint8(recOffset + 1),
      view.getUint8(recOffset + 2),
      view.getUint8(recOffset + 3),
    );
    const offset = view.getUint32(recOffset + 8);
    const length = view.getUint32(recOffset + 12);

    if (offset + length > bytes.byteLength) {
      throw new Error(`Corrupt SFNT table data: table '${tag}' truncated`);
    }

    tables.set(tag, { offset, length });
  }

  const head = tables.get("head");
  if (!head || head.length < 54) {
    throw new Error("Corrupt font: missing or truncated 'head' table");
  }
  const unitsPerEm = view.getUint16(head.offset + 18);
  if (unitsPerEm === 0) {
    throw new Error("Corrupt font: invalid unitsPerEm (0) in 'head' table");
  }

  let hheaAscender: number | undefined;
  let hheaDescender: number | undefined;
  let hheaLineGap: number | undefined;

  const hhea = tables.get("hhea");
  if (hhea && hhea.length >= 10) {
    hheaAscender = view.getInt16(hhea.offset + 4);
    hheaDescender = view.getInt16(hhea.offset + 6);
    hheaLineGap = view.getInt16(hhea.offset + 8);
  }

  let os2Ascender: number | undefined;
  let os2Descender: number | undefined;
  let os2LineGap: number | undefined;

  const os2 = tables.get("OS/2");
  if (os2 && os2.length >= 74) {
    os2Ascender = view.getInt16(os2.offset + 68);
    os2Descender = view.getInt16(os2.offset + 70);
    os2LineGap = view.getInt16(os2.offset + 72);
  }

  const ascender = hheaAscender ?? os2Ascender;
  const descender = hheaDescender ?? os2Descender;
  const lineGap = hheaLineGap ?? os2LineGap ?? 0;

  if (ascender === undefined || descender === undefined) {
    throw new Error(
      "Corrupt font: missing vertical metrics in 'hhea' and 'OS/2' tables",
    );
  }

  const rawLineHeight =
    unitsPerEm > 0 ? (ascender - descender + lineGap) / unitsPerEm : 1.25;
  const lineHeight = rawLineHeight > 0 ? rawLineHeight : 1.25;

  return {
    unitsPerEm,
    ascender,
    descender,
    lineGap,
    lineHeight,
  };
}

export async function parseFontFile(
  buffer: ArrayBuffer | Uint8Array,
  fileName?: string,
): Promise<ParsedFont> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.byteLength > MAX_FONT_SIZE) {
    throw new Error("Font file exceeds maximum allowed size of 20MB");
  }

  if (bytes.byteLength < 12) {
    throw new Error(
      "Corrupt font header: buffer is truncated (less than 12 bytes)",
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);

  let format: FontFormat;
  let sfntBytes: Uint8Array;
  let sfntOffset = 0;

  if (signature === WOFF_2) {
    format = "woff2";
    const woff2 = await loadWoff2();
    const arrayBuffer =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? (bytes.buffer as ArrayBuffer)
        : (bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer);
    sfntBytes = woff2.decompress(arrayBuffer);
    if (!sfntBytes || sfntBytes.byteLength < 12) {
      throw new Error(
        "Corrupt WOFF2 font: decompression failed or produced invalid SFNT header",
      );
    }
  } else if (signature === WOFF_1) {
    format = "woff";
    sfntBytes = await decompressWoff1(bytes);
  } else if (signature === SFNT_TTF) {
    format = fileName?.toLowerCase().endsWith(".otf") ? "otf" : "ttf";
    sfntBytes = bytes;
  } else if (signature === SFNT_CFF) {
    format = "otf";
    sfntBytes = bytes;
  } else if (signature === TTC) {
    if (bytes.byteLength < 16) {
      throw new Error(
        "Corrupt TTC font: buffer truncated (less than 16 bytes)",
      );
    }
    const numFonts = view.getUint32(8);
    if (numFonts === 0) {
      throw new Error("Corrupt TTC font: collection contains zero fonts");
    }
    const firstFontOffset = view.getUint32(12);
    if (firstFontOffset + 12 > bytes.byteLength) {
      throw new Error("Corrupt TTC font: first font offset out of bounds");
    }
    const firstFontSig = view.getUint32(firstFontOffset);
    format =
      firstFontSig === SFNT_CFF || fileName?.toLowerCase().endsWith(".otf")
        ? "otf"
        : "ttf";
    sfntBytes = bytes;
    sfntOffset = firstFontOffset;
  } else {
    throw new Error(
      `Unsupported or invalid font format signature: 0x${signature.toString(
        16,
      )}`,
    );
  }

  const [id, metrics] = await Promise.all([
    computeSha256(bytes),
    Promise.resolve(parseSfntMetrics(sfntBytes, sfntOffset)),
  ]);

  return {
    id,
    format,
    metrics,
  };
}
