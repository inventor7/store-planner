import { ref, watch, onMounted } from "vue";
import type { FloorType } from "@/modules/StorePlanner/data/floors";

/**
 * Composable to generate premium floor patterns as Canvas-backed images for Konva
 */
export function useFloorPatterns() {
  const patternImages = ref<Record<string, HTMLImageElement>>({});

  /**
   * Generates a pattern image for a specific floor type
   */
  const generatePattern = (floorType: FloorType): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const patternId = floorType.id;
      if (patternImages.value[patternId]) {
        resolve(patternImages.value[patternId]);
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      const size = 200; // Base size for tile/pattern repeatability
      canvas.width = size;
      canvas.height = size;

      // 1. Draw Base Color
      ctx.fillStyle = floorType.color;
      ctx.fillRect(0, 0, size, size);

      // 2. Apply Subtle Noise Texture (Premium Feel)
      addGrain(ctx, size, size, 0.03);

      // 3. Draw Pattern
      switch (floorType.pattern) {
        case "grid":
          drawGrid(ctx, size, floorType);
          break;
        case "checkered":
          drawCheckered(ctx, size, floorType);
          break;
        case "herringbone":
          drawHerringbone(ctx, size, floorType);
          break;
        case "dots":
          drawDots(ctx, size, floorType);
          break;
      }

      const img = new Image();
      img.src = canvas.toDataURL();
      img.onload = () => {
        patternImages.value[patternId] = img;
        resolve(img);
      };
    });
  };

  /**
   */
  function addGrain(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
  ) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 255;
      data[i] = Math.min(255, Math.max(0, (data[i] as number) + noise));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] as number) + noise));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] as number) + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Draws a standard grid (tile) pattern
   */
  function drawGrid(ctx: CanvasRenderingContext2D, size: number, type: FloorType) {
    const tileSize = 50;
    ctx.strokeStyle = type.patternColor || "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.globalAlpha = type.patternOpacity || 0.1;

    for (let i = 0; i <= size; i += tileSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a checkered tile pattern
   */
  function drawCheckered(ctx: CanvasRenderingContext2D, size: number, type: FloorType) {
    const tileSize = 50;
    ctx.fillStyle = type.patternColor || "#000000";
    ctx.globalAlpha = type.patternOpacity || 0.2;

    for (let i = 0; i < size / tileSize; i++) {
      for (let j = 0; j < size / tileSize; j++) {
        if ((i + j) % 2 === 1) {
          ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a herringbone (wood) pattern
   */
  function drawHerringbone(ctx: CanvasRenderingContext2D, size: number, type: FloorType) {
    const w = 40;
    const h = 120;
    ctx.strokeStyle = type.patternColor || "rgba(0,0,0,0.2)";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = type.patternOpacity || 0.15;

    // Simplified herringbone for canvas tiling
    for (let x = -size; x < size * 2; x += w) {
      for (let y = -size; y < size * 2; y += h) {
        ctx.save();
        ctx.translate(x, y);
        // Add subtle gradient to each plank
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "rgba(0,0,0,0.05)");
        grad.addColorStop(1, "rgba(255,255,255,0.05)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeRect(0, 0, w, h);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Draws a dots/speckled pattern (for marble/carpet)
   */
  function drawDots(ctx: CanvasRenderingContext2D, size: number, type: FloorType) {
    ctx.fillStyle = type.patternColor || "rgba(0,0,0,0.1)";
    ctx.globalAlpha = type.patternOpacity || 0.1;

    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  return {
    generatePattern,
    patternImages,
  };
}
