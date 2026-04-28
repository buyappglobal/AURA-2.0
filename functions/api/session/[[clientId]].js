export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cache = caches.default;
  
  // En Pages Functions, el clientId viene de la URL o del objeto params
  // Pero para ser compatibles con tu frontend, lo sacamos de la ruta
  const pathParts = url.pathname.split('/');
  const clientId = pathParts[pathParts.length - 1];

  // Intentar recuperar de la red global de Cloudflare (Edge Cache)
  let response = await cache.match(request);
  if (response) {
    return response;
  }

  try {
    // GOOGLE_CLOUD_URL debe configurarse en el panel de Cloudflare Pages (Settings > Variables)
    const targetUrl = `${env.GOOGLE_CLOUD_URL}/api/session/${clientId}`;
    
    const apiResponse = await fetch(targetUrl, {
      headers: { 
        "Authorization": `Bearer ${env.AURA_SECRET_KEY}`,
        "CF-Aura-Request": "true",
        "Accept": "application/json"
      }
    });

    if (!apiResponse.ok) throw new Error("Aura Origin Error: " + apiResponse.status);

    // Estrategia de Caché Avanzada: 
    // - s-maxage=60: El Edge (Cloudflare) guarda el JSON 1 minuto.
    // - stale-while-revalidate=600: Si pasan los 60s, entrega lo viejo rápido y actualiza en 
    //   segundo plano desde Google Cloud. Esto hace que sea instantáneo para el usuario.
    response = new Response(apiResponse.body, apiResponse);
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    
    // Cabeceras CORS exhaustivas
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Aura-Force-Refresh");

    // Guardar en cache y retornar
    context.waitUntil(cache.put(request, response.clone()));
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "Aura Cloud Engine Offline", 
      details: err.message 
    }), { 
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}
