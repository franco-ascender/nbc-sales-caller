# Caller — cobertura local por ciudad

Estado: preparado, sin compras ni llamadas. Fecha: 2026-09-17.

## Decisión de producto

NBC mantendrá un pool de números Twilio locales, uno por ciudad/rate center con demanda, y elegirá el origen por la ciudad y el estado del lead. El número se compra a nombre de la cuenta NBC y se muestra como número real de NBC. El saludo identifica NBC Sales; nunca afirma que el agente está físicamente en la ciudad.

La política inicial admite hasta diez números activos en Estados Unidos. Una ciudad nueva pasa a **cotización** —no a compra— si tiene una campaña planificada o 25 leads calificados. Si no, usa un número de la misma ciudad ya asignado; si no existe, puede usar uno del mismo estado/área metropolitana ya asignado. Si no hay cobertura válida, el intento requiere revisión y no llama.

## Flujo de alta controlado

1. La pantalla administrativa solicita una cotización read-only a Twilio por `country=US`, `locality`, `region` y, cuando corresponda, rate center/código de área.
2. Sólo se muestran candidatos con `voice=true`, su localidad/rate center, precio mensual ofrecido y sus requisitos regulatorios.
3. Si Twilio informa requisito de dirección local o desconocido, queda en revisión: no se prepara una compra automática.
4. El administrador revisa la cotización y el presupuesto máximo. La compra queda bloqueada hasta una aprobación explícita de Anas; el límite de diez tampoco puede eludirse.
5. Tras una compra aprobada, se persiste `city`, `region`, `rate_center`, `phone_number`, capacidad de voz, requisitos, precio, proveedor, fecha y estado. Las llamadas sólo seleccionan filas activas de ese inventario, nunca un valor enviado por el navegador.

La búsqueda de disponibilidad local y sus filtros están documentados por Twilio; los requisitos de dirección pueden depender de la localidad. [Disponibilidad de números locales](https://www.twilio.com/docs/phone-numbers/api/availablephonenumberlocal-resource), [requisitos regulatorios](https://www.twilio.com/docs/phone-numbers/regulatory/faq).

## Guardas implementadas

`src/lib/caller-city-numbers.ts` es deliberadamente puro: resuelve asignación o una cotización/revisión, pero no contiene credenciales, SDK ni método de compra. `canPreparePurchase` exige aprobación de Anas y mantiene el límite. Las pruebas cubren selección exacta, umbral de demanda, validación de candidatos y bloqueo por ausencia de aprobación.

La persistencia está activa mediante `202609170080_caller_city_number_coverage.sql`, `202609210210_caller_number_purchasing.sql` y la corrección aditiva `202609210220_caller_number_e164_constraint.sql`. Guarda política, aprobación, cotizaciones con vencimiento, inventario, estado de compra y claves idempotentes. RLS bloquea los roles de navegador y sólo permite la capa de servicio.

La pestaña administrativa **Local coverage** consulta disponibilidad y precio mensual real de la cuenta Twilio. La búsqueda no compra. `anas@nbcsales.io` es el único aprobador del techo mensual; cualquier compra posterior vuelve a validar presupuesto, capacidad, vigencia, voz y requisito de dirección dentro de una transacción. El modal exige confirmación individual. Un resultado ambiguo queda en `uncertain` y sólo puede reconciliarse contra el inventario de Twilio; nunca dispara una segunda compra automática.

Los números activos pueden utilizarse como `From` en el contrato telefónico Twilio + ElevenLabs `register-call`; no requieren importación al panel de ElevenLabs. La selección automática por ciudad seguirá leyendo únicamente filas `active` del inventario.
