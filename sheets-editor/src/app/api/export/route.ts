import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readSheetData } from '@/lib/sheets';
import type { SheetRow } from '@/types';

/**
 * GET /api/export
 * Export filtered/sorted sheet data as CSV.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const filterColumn = searchParams.get('filterColumn') || '';
    const filterValue = searchParams.get('filterValue') || '';
    const sortColumn = searchParams.get('sortColumn') || '';
    const sortDirection = searchParams.get('sortDirection') || 'asc';

    const { headers, rows } = await readSheetData();

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

    if (filterColumn && filterValue) {
      filteredRows = filteredRows.filter(
        (row) => String(row[filterColumn] || '').toLowerCase() === filterValue.toLowerCase()
      );
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
