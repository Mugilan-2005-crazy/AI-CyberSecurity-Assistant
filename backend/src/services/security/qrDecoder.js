/**
 * services/security/qrDecoder.js
 * ============================================================
 * MODULE 6 (support) — QR image decoder.
 * ------------------------------------------------------------
 * Decodes an uploaded image buffer (PNG/JPEG) into the QR's
 * embedded text using the pure-JS `jsqr` library. We convert the
 * image to raw RGBA pixels via `pngjs` / `jpeg-js` (no native deps).
 *
 * Output is always a controlled result object; decoding failures
 * return { decoded:false } so the caller can respond gracefully
 * instead of crashing.
 */
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

/**
 * Decode an image buffer to QR text.
 * @param {Buffer} buffer - image bytes (PNG or JPEG)
 * @param {string} mime  - content type, e.g. 'image/png'
 * @returns {{ decoded: boolean, text?: string, error?: string }}
 */
export const decodeQr = (buffer, mime = '') => {
  try {
    let width, height, data;

    if (mime.includes('png') || buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
      // PNG path.
      const png = PNG.sync.read(buffer);
      width = png.width;
      height = png.height;
      data = png.data; // RGBA Uint8Array
    } else if (mime.includes('jpeg') || mime.includes('jpg') || buffer[0] === 0xff && buffer[1] === 0xd8) {
      // JPEG path.
      const decoded = jpeg.decode(buffer, { useTArray: true });
      width = decoded.width;
      height = decoded.height;
      data = decoded.data; // RGBA Uint8Array
    } else {
      return { decoded: false, error: 'Unsupported image format' };
    }

    // Run the QR locator on the raw RGBA pixels.
    const qr = jsQR(new Uint8ClampedArray(data), width, height);
    if (!qr || !qr.data) return { decoded: false, error: 'No QR code found in image' };

    return { decoded: true, text: qr.data };
  } catch (err) {
    // Never bubble decoder errors to the request handler.
    return { decoded: false, error: 'Failed to decode image' };
  }
};

export default { decodeQr };
