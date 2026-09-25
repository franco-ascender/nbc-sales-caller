> HISTÓRICO: no usar estas restricciones como instrucciones actuales. Ver ../REVIEW-PROTOCOL.md.

# Revisión y publicación — instrucción vigente de Franco

## Autoridad y alcance

Franco indicó: «Antes de pushear cualquier cosa, yo reviso y ahí pushean». Es una condición explícita del usuario y prevalece sobre cualquier permiso genérico anterior. El método AInnovate se aplica al trabajo existente: leer, documentar, implementar, verificar, actualizar y entregar. No reiniciar Fase 1.

La instrucción de preparar cuatro lanes autoriza implementación local y pruebas dentro del alcance. No exige aprobación de cada paso rutinario. Los límites de archivos están en README.md; los requisitos concretos, en tasks/.

## Vercel primero

- Conectar/verificar cuenta, crear o vincular proyecto, configurar runtime y preparar build aislado están autorizados. Infraestructura empieza por esto, sin esperar a que los otros lanes terminen.
- La publicación inicial del baseline congelado identificado en BASELINE.json conserva la autorización previa para crear el enlace de revisión. No requiere git push. No incluye código nuevo, nuevas migraciones ni modificaciones de otros lanes.
- Si el baseline necesita cambios de código/dependencias para desplegar, preparar el candidato corregido con diff y pruebas antes de solicitar la revisión de Franco de esa versión. Avanzar mientras tanto con toda la conexión independiente.
- No usar un deploy por CLI/API, merge, promoción, tag ni auto-deploy como alternativa para publicar cambios nuevos sin revisión. No vincular una rama mutable a publicación automática durante esta ronda.
- Publicar baseline no equivale a habilitar una cuenta privada de Anas. Entregar qué puede ver con el enlace y qué acceso de aplicación falta, sin compartir credenciales de Franco ni enviar invitaciones.

## Etapas de cada entrega

1. **Preparación:** leer documentos y código; comprobar tarea/estado; documentar el cambio antes de editar. Registrar plan corto con criterios observables, sin pedir aprobación redundante del trabajo asignado.
2. **Implementación local:** respetar ownership, preservar avances ajenos y corregir regresiones propias. Mantener la feature actualizada con contratos y límites reales.
3. **Autorrevisión:** revisar cambios propios, validación de inputs/propiedad, errores, compatibilidad y estados de UI. Ejecutar pruebas significativas. Build/navegador en staging aislado o en ventana coordinada; sin interferir con servidor/dependencias de otros lanes. Guardar evidencia real sin secretos.
4. **Entrega al orquestador:** reporte versionado con archivos y referencia del candidato, pasos para reproducir, pruebas ejecutadas/pendientes, dependencias y deltas documentales. Un lane con SQL sin aplicar o pruebas críticas pendientes es parcial, aunque su código esté escrito.
5. **Revisión técnica:** el orquestador lee código, pruebas y contratos; comprueba integración, consolida docs globales y devuelve correcciones o declara el candidato técnicamente revisado. Los ajustes vuelven al lane propietario. La aplicación de migraciones compartidas se coordina aquí, no simultáneamente desde cuatro chats. No equivale a permiso de publicación.
6. **Revisión de Franco:** presentar resultado observable, rutas, capturas disponibles, límites y versión exacta. Esperar aprobación explícita del push. No inferir aprobación del silencio, de otra tarea ni de una revisión técnica satisfactoria.
7. **Push/publicación autorizados:** solo el ejecutor coordinado verifica de nuevo candidato, destino y archivos aprobados. No incluir cambios concurrentes que no fueron revisados. Un commit/hash o manifiesto de archivos permite identificar qué se revisó; si no hay Git, preparar esta referencia sin inventar rama/commit. No inicializar Git ni crear repositorio remoto como efecto lateral de I01.
8. **Comprobación posterior:** si la acción fue autorizada y ejecutada, reportar push real, commit/destino y, si corresponde, URL/deployment y pruebas sobre lo publicado. Un fallo no se informa como éxito. Si el candidato cambia, vuelve a revisión; las aprobaciones previas no cubren modificaciones posteriores.

## Trazabilidad AInnovate sin conflictos de edición

Cada lane actualiza su feature, handoff y reporte. Su reporte incluye una entrada completa propuesta de CHANGELOG y los cambios de esquema, endpoints, arquitectura y lookup que corresponden. El orquestador consolida esos archivos globales antes de declarar integrada la entrega. Esta asignación centraliza la escritura; no elimina la obligación de documentar. Las migraciones propuestas se identifican como propuestas hasta su aplicación y comprobación.

## Comunicación al usuario

El reporte debe permitir una revisión sin reconstruir la conversación. Estado de implementación, integración, revisión técnica, aprobación de Franco, push y despliegue son campos separados. Para aprobación pendiente, indicar el candidato y la acción exacta que están listos. Explicar que la revisión previa al push proviene de la instrucción de Franco, no de una nueva restricción inventada por el agente. No pedir aprobación cuando aún falta trabajo autorizado necesario para hacer el resultado revisable.
