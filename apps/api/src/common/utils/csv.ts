/**
 * CSV serialisation for exports.
 *
 * Cells that start with =, +, -, @, tab or carriage return are prefixed with an apostrophe
 * so a spreadsheet cannot execute attacker-supplied text as a formula (CSV injection).
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
