export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;
    
    // Intentar recuperar de la red global de Cloudflare (Edge Cache)
    let response = await cache.match(request);
    if (response) {
      console.log("Aura Cache Hit");
      return response;
    }

    const clientId = url.pathname.split('/').pop();

    try {
      // El Worker actúa como puente hacia tu API en Google Cloud Run / AI Studio
      // GOOGLE_CLOUD_URL debe configurarse en el panel de Cloudflare
      const apiResponse = await fetch(`${env.GOOGLE_CLOUD_URL}/api/session/${clientId}`, {
        headers: { 
          "Authorization": `Bearer ${env.AURA_SECRET_KEY}`,
          "CF-Aura-Request": "true",
          "Accept": "application/json"
        }
      });

      if (!apiResponse.ok) throw new Error("Aura Origin Error: " + apiResponse.status);

      // Creamos una nueva respuesta para añadir cabeceras de cache
      response = new Response(apiResponse.body, apiResponse);
      
      // Cacheamos el manifest durante 60 segundos en el Edge
      // Esto evita saturar a Google Cloud si hay miles de pantallas pidiendo lo mismo
      response.headers.set("Cache-Control", "public, max-age=60");

      // Guardar en cache y retornar
      ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch (err) {
      console.error("Aura Worker Error:", err);
      return new Response(JSON.stringify({ 
        error: "Aura Engine Offline", 
        message: "No se pudo conectar con el motor central en Google" 
      }), { 
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
