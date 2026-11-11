import type { ExportRegistrationRow, ExportTable, RenderedExport } from './report-files';

/**
 * Minimal PDF writer for a registration table (WP-19).
 *
 * The project deliberately has no PDF dependency: a report is a page of Helvetica text,
 * which PDF can express with the standard font set. This builder produces a valid
 * PDF 1.4 document with a landscape-style table and page footers.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const TITLE_SIZE = 14;
const SUBTITLE_SIZE = 8;
const FONT_SIZE = 7.5;
const ROW_HEIGHT = 14;

interface Column {
  label: string;
  width: number;
  pick: (row: ExportRegistrationRow) => string;
}

const COLUMNS: Column[] = [
  { label: 'Reference', width: 70, pick: (row) => row.reference },
  {
    label: 'Name',
    width: 120,
    pick: (row) => `${row.firstName} ${row.lastName}`.trim(),
  },
  { label: 'Status', width: 58, pick: (row) => row.status },
  { label: 'Category', width: 75, pick: (row) => row.categoryName ?? '' },
  {
    label: 'Submitted',
    width: 70,
    pick: (row) => row.submittedAt.toISOString().slice(0, 10),
  },
  { label: 'Email', width: 130, pick: (row) => row.email },
];

const ROWS_PER_PAGE = Math.floor(
  (PAGE_HEIGHT - MARGIN * 2 - 70) / ROW_HEIGHT,
);

function escapePdfText(value: string): string {
  const latin1 = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^\u0000-\u00ff]/g, '?');

  return latin1.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function truncate(value: string, width: number): string {
  // Helvetica averages roughly half the point size per character. The approximation
  // only decides where an ellipsis starts, not whether the PDF is valid.
  const maxChars = Math.max(4, Math.floor(width / (FONT_SIZE * 0.5)));

  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function textAt(x: number, y: number, size: number, value: string): string {
  return `BT /F1 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(value)}) Tj ET`;
}

function tableHeader(y: number): string {
  let x = MARGIN;
  const parts: string[] = [];

  for (const column of COLUMNS) {
    parts.push(textAt(x, y, FONT_SIZE, truncate(column.label.toUpperCase(), column.width)));
    x += column.width;
  }

  return parts.join('\n');
}

function tableRow(row: ExportRegistrationRow, y: number): string {
  let x = MARGIN;
  const parts: string[] = [];

  for (const column of COLUMNS) {
    parts.push(textAt(x, y, FONT_SIZE, truncate(column.pick(row), column.width)));
    x += column.width;
  }

  return parts.join('\n');
}

function pageContent(
  rows: ExportRegistrationRow[],
  eventName: string,
  pageNumber: number,
  pageCount: number,
  generatedAt: Date,
): string {
  const parts: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  if (pageNumber === 1) {
    parts.push(textAt(MARGIN, y, TITLE_SIZE, `Registrations - ${eventName}`));
    y -= 18;
    parts.push(
      textAt(
        MARGIN,
        y,
        SUBTITLE_SIZE,
        `Generated ${generatedAt.toISOString()}  |  ${rows.length} row(s) on this page`,
      ),
    );
    y -= 18;
  } else {
    parts.push(textAt(MARGIN, y, SUBTITLE_SIZE, `${eventName} - continued`));
    y -= 18;
  }

  parts.push(tableHeader(y));
  y -= ROW_HEIGHT;

  for (const row of rows) {
    parts.push(tableRow(row, y));
    y -= ROW_HEIGHT;
  }

  parts.push(
    textAt(
      MARGIN,
      MARGIN,
      SUBTITLE_SIZE,
      `Page ${pageNumber} of ${pageCount}`,
    ),
  );

  return parts.join('\n');
}

interface PdfObject {
  body: string;
}

function buildDocument(objects: PdfObject[]): Buffer {
  const header = '%PDF-1.4\n';
  const chunks: string[] = [header];
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, 'latin1');

  objects.forEach((object, index) => {
    offsets.push(cursor);
    const chunk = `${index + 1} 0 obj\n${object.body}\nendobj\n`;
    chunks.push(chunk);
    cursor += Buffer.byteLength(chunk, 'latin1');
  });

  const xrefOffset = cursor;
  const lines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];

  for (const offset of offsets) {
    lines.push(`${String(offset).padStart(10, '0')} 00000 n `);
  }

  lines.push(
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  );

  chunks.push(`${lines.join('\n')}\n`);

  return Buffer.from(chunks.join(''), 'latin1');
}

export function renderRegistrationsPdf(table: ExportTable): RenderedExport {
  const pages: ExportRegistrationRow[][] = [];

  for (let index = 0; index < table.rows.length; index += ROWS_PER_PAGE) {
    pages.push(table.rows.slice(index, index + ROWS_PER_PAGE));
  }

  if (pages.length === 0) {
    pages.push([]);
  }

  const pageCount = pages.length;
  const pageObjectStart = 4;
  const kids = pages
    .map((_, index) => `${pageObjectStart + index * 2} 0 R`)
    .join(' ');

  const objects: PdfObject[] = [
    { body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { body: `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>` },
    {
      body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    },
  ];

  pages.forEach((rows, index) => {
    const content = pageContent(
      rows,
      table.eventName,
      index + 1,
      pageCount,
      table.generatedAt,
    );
    const contentObjectNumber = pageObjectStart + index * 2 + 1;

    objects.push({
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    });
    objects.push({
      body: `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    });
  });

  return {
    content: buildDocument(objects),
    rowCount: table.rows.length,
    truncated: table.truncated,
  };
}
