# ISA / Speed-to-Lead

Estado: borrador funcional derivado del brief, pendiente de definir el piloto. Sin código.

Actualización: Estados Unidos e inglés confirmados. El usuario priorizó el dashboard y la prueba técnica de GoHighLevel antes de conocer vertical y tipo de cita. Ver `dashboard-ghl-test.md` para ese hito; las decisiones comerciales pendientes no lo bloquean.

## Objetivo

Contactar rápidamente a un lead entrante, aplicar la metodología comercial de Anas, calificarlo y conseguir una cita, con el resultado reflejado en GoHighLevel y en el dashboard propio.

## Funciones del brief

- Voz de Anas, guion y manejo de objeciones adaptados al vertical.
- Llamada ante la llegada del lead elegible.
- Calificación, disponibilidad y reserva de cita.
- Derivación a una persona o continuidad por texto cuando corresponda.
- Estado de conversación compartido entre canales.
- Onboarding de clientes y visibilidad de resultados.

El proveedor de texto mencionado en el brief es una referencia. No hay proveedor seleccionado. La fecha de incorporación del canal de texto al piloto está pendiente.

## Primer recorrido propuesto

1. Recibir un evento de GoHighLevel y asociarlo a la cuenta y al lead correctos.
2. Validar elegibilidad y comprobar que el evento no ha generado ya la misma acción.
3. Registrar el intento e iniciar la llamada conforme a las reglas de contacto acordadas.
4. Conversar con el contexto y metodología de esa cuenta; respetar interrupciones y conservar lo ya confirmado.
5. Consultar disponibilidad y crear una cita si el lead corresponde y acepta.
6. Confirmar la cita únicamente tras la respuesta satisfactoria de la agenda.
7. Registrar el resultado, actualizar GoHighLevel y mostrarlo en el dashboard.
8. Si corresponde una derivación, transferir el contexto necesario al humano o canal de texto.

## Calidad y validación propuestas

Los siguientes criterios son una propuesta de evaluación, no resultados obtenidos. Los umbrales numéricos se acordarán antes de probar candidatos.

| Dimensión | Evidencia requerida |
|---|---|
| Rapidez al lead | Tiempo desde creación del lead en CRM hasta inicio del intento; separar demora del evento y del sistema |
| Latencia conversacional | Tiempo desde el fin del habla del interlocutor hasta el primer audio útil, p50 y p95, en llamadas telefónicas reales |
| Interrupciones | Tiempo de parada del audio y recuperación coherente al retomar |
| Voz | Evaluación de Anas de fidelidad, expresividad y estabilidad en llamadas de hasta diez minutos |
| Metodología | Mismo conjunto de objeciones y criterios comerciales para cada candidato |
| Agenda | Cita confirmada con referencia verificable; conflictos de disponibilidad tratados sin inventar una reserva |
| Fiabilidad | Evento repetido no duplica el contacto; fallo de sincronización puede recuperarse sin repetir la llamada |
| Continuidad | El texto o el humano recibe lo ya conversado y el siguiente paso |
| Reportes | Resultado trazable a eventos reales; no contar reintentos de webhook como llamadas nuevas |
| Aislamiento | Un cliente no puede acceder a llamadas, datos o configuración de otro |

El ear-test de sesenta segundos sugerido por el brief es un punto de partida. Añadir escenarios de interrupción, silencio, objeciones y agenda permite verificar el recorrido completo.

## Dashboard: desglose propuesto

Vista de NBC entre cuentas y vista de cada cliente, con permisos por definir. Métricas candidatas: leads elegibles, intentos, llamadas atendidas, conversaciones calificadas, citas confirmadas, derivaciones, duración, latencia y fallos. Desglosar por cliente, período, campaña y resultado cuando existan esos datos.

Antes de construir reportes, fijar unidad de conteo y denominadores. Por ejemplo, citas por lead elegible y citas por conversación atendida son métricas distintas. Una cita agendada no demuestra asistencia ni venta; esos resultados necesitan información adicional del CRM.

## Modelo de datos, componentes y API

El motor ISA sigue pendiente. Existe el dashboard demo y la base de integración descritos en `dashboard-ghl-test.md`. Para lo implementado, ver `../DB_SCHEMA.md`, `../API_DOCS.md` y `../02-architecture.md`.

## Pendientes

- Definir piloto y criterios comerciales.
- Acordar alcance de voz, texto, derivación y onboarding en la primera entrega.
- Obtener metodología y muestras autorizadas de voz.
- Especificar evento real de GoHighLevel y calendario.
- Acordar umbrales de calidad y ejecutar comparación de candidatos.
- Elegir proveedores de voz/telefonía y documentar el motor conversacional. El stack del dashboard ya está aprobado e implementado.
