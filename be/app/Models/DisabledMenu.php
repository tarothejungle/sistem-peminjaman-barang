<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class DisabledMenu extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'menu_key';

    protected $keyType = 'string';

    protected $fillable = ['menu_key', 'is_disabled', 'updated_by'];

    protected function casts(): array
    {
        return ['is_disabled' => 'boolean'];
    }
}
