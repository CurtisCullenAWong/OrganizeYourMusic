import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

const {
    VITE_PORT,
    VITE_SPOTIFY_PROXY_URL,
} = process.env;

const PORT = Number(process.env.PORT) || Number(VITE_PORT) || 8000;

if (!VITE_SPOTIFY_PROXY_URL) {
    throw new Error(
        'Missing required VITE_SPOTIFY_PROXY_URL environment variable'
    );
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

/**
 * Generic Spotify API proxy endpoint
 * Forwards requests to Spotify API with the access token
 */
app.post(VITE_SPOTIFY_PROXY_URL, async (req, res) => {
    try {
        const { url, method = 'GET', data, accessToken } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        if (!accessToken) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        // For GET requests with data, append as query parameters
        let finalUrl = url;
        if (data && method === 'GET') {
            const params = new URLSearchParams(data);
            finalUrl = `${url}?${params.toString()}`;
        }

        const response = await fetch(finalUrl, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Spotify API error (${response.status}):`, errorData);
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) res.set('Retry-After', retryAfter);
            return res.status(response.status).json(errorData);
        }

        const responseData = await response.json();
        res.json(responseData);
    } catch (error) {
        console.error('Spotify API proxy fatal error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Spotify API proxy server running on http://localhost:${PORT}`);
}).on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try another port.`);
        process.exit(1);
    }
});
