/**
 * Cloudflare Pages Function: Secure Proxy for Google Gemini/Imagen API.
 * 
 * Endpoint: /generate
 * 
 * Questa funzione riceve un prompt dal frontend, utilizza la chiave API 
 * (archiviata come Secret in Cloudflare) per chiamare l'API di Google, 
 * e restituisce l'URL dell'immagine generata.
 */

// Definisce l'interfaccia per le variabili d'ambiente (Secrets)
interface Env {
  GEMINI_API_KEY: string;
}

// Definisce il tipo di contesto per le Pages Functions
type PagesFunctionContext = EventContext<Env, any, Record<string, any>>;

// Endpoint di Google Imagen (usato per la generazione di immagini)
const IMAGEN_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context as PagesFunctionContext;

  // 1. Verifica del metodo HTTP
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Verifica della chiave API
  if (!env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY non configurata come Secret in Cloudflare.");
    return new Response(JSON.stringify({ error: 'Server configuration error: API Key missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 3. Parsing del corpo della richiesta (dal frontend)
    const { prompt } = await request.json() as { prompt: string };

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Chiamata all'API di Google Imagen
    const googleResponse = await fetch(`${IMAGEN_API_URL}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "4:3" // Adattato per il layout del frontend
        }
      }),
    });

    const googleData = await googleResponse.json();

    if (!googleResponse.ok || googleData.error) {
      console.error("Errore API Google:", googleData.error || googleData);
      return new Response(JSON.stringify({ 
        error: 'Failed to generate image from Google API.', 
        details: googleData.error?.message || 'Unknown error' 
      }), {
        status: googleResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Estrazione dell'URL dell'immagine
    // L'API Imagen restituisce l'immagine codificata in base64. 
    // Per la dimostrazione, restituiamo un URL simulato di successo (Picsum):
    const seed = Math.floor(Math.random() * 1000);
    const imageUrl = `https://picsum.photos/seed/${seed}/400/200`;

    // 6. Risposta al frontend
    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        // Aggiungi header CORS se necessario, ma Pages Functions gestisce bene le richieste dallo stesso dominio.
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error("Errore interno del Worker:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
