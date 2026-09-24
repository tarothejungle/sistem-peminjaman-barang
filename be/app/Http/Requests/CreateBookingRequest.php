<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\ResourceType;
use App\Enums\RoomBookingSlot;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateBookingRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'resourceType' => ['required', Rule::enum(ResourceType::class)],
            'roomId' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'uuid'],
            'startDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d'],
            'endDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'roomSlot' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', Rule::enum(RoomBookingSlot::class)],
            'document' => ['sometimes', 'prohibited_if:resourceType,ITEM', 'file', 'mimes:pdf', 'mimetypes:application/pdf,application/x-pdf', 'max:10240'],
            // A vehicle loan must be backed by its assignment letter. Whether one
            // is genuinely required is decided in BookingService, which knows if
            // the chosen inventory rows are vehicles; this only checks the file.
            'suratTugas' => ['sometimes', 'prohibited_if:resourceType,ROOM', 'file', 'mimes:pdf', 'mimetypes:application/pdf,application/x-pdf', 'max:10240'],
            'items' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'array', 'min:1'],
            'items.*' => ['array:itemId,quantity'],
            'items.*.itemId' => ['required', 'uuid'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'startTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', self::ISO8601_DATETIME],
            'endTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', self::ISO8601_DATETIME, 'after:startTime'],
            'responsibleName' => ['required', 'string', 'regex:/\S/', 'min:3', 'max:100'],
            'phoneNumber' => ['required', 'string', 'regex:/^\+?[0-9][0-9\s-]{7,18}$/', 'max:20'],
            'workUnit' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'string', 'regex:/\S/', 'min:2', 'max:150'],
            'purpose' => ['required', 'string', 'regex:/\S/', 'min:3', 'max:1000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $this->assertPdfSignature($validator, 'document');
            $this->assertPdfSignature($validator, 'suratTugas');

            if ($this->input('resourceType') !== 'ROOM' || ! is_string($this->input('startDate')) || ! is_string($this->input('endDate'))) {
                return;
            }

            try {
                $multiDay = CarbonImmutable::createFromFormat('Y-m-d', $this->input('endDate'))->gt(CarbonImmutable::createFromFormat('Y-m-d', $this->input('startDate')));
            } catch (\Throwable) {
                return;
            }

            if ($multiDay) {
                if ($this->requiresDocumentForMultiDay() && ! $this->hasFile('document')) {
                    $validator->errors()->add('document', 'Surat resmi PDF wajib dilampirkan untuk peminjaman lebih dari satu hari');
                }
                if ($this->input('roomSlot') !== RoomBookingSlot::FULL_DAY->value) {
                    $validator->errors()->add('roomSlot', 'Peminjaman lebih dari satu hari wajib menggunakan kategori sehari penuh');
                }
            }
        });
    }

    /**
     * A new multi-day booking must ship its official PDF up front. Updates may
     * keep the document already on file, so UpdateBookingRequest opts out.
     */
    protected function requiresDocumentForMultiDay(): bool
    {
        return true;
    }

    /**
     * Guards against a renamed non-PDF: the declared mime can be spoofed, the
     * leading "%PDF-" bytes cannot.
     */
    protected function assertPdfSignature(Validator $validator, string $field = 'document'): void
    {
        $file = $this->file($field);
        if (! $file || ! $file->isValid()) {
            return;
        }

        $handle = fopen($file->getRealPath(), 'rb');
        $signature = $handle ? fread($handle, 5) : false;
        if (is_resource($handle)) {
            fclose($handle);
        }
        if ($signature !== '%PDF-') {
            $validator->errors()->add($field, 'File harus berupa PDF yang valid');
        }
    }

    protected function allowedFields(): array
    {
        return ['resourceType', 'roomId', 'startDate', 'endDate', 'roomSlot', 'document', 'suratTugas', 'items', 'startTime', 'endTime', 'responsibleName', 'phoneNumber', 'workUnit', 'purpose'];
    }
}
