# Publicación de fixes Lead Engine — 2026-09-17

## Resultado

Los tres arreglos están publicados en `https://nbc-sales-nbc-sales.vercel.app/lead-engine`. El alias termina en el deployment `dpl_DjQyJuhJuHxPf6y9TrPSjoizFkSy`, `READY`, target `production`, URL inmutable `https://nbc-sales-r9n59zsov-nbc-sales.vercel.app`. La metadata de Vercel atribuye esta publicación concurrente a `claude-code_2-1-273_agent`.

Durante la revisión el alias avanzó primero a `dpl_xc27FA6GSuyuQ3kK18vfDa1PZ7Nr` y luego al deployment final citado arriba. Ambos contenían los archivos Lead Engine actuales; no se reasignó el alias ni se hizo un deployment idéntico que pudiera revertir el trabajo concurrente. La comprobación final autenticada y los hashes corresponden a `dpl_DjQyJuhJuHxPf6y9TrPSjoizFkSy`.

## Arreglos publicados

- Guard del mínimo de proveedor: `PROVIDER_MIN_CHARGE_CENTS = 50`; una cotización por debajo de USD 0.50 bloquea el CTA y el adaptador de Apify rechaza el dispatch antes de llamar al proveedor. El cap enviado sigue siendo el monto aprobado, sin inflarlo para satisfacer el mínimo.
- Allowlist positiva: 40 perfiles de industria Lane A, con términos core/adjacent, tier general controlado, franquicias etiquetadas y conservadas, y rechazo de coincidencias genéricas que no demuestran relevancia.
- UX de planificación: `Chicago` muestra en línea `Add the two-letter state: Chicago, IL`; `Chicago, IL` habilita `Continue to save`; el submit lleva foco al botón real `Save draft snapshot`; al abrir un plan guardado aparece la guía `Saved · draft. Next: below, choose how many businesses to scrape, then review the cost before approving.`

## Candidato y hashes

Los nueve archivos relevantes coinciden byte por byte con el source del deployment según los SHA-1 devueltos por Vercel. El manifiesto SHA-256 del conjunto es `0c5b13764a9740a148af55450409d3108729c1232232fa6800d6a55383df8cf2`.

| Archivo | SHA-256 |
|---|---|
| `src/lib/lead-engine-cost.ts` | `503fa3e34343cc4f1cf10a4a3328f6099b42abb60c74fdb7d50af678a2885ad2` |
| `src/lib/lead-engine-industries.ts` | `4837618f7beb796ed33edc170b87334570655f10a7145dc483972359c440d269` |
| `src/lib/lead-engine-gates.ts` | `835ecf5c63cc28b1dffc72650f89576f23cc26c2ef4441cb1110ba7cbfee4f1b` |
| `src/lib/lead-engine-scrape.ts` | `8d2687af65ed9d552fc4cc73141ed7b6d88c00cabd7d5c84de9eb029f35120ec` |
| `src/components/lead-engine/LeadEngine.tsx` | `26ae81274a316febca8d52305191757449c3199decbd9d29525069fac1387409` |
| `src/components/lead-engine/LeadEngine.module.css` | `202d49e306013fe0dbf18c0350ce18e46381961d1dd80a3cd883c7f2cd1f8de4` |
| `src/components/lead-engine/LeadPlanStorage.tsx` | `665649c485c5a95d121bedf6380a97b561a119bce4083eba98a1b8b849a7ac4b` |
| `src/components/lead-engine/LeadScrapeWorkspace.tsx` | `91dcd4588503861d757e039b3c03e38ccc1cabbd8f084441f30968744e3e1d12` |
| `src/services/lead-engine-apify.ts` | `d63331d657b615b34cd55631d9054b23bde6d4d65024fec7168439dc28b910f7` |

## Verificación

- `node --experimental-strip-types --test tests/lead-engine-cost.test.ts tests/lead-engine-dialsheet.test.ts tests/lead-engine-plan.test.ts tests/lead-engine-storage.test.ts`: 31/31.
- `npm test`: 246/246.
- `npm run typecheck`: exit 0.
- `npm run build`: Next 16.3.5, 47 páginas generadas, exit 0.
- Navegador HTTPS con login NBC real: sesión autenticada 200, Lead Engine visible, almacenamiento cargado, plan existente abierto sin escribir, guía post-save visible, validación Chicago/IL visible, CTA deshabilitado con metro inválido y habilitado con `Chicago, IL`, submit con foco en `lead-save-draft`, cero errores de página y cero requests fallidos.
- Anónimo: `workspace/session`, `members`, `caller/sessions`, `lead-engine/plans`, `folders`, `lists` y `POST connections/check` devuelven 401 JSON.
- Acceso: URL habitual 200; URL inmutable 302 a Vercel Authentication. `ssoProtection.deploymentType` conserva `prod_deployment_urls_and_all_previews`.
- Configuración de producción preservada: las seis variables de auth/ElevenLabs siguen presentes en target production; también existen por nombre `APIFY_API_TOKEN`, `OUTSCRAPER_API_KEY` y `BATCHDATA_API_KEY`. No se leyeron ni registraron valores.

Evidencia privada sin secretos en `artifacts/orchestrator/lead-publish-20260917/`: `deployment-source-match.json`, `candidate-hashes.json`, `verification.json`, `lead-chicago-state-guidance.png`, `lead-continue-save-focus.png`, `lead-saved-guidance.png` y `verify-live.mjs`.

## Alcance no ejecutado

No se creó ni guardó un plan, no se pidió una nueva cotización, no se aprobó una corrida, no se llamó a Apify/Outscraper/BatchData, no se gastó saldo, no se inició campaña, no se modificó Supabase y no se hizo push a GitHub. Abrir el plan existente fue una lectura autenticada; la comprobación evitó cualquier acción `Approve & start`.
