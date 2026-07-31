/**
 * Compresses an uploaded image file using an offscreen HTML5 canvas to max dimensions (default 400x400)
 * and quality 0.5. Returns a lightweight base64 Data URL (~30KB - 50KB) that easily fits inside localStorage.
 */
export function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.5): Promise<string> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const srcUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(srcUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(srcUrl);
      img.src = srcUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Calculates the exact officer response time from complaint creation to resolution.
 * Returns formatted text (e.g. "2h 15m", "45 mins", "1d 4h")
 * and an efficiency rating badge ("Fast Response ⚡", "Standard Action ⏱️", "Delayed Response ⚠️").
 */
export function calculateOfficerResponseDuration(issue: any): {
  durationText: string;
  ratingText: string;
  ratingColor: string;
  badgeBg: string;
} {
  if (!issue) {
    return {
      durationText: 'Pending Inspection',
      ratingText: 'In Progress',
      ratingColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    };
  }

  // Parse start date (createdAt)
  let startMs = Date.now();
  if (issue.createdAt?.seconds) {
    startMs = issue.createdAt.seconds * 1000;
  } else if (typeof issue.createdAt === 'string') {
    startMs = new Date(issue.createdAt).getTime() || Date.now();
  }

  // Parse resolution date (resolvedAtIso, resolvedAt, or updatedAt)
  let endMs = Date.now();
  if (issue.resolvedAtIso) {
    endMs = new Date(issue.resolvedAtIso).getTime();
  } else if (issue.resolvedAt?.seconds) {
    endMs = issue.resolvedAt.seconds * 1000;
  } else if (issue.updatedAt?.seconds) {
    endMs = issue.updatedAt.seconds * 1000;
  } else if (typeof issue.updatedAt === 'string') {
    endMs = new Date(issue.updatedAt).getTime() || Date.now();
  }

  const diffMs = Math.max(1000 * 60 * 12, endMs - startMs); // default minimum for clear display
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let durationText = '';
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    durationText = `${diffDays}d ${remainingHours}h`;
  } else if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    durationText = `${diffHours}h ${remainingMins}m`;
  } else {
    durationText = `${diffMins} mins`;
  }

  // Determine efficiency rating based on officer duration
  if (diffHours < 6) {
    return {
      durationText,
      ratingText: 'Fast Action ⚡',
      ratingColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    };
  } else if (diffHours < 24) {
    return {
      durationText,
      ratingText: 'Standard Action ⏱️',
      ratingColor: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
    };
  } else {
    return {
      durationText,
      ratingText: 'Delayed Response ⚠️',
      ratingColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    };
  }
}
