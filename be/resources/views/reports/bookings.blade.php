<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan Peminjaman</title>
<style>
    @page { margin: 14mm 10mm; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 7.5px; color: #1f2937; }
    h1 { font-size: 14px; margin: 0 0 3px; }
    .meta { font-size: 8px; color: #4b5563; margin: 0 0 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background-color: #e2e8f0; border: 0.5px solid #94a3b8; padding: 4px; text-align: left; font-size: 7px; text-transform: uppercase; }
    td { border: 0.5px solid #cbd5e1; padding: 4px; vertical-align: top; }
    .empty { text-align: center; color: #6b7280; padding: 18px; font-size: 9px; }
</style>
</head>
<body>
    <h1>Laporan Sistem Peminjaman Ruang Rapat &amp; Kendaraan</h1>
    <p class="meta">Dibuat {{ $report['generatedAt']->format('d/m/Y H:i') }} ({{ $report['timezone'] }})</p>
    <p class="meta">
        @foreach ($report['filters'] as $label => $value){{ $label }}: {{ $value }}@unless ($loop->last) &nbsp;|&nbsp; @endunless
        @endforeach
    </p>

    <table>
        <thead>
            <tr>
                @foreach ($report['columns'] as $column)
                    <th>{{ $column }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($report['rows'] as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td>{{ $cell }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td class="empty" colspan="{{ count($report['columns']) }}">Tidak ada data peminjaman pada filter ini.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>