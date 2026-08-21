<?php

namespace App\Http\Requests;

use App\Enums\RoomBookingSlot;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;

class CreateBookingRequest extends StrictRequest
{
    public function rules(): array
    {
        return [
            'resourceType' => ['required', Rule::in(['ROOM', 'ITEM'])],
            'roomId' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'uuid'],
            'startDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d'],
            'endDate' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'roomSlot' => ['required_if:resourceType,ROOM', 'prohibited_if:resourceType,ITEM', Rule::enum(RoomBookingSlot::class)],
            'document' => ['sometimes', 'prohibited_if:resourceType,ITEM', 'file', 'mimes:pdf', 'mimetypes:application/pdf,application/x-pdf', 'max:10240'],
            'items' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'array', 'min:1'],
            'items.*' => ['array:itemId,quantity'],
            'items.*.itemId' => ['required', 'uuid'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'startTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/'],
            'endTime' => ['required_if:resourceType,ITEM', 'prohibited_if:resourceType,ROOM', 'date', 'regex:/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/', 'after:startTime'],
            'purpose' => ['required', 'string', 'regex:/\S/', 'min:3', 'max:1000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($this->input('resourceType') !== 'ROOM' || ! is_string($this->input('startDate')) || ! is_string($this->input('endDate'))) {
                return;
            }

            try {
                $multiDay = CarbonImmutable::createFromFormat('Y-m-d', $this->input('endDate'))->gt(CarbonImmutable::createFromFormat('Y-m-d', $this->input('startDate')));
            } catch (\Throwable) {
                return;
            }

            if ($multiDay && ! $this->hasFile('document')) {
                $validator->errors()->add('document', 'Surat resmi PDF wajib dilampirkan untuk peminjaman lebih dari satu hari');
            }
            if ($multiDay && $this->input('roomSlot') !== RoomBookingSlot::FULL_DAY->value) {
                $validator->errors()->add('roomSlot', 'Peminjaman lebih dari satu hari wajib menggunakan kategori sehari penuh');
            }

            $file = $this->file('document');
            if ($file && $file->isValid()) {
                $handle = fopen($file->getRealPath(), 'rb');
                $signature = $handle ? fread($handle, 5) : false;
                if (is_resource($handle)) {
                    fclose($handle);
                }
                if ($signature !== '%PDF-') {
                    $validator->errors()->add('document', 'File harus berupa PDF yang valid');
                }
            }
        });
    }

    protected function allowedFields(): array
    {
        return ['resourceType', 'roomId', 'startDate', 'endDate', 'roomSlot', 'document', 'items', 'startTime', 'endTime', 'purpose'];
    }
}
