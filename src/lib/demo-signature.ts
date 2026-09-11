import type { ExportedSignature } from "@/lib/signature-export";

/**
 * A handwritten-looking sample signature used only in the owner's preview.
 * The viewBox hugs the ink so it behaves like a trimmed real signature.
 */
const DEMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 10 278 82" width="278" height="82">
  <path d="M 20 70 C 34 20, 62 14, 58 46 C 55 72, 34 86, 46 64 C 62 36, 104 24, 132 40 C 156 54, 128 80, 150 66 C 176 50, 214 34, 248 42 C 276 50, 262 72, 232 68"
    fill="none" stroke="#1c1c24" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 262 78 C 272 70, 280 60, 286 52" fill="none" stroke="#1c1c24" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export const DEMO_SIGNATURE: ExportedSignature = {
  dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEMO_SVG)}`,
  width: 278,
  height: 82,
  aspect: 278 / 82,
};
