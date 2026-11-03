/** Bounded container/dimension validation. Not an image decoder or malware scanner. */
export function validImageContainer(bytes: Uint8Array, type: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  const dimensions = (width: number, height: number) =>
    width > 0 && height > 0 && width <= 4096 && height <= 4096;
  try {
    if (type === "image/png") {
      if (
        bytes.length < 57 ||
        text(12, 4) !== "IHDR" ||
        view.getUint32(8) !== 13 ||
        !dimensions(view.getUint32(16), view.getUint32(20))
      )
        return false;
      let offset = 8,
        chunks = 0,
        data = false;
      while (offset + 12 <= bytes.length && ++chunks <= 1024) {
        const size = view.getUint32(offset);
        const kind = text(offset + 4, 4);
        if (!/^[A-Za-z]{4}$/.test(kind) || size > bytes.length - offset - 12)
          return false;
        if (kind === "IHDR" && offset !== 8) return false;
        if (kind === "IDAT" && size > 0) data = true;
        offset += size + 12;
        if (kind === "IEND")
          return size === 0 && data && offset === bytes.length;
      }
      return false;
    }
    if (type === "image/jpeg") {
      if (
        bytes.length < 24 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes.at(-2) !== 255 ||
        bytes.at(-1) !== 217
      )
        return false;
      let offset = 2,
        frame = false,
        segments = 0;
      while (offset + 4 <= bytes.length && ++segments <= 2048) {
        if (bytes[offset++] !== 255) return false;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (marker === 0xda) return frame; // entropy-coded scan; EOI already checked
        const size = view.getUint16(offset);
        if (size < 2 || offset + size > bytes.length) return false;
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
          if (
            size < 8 ||
            !dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3))
          )
            return false;
          frame = true;
        }
        offset += size;
      }
      return false;
    }
    if (type === "image/webp") {
      if (
        bytes.length < 26 ||
        text(0, 4) !== "RIFF" ||
        text(8, 4) !== "WEBP" ||
        view.getUint32(4, true) + 8 !== bytes.length
      )
        return false;
      let offset = 12,
        frame = false,
        chunks = 0;
      while (offset + 8 <= bytes.length && ++chunks <= 1024) {
        const kind = text(offset, 4),
          size = view.getUint32(offset + 4, true),
          data = offset + 8;
        if (data + size > bytes.length) return false;
        if (kind === "VP8 ") {
          if (
            size < 10 ||
            text(data + 3, 3) !== "\x9d\x01\x2a" ||
            !dimensions(
              view.getUint16(data + 6, true) & 0x3fff,
              view.getUint16(data + 8, true) & 0x3fff,
            )
          )
            return false;
          frame = true;
        } else if (kind === "VP8L") {
          if (size < 5 || bytes[data] !== 0x2f) return false;
          const bits = view.getUint32(data + 1, true);
          if (!dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1))
            return false;
          frame = true;
        } else if (kind === "VP8X") {
          const u24 = (at: number) =>
            bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
          // Animated images are outside the beta's static token artwork contract.
          if (
            size !== 10 ||
            bytes[data] & 2 ||
            !dimensions(u24(data + 4) + 1, u24(data + 7) + 1)
          )
            return false;
        }
        offset = data + size + (size % 2);
      }
      return frame && offset === bytes.length;
    }
  } catch {
    return false;
  }
  return false;
}
