import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData } from '@/lib/sheets';
import type { SheetRow } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export
 * Export filtered/sorted sheet data as CSV.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sheetKey = url.searchParams.get('sheetKey') || undefined;

    await requireAuth(sheetKey);

    const search = url.searchParams.get('search') || '';
    const sortColumn = url.searchParams.get('sortColumn') || '';
    const sortDirection = url.searchParams.get('sortDirection') || 'asc';

    const { headers, rows } = await readSheetData(sheetKey);

    // Apply filters
    let filteredRows = rows;

    if (search) {
      const lower = search.toLowerCase();
      filteredRows = filteredRows.filter((row) =>
        Object.entries(row)
          .filter(([k]) => k !== '__rowIndex')
          .some(([, v]) => String(v).toLowerCase().includes(lower))
      );
    }

    const filterColumns = url.searchParams.getAll('filterColumn');
    const filterValues = url.searchParams.getAll('filterValue');

    if (filterColumns.length === filterValues.length && filterColumns.length > 0) {
      filterColumns.forEach((column, index) => {
        const value = filterValues[index];
        if (!column || !value) return;
        filteredRows = filteredRows.filter(
          (row) => String(row[column] || '').toLowerCase() === value.toLowerCase()
        );
      });
    }

    // Apply sorting
    if (sortColumn && headers.includes(sortColumn)) {
      filteredRows = [...filteredRows].sort((a, b) => {
        const aVal = String(a[sortColumn] || '');
        const bVal = String(b[sortColumn] || '');
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
        return sortDirection === 'desc' ? -cmp : cmp;
      });
    }

    // Build CSV
    const csvRows: string[][] = [headers];
    filteredRows.forEach((row) => {
      csvRows.push(headers.map((h) => escapeCSV(String(row[h] ?? ''))));
    });

    const csv = csvRows.map((r) => r.join(',')).join('\n');
    const filename = `sheet-export-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[GET /api/export]', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
