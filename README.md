# SE2026-Tempuran - Sistem Monitoring Sensus Ekonomi 2026

## Deskripsi

Platform monitoring real-time untuk Sensus Ekonomi 2026 Kecamatan Tempuran, Kabupaten Karawang. Mendukung 6 PML dan 46 PPL di 14 desa.

## Struktur

```
├── index.html        # Landing page + Login
├── dashboard.html    # Dashboard utama
├── assets/
│   ├── css/
│   │   ├── app.css
│   │   └── landing.css
│   └── js/
│       ├── app.js
│       ├── landing.js
│       └── supabase.js
└── README.md
```

## Login

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin` | `SE2026TEMPURAN` |
| PML   | email PML | `PML2026Tempuran` |
| PPL   | email PPL | `PPL2026Tempuran` |

## Deploy ke Vercel

1. Push ke GitHub
2. Import ke https://vercel.com/new
3. Framework: Other, Root: ., Output: .
4. Deploy

## Catatan

- Data diambil langsung dari Supabase Database
- Tidak perlu file `.csv` atau `.xlsx` untuk deployment
- Gunakan Supabase Dashboard untuk import data

---

BPS Karawang - Kecamatan Tempuran - 2026
