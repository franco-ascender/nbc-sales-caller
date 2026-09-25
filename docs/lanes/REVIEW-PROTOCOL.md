# Publicación y revisión — regla vigente de Franco

Actualizado 2026-09-17 tras su pedido explícito de simplificar. Reemplaza las restricciones incompatibles de tareas, reportes y prompts históricos.

1. **Franco revisa en https://nbc-sales-nbc-sales.vercel.app.** Localhost sirve para desarrollo y pruebas; no equivale a publicar ni a entregar lo que pidió.
2. **«Pushealo», «publicalo», «subilo a Vercel» o «quiero verlo ahí» autorizan publicar el trabajo solicitado en ese enlace.** No volver a preguntar si hay permiso, exigir una frase distinta o pedir aprobación de un hash. Revisar y probar técnicamente el candidato es trabajo del equipo, no un trámite extra para Franco.
3. Preparar la entrega, preservar cambios ajenos y publicar una versión integrada coherente. Solo una publicación a la vez. Infra ayuda; su ownership no es un veto ni un permiso adicional que Franco deba conseguir. Si el lane no puede publicar, coordina la ejecución y entrega el enlace cuando esté comprobado; no sustituye Vercel por localhost.
4. **El enlace debe llegar al login NBC sin exigir pertenecer al equipo Vercel.** Conservar auth/roles/RLS de la aplicación. No agregar protección del proveedor que impida revisar. Comprobar el alias habitual sin cookies privilegiadas después de cada publicación y verificar que las APIs privadas siguen rechazando anónimos. Un deployment READY con pantalla Vercel «You Need Access» no es una entrega válida. Tampoco basta /200: comprobar variables runtime del target real y que el bundle tenga la configuración pública necesaria. Verificar login NBC completo con acceso autorizado existente cuando esté disponible; si no, declarar ese límite, sin afirmar que la cuenta funciona por un 401 anónimo.
5. En este contexto, «push» significa hacer visible el cambio en Vercel. Si se pide Git explícitamente, usar el repo/remoto existente y ejecutar lo autorizado; no inventar commits ni crear remotos como efecto lateral. Deploy por API/CLI es válido y no necesita un git push previo.
6. Si falla acceso, build o deploy, investigar y corregir dentro del encargo. Pedir al usuario solo un dato/acceso realmente ausente después de comprobarlo, explicando cuál. No citar una regla vieja para bloquear una instrucción nueva. La autorización de publicación no autoriza campañas, compras ajenas ni eliminar datos.
7. Entregar breve: qué cambió, URL habitual comprobada y limitación real si existe. El equipo conserva internamente logs y versión, sin pedir a Franco administrar snapshots o permisos entre lanes.

La revisión técnica precede a publicar; la revisión de Franco sucede en Vercel y sus correcciones se atienden allí según el pedido. La instrucción histórica «antes de pushear yo reviso» no debe reinterpretarse como exigir localhost cuando Franco ya pidió publicar para revisar.

Guía operativa: docs/04-deployment.md. No ejecutar scripts de publicación históricos sin comprobar su snapshot/base: algunos contienen deployments fijos de entregas anteriores.
