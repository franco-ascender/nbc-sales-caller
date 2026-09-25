# Sesión compartida del portal durante 12 horas — S01

Fecha: 2026-09-15. Request de Franco: abrir pestañas nuevas sin iniciar sesión otra vez durante 12 horas. Autoriza modificar WorkspaceAccess/auth de navegador, ampliando ownership previo Academy solo para esta tarea. Publicación autorizada en el mismo alias https://nbc-sales-nbc-sales.vercel.app; no enviar URLs nuevas al usuario.

## Plan previo al código

Usar persistencia de Supabase Auth con storage específico NBC compartido por pestañas del mismo origen y perfil. Envelope local {expiresAt,value}, donde value es la sesión del SDK; nunca password. Solo login explícito inicia ventana fija de 12 horas; refresh no la prolonga ni resucita almacenamiento expirado/eliminado. Supabase mantiene/rota tokens; APIs siguen validando Auth y membresía en servidor. La ventana es política de restauración en navegador, no cambia expiración JWT/revocación global ni configuración comercial del proveedor. No cuenta como permiso por existir localStorage.

Al montar, pantalla Checking your session hasta getSession + GET /api/workspace/session validado. Errores transitorios no eliminan sesión aún válida; ofrecer retry. 401/403 y logout limpian; expiry por timer y focus/visibility, storage event propaga cierre entre pestañas. Ignorar verificaciones pendientes tras logout/cambio de cuenta. Restauración no se considera login nuevo. Login rechazado no deja sesión persistida. No reescribir otros módulos o datos del usuario.

Archivos: WorkspaceAccess.tsx/CSS, src/lib/workspace-session-storage.ts, tests/workspace-session*, este feature, reporte/handoff propios S01 y artifacts/lanes/S01. No dependencias/env/SQL nuevas ni modificar requireWorkspaceUser o contratos de API. Preservar snapshot integrado vigente (I02-R4/C02/K01) para desplegar solo estos archivos.

## Verificación y aceptación

Pruebas de storage con reloj controlado: exactamente 12h, refresh sin extensión, expiry, datos inválidos, logout/refresh tardío. Browser con transporte fixture: login, reload/tab/session compartida, vencimiento con reloj, logout cruzado y carreras/respuesta denegada/error recuperable. Build aislado y HTTPS con Auth real: login una vez, pestaña nueva/recarga admitidas, logout elimina restauración; no esperar 12h reales ni inventar esa prueba. Conservar APIs anónimas 401 y Academy/Caller presentes. Registrar evidencia saneada sin tokens/contraseñas/storageState en artefactos.

Docs globales por orquestador: seguridad y arquitectura deben reemplazar política antigua de memoria por persistencia SDK acotada12h; API/DB sin cambios. Antes de publicación verificar alias y snapshot para no perder cambios concurrentes. El alcance es el mismo navegador/perfil/origen; incógnito u otro dispositivo necesitan login propio.

## Entrega verificada

Implementado storage fijo12h, restore validado, refresh sin extensión y logout/expiry entre pestañas. Cuatro unitarias y seis recorridos fixture pasan; reloj controlado para12h. Build/TypeScript aislados y build cloud aprobados. Cuatro comprobaciones con Auth real tanto local como en Vercel: una solicitud de password, nueva pestaña/recarga restauradas, deadline intacto, logout compartido. Publicado en https://nbc-sales-nbc-sales.vercel.app sobre C03-R1/I02-R4/K01,125 archivos, tres deltas runtime. Sin SQL/paquetes/env nuevos. Reporte docs/lanes/reports/S01.md y artifacts/lanes/S01. Primer login después de actualización inicia persistencia; no recupera automáticamente una sesión antigua que solo vivía en memoria.
