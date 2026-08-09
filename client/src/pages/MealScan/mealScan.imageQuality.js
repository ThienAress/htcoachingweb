const MIN_EDGE_PIXELS = 320;
const EXTREME_DARK_LUMINANCE = 12;
const DARK_LUMINANCE = 42;
const EXTREME_BRIGHT_LUMINANCE = 248;
const BRIGHT_LUMINANCE = 238;
const LOW_CONTRAST_DEVIATION = 16;
const LOW_SHARPNESS_VARIANCE = 55;
const SAMPLE_MAX_EDGE = 160;

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const luminanceAt = (data, pixelIndex) => {
  const offset = pixelIndex * 4;
  return (
    0.2126 * data[offset] +
    0.7152 * data[offset + 1] +
    0.0722 * data[offset + 2]
  );
};

export const measureMealImagePixels = ({ data, width, height }) => {
  const pixelCount = Math.max(0, Number(width) * Number(height));
  if (!data || pixelCount === 0 || data.length < pixelCount * 4) {
    throw new Error("Invalid image pixel data");
  }

  const luminance = new Float32Array(pixelCount);
  let sum = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const value = luminanceAt(data, index);
    luminance[index] = value;
    sum += value;
  }
  const mean = sum / pixelCount;
  let squaredDeviation = 0;
  for (const value of luminance) {
    squaredDeviation += (value - mean) ** 2;
  }

  const laplacian = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      laplacian.push(
        4 * luminance[index] -
          luminance[index - 1] -
          luminance[index + 1] -
          luminance[index - width] -
          luminance[index + width],
      );
    }
  }
  const laplacianMean = laplacian.length
    ? laplacian.reduce((total, value) => total + value, 0) / laplacian.length
    : 0;
  const sharpnessVariance = laplacian.length
    ? laplacian.reduce(
        (total, value) => total + (value - laplacianMean) ** 2,
        0,
      ) / laplacian.length
    : 0;

  return {
    luminanceMean: round(mean),
    contrastDeviation: round(Math.sqrt(squaredDeviation / pixelCount)),
    sharpnessVariance: round(sharpnessVariance),
  };
};

export const assessMealImageQuality = ({
  sourceWidth,
  sourceHeight,
  metrics,
}) => {
  const blockingIssues = [];
  const warnings = [];
  const shortestEdge = Math.min(Number(sourceWidth) || 0, Number(sourceHeight) || 0);

  if (shortestEdge < MIN_EDGE_PIXELS) blockingIssues.push("low_resolution");
  if (metrics.luminanceMean <= EXTREME_DARK_LUMINANCE) {
    blockingIssues.push("too_dark");
  } else if (metrics.luminanceMean < DARK_LUMINANCE) {
    warnings.push("dark");
  }
  if (metrics.luminanceMean >= EXTREME_BRIGHT_LUMINANCE) {
    blockingIssues.push("overexposed");
  } else if (metrics.luminanceMean > BRIGHT_LUMINANCE) {
    warnings.push("bright");
  }
  if (metrics.contrastDeviation < LOW_CONTRAST_DEVIATION) {
    warnings.push("low_contrast");
  }
  if (metrics.sharpnessVariance < LOW_SHARPNESS_VARIANCE) {
    warnings.push("possibly_blurry");
  }

  return {
    usable: blockingIssues.length === 0,
    blockingIssues,
    warnings: [...new Set(warnings)],
    metrics,
  };
};

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions"));
    };
    image.src = url;
  });

export const inspectMealImageFile = async (file) => {
  const image = await loadImage(file);
  const ratio = Math.min(1, SAMPLE_MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(3, Math.round(image.width * ratio));
  const height = Math.max(3, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to inspect image pixels");
  context.drawImage(image, 0, 0, width, height);
  const metrics = measureMealImagePixels(
    context.getImageData(0, 0, width, height),
  );

  return assessMealImageQuality({
    sourceWidth: image.width,
    sourceHeight: image.height,
    metrics,
  });
};
