<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Exceptions\ApiException;
use App\Services\BookingReportExporter;
use App\Services\BookingReportService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

final class BookingReportController extends Controller
{
    private const FORMATS = ['xlsx' => 'Excel', 'pdf' => 'PDF'];

    public function __construct(
        private readonly BookingReportService $reports,
        private readonly BookingReportExporter $exporter,
    ) {}

    public function export(Request $request, string $format): Response
    {
        $mime = match ($format) {
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf' => 'application/pdf',
            default => throw new ApiException('Format laporan tidak dikenal', 400),
        };

        $request->validate([
            'status' => ['sometimes', 'nullable', Rule::enum(BookingStatus::class)],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        if (array_diff(array_keys($request->query()), ['status', 'from', 'to']) !== []) {
            throw new ApiException('Data tidak valid', 400, ['query' => ['Parameter tidak dikenal']]);
        }

        $report = $this->reports->collect([
            'status' => $request->query('status'),
            'from' => $request->query('from'),
            'to' => $request->query('to'),
        ]);

        $bytes = $format === 'xlsx' ? $this->exporter->xlsx($report) : $this->exporter->pdf($report);
        $filename = 'laporan-peminjaman-'.$report['generatedAt']->format('Ymd-His').'.'.$format;

        return response($bytes, HttpResponse::HTTP_OK, [
            'Content-Type' => $mime,
            'Content-Length' => (string) strlen($bytes),
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
