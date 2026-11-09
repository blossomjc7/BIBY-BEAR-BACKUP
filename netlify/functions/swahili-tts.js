exports.handler = async function(event, context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400"
    };

    // Handle CORS preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ""
        };
    }

    const text = event.queryStringParameters.text;
    const lang = event.queryStringParameters.lang || "sw"; // Default to Swahili
    
    if (!text) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing text parameter" })
        };
    }

    try {
        // Split text into chunks of max 200 characters (Google Translate TTS limit)
        const chunks = [];
        let currentChunk = "";
        const words = text.split(" ");
        for (const word of words) {
            if ((currentChunk + " " + word).trim().length <= 200) {
                currentChunk = (currentChunk + " " + word).trim();
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = word;
            }
        }
        if (currentChunk) chunks.push(currentChunk);

        // Fetch audio for all chunks in parallel using native global fetch
        const fetchPromises = chunks.map(async (chunk) => {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!res.ok) {
                throw new Error(`Google Translate TTS failed with status ${res.status}`);
            }
            return Buffer.from(await res.arrayBuffer());
        });

        const buffers = await Promise.all(fetchPromises);
        const combinedBuffer = Buffer.concat(buffers);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=86400",
                ...corsHeaders
            },
            body: combinedBuffer.toString("base64"),
            isBase64Encoded: true
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: err.message })
        };
    }
};
