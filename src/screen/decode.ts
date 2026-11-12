import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/screen";

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

function drawCover(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("não foi possível preparar o canvas da tela");
  const crop = fitToScreen({ width: sourceWidth, height: sourceHeight });
  ctx.imageSmoothingEnabled = true;
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
  return new Uint8ClampedArray(ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).data);
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
    const frames: Uint8ClampedArray[] = [];
    const durations: number[] = [];
    for (let i = 0; i < track.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
      try {
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
  if (!file.type.startsWith("image/")) {
    throw new Error("selecione um arquivo de imagem (PNG, GIF, WebP ou JPEG)");
  }
  if (file.type === "image/gif") {
    return decodeGif(file);
  }
  const bitmap = await createImageBitmap(file);
  try {
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
