<?php

declare(strict_types=1);

namespace App\Services;

use Carbon\CarbonImmutable;
use Dompdf\Dompdf;
use Dompdf\Options;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use RuntimeException;

/**
 * Renders a collected report into downloadable bytes.
 *
 * Both writers consume the same array from BookingReportService, so the .xlsx and
 * .pdf files always carry identical rows.
 */
final class BookingReportExporter
{
    private const HEADER_ROW = 4;

    private const BODY_ROW = 5;

    /** @param array{generatedAt: CarbonImmutable, timezone: string, filters: array<string, string>, columns: list<string>, rows: list<list<string>>} $report */
    public function xlsx(array $report): string
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Laporan Peminjaman');

        $lastColumn = Coordinate::stringFromColumnIndex(count($report['columns']));

        $sheet->setCellValue('A1', 'Laporan Sistem Peminjaman Ruang Rapat & Kendaraan');
        $sheet->mergeCells("A1:{$lastColumn}1");
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        $sheet->setCellValue('A2', 'Dibuat '.$report['generatedAt']->format('d/m/Y H:i').' ('.$report['timezone'].')');
        $sheet->mergeCells("A2:{$lastColumn}2");
        $sheet->getStyle('A2')->getFont()->setSize(9);

        $filterLine = implode('   |   ', array_map(
            static fn (string $key, string $value): string => $key.': '.$value,
            array_keys($report['filters']),
            array_values($report['filters']),
        ));
        $sheet->setCellValue('A3', $filterLine);
        $sheet->mergeCells("A3:{$lastColumn}3");
        $sheet->getStyle('A3')->getFont()->setSize(9);

        $this->writeRow($sheet, $report['columns'], self::HEADER_ROW);
        foreach (array_values($report['rows']) as $offset => $row) {
            $this->writeRow($sheet, $row, self::BODY_ROW + $offset);
        }

        $headerRange = 'A'.self::HEADER_ROW.':'.$lastColumn.self::HEADER_ROW;
        $sheet->getStyle($headerRange)->getFont()->setBold(true);
        $sheet->getStyle($headerRange)->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFE2E8F0');
        $sheet->getStyle($headerRange)->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

        $lastRow = $report['rows'] === [] ? self::HEADER_ROW : self::HEADER_ROW + count($report['rows']);
        $sheet->getStyle('A'.self::HEADER_ROW.':'.$lastColumn.$lastRow)
            ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('A'.self::BODY_ROW.':'.$lastColumn.$lastRow)
            ->getAlignment()->setVertical(Alignment::VERTICAL_TOP)->setWrapText(true);

        $sheet->freezePane('A'.self::BODY_ROW);

        foreach ($report['columns'] as $index => $column) {
            $letter = Coordinate::stringFromColumnIndex($index + 1);
            $sheet->getColumnDimension($letter)->setWidth($this->columnWidth($column));
        }

        $path = tempnam(sys_get_temp_dir(), 'laporan-xlsx-');
        if ($path === false) {
            throw new RuntimeException('Gagal menyiapkan berkas Excel sementara.');
        }

        try {
            (new Xlsx($spreadsheet))->save($path);
            $bytes = file_get_contents($path);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
            $spreadsheet->disconnectWorksheets();
        }

        if ($bytes === false) {
            throw new RuntimeException('Gagal menulis berkas Excel.');
        }

        return $bytes;
    }

    /** @param array{generatedAt: CarbonImmutable, timezone: string, filters: array<string, string>, columns: list<string>, rows: list<list<string>>} $report */
    public function pdf(array $report): string
    {
        $options = new Options;
        $options->setIsRemoteEnabled(false);
        $options->setDefaultFont('DejaVu Sans');
        $options->setChroot(base_path());

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('a4', 'landscape');
        $dompdf->loadHtml(view('reports.bookings', ['report' => $report])->render(), 'UTF-8');
        $dompdf->render();

        return $dompdf->output();
    }

    /**
     * Writes one row as literal text.
     *
     * `fromArray()` runs every value through the default value binder, which
     * turns a string starting with "=" into a live formula. Borrowers control
     * columns such as "Nama Peminjam", so a payload like
     * `=HYPERLINK("http://evil.test","klik")` would execute for the
     * administrator who opens the exported report. Forcing the string data type
     * keeps user input inert.
     *
     * @param  list<string>  $values
     */
    private function writeRow(Worksheet $sheet, array $values, int $row): void
    {
        foreach (array_values($values) as $index => $value) {
            $sheet->setCellValueExplicit(
                Coordinate::stringFromColumnIndex($index + 1).$row,
                (string) $value,
                DataType::TYPE_STRING,
            );
        }
    }

    private function columnWidth(string $column): float
    {
        return match ($column) {
            'No' => 5,
            'ID Peminjaman' => 38,
            'Nama Peminjam', 'Kendaraan / Ruangan' => 28,
            'No. Telepon' => 16,
            'Unit Kerja' => 22,
            'Jenis' => 15,
            'Surat Tugas' => 12,
            'Poin Kredibilitas Kendaraan' => 22,
            'Status' => 26,
            default => 18,
        };
    }
}
