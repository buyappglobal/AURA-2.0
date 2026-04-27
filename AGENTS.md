# Aura Business - Guía de Arquitectura y Reglas del Proyecto

Este archivo contiene las directrices fundamentales para el desarrollo de Aura Business. Debe ser leído por cualquier agente o tutor que trabaje en el proyecto para mantener la coherencia del sistema.

## 1. Sistema de Audio Unificado (AuraPlayer)
- **Motor Único**: No existen reproductores separados para "Circadiano" e "Impulso". Todo pasa por el `Unified Audio Orchestrator` en `AuraSoundscape.tsx`.
- **Modo de Operación**:
  - El sistema detecta si hay un `modo_manual` (Impulso) activo en Firestore.
  - Si no lo hay, cae automáticamente al `modo_circadiano` (horario por defecto).
- **Transiciones**:
  - Se utiliza un crossfade de 4-5 segundos entre pistas.
  - Las pistas comienzan con un offset de ~3 segundos para evitar silencios iniciales o intros lentas.
- **Sin Botón de Parada**: No se usa un botón de "Detener". Para volver al estado normal, se cambia el modo a "Automático", lo que limpia el flag `modo_manual` en la base de datos.
- **Aura Guard**: Un vigilante de silencio que monitoriza el AudioContext. Si detecta silencio prolongado (>20s) y el sistema debería estar sonando, fuerza un salto a la siguiente pista.

## 2. Gestión de Ciclos Circadianos
- **Arquitectura de "Default + Override"**:
  - Existe un horario estándar (Morning, active, etc.) definido en el código como base para todos los clientes.
  - **Futuro Próximo**: Cada cliente tendrá un campo `circadian_schedule` en su documento de Firestore. 
  - Si este campo existe, el sistema ignorará el horario por defecto y usará el personalizado del cliente.
  - Esto permite a los comerciales y al SuperAdmin configurar tramos horarios y carpetas específicas para cada negocio sin tocar el código.

## 3. Interfaz de Usuario (UI/UX)
- **Minimalismo**: La interfaz debe ser limpia, evocando una pantalla de señalización digital premium.
- **Controles Ocultos**: Los controles de volumen y configuración desaparecen tras la inactividad para no ensuciar la visual.
- **Animaciones**: Se usa `motion` (framer-motion) para todas las transiciones de menús y estados.

## 4. Integración Firebase
- **Documento Maestro**: `clientes/{clientId}` controla el estado de reproducción (`modo_manual`).
- **Heartbeat**: El display envía un `lastSeen` cada 60 segundos a `displays/{clientId}` para monitorizar la actividad desde el Admin.
