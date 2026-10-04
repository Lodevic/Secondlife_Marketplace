# SecondLife Marketplace — Frontend

Fondasi dashboard web untuk seller dan admin, dibuat dengan React, Vite, React Router, Axios, Context API, dan Tailwind CSS.

## Menjalankan aplikasi

Pastikan backend Flask berjalan di `http://localhost:5000`, lalu dari folder `frontend/` jalankan:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Variabel `VITE_API_URL` pada `.env` mengatur URL backend dan secara default bernilai `http://localhost:5000`.

## Halaman

- `/login` — autentikasi seller dan admin.
- `/seller/dashboard` — placeholder dashboard seller.
- `/admin/dashboard` — placeholder dashboard admin.
- Role yang tidak sesuai akan melihat halaman 403; rute yang tidak dikenal menampilkan halaman 404.
