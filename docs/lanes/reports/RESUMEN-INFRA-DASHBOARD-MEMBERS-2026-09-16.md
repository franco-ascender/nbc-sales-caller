# Reporte consolidado — NBC Sales: infraestructura, membresías y dashboard

Preparado el 16 de septiembre de 2026. Abarca el trabajo de esta conversación, desde la publicación inicial hasta la corrección del mock en Your Roadmap: entregas I01–I09. Las implementaciones registradas se realizaron el 14 y 15 de septiembre. Fuentes: reportes de entrega, manifiestos y evidencias locales; consulta de estado Vercel del 16 de septiembre. No incluye contraseñas, tokens ni claves.

**Resultado general**

Pasamos de una plataforma en preparación a un portal NBC publicado en Vercel, con login general, roles y membresías, onboarding persistente, navegación de mentoría, Overview personalizable, apariencia clara/oscura, perfil, administración de consumo y base de créditos. La última corrección de esta conversación puso el roadmap de ejemplo directamente en /members, la pantalla Your Roadmap que mostrabas en la captura.

El portal está accesible para revisión en https://nbc-sales-nbc-sales.vercel.app/. Es un despliegue preview/staging autorizado; no se realizó una promoción formal a producción ni un push Git durante esta conversación.

**1. Dirección de producto y alcance acordado**

La visión que definiste es incluir el portal con el programa de mentoría de NBC Sales: centralizar herramientas, aprendizaje, acompañamiento y soporte, con experiencia premium y marca NBC. El objetivo comercial mencionado de un programa de USD 15.000 se tomó como contexto de diseño; no se configuró una venta de ese programa por ese importe.

La interfaz quedó en inglés. La dirección visual final conserva navy, azul, blanco y amarillo NBC, con superficies translúcidas y temas claro/oscuro coherentes. NBC Credits es la moneda de cara al miembro; el consumo y los costos internos se administran por separado.

El alcance implementado aquí fue infraestructura, shell/navegación, membresías, Overview, Settings, Usage, base de pagos y mocks del roadmap. Se conservaron e integraron versiones publicadas de Caller, Lead Engine, Academy y Calendar desarrolladas en otros chats; no se atribuye aquí toda su implementación.

**2. Publicación y acceso en Vercel — I01 / I02**

- Se creó/configuró el proyecto NBC Sales en Vercel y se publicó una URL HTTPS.
- Se configuraron las variables necesarias para el runtime, manteniendo secretos fuera de los archivos públicos y del código cliente.
- Se permitió entrar al login NBC sin necesitar una cuenta de Vercel, mediante excepciones limitadas a los deployments de revisión.
- Después de tu observación de que la raíz abría directamente el dashboard, se protegieron la raíz y las páginas del portal con el login general NBC.
- Las APIs mantienen sus verificaciones de sesión y permisos en el servidor. Ocultar una pantalla no es la única protección.
- Las publicaciones se construyeron desde archivos congelados y verificados. Cuando otro chat había actualizado el alias, se integró esa versión antes de publicar para conservar su trabajo.

Los cambios se publicaron en Vercel bajo tu autorización persistente. No se usó localhost como entrega final. No se hicieron Git push, merge, tag ni promoción a producción.

**3. Roles, cuentas y membresías — I02**

Se implementaron los roles admin, coach y estudiante con membresía activa como condición de acceso.

| Rol | Alcance implementado en membresías |
|---|---|
| Admin | Revisar miembros, asignar coaches, administrar sesiones y asignar créditos manualmente; acceso a Usage. |
| Coach | Revisar estudiantes asignados y trabajar con sus conversaciones/sesiones permitidas. |
| Estudiante | Acceder a sus propios datos, onboarding, conversación con mentor, soporte y créditos. |

Se crearon y activaron las cuentas solicitadas:

| Persona | Email | Rol |
|---|---|---|
| Anas Daoud | anas@nbcsales.io | Admin |
| Elias Castañeda | elias@nbcsales.io | Admin |
| Franco | Cuenta operadora existente | Admin activo |

También se corrigió tu error “Your account does not have an active NBC membership”: tu usuario Auth existía, pero faltaba la membresía. Se activó sobre la misma cuenta, conservando sus credenciales. Los accesos de Anas y Elias se probaron con autenticación real; las contraseñas iniciales se entregaron mediante archivo privado local, sin enviarlas por email ni incluirlas en reportes.

La activación de una membresía no equivale a conceder todos los permisos particulares de cada herramienta. Cada módulo conserva su autorización.

**4. Onboarding y estructura del portal — I02**

Se reorganizó Members para que el recorrido sea claro:

- Start Here antes de completar onboarding, con icono de inicio del camino.
- Dos preguntas temporales: en qué está trabajando el miembro y qué quiere lograr.
- Guardar borrador y completar explícitamente, con persistencia real en Supabase.
- Your Roadmap e icono de mapa después de completar.
- Calendar y Mentor Chat como secciones independientes del menú lateral.
- Support accesible al pie del menú.
- NBC Credits siempre en la cabecera, con saldo disponible del usuario que inició sesión y enlace a su historial.
- Revisión de otros miembros plegable para admin/coach, sin reemplazar el saldo propio de la cabecera por el del estudiante inspeccionado.

Al principio Your Roadmap mostraba “Roadmap charging”, como pediste. En la última entrega se sustituyó ese estado por el mock visible para revisar el diseño. El formulario definitivo de NBC y una roadmap personalizada asignada por coaches siguen pendientes.

**5. Mentor Chat, soporte y calendario**

Mentor Chat guarda mensajes y un historial paginado de la conversación entre estudiante y coach asignado. Se comprobaron permisos y reintentos sin duplicar mensajes. La actualización es manual mediante Refresh.

Support permite abrir tickets con título y descripción, consultar su estado, resolverlos y reabrirlos, respetando los permisos implementados.

Esto constituye una base funcional de comunicación y soporte, no un reemplazo completo de Slack: no se implementaron canales, adjuntos, notificaciones ni mensajería en tiempo real en esta conversación.

Calendar permite sesiones NBC grupales/privadas y enlaces para unirse. En I05 se preparó un feed autenticado y un adaptador Google de solo lectura. Confirmaste que tu cuenta lectora es admin@nalify.marketing; se recomendó que el dueño comparta el calendario del programa con una cuenta dedicada de integración NBC, sin entregar su contraseña ni acceso completo a su cuenta.

El calendario externo de mentoría no quedó conectado en este trabajo: faltan identificar el calendario exacto y completar la autorización OAuth utilizable por el servidor. La vista mensual que actualmente conserva el portal fue añadida por otro chat en KCAL01 y se integró en nuestros despliegues posteriores. Esa grilla visible no significa que Google Calendar esté sincronizado.

**6. Sesión persistente**

Se integró la sesión de 12 horas de S01 y después se reforzó su recuperación en I05:

- Refrescar y abrir otra pestaña del mismo navegador conserva el acceso dentro de esa ventana.
- Se valida la identidad y membresía con el servidor al restaurar.
- La renovación de tokens no prolonga indefinidamente el plazo de 12 horas.
- Una respuesta tardía de un token viejo no elimina una sesión más nueva.
- Un fallo temporal permite reintentar; un rechazo real de permisos no abre el portal.
- Sign out limpia la sesión y se propaga entre pestañas.

Se comprobó con login real sobre Vercel. La contraseña no se guarda en el navegador. Otro dispositivo, perfil de navegador o incógnito necesita su propio login. Es persistencia limitada, no sesión permanente.

**7. Evolución del Overview y diseño — I03 / I04 / I05 / I07**

La primera versión cambió Workspace a Resumen y agregó métricas, pipeline, gráficos y animaciones. Tras tu corrección se pasó a Overview, manteniendo toda la interfaz en inglés.

Después se incorporaron widgets, galería y personalización. La versión oscura con turquesa no era la identidad que querías: se reemplazó por la paleta NBC, apariencia clara por defecto y modo oscuro global. El efecto liquid glass se implementó mediante transparencias, blur, bordes y reflejos sutiles, con alternativas accesibles cuando corresponde.

El Overview terminó con 11 widgets:

| Grupo | Widgets |
|---|---|
| Métricas | Your leads, Ready for outreach, Conversations, Practice minutes |
| Actividad | Conversation activity, Your pipeline, Recent conversations |
| Aprendizaje | Your roadmap, Next up in Academy |
| Acompañamiento y cuenta | Next coaching call, NBC Credits |

Se implementó Edit para arrastrar tarjetas, agregar desde una galería, quitar, cambiar tamaño mediante esquina o presets, mover con teclado, guardar con Done, cancelar y restaurar. La galería muestra previsualizaciones basadas en los datos disponibles. También se agregó ocultar/mostrar la barra lateral.

Los gráficos usan curvas suaves y animaciones, con límites para no inventar valores entre observaciones, estados vacíos/errores y respeto de movimiento reducido. Las métricas no generan ingresos, crecimiento ni resultados ficticios. Su alcance depende de los datos cargados: por ejemplo, últimas sesiones y leads disponibles, no necesariamente toda la historia de la cuenta.

La personalización y los hitos personales se guardan por cuenta en ese navegador. Todavía no se sincronizan entre dispositivos.

Tras tu captura de tarjetas desalineadas y huecos, I07 cambió la distribución a filas completas de altura compartida. Al modificar el tamaño de una tarjeta puede ajustarse la altura de sus vecinas para conservar los bordes alineados. La migración de la distribución anterior conserva lecciones, hitos y completados.

**8. Widget Academy y roadmap personal del Overview**

Next up in Academy permite elegir una colección/lección disponible, conservar la selección y abrir videos compatibles por acción del usuario. Tiene controles para marcar completado localmente y avanzar cuando hay una siguiente lección disponible. No se asignó automáticamente un curso ficticio ni se activó autoplay.

Se corrigió el video aplastado y luego el extremo opuesto: un poster demasiado grande que ocultaba texto y acciones. La versión final mantiene 16:9 y acomoda video/detalles lado a lado cuando hay ancho suficiente; en móvil se apilan.

El roadmap del Overview permite crear, editar, completar y eliminar hitos personales locales. Es distinto de la futura roadmap oficial asignada por el coach.

**9. Settings — I06**

El avatar/nombre al pie del menú abre /settings. Se implementó lectura y guardado de nombre, avatar de iniciales/color, negocio, zona horaria, objetivo y preguntas del onboarding.

Email y rol son de solo lectura. Guardar el perfil no completa automáticamente el onboarding ni permite cambiar permisos. La cabecera y el menú actualizan la identidad mostrada. Subir una fotografía de perfil no se implementó en este alcance.

Una actualización posterior de Lead Engine añadió su propio bloque de conexiones a Settings; mantiene nuestro ProfileSettings y no forma parte de las tareas realizadas en esta conversación.

**10. Usage y NBC Credits — I02 / I06**

La primera base de créditos implementó wallet, saldo disponible/reservado, historial y asignaciones manuales de admin. Se prepararon operaciones atómicas de reserva, liquidación y liberación, con protección frente a reintentos y concurrencia.

En I06 se agregó /admin/usage, visible únicamente para admins y protegido también en API/SQL. Incluye todas las membresías automáticamente, aunque no tengan consumo; permite buscar por nombre/email y paginar. Las membresías nuevas reciben wallet con saldo cero, sin asignar créditos ficticios.

El registro muestra tokens de entrada/salida/cache cuando el proveedor los reporta, duración, costo conocido y saldos. Caller tiene un adaptador para registrar datos de resultados terminales por miembro/llamada, sin duplicarlos. Los tokens históricos no se inventaron: se recuperó duración cuando existía, pero mediciones ausentes siguen desconocidas. El costo LLM reportado puede ser parcial respecto del costo total de voz.

No quedó conectado un sistema universal de medición de todas las herramientas; otros productos deben incorporar su adaptador cuando corresponda. No se activaron descuentos automáticos de NBC Credits.

Se dejó una calculadora con una propuesta comercial: 1 NBC Credit = $0.01 de valor de compra y multiplicador ilustrativo de costo × 3, redondeado por operación. Es borrador, no tarifa aprobada ni cobro aplicado.

**11. Infraestructura de recargas**

Se preparó Stripe Checkout como adaptador de pagos, con paquetes inactivos, órdenes cuyo importe determina el servidor, reintentos identificados, validación de firma de webhook y acreditación atómica una sola vez después de confirmar el pago. Volver de la página de checkout no acredita por sí solo.

Las pruebas cubrieron entregas simultáneas/duplicadas y produjeron un único asiento. Se usó proveedor HTTP simulado y DB real de prueba; no se hizo una transacción Stripe real ni se cobró a miembros.

Faltan cuenta/configuración de Stripe, webhook registrado, paquetes y equivalencia definitivos, costos completos, débitos integrados y política de reembolsos/disputas antes de habilitar pagos comerciales.

**12. Mock del roadmap y corrección de ubicación — I08 / I09**

Primero se agregó el mock en el widget de Overview. Cuando mostraste la pantalla Your Roadmap sin “Preview example”, se reconoció la interpretación incorrecta y se corrigió la ruta exacta.

El resultado final está en https://nbc-sales-nbc-sales.vercel.app/members, para onboarding completado. Muestra directamente cinco fases:

1. Build your foundation.
2. Master the conversation.
3. Handle objections.
4. Close with confidence.
5. Build your sales system.

Las dos primeras aparecen completadas, la tercera en curso y las últimas pendientes. El 40% es ficticio y está rotulado como ejemplo. Se puede seleccionar cada fase para ver sus objetivos y foco de coaching. No escribe datos ni simula una asignación real del mentor. El onboarding incompleto sigue mostrando Start Here.

**13. Comprobaciones realizadas**

A lo largo de las entregas se ejecutaron builds y chequeos TypeScript, pruebas de validaciones/layout/sesión, recorridos de navegador y verificaciones reales de Auth/API/DB cuando correspondía. Se probaron permisos admin/coach/estudiante, acceso cruzado rechazado, persistencia, reintentos, concurrencia de créditos, sesión entre pestañas y exclusión de secretos en archivos públicos.

Las revisiones visuales incluyeron escritorio, móvil y anchos de 320 a 1608 px, además de modos claro/oscuro. “Móvil” aquí significa Chrome con viewport y eventos táctiles simulados, no una certificación en dispositivos físicos de todos los navegadores.

Las pruebas con datos demo, reproductores simulados y pagos simulados están separadas de las verificaciones reales. Las cuentas y movimientos temporales de pruebas de membresías/créditos fueron eliminados. No se ejecutaron campañas, llamadas pagadas, compras ni emails a terceros como parte de este trabajo.

**14. Pendientes que no conviene dar por terminados**

| Pendiente | Qué falta |
|---|---|
| Compra del programa → acceso automático | Señal de compra confiable, alta/asignación y ciclo de membresía; los accesos actuales fueron provisionados. |
| Onboarding definitivo | Formulario real de NBC y sus reglas; hoy hay preguntas temporales y campos de perfil. |
| Roadmap oficial | Modelo persistente, asignación por coach, carga/edición y progreso real; lo mostrado en /members es mock. |
| Calendario Google | Calendario exacto y OAuth/permisos de lectura de la identidad de integración. |
| Sustitución de Slack | Canales, adjuntos, notificaciones y actualización en tiempo real, si se deciden. |
| Créditos comerciales | Tarifa definitiva, cobertura completa de costos/consumo, débitos y recargas activas. |
| Perfil con fotografía | Subida, almacenamiento y gestión de la imagen. |
| Preferencias multidispositivo | Persistir/sincronizar layout y progreso personal fuera del navegador. |
| Identidad propietaria en todos los módulos | Consolidar nombres y revisar exposición de proveedores/prompts en cada herramienta; no se declaró una auditoría integral terminada. |
| “MVC CRUD” | Quedó pendiente precisar el módulo y alcance; no se ejecutó una reescritura general de arquitectura. |

**15. Entregas, fuentes y estado de publicación**

| Entrega | Qué cubre | Reporte |
|---|---|---|
| I01 | Proyecto Vercel y primer HTTPS | [I01](I01.md) |
| I02 | Miembros, roles, cuentas, login raíz, onboarding, navegación y acceso de Franco | [I02](I02.md) |
| I03 | Primer rediseño de resumen y gráficos | [I03](I03.md) |
| I04 | Overview en inglés, widgets, galería, sidebar, Academy/hitos locales | [I04](I04.md) |
| I05 | NBC glass, temas globales, editor directo, recuperación de sesión y adaptador Calendar | [I05](I05.md) |
| I06 | Settings, Usage, metering, wallets y recargas preparadas | [I06](I06.md) |
| I07 | Filas sin huecos y proporciones de Academy | [I07](I07.md) |
| I08 | Ejemplo de roadmap en Overview | [I08](I08.md) |
| I09 | Mock completo en la pantalla Your Roadmap | [I09](I09.md) |

Fuentes complementarias integradas, desarrolladas en otros chats: [sesión S01](S01.md), [vista Calendar KCAL01](KCAL01.md), más snapshots publicados de Caller, Academy y Lead Engine.

Persistencia añadida en esta conversación: migraciones `202609140030_members.sql` y `202609150060_usage_settings.sql`, aplicadas y verificadas según sus entregas, con RLS y operaciones sensibles restringidas al servidor. No deben reaplicarse como si fueran pendientes.

Último deployment de esta conversación: I09 `dpl_Hb6nrHcYHuiCAnekixRLfF1obKZC`, probado sobre HTTPS el 15 de septiembre. Su URL inmutable es https://nbc-sales-6fiwq7u8r-nbc-sales.vercel.app/members.

La consulta del 16 de septiembre a las 15:20 UTC confirma que el alias habitual ya apunta a una actualización posterior de otro chat: L01-R9 `dpl_yCUAVQPNyp4nySasyLosVRSUBpCC`, READY. Se verificó el SHA256 de su archivo fuente y se compararon 60 archivos de nuestras entregas: 54 permanecen idénticos; 6 tienen ampliaciones posteriores en estilos de Lead Engine/Academy, vista Calendar y composición de Settings. Los componentes del roadmap I09 permanecen intactos; Settings conserva ProfileSettings y agrega conexiones de Lead Engine. Esta comparación es de fuente/estado de despliegue, no una repetición hoy de todas las pruebas históricas.

Evidencia detallada: `artifacts/lanes/I01/` a `artifacts/lanes/I09/`, con manifiestos, builds, capturas y resultados por entrega. Los reportes distinguen autorrevisión, publicación y aceptación humana; no se infiere una aprobación global de diseño o lanzamiento comercial por haber pasado los tests.
