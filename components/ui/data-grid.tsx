import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataGridColumn<T> {
  key: keyof T | string;
  header: string;
  className?: string;
  cell?: (row: T) => React.ReactNode;
}

export interface DataGridProps<T extends object> {
  columns: DataGridColumn<T>[];
  data: T[];
  className?: string;
  emptyMessage?: string;
}

function DataGrid<T extends object>({
  columns,
  data,
  className,
  emptyMessage = "No records found.",
}: DataGridProps<T>) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)} className={column.className}>
                    {column.cell
                      ? column.cell(row)
                      : String((row as Record<string, unknown>)[column.key as string] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export { DataGrid };
