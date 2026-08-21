<?php

namespace App\Http\Requests;

use Carbon\CarbonImmutable;

final class UpdateBookingRequest extends CreateBookingRequest
{
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

            if ($multiDay && $this->input('roomSlot') !== 'FULL_DAY') {
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
}
