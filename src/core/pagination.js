/** Split `barCount` bars into pages of lines of bar indices. Arithmetic only, so it is tested. */
export function paginate(barCount, { barsPerLine, linesPerPage }) {
  const lines = [];
  for (let i = 0; i < barCount; i += barsPerLine) {
    lines.push(Array.from({ length: Math.min(barsPerLine, barCount - i) }, (_, k) => i + k));
  }
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  return pages.length ? pages : [[]];
}
