const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Downloads rows as a CSV file. `columns` is a list of [header, (row) => value]. */
export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map(([header]) => csvCell(header)).join(',')];
  rows.forEach((row) => lines.push(columns.map(([, get]) => csvCell(get(row))).join(',')));
  // The byte-order mark lets Excel read the Taka sign as UTF-8
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
