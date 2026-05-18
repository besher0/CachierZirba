import { Platform, Share } from 'react-native';

function escapeValue(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const headerLine = headers.map(escapeValue).join(',');
  const body = rows.map((row) => row.map(escapeValue).join(',')).join('\n');
  return `${headerLine}\n${body}`;
}

export async function exportCsv(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({
    title: filename,
    message: csv,
  });
}
