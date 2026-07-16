export function compressImage(
  dataUrl: string,
  maxWidth: number = 1200,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG for better compression
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUrl;
  });
}

// Compress progressively harder until the data URL fits under maxChars.
// Firestore documents cap at ~1MB, so scorecard images must stay well below
// that after the rest of the document (game, interpretation) is added.
export async function compressToLimit(
  dataUrl: string,
  maxChars: number = 700_000
): Promise<string> {
  if (dataUrl.length <= maxChars) return dataUrl;
  const attempts: Array<[number, number]> = [
    [1200, 0.7],
    [1000, 0.55],
    [800, 0.45],
    [640, 0.35],
  ];
  let best = dataUrl;
  for (const [maxWidth, quality] of attempts) {
    best = await compressImage(dataUrl, maxWidth, quality);
    if (best.length <= maxChars) return best;
  }
  return best; // smallest we could manage
}
