export async function onRequest(context) {
    const { request } = context;
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
        return new Response("", { status: 200, headers: corsHeaders });
    }

    const urlObj = new URL(request.url);
    const text = urlObj.searchParams.get("text");
    const lang = urlObj.searchParams.get("lang") || "sw";

    if (!text) {
        return new Response(JSON.stringify({ error: "Missing text parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }

    try {
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

        const buffers = [];
        let totalLength = 0;

        for (const chunk of chunks) {
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
            const res = await fetch(ttsUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
            if (!res.ok) {
                throw new Error(`TTS failed with status ${res.status}`);
            }
            const arrBuf = await res.arrayBuffer();
            const uint8 = new Uint8Array(arrBuf);
            buffers.push(uint8);
            totalLength += uint8.byteLength;
        }

        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of buffers) {
            combined.set(buf, offset);
            offset += buf.byteLength;
        }

        return new Response(combined.buffer, {
            status: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=86400",
                ...corsHeaders
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
}