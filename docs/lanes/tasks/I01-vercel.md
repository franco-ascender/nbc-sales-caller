# I01 — Publicar NBC Sales en Vercel para revisión de Anas

> Actualización vigente: leer completo `metodo_ainnovate.md` y `docs/lanes/REVIEW-PROTOCOL.md`. Antes de todo push, Franco revisa y autoriza la entrega concreta. Preparar implementación, pruebas y reporte versionado primero. La revisión técnica del orquestador no sustituye su aprobación.

Lane: Infraestructura + Dashboard. Herramienta elegida: Codex, modo Local, mismo proyecto. Estado inicial: preparada, sin ejecutar. Esta es la prioridad número uno del usuario, explícitamente autorizada. El primer resultado debe ser una URL de revisión funcional, no un rediseño del dashboard.

## Leer primero

CLAUDE.md, docs/lanes/README.md, docs/lanes/REPORT-TEMPLATE.md, docs/04-deployment.md, docs/03-security.md, docs/features/master-platform.md, docs/features/platform-delivery.md y docs/lanes/BASELINE.json. Las instrucciones anteriores «no publicar» de handoffs históricos quedan sustituidas para esta tarea por la autorización actual del usuario.

## Estado confirmado por orquestador

GET de metadatos 2026-09-14: Supabase NBC Caller activo; Vercel equipo NBC Sales reconocido, cero proyectos en ese equipo y sin páginas adicionales. Un intento anterior de crear proyecto devolvió HTTP403 por permisos. Esta consulta actual NO repitió POST ni confirma que el bloqueo siga vigente. Hay tokens/IDs privados en `.env.local`. No pedir nuevamente datos que ya existen ni imprimirlos. No existe Git local; el primer despliegue no requiere abrir un repositorio público.

## Ejecutar

1. Leer BASELINE.json, comprobar SHA256 y extraer su tar.gz en un staging aislado bajo /private/tmp. El snapshot tiene 57 archivos runtime, sin `.env`, documentación interna, datos de Supabase, capturas ni dependencias. No desplegar directamente la carpeta compartida mientras los otros lanes editan.
2. Consultar el proyecto/equipo actual con credenciales existentes. Reutilizar un proyecto si ya existe. Si no existe, crear/vincular el proyecto NBC Sales en el equipo NBC Sales; comprobar permisos y scope reales. Evitar duplicados si la respuesta es ambigua. Si el API no permite crear, revisar autenticación CLI/local ya disponible o proporcionar el paso mínimo que debe hacer el usuario en Vercel, conservando todo el staging listo para desplegar. No insistir ciegamente con el mismo 403 ni proponer upgrades de pago por defecto.
3. Verificar documentación oficial actual de Vercel y compatibilidad Node/Next/dependencias del lockfile. Preparar las correcciones necesarias en staging y en archivos de infraestructura de tu ownership. Si cambia código o lockfile del candidato, obtener revisión de Franco de esa versión antes del upload; la autorización del baseline no cubre esos cambios. Instalar/compilar en staging, no tocar node_modules o .next del workspace concurrente. Registrar las correcciones aplicadas al snapshot.
4. Configurar solo runtime necesario mediante canal privado: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, NBC_OPERATOR_EMAIL, ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID. Las dos primeras son públicas; el resto solo servidor. No desplegar VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN, contraseña inicial ni claves OpenAI/Anthropic sin consumidor. GoHighLevel solo si ya está configurado y se valida su destino. No copiar todo `.env.local` al hosting.
5. Desplegar una versión de revisión accesible por HTTPS. Está autorizado publicar el baseline inicial congelado para que el usuario comparta el enlace con Anas, sin git push ni código nuevo no revisado; mantener autenticación de las APIs y del Caller privado. Comprobar Deployment Protection y el acceso real en una sesión sin login Vercel, no solo que la URL devuelve READY. No compartir la cuenta/contraseña de Franco ni enviar invitaciones. Si falta definir acceso privado de Anas, entregar la URL de revisión visual funcionando y describir por separado ese acceso pendiente.
6. Verificar Home, /caller, /academy, /ask-anas, /lead-engine, /integrations, navegación móvil y rechazo anónimo de APIs privadas. No iniciar llamadas para comprobar un despliegue. Guardar IDs de proyecto en configuración local preservando los valores existentes; no subir secretos como artefactos.
7. Escribir docs/lanes/infra.md, actualizar docs/04-deployment.md y entregar docs/lanes/reports/I01.md conforme a plantilla. Reportar snapshot SHA, correcciones, URL/deployment ID, acceso real y validaciones. Después de la conexión, preparar si hace falta correcciones pequeñas de presentación del shell como candidato separado para revisión. Incluir capturas públicas y recorrido de 2–3 minutos. No empezar login global, roles o rediseño amplio hasta asignación I02.

## Terminado cuando

Existe una URL de revisión accesible y comprobada, runtime configurado, APIs privadas protegidas y reporte reproducible. Si un permiso externo impide publicar, reportar el bloqueo específico y la intervención mínima, junto con staging listo. No afirmar «conectado» por tener un token o por completar un build local. No aplicar migraciones L01/K01 durante I01.

La feature de entrega propia es `docs/features/platform-delivery.md`: actualizarla antes/después de cambios de configuración, sin editar la feature global de plataforma. Guardar evidencia en `artifacts/lanes/I01/`.
