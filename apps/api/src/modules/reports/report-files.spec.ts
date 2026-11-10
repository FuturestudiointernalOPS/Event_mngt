import { describe, expect, it } from 'vitest';
import type { ExportRegistrationRow } from './report-files';
import {
  capRows,
  csvCell,
  renderExport,
  renderRegistrationsCsv,
} from './report-files';
import { renderRegistrationsPdf } from './report-pdf';
import {
  downloadBlocker,
  exportExpiry,
  exportFileName,
  isExpired,
} from './report-exports.rules';

const NOW = new Date('2026-11-10T12:34:56.000Z');

function row(overrides: Partial<ExportRegistrationRow> = {}): ExportRegistrationRow {
  return {
    reference: 'EP-2026-0001',
    status: 'APPROVED',
    source: 'PUBLIC',
    submittedAt: new Date('2026-11-09T10:00:00.000Z'),
    decidedAt: new Date('2026-11-09T11:00:00.000Z'),
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    phone: null,
    organizationName: 'Analytical Engines',
    jobTitle: 'Mathematician',
    country: 'UK',
    categoryKey: 'startup',
    categoryName: 'Startup',
    ...overrides,
  };
}

function table(rows: ExportRegistrationRow[]) {
  return {
    rows,
    truncated: false,
    eventName: 'Innovation Village 2026',
    generatedAt: NOW,
  };
}

describe('export policy', () => {
  it('names files safely and keeps the format extension', () => {
    expect(exportFileName('Innovation Village / 2026', 'CSV', NOW)).toBe(
      'registrations-innovation-village-2026-20261110-123456.csv',
    );
    expect(exportFileName('', 'PDF', NOW)).toBe(
      'registrations-event-20261110-123456.pdf',
    );
  });

  it('expires a file after the retention window', () => {
    const expiry = exportExpiry(NOW);
    expect(isExpired(expiry, new Date('2026-11-16T12:00:00.000Z'))).toBe(false);
    expect(isExpired(expiry, new Date('2026-11-18T12:00:00.000Z'))).toBe(true);
  });

  it('explains why a download is blocked', () => {
    expect(downloadBlocker('PENDING', null, NOW)).toBe('not_ready');
    expect(downloadBlocker('PROCESSING', null, NOW)).toBe('not_ready');
    expect(downloadBlocker('FAILED', exportExpiry(NOW), NOW)).toBe('failed');
    expect(downloadBlocker('COMPLETED', new Date('2026-11-01T00:00:00.000Z'), NOW)).toBe(
      'expired',
    );
    expect(downloadBlocker('COMPLETED', exportExpiry(NOW), NOW)).toBeNull();
  });
});

describe('CSV export', () => {
  it('quotes delimiters, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('writes a BOM, CRLF rows and the full header', () => {
    const rendered = renderRegistrationsCsv(
      table([row({ lastName: 'Byron, Jr.', phone: '+229 00 00' })]),
    );
    const text = rendered.content.toString('utf8');

    expect(text.startsWith('\uFEFFreference,status,source')).toBe(true);
    expect(text).toContain('\r\n');
    expect(text).toContain('"Byron, Jr."');
    expect(text).toContain('+229 00 00');
    expect(text.endsWith('\r\n')).toBe(true);
    expect(rendered.rowCount).toBe(1);
  });

  it('caps a very large result instead of buffering without bound', () => {
    const capped = capRows(Array.from({ length: 10_001 }, (_, index) => index));

    expect(capped.rows).toHaveLength(10_000);
    expect(capped.truncated).toBe(true);
    expect(capRows([1, 2]).truncated).toBe(false);
  });

  it('dispatches by format', () => {
    const csv = renderExport('CSV', table([row()]));
    const pdf = renderExport('PDF', table([row()]));

    expect(csv.content.toString('utf8')).toContain('EP-2026-0001');
    expect(pdf.content.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  });
});

describe('PDF export', () => {
  it('writes a structurally valid document with a correct cross-reference table', () => {
    const rendered = renderRegistrationsPdf(table([row()]));
    const text = rendered.content.toString('latin1');

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('(Registrations - Innovation Village 2026)');
    expect(text).toContain('(EP-2026-0001)');

    const match = /startxref\n(\d+)\n%%EOF/.exec(text);
    expect(match).not.toBeNull();
    const xrefOffset = Number(match?.[1]);
    expect(text.slice(xrefOffset, xrefOffset + 4)).toBe('xref');

    const xref = text.slice(xrefOffset).split('trailer')[0];
    const entries = xref
      .split('\n')
      .filter((line) => /^\d{10} \d{5} [nf] $/.test(line));

    // First entry is the free object; every other offset must point at its object.
    entries.slice(1).forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });

  it('paginates long result sets', () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      row({ reference: `EP-${index}` }),
    );
    const rendered = renderRegistrationsPdf(table(rows));
    const text = rendered.content.toString('latin1');

    expect(text).toContain('/Count 2');
    expect(text).toContain('(Page 1 of 2)');
    expect(text).toContain('(Page 2 of 2)');
    expect(rendered.rowCount).toBe(60);
  });

  it('encodes accented text in the standard font charset', () => {
    const rendered = renderRegistrationsPdf(
      table([row({ firstName: 'Adélaïde', lastName: 'Ngo' })]),
    );

    // WinAnsi maps `é` to 0xE9; UTF-8 would have written two bytes and broken the
    // byte offsets the cross-reference table depends on.
    expect(rendered.content.includes(Buffer.from([0xe9]))).toBe(true);
    expect(rendered.content.toString('latin1')).toContain('(Adélaïde Ngo)');
  });
});
