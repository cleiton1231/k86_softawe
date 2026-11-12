import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  maxScreenFrames,
} from "../protocol/screen";

export interface ScreenAnimation {
  width: number;
  height: number;
  delayMs: number;
  frames: Uint8ClampedArray[];
}

export interface CoverCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Cover crop in source pixels for a 240x135 target. The image is scaled up or
 * down until it fills the panel, then centered and cropped.
 */
export function fitToScreen(
  source: { width: number; height: number },
  targetWidth = SCREEN_WIDTH,
  targetHeight = SCREEN_HEIGHT,
): CoverCrop {
  if (source.width <= 0 || source.height <= 0) {
    throw new Error("source image must have positive dimensions");
  }
  const scale = Math.max(targetWidth / source.width, targetHeight / source.height);
  const sw = targetWidth / scale;
  const sh = targetHeight / scale;
  return {
    sx: (source.width - sw) / 2,
    sy: (source.height - sh) / 2,
    sw,
    sh,
  };
}

/** The protocol's frame delay is one byte; stay in a usable animation range. */
export function clampDelayMs(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(255, Math.max(10, Math.round(value)));
}

export const MAX_SOURCE_DIMENSION = 8192;
export const MAX_SOURCE_PIXELS = 4096 * 4096;

export function assertFrameBudget(
  frameCount: number,
  limit = maxScreenFrames(),
): void {
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error("o arquivo não contém frames");
  }
  if (frameCount > limit) {
    throw new Error(
      `o arquivo tem ${frameCount} frames; o limite desta tela é ${limit}`,
    );
  }
}

export function assertSourceDimensions(width: number, height: number): void {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_SOURCE_DIMENSION ||
    height > MAX_SOURCE_DIMENSION ||
    width * height > MAX_SOURCE_PIXELS
  ) {
    throw new Error(`dimensões de imagem não suportadas: ${width}x${height}`);
  }
}

type CoverDrawer = (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) => Uint8ClampedArray;

let coverDrawer: CoverDrawer | null = null;

function createCoverDrawer(): CoverDrawer {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("não foi possível preparar o canvas da tela");
  ctx.imageSmoothingEnabled = true;

  return (source, sourceWidth, sourceHeight) => {
    const crop = fitToScreen({ width: sourceWidth, height: sourceHeight });
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.drawImage(
      source,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
    );
    // getImageData already returns a detached copy; no extra wrapper needed.
    return ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).data;
  };
}

function drawCover(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Uint8ClampedArray {
  coverDrawer ??= createCoverDrawer();
  return coverDrawer(source, sourceWidth, sourceHeight);
}

async function decodeGif(file: File): Promise<ScreenAnimation> {
  if (typeof ImageDecoder === "undefined") {
    throw new Error("este navegador não suporta GIF animado; use Chrome ou Edge");
  }
  const decoder = new ImageDecoder({
    data: await file.arrayBuffer(),
    type: "image/gif",
  });
  try {
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track || track.frameCount < 1) {
      throw new Error("o GIF não contém frames");
    }
    assertFrameBudget(track.frameCount);
    const frames: Uint8ClampedArray[] = [];
    const durations: number[] = [];
    for (let i = 0; i < track.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
      try {
        assertSourceDimensions(image.displayWidth, image.displayHeight);
        frames.push(drawCover(image, image.displayWidth, image.displayHeight));
        if (image.duration && image.duration > 0) {
          durations.push(image.duration / 1000);
        }
      } finally {
        image.close();
      }
    }
    const average =
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : 50;
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      delayMs: clampDelayMs(average),
      frames,
    };
  } finally {
    decoder.close();
  }
}

export async function decodeScreenFile(file: File): Promise<ScreenAnimation> {
  if (!file.type.startsWith("image/") && !/\.(gif|png|webp|jpe?g)$/i.test(file.name)) {
    throw new Error("selecione um arquivo de imagem (PNG, GIF, WebP ou JPEG)");
  }
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) {
    return decodeGif(file);
  }
  const bitmap = await createImageBitmap(file);
  try {
    assertSourceDimensions(bitmap.width, bitmap.height);
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      delayMs: 0,
      frames: [drawCover(bitmap, bitmap.width, bitmap.height)],
    };
  } finally {
    bitmap.close();
  }
}
