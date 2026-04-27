# Changelog - Aura Business

Todas las actualizaciones notables de este proyecto serán documentadas en este archivo.

## [20-Abr-2026] v1.0.0 - Aura Ecosystem: Sales & Demo Hub
### Añadido
- **Modo Demo / Ventas (Ecosistema Partner):**
  - Nueva propiedad `isDemoAccount` vinculada al perfil de usuario para transformar cualquier pantalla en un escaparate de ventas.
  - **Marca de Agua de Ventas:** Indicador visual sutil en la parte superior ("Canal de Ventas - Aura Ecosystem") para diferenciar pantallas de demostración de monitores de cliente final.
  - **Bloqueo Inteligente de Ajustes:** La rueda dentada de configuración aparece atenuada (40% opacidad) en modo demo.
  - **Portal de Acceso Partner (Backdoor):** Al pulsar la rueda bloqueada, se abre un portal de seguridad con un mensaje de confirmación ("¿Realmente quieres acceder?"). Si se confirma, se ofrece un formulario de login integrado que permite a los comerciales acceder a su sesión y abrir su panel de control en una pestaña nueva sin interrumpir la presentación al cliente.
  - **WhatsApp Centralizado:** El Super Admin ahora puede asignar un número de WhatsApp específico a cada usuario. Este será el contacto principal que usará el **Agente Aura AI** para redirigir leads de forma automática a cada partner.
- **URLs Amigables (Slugs Dinámicos):**
  - Implementación de rutas personalizadas (ej. `auradisplay.es/hub/sierraservicios` o `auradisplay.es/sierraservicios`).
  - Resolución inteligente de slugs mediante `HubResolver.tsx`, mapeando nombres amigables a IDs de cliente secretas.
  - Activación automática del **Agente Aura AI** con modo forzado (`?auraAgent=true`) al entrar vía ruta amigable.
- **Super Admin Supervitaminada (Estadísticas y Control):**
  - **Actividad en Tiempo Real:** Heartbeat dinámico que rastrea cuándo un monitor estuvo conectado por última vez. Los usuarios online se muestran con una pulsación verde y sombra brillante.
  - **Buscador Avanzado:** Barra de búsqueda que permite encontrar usuarios por Email, Slug o Ciudad instantáneamente.
  - **Filtrado por Categorías y Delegación:** Selectores rápidos para filtrar por roles (Admin, Comercial, Cliente) y por ciudades/delegaciones (detectadas automáticamente).
  - **Estadísticas de Uso (Impulsos):** Contador acumulativo de "Impulsos Aura" activados por cada cliente, visible en el panel general y en cada tarjeta de usuario.
  - **Gestión de Identidad:** Campos para asignar Delegación/Ciudad a cada cuenta para una mejor organización regional.
  - **Borrado Seguro (Soft Delete):** Funcionalidad para eliminar cuentas que limpia la identidad del usuario y lo oculta del panel operativo sin perder el rastro histórico si fuera necesario recuperar datos.
  - **Dashboard de KPIs:** Tarjetas de resumen con Cuentas Totales, Monitores Online y Total de Impulsos de la red.
- **Agente Aura v1.3.0 (Dynamic AI):**
  - Capacidad de detectar el contexto de ventas para actuar como asistente del partner comercial.
  - WhatsApp dinámico configurado por local, permitiendo que cada partner reciba sus propios leads directamente.
- **Super Admin Extendida:**
  - Nuevos controles para gestionar Slugs y activar el Modo Demo directamente desde la lista de usuarios.

## [12-Abr-2026] v0.7.0-alpha - Sistema de Vinculación Smart TV (QR + Code)
### Añadido
- **Sistema de Emparejamiento TV (QR + Código):**
  - Nueva opción "Vincular Pantalla" en el menú de ajustes para una conexión sin cables.
  - Generación de códigos únicos de 6 dígitos y códigos QR dinámicos para una vinculación instantánea.
  - Sincronización en tiempo real: la TV se vincula automáticamente al confirmar desde el móvil.
  - Persistencia de dispositivo: las pantallas vinculadas se recuerdan mediante almacenamiento local.
  - Modo Demo Fluido: las TVs muestran contenido de alta calidad por defecto hasta ser vinculadas a una cuenta de cliente.
- **Interfaz de Vinculación Admin:**
  - Detección automática de solicitudes de emparejamiento al escanear el QR.
  - Modal de confirmación seguro para vincular dispositivos a cuentas de clientes específicas.
- **Infraestructura Firestore:**
  - Nueva colección `pairingCodes` con lógica de expiración automática.
  - Reglas de seguridad actualizadas para proteger el proceso de vinculación.

## [En Estudio] v0.7.0-alpha - Aura Video Library
### Próximamente
- **Fondos Dinámicos (Video):** Implementación de biblioteca de videos MP4 curados por temáticas (Zen, Energy, Elegant, Food).
- **Optimización de Costes:** Sistema basado en repositorios externos para ofrecer contenido dinámico de alta calidad sin costes de almacenamiento para el cliente ni para la plataforma.
- **Cumplimiento Legal:** Videos mudos optimizados para Autoplay y libres de cánones de SGAE/Video.

## [11-Abr-2026] v0.6.6-alpha - Diseño Consciente de la Altura (Landscape Optimization)
### Añadido
- **Escalado Basado en Altura (vh):** Transición de un diseño basado en el ancho (`vw`) a uno basado en la altura (`vh`) para los textos centrales y superiores. Esto garantiza que el contenido se encoja proporcionalmente cuando el espacio vertical es limitado (como en móviles apaisados o TVs con layouts específicos).
- **Branding Adaptativo:** El logotipo y la información de cabecera ahora reducen su tamaño y espaciado dinámicamente en modo apaisado, evitando que empujen el contenido principal hacia fuera de la pantalla.
- **Jerarquía Visual Protegida:** Ajuste de los límites de `clamp()` para asegurar que el Título, Subtítulo y Etiqueta siempre mantengan su relación de tamaño y nunca se solapen con el ticker inferior.
- **Padding Dinámico Proporcional:** El margen de seguridad inferior ahora se calcula en base al porcentaje de altura de la pantalla, asegurando una separación perfecta con la barra de noticias en cualquier resolución.

## [11-Abr-2026] v0.6.5-alpha - Tipografía Fluida y Adaptabilidad Total
### Añadido
- **Sincronización de Diseño Fluido:** Ahora todos los elementos centrales (Categoría, Título, Subtítulo y Etiqueta) escalan de forma armónica y proporcional mediante `clamp()`. Esto garantiza que la jerarquía visual se mantenga intacta en cualquier tamaño de pantalla.
- **Etiquetas Adaptativas:** Las etiquetas sombreadas (tags) ahora tienen dimensiones y tipografía fluida, asegurando su visibilidad y legibilidad tanto en móviles como en Smart TVs de gran formato.
- **Optimización de Espaciado Vertical:** Refinamiento de los márgenes y el padding dinámico para evitar que el contenido se desplace fuera del área visible en resoluciones de escritorio o TV.

## [11-Abr-2026] v0.6.4-alpha - Diseño "Floating" y Botón Independiente
### Añadido
- **Botón de Reproducción Independiente:** El botón de Play/Pause ahora es un elemento circular perfecto e independiente, eliminando cualquier riesgo de recorte o achatamiento visual.
- **Info Rail Flotante:** El texto "AURA LIVE" y el indicador de estado ahora flotan sobre el botón sin fondo oscuro, logrando un minimalismo extremo y disruptivo.
- **Animaciones de Entrada:** Transiciones suaves con efecto de muelle (spring) para la aparición de la información de streaming.
- **Visualizer Refinado:** Los anillos de visualización ahora son mucho más prominentes, con colores más vibrantes (Rojo, Azul, Amarillo) y una mayor escala de reacción para que el "aura" sea claramente visible incluso en pantallas grandes.

## [11-Abr-2026] v0.6.3-alpha - Minimalismo Extremo y Refinamiento UI
### Añadido
- **Reproductor Ultra-Minimalista:** Eliminación del control de volumen en pantalla para delegar el control al dispositivo físico, simplificando la interfaz.
- **Ajuste de Proporciones:** Refinamiento de las dimensiones del reproductor colapsado para evitar recortes visuales del botón de Play/Pause en cualquier resolución.
- **Info Rail Simplificado:** Rediseño del indicador "AURA LIVE" para una estética más limpia y equilibrada.

## [11-Abr-2026] v0.6.2-alpha - Optimización Smart TV (webOS/Tizen)
### Añadido
- **Modo "Pulsa para Iniciar":** Implementación de una capa de interacción para Smart TVs que evita el bloqueo de Autoplay por parte del navegador.
- **Fallback de Imágenes Robusto:** El sistema ahora garantiza que siempre haya contenido visual (imágenes de demo) si el cliente no tiene imágenes activas, evitando pantallas negras accidentales.
- **Función "Copiar Enlace":** El botón de Cast ahora detecta si el dispositivo no soporta el menú nativo de compartir y ofrece copiar el enlace directamente con una notificación visual (Toast).
- **Rediseño Vertical del Reproductor:** El control de audio ahora utiliza un diseño vertical "disruptivo" que se expande hacia arriba, optimizando el espacio y mejorando la estética en Smart TVs y smartphones.
- **Auto-ocultación Inteligente:** Implementación de un sistema de auto-ocultación para los controles del reproductor en dispositivos táctiles y TVs, asegurando que la interfaz se limpie automáticamente tras unos segundos de inactividad.

## [11-Abr-2026] v0.6.1-alpha - Mejoras de Conectividad y UI
### Añadido
- **Botón de Cast:** Re-integración del botón de Cast/Enviar a TV en el menú de configuraciones. Permite compartir el enlace rápidamente o acceder a la guía de conexión para proyectar en Smart TVs.
- **Guía de Conexión Actualizada:** Instrucciones específicas para Google Cast / Chromecast, explicando cómo usar la función nativa del navegador para proyectar la pestaña completa.
- **Rediseño de Menú de Ajustes:** Nueva cuadrícula de acciones rápidas (Refrescar, Pantalla, Admin, Cast) para un acceso más ágil a las funciones principales.
- **Iconografía Mejorada:** Actualización de iconos para una mejor guía visual en la configuración de dispositivos externos.

## [10-Abr-2026] v0.6.0-alpha - Unificación y Control de Publicidad
### Añadido
- **Unificación de Pantallas:** La ruta `/view` ahora utiliza el motor principal de Aura Business, garantizando que todos los clientes tengan el mismo diseño premium que la web oficial.
- **Identidad y Datos:** Nombre del local, hora y clima integrados en la parte superior para una visualización limpia y profesional.
- **Lógica de Publicidad Inteligente:** El sistema ahora detecta automáticamente si el cliente tiene contratado el panel de publicidad.
- **Control de Ticker:** Si un cliente no tiene publicidad, el ticker de Aura Business desaparece por completo, dejando la pantalla libre de distracciones.
- **Modo Minimalista:** Si un cliente decide no subir imágenes, el sistema ahora muestra sus textos sobre un fondo negro premium con efectos de brillo "Aura Glow", ideal para un estilo sobrio y elegante.
- **Ajuste de Composición Dinámico:** El bloque de texto central ahora ajusta su posición automáticamente según la presencia del ticker, garantizando que nunca se solape con la publicidad o los controles y mejorando el equilibrio visual.

## [10-Abr-2026] v0.5.0-alpha - Super Admin y Roles
### Añadido
- **Panel de Super Admin:** Nueva interfaz en `/admin/super` para gestión centralizada de usuarios.
- **Sistema de Roles:** Implementación de roles `admin`, `sales` (comercial) y `client`.
- **Impersonación:** Capacidad para que Admins y Comerciales entren en las pantallas de sus clientes para gestión o demostraciones.
- **Gestión de Permisos:** Toggles para activar/desactivar el panel de publicidad (`hasAdsPanel`) por usuario.

## [09-Abr-2026] v0.4.0-alpha - Programación y Tickers
### Añadido
- **Programación Horaria:** Soporte para horarios y días de la semana en imágenes, textos y tickers.
- **Ticker Independiente:** Sistema de mensajes fluyendo en la parte inferior.
- **Mejoras de UI:** Rediseño del panel de administración con estética oscura y minimalista.

---
*Este documento es para uso interno del equipo de Aura Business.*
