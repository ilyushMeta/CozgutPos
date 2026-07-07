import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
}

/** Thin, shared TanStack Table wrapper (CLAUDE.md fixed stack) for simple back-office lists. */
export function DataTable<T>({ data, columns }: DataTableProps<T>) {
  const { t } = useTranslation();
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-6">{t('common.noResults')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-gray-200 dark:border-gray-700 text-left"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="py-2 px-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-2 px-3 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
