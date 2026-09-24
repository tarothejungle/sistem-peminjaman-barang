<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset Password Sistem Peminjaman Ruang Rapat &amp; Kendaraan</title>
</head>
<body style="margin:0;padding:24px;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#1e293b;border-radius:16px;overflow:hidden;">
        <tr>
            <td style="padding:28px 28px 8px 28px;">
                <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#60a5fa;font-weight:bold;">Sistem Peminjaman Ruang Rapat &amp; Kendaraan</p>
                <h1 style="margin:8px 0 0 0;font-size:22px;color:#ffffff;">Permintaan Reset Password</h1>
            </td>
        </tr>
        <tr>
            <td style="padding:16px 28px;font-size:14px;line-height:22px;color:#cbd5e1;">
                <p style="margin:0 0 14px 0;">Halo <strong style="color:#ffffff;">{{ $fullName }}</strong>,</p>
                <p style="margin:0 0 14px 0;">
                    Kami menerima permintaan reset password untuk akun dengan username
                    <strong style="color:#ffffff;">{{ $username }}</strong>.
                    Klik tombol di bawah untuk membuat password baru.
                </p>
                <p style="margin:24px 0;text-align:center;">
                    <a href="{{ $resetUrl }}"
                       style="display:inline-block;padding:14px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:bold;font-size:14px;">
                        Buat Password Baru
                    </a>
                </p>
                <p style="margin:0 0 14px 0;">
                    Tautan ini hanya berlaku <strong style="color:#ffffff;">{{ $expiresInMinutes }} menit</strong> dan hanya dapat digunakan satu kali.
                </p>
                <p style="margin:0 0 14px 0;color:#94a3b8;font-size:13px;">
                    Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
                </p>
                <p style="margin:0;color:#64748b;font-size:12px;word-break:break-all;">
                    Tombol tidak berfungsi? Salin tautan berikut ke browser Anda:<br>{{ $resetUrl }}
                </p>
            </td>
        </tr>
        <tr>
            <td style="padding:18px 28px 26px 28px;border-top:1px solid rgba(255,255,255,0.08);color:#64748b;font-size:11px;">
                Email ini dikirim otomatis oleh Sistem Peminjaman Ruang Rapat &amp; Kendaraan. Mohon tidak membalas email ini.
            </td>
        </tr>
    </table>
</body>
</html>
