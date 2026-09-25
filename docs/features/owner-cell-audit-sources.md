# Auditoría Owner Cell, parte 2: 04_SOURCE_CATALOG y 07_RESEARCH_BUILD_SPEC

Fecha: 2026-09-24. Lectura línea por línea de `handoff/04_SOURCE_CATALOG.md` y `handoff/07_RESEARCH_BUILD_SPEC.md` contra el código actual. Complementa `docs/features/owner-cell-audit.md` (que cubre 00, 01, 03, 05, 08 y 09). Solo lectura del código; este archivo es el único escrito.

Convenciones de estado: LISTO (hay adaptador o función con archivo citado), PARCIAL (existe una pieza pero falta parte del requisito), EN CURSO (hay stub, TODO o gate marcado pero no la carga), NO (no aparece en el código), EXCLUIDO (gate legal o AVOID del propio catálogo, coherente con el código), FUERA DE ALCANCE (requiere pedido manual, compra, cuenta o FOIA que ningún adaptador puede resolver). Nunca se marca LISTO sin ruta de archivo.

Sondas en vivo del 2026-09-24 (GETs gratuitos): los 31 adaptadores respondieron 200 o 206, salvo `cslb` (portal 503 en el postback). Observaciones: `tx_tdi` devolvió solo entidades (owner_is_entity), `nppes_medspa` devolvió 0 filas en la página sondeada, `mn_dli` en sus primeros 64 KB solo trajo filas no Master.

## Parte 1. 04_SOURCE_CATALOG.md, fuente por fuente

Abreviaturas de evidencia: `REG` = `src/lib/lead-engine-registers.ts`; `REGSVC` = `src/services/lead-engine-registers.service.ts`; `BRAIN` = `src/data/lead-engine-brain.json`; `BRANDS` = `src/data/lead-engine-brands.json` + `src/lib/lead-engine-brands.ts`; `MEDSPA` = `src/lib/lead-engine-medspa.ts` + `src/services/lead-engine-medspa.service.ts`; `REVIEWS` = `src/lib/lead-engine-reviews.ts` + `src/services/lead-engine-reviews.service.ts`; `JOBS` = `src/services/lead-engine-jobs.service.ts`; `BATCH` = `src/services/lead-engine-batchdata.ts`. "Receta A" significa que el brain rutea la industria a Google Maps y no hay registro.

### Grupo A: servicios del hogar con licencia estatal obligatoria

| Fuente | Tag del catálogo | Estado en el código | Evidencia |
|---|---|---|---|
| CSLB License Master + Personnel (portal gratuito) | VERIFIED (data), UNKNOWN (terms) | LISTO adaptador `cslb`; hoy bloqueado (portal 503 en el postback, igual que el 2026-09-21) | `REG` cslbMasterRow (CLEAR + vencimiento futuro), cslbPersonnelRow; `REGSVC` fillCslbPhones |
| CSLB pedido pago | VERIFIED | FUERA DE ALCANCE: compra redundante con el portal | catálogo lo marca redundante |
| WA L&I m8qx-ubtq | VERIFIED | LISTO adaptador `wa_lni` (statuscode A, Individual = persona) | `REG` waLni |
| OR CCB g77e-6bhs | VERIFIED | LISTO adaptador `or_ccb` (RMI, sole proprietor si full_name = rmi_name) | `REG` orCcb |
| MN DLI CSVs | VERIFIED / REPORTED | LISTO adaptador `mn_dli` (solo Electrical y Plumbing, solo Master, Status issued); sonda de hoy: primeros 64 KB sin filas Master | `REG` mnDli; reuso de teléfono en `REGSVC` reuse (RPC lead_engine_names_reuse) |
| FL DBPR contractor extracts | VERIFIED | LISTO adaptador `fl_dbpr_construction` como receta B (los extractos no traen teléfono, verificado 2026-09-21) | `REG` flDbprRecord |
| TX TDLR All Licenses (contratistas) | VERIFIED | PARCIAL: solo el segmento Mini Establishment via `tx_tdlr_salons`; Electrical Contractor y A/C no se ingieren | `REG` txTdlrSalons segments |
| TX TSBPE plomería | UNKNOWN | NO | sin adaptador |
| GA SOS PLB rosters | VERIFIED | FUERA DE ALCANCE: formulario pago | sin adaptador |
| NC LBGC lista $25 | VERIFIED / REPORTED | FUERA DE ALCANCE: compra por correo | sin adaptador |
| NC PHFS | REPORTED | NO (solo por registro) | sin adaptador |
| NC electricistas | UNKNOWN | NO | sin adaptador |
| AZ Registrar of Contractors | VERIFIED (legal) | EXCLUIDO por gate legal (A.R.S. 39-121.03) | `BRAIN` states.AZ.notes |
| CO DORA 7s5z-vewr | VERIFIED | NO; la mitad del join (CO SOS agente) sí existe | `REG` coSosAgents |
| IL IDFPR roofing | VERIFIED | PARCIAL: `il_idfpr` cubre CPA y managing brokers, no roofing | `REG` IL_IDFPR_PROFESSIONS |
| OH OCILB | REPORTED | NO | sin adaptador |
| PA AG HIC (fila A) | UNKNOWN / VERIFIED (B) | NO | sin adaptador |
| NYC DCWP HIC | VERIFIED | NO | sin adaptador |
| NYC DOB legacy BIS | VERIFIED | NO | sin adaptador |
| NYC DOB NOW | VERIFIED | NO | sin adaptador |
| NJ DCA bulk | VERIFIED | NO | sin adaptador |
| TN Tableau | VERIFIED / UNKNOWN | NO | sin adaptador |
| NV Contractors Board | VERIFIED | FUERA DE ALCANCE: lista $200 | sin adaptador |
| MI LARA FOIA | VERIFIED / UNKNOWN | FUERA DE ALCANCE: FOIA pago | sin adaptador |
| VA DPOR regulant lists | VERIFIED (404 en E) | NO | sin adaptador |
| SC LLR | VERIFIED | EXCLUIDO por gate legal | `BRAIN` states.SC legal_status prohibited |
| LA LSLBC | REPORTED | NO | sin adaptador |
| UT DOPL | VERIFIED (legal) | EXCLUIDO por gate legal | `BRAIN` states.UT legal_status prohibited |
| NM RLD | UNKNOWN | NO; receta A cubre | `BRAIN` recipes.A |
| MA OCABR y boards | UNKNOWN | NO; receta A cubre | `BRAIN` recipes.A |
| MD MHIC y boards | REPORTED | NO | sin adaptador |
| AL, KY, OK, WI, MO boards | UNKNOWN / MO REPORTED | NO; receta A cubre | `BRAIN` recipes.A |
| IN PLA plumbing | VERIFIED | NO | sin adaptador |
| Austin permits 3syk-w9eu | VERIFIED | LISTO adaptador `austin_permits` (12 meses, contractor_phone no nulo) | `REG` austinPermits |
| Chicago permits | VERIFIED | NO | sin adaptador |
| Seattle permits | VERIFIED | NO | sin adaptador |
| Los Angeles permits | VERIFIED / REPORTED | EXCLUIDO (AVOID para identidad), coherente | sin adaptador |
| Miami-Dade permits | UNKNOWN | NO | sin adaptador |
| Phoenix, Denver, San Diego permits | UNKNOWN | NO | sin adaptador |
| Shovels.ai | VERIFIED / UNKNOWN | NO; permit_velocity existe solo como feature del score sin fuente | `src/lib/lead-engine-score.ts` smallBusinessFactor |
| BatchData Permits | VERIFIED / UNKNOWN | NO | sin adaptador |
| BuildZoom | REPORTED | EXCLUIDO (AVOID) | catálogo |
| PermitStack | REPORTED | NO | sin adaptador |
| ConstructConnect, Dodge, PermitFlow | REPORTED | EXCLUIDO (AVOID) | catálogo |

### Grupo B: servicios del hogar sin licencia estatal

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| Apify compass/crawler-google-places | VERIFIED | LISTO (fase scrape de cada job, 125 a 500 lugares por corrida, filtro de cadenas) | `src/services/lead-engine-apify-runs.ts`; `JOBS` scrape, isChain línea 727 |
| Apify compass/google-maps-reviews-scraper | VERIFIED | LISTO (actor Xb8osYTtOjlsgI6k9, 25 reseñas nuevas por listado, medido) | `REVIEWS` createReviewsScraper |
| CO SOS 4ykn-tg5h | VERIFIED | LISTO adaptador `co_sos_agents` (agente persona, misma dirección principal, 12 patrones de nombre) | `REG` coSosAgentRow, CO_SOS_PATTERNS |
| FL Sunbiz SFTP | VERIFIED / REPORTED | NO | sin adaptador (grep sunbiz vacío en src) |
| WA SOS extract | VERIFIED | NO | sin adaptador |
| NY DOS Active Corporations | VERIFIED | NO | sin adaptador |
| TX SOSDirect bulk | VERIFIED | FUERA DE ALCANCE: producto pago | sin adaptador |
| CA SOS bizfile | REPORTED | NO | sin adaptador |
| OR, OH, IN, MN, NC, GA, AZ, NV, WV, PA, IL, MI, TN, VA SOS | mixto | NO | sin adaptador |
| KY Business Records | REPORTED | EXCLUIDO (AVOID) | catálogo |
| TX TDA pest CSVs | VERIFIED / UNKNOWN | NO | sin adaptador |
| CA CDPR | VERIFIED | NO | sin adaptador |
| CA SPCB | REPORTED | NO | sin adaptador |
| FL FDACS pest | VERIFIED / UNKNOWN | FUERA DE ALCANCE: pedido Capítulo 119 | sin adaptador |
| Apify pest-control-license-scraper | VERIFIED (página) | NO | sin adaptador |
| FMCSA Motor Carrier Census az4n-8mr2 | VERIFIED | LISTO adaptador `fmcsa` (status A, por estado x 5 filtros, sole proprietor si legal_name = officer) | `REG` fmcsaRow |
| FMCSA L&I | VERIFIED (por registro) | NO | sin adaptador |
| FL FDACS movers | REPORTED | FUERA DE ALCANCE: pedido | sin adaptador |
| TX DMV Truck Stop | VERIFIED (URL) | NO | sin adaptador |
| CA BHGS MTR | REPORTED | NO | sin adaptador |
| LA LDAF, CT DEEP, MD DNR arboristas | REPORTED / VERIFIED | NO | sin adaptador |
| TX TCEQ irrigadores | REPORTED | NO | sin adaptador |
| PA HIC .xlsx | VERIFIED | NO | sin adaptador |
| MD MHIC, NJ DCA HIC, CT DCP, MA HIC | REPORTED | NO | sin adaptador |
| Seattle business license wnbq-64tb | VERIFIED | NO | sin adaptador |
| SF g8m3-pdis | VERIFIED | NO | sin adaptador |
| Chicago licenses + owners | VERIFIED | NO | sin adaptador |
| LA Listing of Active Businesses | VERIFIED | NO | sin adaptador |
| Miami-Dade LBT GIS | VERIFIED (metadata) | EXCLUIDO (AVOID scraping), coherente | catálogo |
| FL county tax collector lists | REPORTED | NO | sin adaptador |
| Osceola BTR, Orange County | VERIFIED / UNKNOWN | NO | sin adaptador |
| Palm Beach subscription | VERIFIED (exists) | FUERA DE ALCANCE: suscripción | sin adaptador |
| LA County FBN | VERIFIED / UNKNOWN | NO | sin adaptador |
| Harris County assumed names | VERIFIED | FUERA DE ALCANCE: data sales | sin adaptador |
| Website About page + LLM | Estimate | LISTO (fetch de home, /about, /team; extractor determinista primero, Haiku solo si no hay nombre) | `REVIEWS` stripHtml, extractOwnerFromText, extractOwnersForRows |
| Apify facebook-pages-scraper | VERIFIED (pricing) | NO | sin adaptador |
| Historical WHOIS | REPORTED | EXCLUIDO (AVOID) | catálogo |
| Yelp, Thumbtack, Nextdoor, Angi | VERIFIED / REPORTED | NO (NICE) | sin adaptador |
| LocalPipe, LocalProspects, Openmart | REPORTED | EXCLUIDO (competidores) | catálogo |
| Clay, Apollo, ZoomInfo, Lusha | REPORTED | EXCLUIDO (AVOID) | catálogo |

### Grupo C: salud con NPI

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| NPPES NPI Registry API | VERIFIED | LISTO adaptador `nppes` (NPI-2 AO, 6 taxonomías, corte por zip3, techo 1.000, taxonomía primaria del lado cliente, títulos de staff excluidos) | `REG` nppes, nppesOrganization, NPPES_EXCLUDED_TITLE |
| NPPES bulk V.2 | VERIFIED / REPORTED | NO: no hay carga bulk a Postgres, solo API | grep bulk vacío |
| CMS National Downloadable File | VERIFIED | NO | sin adaptador |
| PECOS, Medicare utilization, Order and Referring | REPORTED | NO | sin adaptador |
| CMS All Owners | VERIFIED / REPORTED | EXCLUIDO (no aplica), coherente | catálogo |
| FL DOH MQA | VERIFIED / REPORTED | NO (requiere cuenta) | sin adaptador |
| FL DBPR veterinaria | VERIFIED | NO | sin adaptador |
| TX TSBDE dentistas | VERIFIED / UNKNOWN | NO | sin adaptador |
| TX TBVME | VERIFIED / UNKNOWN | NO | sin adaptador |
| TX DSHS HPRC | REPORTED | EXCLUIDO (no es fuente) | catálogo |
| CA DCA public files | VERIFIED / UNKNOWN | NO | sin adaptador |
| WA DOH credential data | VERIFIED | NO | sin adaptador |
| NC health boards | VERIFIED / UNKNOWN | FUERA DE ALCANCE: pedido por correo | sin adaptador |
| NY Office of the Professions | REPORTED | EXCLUIDO (AVOID listas), coherente | catálogo |
| GA SOS PLB health | VERIFIED (form) | FUERA DE ALCANCE | sin adaptador |
| Otros boards (IN, OH, TN, VA, MI, AZ, CO) | REPORTED | NO | sin adaptador |
| FL AHCA clinic licensure | REPORTED | NO | sin adaptador |
| USDA APHIS NVAP | VERIFIED / UNKNOWN | NO | sin adaptador |
| DataZapp healthcare lists | VERIFIED (precio) | NO | sin adaptador |
| CarePrecise, Provyx | REPORTED | NO | sin adaptador |
| Definitive, IQVIA, ZoomInfo, Cognism, Ribbon, HealthLink, Doximity, AVMA, Healthgrades, Zocdoc, DEA | REPORTED / UNKNOWN | EXCLUIDO (AVOID), coherente | catálogo |
| Smarty US Street API (RDI) | pregunta abierta 3 | PARCIAL: la residencialidad del mailing se infiere por heurística, sin Smarty | `MEDSPA` clinicianContact (mailing residential_candidate) |

### Grupo D: estética y salud cash pay (med spas)

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| Google Maps via Apify (keyword set D) | VERIFIED | PARCIAL: scrape existe, el set de keywords es el del brain, no la lista completa del catálogo | `BRAIN` industries.med_spa; `JOBS` scrape |
| TN Medical Spa Registry PDF | VERIFIED / UNKNOWN | LISTO como dato (588 filas, 622 directores, fetch 2026-09-21) y clasificador director_only (3 o más spas) | `src/data/lead-engine-tn-medspa-directors.json`; `MEDSPA` DIRECTOR_ONLY_THRESHOLD |
| TN LicensureReports | VERIFIED | NO | sin adaptador |
| RI CHFR | VERIFIED / UNKNOWN | NO | sin adaptador |
| FL Sunbiz two hop | VERIFIED (caso vivo) | NO | sin adaptador |
| FL BoM Office Surgery, Electrolysis, AHCA export | VERIFIED / UNKNOWN | NO | sin adaptador |
| TX TDLR laser hair | VERIFIED / UNKNOWN | NO | sin adaptador |
| TX TDLR Esthetician Establishment | VERIFIED | NO (solo Mini Establishment está segmentado) | `REG` txTdlrSalons segments |
| TX Comptroller PIR | VERIFIED / REPORTED | EN CURSO: adaptador HTML marcado UNVERIFIED, probado solo con fixture, no cableado al runner | `MEDSPA` createTxComptrollerAdapter, verified: false |
| TMB ORSSP | VERIFIED / UNKNOWN | NO | sin adaptador |
| TX Board of Nursing | VERIFIED (negativo) | LISTO por la vía alternativa que indica el catálogo: roster NPI-1 taxonomía 363L | `MEDSPA` ROSTER_TAXONOMY, createNpiRoster |
| NPPES organization name + address (uso D) | VERIFIED | LISTO: `nppes_medspa` por nombre y roster NPI-1 por zip y suite; hoy `nppes_medspa` devolvió 0 filas en la sonda (ver trampa 7) | `REG` nppesMedspa; `MEDSPA` matchClinicianToSpa |
| CO SOS 4ykn-tg5h (uso D) | VERIFIED | LISTO adaptador `co_sos_agents` (MED SPA, MEDSPA, AESTHETIC, LASER) | `REG` CO_SOS_PATTERNS; `BRAIN` med_spa.CO |
| NY DOS n9v6-gdp6 (uso D) | VERIFIED (aprox) | NO | sin adaptador |
| Apify instagram-profile-scraper / instagram-scraper | VERIFIED / REPORTED | NO | grep instagram vacío en src |
| Spa website team page | VERIFIED (muestra) | LISTO (mismo extractor de about/team) | `REVIEWS` rules title_colon_name, name_comma_title |
| Apify realself-scraper | REPORTED | NO | sin adaptador |
| Alle, Aspire, device locators | VERIFIED / UNKNOWN | EXCLUIDO por guardrail | `BRAIN` guardrails (never manufacturer locators) |
| AmSpa, Yelp, Groupon, booking pages, Zocdoc | VERIFIED / REPORTED | EXCLUIDO (AVOID bulk), coherente | catálogo |
| Local press "best injectors" | VERIFIED | NO | sin adaptador |
| Facebook transparency | REPORTED | NO | sin adaptador |
| Google category thread | UNKNOWN | NO (lectura manual) | pendiente |
| Indiana SEA 282 | VERIFIED / UNKNOWN | NO (plan enero 2027) | pendiente |

### Grupo E: cuidado personal y fitness

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| NY DOS y3u4-jbgh (negocios y renters) | VERIFIED | LISTO adaptador `ny_salons` (4 tipos, LAST FIRST, Owner vs Suite Renter) | `REG` nySalonRow, NY_SALON_TYPES |
| NY DOS individuales ucu3-8265 | VERIFIED | NO | sin adaptador |
| FL DBPR barbers lic03bb | VERIFIED | LISTO adaptador `fl_dbpr_barbers` (dueño en bloque de dirección, barberos con calle de casa) | `REG` flBarberRecord; `src/lib/lead-engine-parcel.ts` homeStreetSource |
| FL DBPR cosmetology | VERIFIED / UNKNOWN | NO | sin adaptador |
| TX TDLR 7358-krk7 (suites) | VERIFIED | LISTO adaptador `tx_tdlr_salons` para el segmento suites; los CSV licfile.asp diarios NO | `REG` txTdlrSalons |
| CA DCA Barbering | VERIFIED / UNKNOWN | NO | sin adaptador |
| CO DORA 7s5z-vewr | VERIFIED | NO | sin adaptador |
| IL IDFPR COSMO, BCENT | VERIFIED | PARCIAL: `il_idfpr` existe pero solo segmenta CPA y RE | `REG` IL_IDFPR_PROFESSIONS |
| NJ DCA, VA DPOR, DE, OR HLO, NC, NV, MI, TN | mixto | NO | sin adaptador |
| PA DOS, OH, MN, GA (pedidos) | VERIFIED / REPORTED / UNKNOWN | FUERA DE ALCANCE: listas por pedido o pago | sin adaptador |
| WA DOL cosmetology | VERIFIED | EXCLUIDO por gate legal | catálogo (educadores y asociaciones) |
| AZ Board of Barbering | REPORTED | EXCLUIDO (A.R.S. 39-121.03) | `BRAIN` states.AZ |
| TX TDLR massage | VERIFIED / UNKNOWN | NO | sin adaptador |
| FL MQA massage, CA CAMTC, NY LMT | mixto | NO | sin adaptador |
| Montgomery MD Bodyworks, Santa Clara body art, tattoo FL, TX, NC, IL | mixto | NO | sin adaptador |
| Booksy, Fresha, StyleSeat, GlossGenius, Vagaro, Mindbody | VERIFIED / REPORTED / UNKNOWN | NO | sin adaptador |
| CrossFit map, Yoga Alliance, BJJ lists | mixto | NO | sin adaptador; fitness solo como grupo de marcas (`BRANDS` fitness 54) |
| Suite operator directories (Sola, Salon Lofts) | VERIFIED (JS) | EXCLUIDO (AVOID scrape), coherente | catálogo |

### Grupo F (y J): servicios profesionales regulados y legal

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| FL DFS Licensee Search bulk | VERIFIED / UNKNOWN (Business) | LISTO adaptador `fl_dfs_individual` (Individual, guards de Excel, status VALID); archivo Business NO | `REG` flDfsRecord, stripExcelGuard |
| TX TDI datasets | VERIFIED | LISTO adaptador `tx_tdi` (kvqi-vsrr Owner y DRLP + join kxv3-diwf de 15 NPN); appointments bupb-23s9 NO; sonda de hoy: todas las filas de la página eran entidades (owner_is_entity) | `REG` txTdiRow; `REGSVC` fillTdiAddresses |
| NAIC SBS | VERIFIED / UNKNOWN (terms) | FUERA DE ALCANCE: pago y términos sin leer | sin adaptador |
| NIPR PDB | VERIFIED | EXCLUIDO por gate legal (FCRA) | `BRAIN` guardrails |
| WA OIC, CA CDI, otros DOI | UNKNOWN | NO | sin adaptador |
| IRS PTIN FOIA extracts | VERIFIED | LISTO adaptador `irs_ptin` (un CSV por estado, dbaHasSurname) | `REG` ptinRecord, PTIN_STATES |
| IRS Enrolled Agents | VERIFIED | NO (join) | sin adaptador |
| IRS Directory | REPORTED | EXCLUIDO (no agrega), coherente | catálogo |
| FL DBPR CPA | VERIFIED | LISTO adaptador `fl_cpa` (calle de casa en el archivo) | `REG` flCpaRecord; parcel registerCarriesHomeStreet |
| CA CBA, TX TSBPA, WA BoA, CO DORA CPA, NY tax preparers, NASBA | mixto | NO | sin adaptador |
| IL IDFPR public accountants | VERIFIED | LISTO adaptador `il_idfpr` segmento CPA | `REG` IL_IDFPR_PROFESSIONS |
| FL DBPR real estate regional CSVs | VERIFIED | LISTO adaptador `fl_re` (regiones 1 a 7 sin header, patrón property management) | `REG` FL_RE_FILES, flReRecord |
| TX TREC s7ft-44qi | VERIFIED | LISTO adaptador `tx_trec` (Broker Individual activo, verificado 2026-09-21) | `REG` txTrecRow |
| CA DRE CurrList | VERIFIED | NO | sin adaptador |
| NY DOS real estate yg7h-zjbf | VERIFIED | NO | sin adaptador |
| CO DORA RE, CT | VERIFIED | NO | sin adaptador |
| IL IDFPR real estate | VERIFIED | LISTO adaptador `il_idfpr` segmento managing broker | `REG` IL_IDFPR_PROFESSIONS |
| GA, NC, AZ ADRE, WA, NJ, VA real estate | UNKNOWN | PARCIAL: `az_adre` LISTO (brokers activos, 50 MB, servidor ignora Range); el resto NO | `REG` azAdreRecord |
| NMLS bulk | Given | EXCLUIDO (AVOID) | catálogo |
| NMLS Consumer Access, FL OFR, TX SML, CA DFPI | VERIFIED / UNKNOWN | NO | sin adaptador |
| SEC Form ADV mensual y FOIA Schedule A | VERIFIED / REPORTED | NO | sin adaptador |
| IAPD API | VERIFIED | NO | sin adaptador |
| NYS Attorney Registrations eqw2-r5nb | VERIFIED | LISTO adaptador `ny_attorneys` (Currently registered, NY, surnameInFirm = Named Partner) | `REG` nyAttorneyRow |
| Florida Bar, State Bar TX, CA, otros bars | VERIFIED / UNKNOWN | FUERA DE ALCANCE: productos con términos sin leer | sin adaptador |
| Avvo, Justia, FindLaw, Martindale | REPORTED | NO | sin adaptador |
| FINRA BrokerCheck | REPORTED | EXCLUIDO (AVOID) | catálogo |
| PA PALS (no está en el catálogo) | n/a | LISTO adaptador `pa_pals` heredado de Anas (búsqueda por 50 apellidos, techo 500) | `REG` paPals |

### Grupo G: automotor

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| NY DMV nhjr-rpi2 | VERIFIED | LISTO adaptador `ny_repair_shops` (RS y RSB, owner_name persona, vencimiento texto) | `REG` nyRepairShopRow |
| WA DOL ucdg-xgbj | VERIFIED | NO | sin adaptador |
| CT DMV apne-w8c6 | VERIFIED | NO | sin adaptador |
| CA BAR (DCA file, locator API) | VERIFIED / UNKNOWN | NO | sin adaptador |
| CA DMV OL, CHP tow | REPORTED | NO | sin adaptador |
| FL FDACS MVR | VERIFIED / UNKNOWN | FUERA DE ALCANCE: pedido | sin adaptador |
| FL FLHSMV, TX TxDMV | REPORTED / VERIFIED (URLs) | NO | sin adaptador |
| TX TDLR tow (7358-krk7) | VERIFIED | NO (solo Mini Establishment segmentado) | `REG` txTdlrSalons |
| Chicago auto licenses, Cincinnati | VERIFIED / UNKNOWN | NO | sin adaptador |
| MI Department of State | VERIFIED / UNKNOWN | FUERA DE ALCANCE: FOIA | sin adaptador |
| NJ MVC, GA, NC, CO dealers, emissions stations | REPORTED / VERIFIED (NY) | NO | sin adaptador |
| NAPA, Bosch, AAA, ASE | REPORTED | NO | sin adaptador |
| OSM name suggestion index (auto) | VERIFIED | LISTO: grupo `auto` con 189 marcas, aplicado en el filtro de scrape | `BRANDS` groups.auto; `JOBS` isChain |
| Car washes, detailing, mobile mechanics | ver B | LISTO via receta A (`car_detailing`, `auto_repair`, `auto_body`) | `BRAIN` industries |

### Grupo H: cuidado infantil y educación

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| NY OCFS cb42-qumz | VERIFIED | LISTO adaptador `ny_childcare` (GFDC y FDC, License o Registration, opt out respetado) | `REG` nyChildcareRow |
| PA OCDEL ajn5-kaxt | VERIFIED | LISTO adaptador `pa_childcare` (Family y Group homes, responsible_person) | `REG` paChildcareRow |
| TX HHSC bc5r-88dy | VERIFIED | LISTO adaptador `tx_childcare` (3 tipos de hogar, cerrados excluidos) | `REG` txChildcareRow |
| CA CHHS family homes | VERIFIED | EXCLUIDO por gate legal (HSC 1596.86) | `BRAIN` guardrails y states.CA |
| CO CDEC a9rr-k8mu | VERIFIED | NO | sin adaptador |
| WA DCYF was8-3ni8 | VERIFIED | NO | sin adaptador |
| DE iuzd-3dbt | VERIFIED | NO (el brain lo nombra, no hay adaptador) | `BRAIN` states.DE |
| IL DCFS, OH export, MN DHS, FL DCF | VERIFIED / UNKNOWN | NO | sin adaptador |
| GA DECAL, NC DCDEE | VERIFIED / UNKNOWN | FUERA DE ALCANCE: open records | sin adaptador |
| AZ Care Check, OR, NJ, TN, NV, MI, VA | REPORTED / UNKNOWN | NO | sin adaptador |
| Driving schools, tutoring, dance, swim, martial arts | REPORTED | NO: sin clave de industria receta A en el brain | `BRAIN` industries |
| Care.com, Wyzant, Winnie | REPORTED | NO | sin adaptador |
| CCR&R lists | REPORTED | EXCLUIDO (AVOID) | catálogo |

### Grupo I: gastronomía y hospitalidad

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| TX TABC 7hf9-qc9f | VERIFIED | LISTO adaptador `tx_tabc` (BG, BQ, NT, MB activos; mailing distinto de premises como calle de casa) | `REG` txTabcRow; parcel homeStreetSource register_mailing |
| TX TABCLicenses legacy, Mixed Beverage receipts | VERIFIED / REPORTED | NO | sin adaptador |
| TX DSHS retail food | VERIFIED (ausencia) | FUERA DE ALCANCE: pedido | sin adaptador |
| NY DOH cnih-y5dw | VERIFIED | LISTO adaptador `ny_doh_food` (solo Restaurant, operador persona); la exclusión de corporaciones con más de 2 locales NO está | `REG` nyDohFoodRow |
| NY SLA 9s3h-dpkz | VERIFIED | NO | sin adaptador |
| NYC DOHMH 43nn-pn8j | VERIFIED | NO | sin adaptador |
| FL DBPR H&R + chgownr_food, FL ABT | VERIFIED / UNKNOWN | NO | sin adaptador |
| CA ABC, CA county EH | VERIFIED / REPORTED | NO | sin adaptador |
| CO liquor, MO new liquor | VERIFIED | NO | sin adaptador |
| WA LCB | VERIFIED | EXCLUIDO por gate legal | `BRAIN` guardrails (WA liquor lists) |
| Chicago food and liquor, otros estados | VERIFIED / REPORTED | NO | sin adaptador |
| New Orleans STR en36-xvxg | VERIFIED | LISTO adaptador `nola_str` (Issued y Pending, contacto persona) | `REG` nolaStrRow |
| New Orleans Vacation Rentals | VERIFIED (exists) | NO | sin adaptador |
| Orlando STR ssrj-rbua | VERIFIED | LISTO adaptador `orlando_str` (Active, dirección del propietario) | `REG` orlandoStrRow |
| Denver, Seattle STR | VERIFIED | NO | sin adaptador |
| Austin STR | VERIFIED | EXCLUIDO (no sirve para identidad), coherente | catálogo |
| Norfolk, Cambridge, Marin, Nashville, San Diego, Miami Beach | REPORTED | NO | sin adaptador |
| Food trucks, caterers | mixto | NO: sin clave receta A en el brain | `BRAIN` industries |
| OSM name suggestion index (food) | VERIFIED / REPORTED | LISTO: grupo `food` con 830 marcas | `BRANDS` groups.food |
| Yelp, OpenTable, Toast, DoorDash | REPORTED | EXCLUIDO (AVOID) | catálogo |

### Transversal: registros corporativos, permisos, federales, verificación y append

| Fuente | Tag | Estado en el código | Evidencia |
|---|---|---|---|
| SOS CO 4ykn-tg5h | VERIFIED | LISTO `co_sos_agents` | `REG` |
| SOS FL Sunbiz, WA, NY n9v6-gdp6, CA bizfile, OR, OH, IN, MN, NC, GA, AZ, NV, KY, WV, PA, IL, MI, TN, VA | mixto | NO | sin adaptador |
| SOS TX SOSDirect y Comptroller PIR | VERIFIED / REPORTED | EN CURSO (PIR sin verificar, fixture); SOSDirect FUERA DE ALCANCE | `MEDSPA` createTxComptrollerAdapter |
| OpenCorporates | REPORTED | EXCLUIDO (AVOID) | catálogo |
| Permisos Austin, NYC, Chicago, Seattle | VERIFIED | PARCIAL: solo Austin | `REG` austinPermits |
| Shovels, BatchData Permits, PermitStack, BuildZoom | mixto | NO / EXCLUIDO | catálogo |
| FMCSA az4n-8mr2 | VERIFIED | LISTO `fmcsa` | `REG` |
| IRS PTIN | VERIFIED | LISTO `irs_ptin` | `REG` |
| NPPES API y bulk | VERIFIED | PARCIAL: API LISTO, bulk NO | `REG` nppes; `MEDSPA` createNpiRoster |
| Apify crawler-google-places | VERIFIED | LISTO | `src/services/lead-engine-apify-runs.ts` |
| Apify google-maps-reviews-scraper | VERIFIED | LISTO | `REVIEWS` |
| Outscraper | REPORTED | LISTO como respaldo (servicio y motor Python) | `src/services/lead-engine-outscraper.ts`; `ownercell/scrape.py` |
| DataZapp Phone Append (cell only) | VERIFIED / UNKNOWN | NO: solo figura como costo unitario experimental | `BRAIN` unit_costs_usd.cell_append_per_match_datazapp y _note |
| BatchData skip trace | REPORTED | LISTO, pero como append primario y no como respaldo de DataZapp | `BATCH` skipTrace; `JOBS` fase trace |
| Telnyx Number Lookup | VERIFIED (pricing) | NO: sin cliente; el tipo de línea sale de BatchData phone/verification | `BATCH` verifyPhones; grep telnyx solo en `BRAIN` |
| RealPhoneValidation Turbo V3 / DNC Plus | REPORTED / VERIFIED | NO | grep vacío |
| Twilio Lookup | VERIFIED (types) | NO (`src/lib/twilio-phone-numbers.ts` es compra de números del Caller, no lookup) | grep |
| Trestle Real Contact | VERIFIED / REPORTED | NO | grep vacío |
| TCPA Litigator List | VERIFIED (named) | PARCIAL: flag tcpa de BatchData, sin lista dedicada | `BATCH`; `src/lib/lead-engine-gates.ts` tcpa_litigator_present |
| FTC National DNC (suscripción directa) | VERIFIED | PARCIAL: flag dnc de BatchData, sin suscripción propia; el gate de 31 días existe | `src/lib/lead-engine-gates.ts` SCRUB_MAX_AGE_MS; `BRAIN` rescrub_days |
| State DNC lists (TX, FL, PA, IN, MO) | REPORTED | NO | grep vacío |
| FCC Reassigned Numbers Database | REPORTED | NO | grep vacío |
| Facebook, Instagram, Yelp, Thumbtack scrapers | mixto | NO | grep vacío |
| Data Axle, Clay, Apollo, ZoomInfo, Lusha, Cognism | REPORTED | EXCLUIDO (AVOID) | catálogo |
| libpostal, rapidfuzz, phonenumbers, pg_trgm | Given | PARCIAL: ports propios en TypeScript (token sort ratio, normalización de calle y sufijos, teléfono 10 dígitos); sin libpostal ni pg_trgm | `src/lib/lead-engine-buckets.ts` normalizeName, normalizeAddress, tokenSortRatio |
| Small LLM extraction | Estimate | LISTO (Haiku 4.5, 200 tokens de salida, solo cuando el extractor determinista falla, medido) | `REVIEWS` ANTHROPIC_MODEL, anthropicCents |

### Known traps: implementadas como aserciones?

| Trampa | Estado | Dónde |
|---|---|---|
| TX TDLR owner_telephone refleja business_telephone | LISTO: solo business_telephone entra a phone10; la diferencia queda como flag, nunca como segundo teléfono | `REG` txTdlrSalonRow (ownerTelephoneMirrorsBusiness); `BRAIN` guardrails |
| TX TDLR owner_name = business_name (y Montgomery MD) | LISTO para TDLR (flag ownerNameMirrorsBusiness, el nombre sale de business_name solo si parece persona); Montgomery MD NO (sin adaptador) | `REG` txTdlrSalonRow |
| CT active='1' | NO: no hay adaptador CT | pendiente |
| MN reuso de teléfono (hasta 189) | PARCIAL: tabla de frecuencia por teléfono y corte en más de 3 licencias (MAX_PHONE_REUSE = 3, PHONE_REUSE_MAX = 3, penalización en score); el doble umbral del catálogo (más de 2 nombres de negocio o más de 3 personas) no se distingue | `REGSVC` reuse; `src/lib/lead-engine-jobs.ts` PHONE_REUSE_MAX; `supabase/migrations/202609210250_lead_engine_registers.sql` lead_engine_names_reuse |
| CSLB status CLEAR + vencimiento futuro + Maps vivo o permiso 12 meses | PARCIAL: CLEAR y vencimiento sí; la exigencia de Maps vivo o permiso reciente no es gate (el bucket 1 se entrega igual) | `REG` cslbMasterRow; `src/lib/lead-engine-buckets.ts` |
| BatchData desordenado y 403 en el body | LISTO: match por número devuelto, no por posición; 403 en body con 200 se lee y congela el job | `BATCH` líneas 135 a 140 y 177 |
| NPPES organization_name wildcard solo trailing | PARCIAL: `MEDSPA` lo documenta y no busca por nombre; pero `nppes_medspa` sigue enviando patrones con comodín inicial (`*med spa*`), que NPPES trata como prefijo; la sonda de hoy devolvió 0 filas, coherente con la trampa | `REG` NPPES_MEDSPA_PATTERNS; `MEDSPA` comentario de cabecera |
| NPPES techo skip 1.000 y limit 200 | LISTO: NPPES_LIMIT 200, NPPES_SKIP_MAX 1000, corte por prefijo zip3, nota skip_ceiling_reached; roster con NPPES_SKIP_CEILING y flag truncated | `REG` nppes; `MEDSPA` createNpiRoster |
| NPPES state solo rechazado, taxonomía primaria del lado cliente, address_purpose LOCATION | LISTO | `REG` nppesUrl, nppesOrganization (primary_taxonomy_mismatch) |
| CMS datastore zip 9 dígitos | NO: sin adaptador CMS | pendiente |
| NY DMV expiration_date texto MM/DD/YYYY | LISTO: segmentos like '%2026', '%2027', '%2028' más chequeo de vencimiento futuro | `REG` nyRepairShops |
| NPPES AO "differs" contaminado por mesas HQ | PARCIAL: se excluyen títulos de staff (credentialing, billing, office manager); no hay regla de repetición de AO ni de geografía | `REG` NPPES_EXCLUDED_TITLE |
| FL DFS guards Excel ="..." y Business binario | LISTO para los guards; Business no se ingiere | `REG` stripExcelGuard, flDfsRecord |
| FL DBPR RE sin header, posicional | LISTO | `REG` FL_RE_FILES hasHeader false, flReRecord |
| SEC zips irregulares | NO: sin adaptador SEC | pendiente |
| Límites Socrata (300 caracteres, OR silenciosos, app token) | LISTO: SOCRATA_URL_MAX 300, segmentos por estado y filtro en vez de OR, $select mínimo en Austin, X-App-Token si SOCRATA_APP_TOKEN | `REG` socrataUrl, fmcsa; `REGSVC` defaultFetcher |
| NY OCFS phone_number_omitted y address_omitted | LISTO: opt out respetado, la fila se salta y no se hace append | `REG` nyChildcareRow |
| CA CHHS hogares pequeños (HSC 1596.86) | LISTO como gate: sin adaptador y guardrail explícito | `BRAIN` guardrails; states.CA legal_status restricted |

### Verification requests still open (97 pedidos consolidados)

Estado hoy: RESUELTA (hay evidencia en código o en la sonda de hoy), PARCIAL (una parte respondida), ABIERTA (nadie corrió el pedido). Los pedidos que requieren cuenta, correo o compra siguen ABIERTOS por definición.

| Pedido | Estado hoy | Nota |
|---|---|---|
| CSLB terms del portal | ABIERTA | portal 503 hoy y el 2026-09-21 |
| TDLR link Electrical Contractor a Master Electrician | ABIERTA | no se ingieren filas Electrical Contractor |
| DataZapp endpoint, módulos, reverse phone, 500 mailings TX | ABIERTA | sin cliente DataZapp |
| Register phone mobile share (CSLB, WA) via Telnyx | ABIERTA | sin Telnyx; el tipo de línea solo se mide al pagar BatchData en un job |
| Maps phone mobile share por oficio + FTC | ABIERTA | idem |
| Reviews owner name hit rate (500 placeIds, auditoría 100) | PARCIAL | extractor y actor cableados con medición de costo; la auditoría de precisión no se corrió |
| FMCSA phone mobile share | ABIERTA | adaptador listo, sin tipo de línea |
| Sunbiz cordata y ficdata, tasa two hop | ABIERTA | sin SFTP |
| WA data extract phone y email; carta a L&I; pedido a WA OIC | ABIERTA | fuera del código |
| Seattle wnbq-64tb line type | ABIERTA | sin adaptador |
| CO agent as owner heuristic (DORA, LANDSCAP, 86 MED SPA) | PARCIAL | `co_sos_agents` implementa la heurística (agente persona, misma dirección) y guarda surnameInEntity; la medición contra DORA no se hizo |
| VA DPOR layouts | ABIERTA | 404 en la sesión E |
| TN contractor Tableau | ABIERTA | manual |
| MI FOIA fields | ABIERTA | correo |
| NC LBGC fields, NC health boards, NC SOS subscription | ABIERTA | correo y browser |
| NV lista $200 | ABIERTA | compra |
| AZ ROC commercial quote | ABIERTA | formulario |
| Shovels phone fill | ABIERTA | sin cuenta |
| Permit portal fields (Miami-Dade, Phoenix, Denver, San Diego, LA FBN) | ABIERTA | sin adaptador |
| PA HIC full export | ABIERTA | manual por condado |
| OH OCILB bulk | ABIERTA | correo |
| LA LSLBC export | ABIERTA | manual |
| FL email exemptions (455.229, 119.071, 456.017) | ABIERTA | lectura legal; el código no usa emails para llamar |
| RealPhoneValidation rate card | ABIERTA | sin cliente |
| Reassigned Numbers Database pricing | ABIERTA | sin cliente |
| TX TDA pest CSV columns | ABIERTA | sin adaptador |
| FDACS bulk (pest, movers, MVR) | ABIERTA | Capítulo 119 |
| FL county BTR files (Osceola, Charlotte, Palm Beach) | ABIERTA | sin adaptador |
| Harris County assumed names | ABIERTA | correo |
| SOS bulk products (OR, OH, TN, MI, PA, IL, VA, AZ, NV, GA, CA) | ABIERTA | manual |
| Florida Do Not Call list | ABIERTA | sin listas estatales |
| Apify crawler-google-places price tier | RESUELTA | 0,4 centavos por lugar, mínimo $0,50: `src/lib/lead-engine-jobs.ts` APIFY_CENTS_PER_PLACE, MIN_PLACES_PER_RUN |
| Yelp owner first name coverage | ABIERTA | sin adaptador |
| NPPES AO phone mobile share (2.000 filas bulk) | ABIERTA | sin carga bulk ni Telnyx |
| Residential mailing en NPI-1 (Smarty RDI) | PARCIAL | heurística residencial en `MEDSPA`, sin Smarty ni medición |
| Florida MQA files (cuenta, campos, APRN autónoma) | ABIERTA | requiere cuenta |
| TSBDE phone fill; Gov Code 552.11765 history | ABIERTA | manual |
| CA DCA Box folder contents | ABIERTA | browser |
| NPPES V.2 readme | ABIERTA | sin bulk |
| CMS datastore numeric filters | ABIERTA | sin adaptador |
| NPPES API rate limit (600 llamadas en 10 min) | PARCIAL | los adaptadores no observaron 429 en las corridas de hoy y del 2026-09-21; no se corrió la prueba de 600 |
| AO title y repetición a escala; Solo NPI-1 share | ABIERTA | requiere bulk |
| Maps match rate por teléfono (Tampa) | PARCIAL | el bucket step existe (`src/lib/lead-engine-buckets.ts`); la medición Tampa no se corrió |
| NY solicitation ground (POL 89) | ABIERTA | lectura legal |
| USDA APHIS NVAP fields | ABIERTA | manual |
| FL AHCA clinic lists | ABIERTA | manual |
| DataZapp healthcare coverage test | ABIERTA | compra |
| PECOS reassignment join | ABIERTA | sin adaptador |
| Current Tennessee registry file | RESUELTA | PDF Approved_Med_Spa.pdf bajado el 2026-09-21: 588 filas, 622 directores (`src/data/lead-engine-tn-medspa-directors.json` _about) |
| Rhode Island OACF list | ABIERTA | manual |
| TMB ORSSP catalog; TX BON APRN list | ABIERTA | cuenta y correo |
| TDLR laser hair y massage files; definición Mini Establishment | ABIERTA | robots bloqueó el fetch |
| NPI-1 at address con taxonomías médicas (200 listados) | PARCIAL | roster NP, PA, RN implementado; MD, derm y plástica no están en ROSTER_TAXONOMY; la medición no se corrió |
| NPPES aesthetic name regex counts | ABIERTA | requiere bulk |
| Texas PIR fields (SERENITY CREEK, 50 títulos Austin) | PARCIAL | `MEDSPA` observó el redirect a comptroller.texas.gov/taxes/franchise/account-status/search el 2026-09-21; el parser sigue UNVERIFIED |
| Instagram bio role words | ABIERTA | sin adaptador |
| Website owner naming rate (1.000 sitios FL) | PARCIAL | extractor listo, medición no corrida |
| Google category enforcement thread | ABIERTA | lectura manual |
| Indiana registry data | ABIERTA | octubre 2026 |
| Preguntas a Anas sobre su workaround | ABIERTA | fuera del código |
| Florida cosmetology salon rows | ABIERTA | sin adaptador |
| New York individual to shop link (related_business_uid) | ABIERTA | `ny_salons` no usa related_business_uid |
| Minnesota designated salon manager | ABIERTA | manual |
| Fresha job title frequency | ABIERTA | sin adaptador |
| Line type en TX suite phones (1.000) | ABIERTA | sin Telnyx |
| CrossFit affiliate endpoint | ABIERTA | manual |
| Booking platform terms | ABIERTA | lectura legal |
| Texas DSHS tattoo list | ABIERTA | manual |
| FL DFS Business file columns y cadence | ABIERTA | solo Individual se ingiere |
| TX TDI appointment field names y phone availability | ABIERTA | bupb-23s9 no se usa; kxv3-diwf sí (ciudad, estado, ZIP, sin calle, verificado 2026-09-21) |
| NAIC SBS checkout terms | ABIERTA | compra |
| CA CDI bulk | ABIERTA | manual |
| SEC workbook columns y Schedule A; IAPD summary | ABIERTA | sin adaptador |
| Bar member data products (FL, TX, CA) | ABIERTA | correo |
| PTIN file sizes | PARCIAL | los 50 CSV estatales respondieron 200 o 206 hoy con header `"LAST_NAME"`; no se contaron filas |
| FL DBPR regional RE layout | RESUELTA | mapeo posicional en `REG` flReRecord (Anas); regiones 1 a 7 |
| CA DRE CurrList | ABIERTA | sin adaptador |
| CO DORA FRM code | ABIERTA | sin adaptador |
| NY DOS brokerage counts | ABIERTA | sin adaptador |
| FINRA BrokerCheck terms | ABIERTA | AVOID igual |
| BAR locator API terms y rate limit | ABIERTA | sin adaptador |
| NY owner_name person share | PARCIAL | `ny_repair_shops` aplica el regex de persona por fila (skip owner not_a_person); la proporción global no se reportó |
| Line type en WA y NY Maps phones (G) | ABIERTA | sin Telnyx |
| TxDMV dealer list export | ABIERTA | browser |
| Childcare phone line type (NY, PA) y FTC en 3.000 | ABIERTA | sin Telnyx |
| WA DCYF portal phones | ABIERTA | sin adaptador |
| IL y OH childcare exports | ABIERTA | browser |
| CA CHHS small vs large split | ABIERTA | excluido igual |
| FL DCF provider list | ABIERTA | browser |
| GA y NC childcare list requests | ABIERTA | open records |
| TABC owner share y mail address | PARCIAL | `tx_tabc` calcula mailDiffersFromPremises por fila y salta owner_is_entity; las proporciones no se reportaron; DataZapp no existe |
| FL hrfood full file shares y readme | ABIERTA | sin adaptador |
| NY SLA principals | ABIERTA | sin adaptador |
| Host line vs mobile food line type | ABIERTA | sin Telnyx |
| STR datasets (Nashville, San Diego, Miami Beach, Norfolk, Cambridge, Marin) | ABIERTA | sin adaptador |
| Name suggestion index food brands (restaurant, cafe, bar, ice_cream) | RESUELTA | grupo `food` con 830 marcas en `BRANDS` |
| CT active flag y BatchData unordered/403 en vivo | PARCIAL | BatchData RESUELTA en `BATCH`; CT ABIERTA (sin adaptador) |

Conteo de pedidos: 97 en total; 4 RESUELTAS, 12 PARCIALES, 81 ABIERTAS.

## Parte 2. 07_RESEARCH_BUILD_SPEC.md, módulo por módulo

Mismas abreviaturas que la Parte 1. Además: `GATES` = `src/lib/lead-engine-gates.ts`; `SCORE` = `src/lib/lead-engine-score.ts`; `GRAPH` = `src/lib/lead-engine-graph.ts` + `src/services/lead-engine-graph.service.ts`; `PARCEL` = `src/lib/lead-engine-parcel.ts`; `JOBSLIB` = `src/lib/lead-engine-jobs.ts`; `MIG` = `supabase/migrations/2026092102*.sql`.

### Secciones ejecutivas (1 a 9)

**Sección 4, stack recomendado (tabla global).**

| Componente | Prioridad | Estado | Evidencia |
|---|---|---|---|
| Socrata + bulk files (CSLB, FL DBPR, FL MQA, FL DFS, Sunbiz, VA DPOR, MN DLI, NJ DCA, NPPES, CMS, PTIN, SEC, FMCSA) | MUST | PARCIAL: 31 adaptadores cubren Socrata (WA, OR, TX, NY, PA, LA, FL Orlando, CO, IL, Austin, FMCSA), CSLB, FL DBPR, FL DFS, MN DLI, PTIN y NPPES API; faltan FL MQA, Sunbiz, VA DPOR, NJ DCA, CMS, SEC y NPPES bulk | `REG` REGISTER_ADAPTERS |
| Apify crawler-google-places | MUST | LISTO | `src/services/lead-engine-apify-runs.ts`; `JOBS` |
| Apify reviews scraper + LLM chico | MUST en B, E, G, I | LISTO y cableado al runner para recetas A y D (nameOwners tras verify) | `REVIEWS`; `JOBS` líneas 280 y 347 a 361 |
| Resolución de entidades (libpostal, rapidfuzz, phonenumbers, pg_trgm) | MUST | PARCIAL: ports propios en TS con umbrales 0,87 nombre y 0,90 dirección y banda 0,80 a 0,87; sin libpostal ni pg_trgm | `src/lib/lead-engine-buckets.ts` NAME_THRESHOLD, ADDRESS_THRESHOLD, NAME_BAND_LOW |
| Telnyx Number Lookup | MUST | NO | grep telnyx solo en `BRAIN` unit_costs |
| FTC DNC suscripción directa | MUST | NO (el DNC viene del flag de BatchData; el rescrub de 31 días sí es gate) | `GATES` stale_dnc_scrub; `BRAIN` rescrub_days |
| TCPA Litigator List o Trestle | MUST | PARCIAL: flag tcpa de BatchData, litigator_vendor = batchdata en el ledger | `JOBS` línea 806; `GATES` tcpa_litigator_present |
| DataZapp cell only | SHOULD | NO | `BRAIN` _note (experimental, pendiente de bake off) |
| RealPhoneValidation | SHOULD | NO | grep vacío |
| BatchData skip trace | SHOULD (reserva) | LISTO pero como vía primaria de la receta B, no como reserva | `BATCH` skipTrace; `JOBS` fase trace |
| SOS bulk (CO, NY, Sunbiz, WA, TX PIR) | SHOULD / MUST en B, D, E, I | PARCIAL: CO listo, TX PIR en curso, resto no | `REG` coSosAgents; `MEDSPA` |
| Shovels.ai | NICE | NO | |
| Outscraper | NICE | LISTO como respaldo | `src/services/lead-engine-outscraper.ts` |
| Fresha, Booksy, Instagram | NICE | NO | |
| Data Axle, Clay, Apollo, ZoomInfo, OpenCorporates, NIPR, NMLS, FINRA, voter, DMV, WA LCB, SC, UT | AVOID | EXCLUIDO, coherente con guardrails | `BRAIN` guardrails |

Las "dos decisiones a tomar ahora" (verificador separado por función; DataZapp como append primario) no están reflejadas: el código usa BatchData para tipo de línea, DNC, litigante y skip trace. El brain lo documenta como decisión diferida a un bake off (Fase 2) que no se corrió.

**Sección 6, moats.**

| Moat | Estado | Evidencia |
|---|---|---|
| Owner Probability Score entrenado con outcomes | PARCIAL: v0 por reglas (pesos 0,25 / 0,20 / 0,20 / 0,15 / 0,10 / 0,10) ordena la hoja de marcado; los outcomes se guardan con features_snapshot; no hay v1 logística | `SCORE`; `MIG` 202609210230 lead_engine_dial_outcomes, 202609210270 lead_engine_score_report |
| Grafo de entidades con historia | LISTO: nodos person, business, license, phone, place, permit, sos_entity, npi; aristas con observed_at, on conflict do nothing; escritura en names, scrape, bucket, verify y deliver | `GRAPH`; `JOBS` graph(); `MIG` 202609210230 lead_engine_entity_graph_edges, 202609210270 lead_engine_phone_neighborhood |
| MSO + PC pairing (CPOM) | NO | sin código |
| Ledger de cumplimiento por número | LISTO: source_register, source_row_id, place_id, maps_phone, bucket, verify_vendor, dnc_checked_at, litigator_vendor, legal_gate, time_zone; dnc_file_version queda null | `JOBS` líneas 800 a 813; `MIG` 202609210230 lead_engine_row_ledger |
| Bucket 1 "licensed but invisible" | LISTO en receta D | `src/lib/lead-engine-buckets.ts`; `JOBS` bucketStep |
| Diff diario de nuevos licenciatarios | LISTO: RPC lead_engine_new_licensees, ruta `/api/lead-engine/registers/[source]/new`, cron 07:15 UTC con cadencias | `MIG` 202609210250; `src/lib/lead-engine-cron.ts`; `vercel.json` |
| Extracción de nombre desde reseñas y about | LISTO | `REVIEWS` |
| Permit velocity y license age | PARCIAL: license_age_years se calcula desde license_issue_date; permit_velocity es una feature sin productor (Austin ingiere permisos pero nadie cuenta permisos por contratista) | `SCORE` featuresFromLedger |
| Clasificador micro y detector de tracking numbers | NO (no hay carrier name: BatchData no lo devuelve) | `GRAPH` VerificationInput.carrier siempre null desde `JOBS` |
| Routing por idioma | NO: el extractor detecta español en la regla (language es) pero no hay columna ni flag de routing en la hoja ni en el ledger | `REVIEWS` OwnerLanguage; grep language en `JOBSLIB` vacío |

**Sección 7, plan de 90 días.**

| Módulo | Estado | Evidencia |
|---|---|---|
| Módulo 0: outcomes + ledger, E.164, matching 0,87/0,90/banda, 4 buckets, filtro de teléfono exclusivo, zip a IANA, rescrub 31 días, cap de gasto | LISTO salvo libpostal (port propio) | `MIG` 202609210230 y 202609210240; buckets; `src/lib/lead-engine-dial-window.ts`; `GATES`; lead_engine_meter |
| Módulo 1: CSLB Sole Owner end to end | EN CURSO: adaptador completo, portal 503 | `REG` cslb |
| Módulo 2: WA y OR, y medición Telnyx del mobile rate | PARCIAL: WA y OR listos; sin Telnyx | `REG` waLni, orCcb |
| Módulo 3: NPPES bulk, AO contrast, surname in entity, DSO exclusion; quiroprácticos y podólogos FL y TX | PARCIAL: AO contrast via API (`nppes`, receta D `healthcare_ao_contrast`), títulos de staff excluidos; sin bulk, sin surname in entity para NPI-2, sin DSO por repetición de AO | `REG` nppes; `BRAIN` industries |
| Módulo 4: TX mini establishments, NY salons, FL DBPR, Sunbiz SFTP | PARCIAL: TX, NY y FL listos; Sunbiz NO | `REG` |
| Módulo 5: receta B invertida con reviews y FMCSA; TX TDI y PTIN; childcare | PARCIAL: FMCSA, TDI, PTIN, childcare listos; reviews listo; la "inversión Maps first con gate de tipo de línea" no existe sin Telnyx | `REG`; `REVIEWS` |
| Módulo 6: Grupo D (Sunbiz two hop, PIR, director graph), automotor, food | PARCIAL: director graph y roster NPI-1 listos pero no cableados al runner; PIR en curso; Sunbiz NO; NY repair shops, TABC, NY DOH, STR listos | `MEDSPA` (sin llamadores fuera de tests); `REG` |

**Sección 8, piso de cumplimiento.**

| Regla | Estado | Evidencia |
|---|---|---|
| Solo marcado manual, sin SMS | LISTO: hoja xlsx para marcar a mano; guardrail "No SMS export path" | `JOBSLIB` jobWorkbook; `BRAIN` guardrails |
| DNC federal en celulares de dueños, rescrub 31 días, evidencia de línea de negocio | PARCIAL: DNC por BatchData, rescrub 31 días como gate, evidencia register_eq_maps en ledger; sin suscripción FTC propia ni dnc_file_version | `GATES`; `JOBS` |
| Litigator scrub siempre | PARCIAL (flag BatchData) | `GATES` |
| Ventana 8 a 20 hora local, filas sin zona retenidas; FL 3 intentos por 24 h | PARCIAL: ventana y hold back listos; contador de intentos FTSA NO | `src/lib/lead-engine-dial-window.ts` DIAL_WINDOW, holdBackWithoutZone; grep ftsa vacío |
| Supresión global permanente de opt out y litigantes | LISTO | `GATES` suppression_intersection; outcome opt_out |
| Gates legales por fuente (voter, DMV, SC, UT, WA LCB, NIPR, locators, AZ, CA CHHS) | LISTO como configuración | `BRAIN` guardrails y states.legal_status; `JOBSLIB` quoteJob blockers |
| CCPA (aviso, acceso y borrado, procedencia) | NO | sin código |

**Sección 9, preguntas que gatean la primera campaña.** Mobile rate por registro: ABIERTA (sin Telnyx). Workaround de Anas: ABIERTA. Hit rate DataZapp: ABIERTA. Revisión legal humana por estado (WA, AZ, MI): ABIERTA; el brain deja WA "ok" y AZ "ok" con nota.

### Apéndice A: servicios del hogar con licencia

| Elemento | Estado | Evidencia |
|---|---|---|
| Build first: CSLB Sole Owner, luego WA y OR, luego FL DBPR, luego Austin como feed de intención | PARCIAL: WA, OR, FL DBPR y Austin listos; CSLB bloqueado por el portal | `REG` |
| Workflow A1 ingest de registros (CSLB, WA, OR, MN, FL, TX, VA, IL, CO, NJ, NYC) | PARCIAL: CSLB, WA, OR, MN, FL listos; TX solo suites; IL sin roofing; VA, CO DORA, NJ, NYC NO | `REG` |
| A2 permisos (Austin, NYC DOB, Chicago, Seattle, Shovels) | PARCIAL: solo Austin | `REG` austinPermits |
| A3 scrape Maps por metro y oficio | LISTO | `JOBS` |
| B1 normalizar (libpostal, E.164, tokens) | PARCIAL (port propio) | buckets |
| B2 resolución (person key, business key, phone key) | LISTO (bloqueo por zip y teléfono, phone equal primero) | buckets assignBuckets |
| B3 filtro de rol de dueño (Sole Owner, Member, Partner, Officer, Individual, RMI; RME fuera) | PARCIAL: el título se conserva (CSLB_TITLES, RMI, Principal, Qualifier) y pesa en el score; no es filtro excluyente (un RME se entrega con score bajo) | `REG` cslbTitle; `SCORE` EMPLOYEE_TITLES |
| B4 gate de tamaño y actividad (reviews < 100, personnel < 4, permisos < 150) | PARCIAL: reviews y permit_velocity solo en score; sin personnel_count productor | `SCORE` smallBusinessFactor |
| C1 a D3 buckets 1 a 4 | LISTO | buckets |
| E1 append cell only (DataZapp, fallback BatchData) | PARCIAL: solo BatchData | `BATCH` |
| E2 tipo de línea y conectado (Telnyx o RPV) | PARCIAL: BatchData reachable + Mobile | `src/services/lead-engine-verify.service.ts` |
| E4 DNC (FTC + listas estatales) | PARCIAL: solo flag BatchData | |
| E5 litigator | PARCIAL | |
| E6 reassigned check | NO | grep vacío |
| F1 ledger, F2 score y ventana, F3 export 3.000 a 5.000 | LISTO | `JOBS` deliver, jobWorkbook |
| G1 outcomes (reached_owner, gatekeeper, wrong_number, voicemail, disconnected, do_not_call) | LISTO con 7 códigos (opt_out en vez de do_not_call_request, más no_answer) | `JOBSLIB` OUTCOMES; ruta outcomes/import |
| Tabla MUST: Socrata; CSLB, FL DBPR, VA DPOR, MN DLI, NJ DCA; Apify; libpostal+rapidfuzz+phonenumbers; FTC DNC; Telnyx; TCPA list | 5 de 7 al menos PARCIAL; FTC directo y Telnyx NO | ver Sección 4 |
| Legal check por registro (CA allowed practice, FL 119, WA PDDL caution, OR PD, MN, TX PIA, CO PD, IL ODbL, NJ, NYC, VA, GA, NC, NV, MI, IN, AZ restricted, SC y UT prohibited, resto UNKNOWN) | PARCIAL: el brain codifica ok / restricted / prohibited para 21 estados (SC, UT prohibited; CA restricted; AZ ok con nota); no hay atribución ODbL para IL ni registro de la advertencia RCW 42.56.070 para WA en el ledger | `BRAIN` states; `JOBS` legal_gate en ledger |
| Conclusión H4: triangulación A + B + C + D + gate E de tamaño | PARCIAL: A, B, C, D presentes con BatchData como D único; E solo como score | |

### Apéndice B: servicios del hogar sin licencia

| Elemento | Estado | Evidencia |
|---|---|---|
| Build first: gate de tipo de línea en teléfonos Maps (medir mobile share día uno), FMCSA join, reviews extraction, CO y FL SOS agent heuristic | PARCIAL: FMCSA, reviews y CO listos; el gate de tipo de línea como primer paso pago NO (la receta A verifica todo con BatchData, que ya incluye DNC, sin pre gate barato); FL agent heuristic NO | `BRAIN` recipes.A; `REG` |
| A1 register union (FMCSA, SOS CO FL WA NY OR OH IN, Seattle, SF, Chicago, ficdata, PA HIC, pest) | PARCIAL: FMCSA y CO | `REG` |
| B1 clean: dedupe teléfono y título+ciudad, regex franquicias, agregadores, frecuencia de teléfono > 2, isAdvertisement | PARCIAL: no phone, toll free, dup, closed, chain (BRANDS) y allowlist; sin regla de agregador ni isAdvertisement | `src/lib/lead-engine-scrape.ts`; `JOBS` línea 727; `ownercell/scrape.py` filter_rows |
| B5 micro score (reviews < 60, sin web, sin dirección, nombre de persona en título, claimThisBusiness) | NO como score previo; reviews entra al Owner Score | `SCORE` |
| C1 tipo de línea en Maps phone, C2 mobile / landline / tracking | PARCIAL: Mobile vs no Mobile via BatchData; sin segmento tracking ni carrier | `BATCH` |
| E1 reviews scrape 20 a 30 nuevas | LISTO (25) | `REVIEWS` MAX_REVIEWS_PER_LISTING |
| E2 identidad: LLM de reseñas, nombre del registro, about page, DBA, mezcla de idioma | PARCIAL: reseñas, about y registro sí; DBA NO; idioma solo dentro del extractor | `REVIEWS` |
| E4 append (DataZapp, BatchData fallback), E5 tipo de línea del append | PARCIAL: BatchData trae Mobile en la misma respuesta | `BATCH` skipTrace |
| F1 conectado, DNC nacional + estatal, litigator, reassigned | PARCIAL: nacional, litigator y conectado via BatchData; estatal y reassigned NO | |
| F2 ledger con carrier, DNC file version, manual dial flag, language preference | PARCIAL: sin carrier, sin dnc_file_version, sin language | `JOBS` líneas 800 a 813 |
| F3 score, clasificador micro, routing español | PARCIAL: score sí; micro y español NO | `SCORE` |
| G1 outcomes con wrong_name y language_mismatch | NO: el enum tiene 7 códigos sin esos dos | `JOBSLIB` OUTCOMES |
| Tabla MUST: Apify places, Apify reviews, Telnyx, FMCSA, Seattle/SF/Chicago/LA, SOS bulk, ficdata, PA HIC, pest CSVs, FTC + estatales, TCPA, LLM chico | 5 LISTOS (places, reviews, FMCSA, LLM, SOS CO parcial), 6 NO | |
| Legal: FMCSA allowed, CO PD, NY, Sunbiz, WA caution, Seattle, SF, Chicago, LA CC0, Miami-Dade request only, TX SOS, PA HIC, pest, DBA, Maps scraping riesgo aceptable (guardar solo nombres y snippets), Yelp etc. NICE, TCPA presunción residencial, FTSA, AZ | PARCIAL: Maps scraping guarda solo nombre, evidencia corta y placeId (LISTO); FTSA sin contador; AZ gate solo como nota | `REVIEWS` evidence 80 caracteres; `BRAIN` |
| Conclusión H3: Maps first con gate de tipo de línea, union de registros para bucket 1, segmento tracking, DNC al 50 por ciento, routing español | PARCIAL: la mitad "union de registros y reseñas" sí; la mitad "gate barato de tipo de línea y tracking" NO | |
| Build order de 7: reviews + outcomes semana uno; carrier config; language; register union y diff; micro classifier tras 3.000 dials | reviews, outcomes, diff LISTOS; carrier, language, micro NO | |

### Apéndice C: salud con NPI

| Elemento | Estado | Evidencia |
|---|---|---|
| Build first: NPPES bulk con AO contrast y surname in entity, quiro y podólogos FL y TX, exclusión DSO | PARCIAL: AO contrast via API; sin bulk, sin surname in entity NPI-2, sin DSO | `REG` nppes |
| A1 bulk mensual + semanal a Postgres | NO | |
| A2 API deltas y refresh | LISTO (es la única vía) | `REG` nppes |
| A3 CMS National Downloadable | NO | |
| A4 boards estatales por número de licencia | NO | |
| A5 SOS officers FL NC CO WA IN OH | PARCIAL: CO | |
| A6 Maps por metro y categoría | LISTO | |
| B2 roster por dirección (NPI-1 por dirección y taxonomía) | LISTO para NP, PA, RN por zip (pensado para D, reutilizable) | `MEDSPA` createNpiRoster |
| B3 filtro corporativo: repetición de AO, geografía de AO, título, marca, num_org_mem | PARCIAL: solo título (NPPES_EXCLUDED_TITLE) y marcas (`BRANDS` medspa_franchise_telehealth, registered_agent_services) | `REG`; `BRANDS` |
| C1 grafo de resolución (AO owner title, AO = NPI-1 en dirección, apellido en nombre, sole provider, sole_proprietor, SOS officer) | PARCIAL: sole_proprietor y NPI-1 en dirección en `MEDSPA`; apellido en nombre solo para PTIN y NY attorneys (surnameInCompany) | `MEDSPA` clinicianContact; `REG` surnameInCompany |
| C2 umbral de probabilidad 0,6 | PARCIAL: confidences 0,5 a 0,95 en med spa; sin umbral 0,6 de entrega | `MEDSPA` resolveMedSpaOwner |
| D1 candidatos de teléfono rankeados (AO differing, NPI-1 mailing, NPI-1 location) | PARCIAL: AO phone es el phone10 de `nppes`; mailing phone que difiere se propone en `MEDSPA`; sin ranking de tres | |
| E0 a E5 append, línea, DNC, litigator, reassigned | PARCIAL (BatchData) | |
| F2 new practice flag por enumeration_date | LISTO como licenseIssueDate = enumeration_date y RPC new_licensees | `REG` nppesOrganization |
| G1 outcomes con reached_hq y reached_front_desk_only | NO | `JOBSLIB` OUTCOMES |
| Tabla MUST: NPPES bulk, NPPES API, CMS NDF, Apify, Postgres ER, FTC + TX FL, Telnyx, TCPA | API, Apify y ER (parcial) sí; bulk, CMS, FTC directo, Telnyx NO | |
| Legal: NPPES sin opt out, CMS, HIPAA n/a, FL, FTSA, TX 552.11765 (no pedir datos de casa a boards TX), CA 1798.61, NC, NY POL 89 (no pedir listas), GA, otros, TCPA, DEA, AVMA | LISTO por omisión: no hay adaptador de boards TX ni pedidos NY; NPPES y Maps son las únicas fuentes C | |
| Conclusión H3: resolución en grafo con exclusión corporativa, tres candidatos de teléfono, append para el 70 por ciento | PARCIAL | |

### Apéndice D: med spas

| Elemento | Estado | Evidencia |
|---|---|---|
| Build first: Florida (Sunbiz two hop + roster NPI-1), luego Texas con PIR, luego director graph | PARCIAL: roster NPI-1 y director graph LISTOS pero sin llamadores en el runner (solo tests); PIR EN CURSO; Sunbiz NO | `MEDSPA`; `tests/lead-engine-medspa.test.ts`; grep resolveMedSpaOwnerLive sin llamadores |
| A1 Maps con todas las categorías D y keyword strings | PARCIAL (keywords del brain) | `BRAIN` |
| A2 registros (TN PDF, TDLR laser y esthetician, FL MQA, RI, AHCA) | PARCIAL: TN sí, resto NO | `src/data/lead-engine-tn-medspa-directors.json` |
| A3 SOS (Sunbiz, CO, NC, WA, OR, NY; per record TX PIR, CA, AZ, NV) | PARCIAL: CO y PIR en curso | |
| A4 NPPES bulk + delta, NPI-1 NP PA RN MD por dirección | PARCIAL: API, NP PA RN; sin MD | `MEDSPA` ROSTER_TAXONOMY |
| B1 filtro de cadenas y telehealth, flag franquiciado | LISTO como blocklist (67 marcas) antes de gastar; "never drop franchisees" NO se cumple: la marca bloquea, no flaguea | `MEDSPA` medSpaFranchise (blocked_franchise); `BRANDS` |
| C1 roster de dirección con suite | LISTO (calle + suite + zip, umbral 0,90) | `MEDSPA` matchClinicianToSpa |
| C2 extracción web y bio de Instagram | PARCIAL: web sí, Instagram NO | `REVIEWS` |
| C3 resolución persona primero (SOS officer, two hop, mailing = member address) | PARCIAL: PIR officers con títulos de dueño y exclusión de agentes registrados; sin two hop ni SOS FL | `MEDSPA` OWNER_TITLE, registeredAgentService |
| C4 grafo de directores médicos (2 o más spas, título director, NPI-1 en otro lugar) | LISTO con umbral 3 (el catálogo dice 3 o más; el apéndice dice 2 o más) | `MEDSPA` DIRECTOR_ONLY_THRESHOLD = 3 |
| C5 score por acuerdo de capas | PARCIAL: confidence aditiva en `MEDSPA` | |
| D1 a D5 buckets con teléfono libre (mailing differs, AO differs, agent phone) | PARCIAL: mailingPhoneDiffers propone el mailing phone | `MEDSPA` clinicianContact |
| E0 a E5 validación | PARCIAL (BatchData) | |
| F1 ledger con evidencia director_only | NO: `MEDSPA` no escribe al ledger porque no está cableado | |
| G1 outcomes con reached_injector_employee, reached_medical_director, reached_booking_platform | NO | `JOBSLIB` OUTCOMES |
| H1 detección de spas nuevos (SOS < 180 días, NPI nuevos, TN) | PARCIAL: new_licensees por fuente (co_sos_agents entityformdate, nppes enumeration_date); sin cron específico D | RPC lead_engine_new_licensees |
| Tabla MUST: Apify D keywords, Sunbiz two hop, CO NC WA OR SOS, NPPES roster, web team page, TX PIR, blocklists, director graph, DataZapp+Telnyx+RPV+FTC+litigator | 5 LISTOS o PARCIALES (Apify, CO, roster, web, blocklists, director graph), Sunbiz NO, PIR en curso, validación PARCIAL | |
| Legal: NPPES, SOS (usar domicilios de miembros solo como llave de append), TN 63-6-105, RI, AHCA, MQA, TX 552.11765, CA, NY, board rules no restringen, Instagram bajo volumen, locators no bulk, RealSelf etc. per record, TCPA 45 por ciento DNC, FTSA, TX DNC, CCPA, HIPAA | PARCIAL: locators y CA CHHS como guardrail; sin CCPA ni contador FTSA | `BRAIN` guardrails |
| Conclusión H6: discovery Maps con filtro de cadenas; identidad por stack estatal (SOS + NPI-1 en dirección + web + Instagram); score por acuerdo y director graph | PARCIAL: la lógica pura existe y está probada; no produce filas de job | `tests/lead-engine-medspa.test.ts` |
| Build order: outcomes + resolver semana uno; roster y director graph semana dos; web e Instagram semana tres; cron spas nuevos; MSO + PC | roster, director graph, web LISTOS; resto NO | |

### Apéndice E: cuidado personal y fitness

| Elemento | Estado | Evidencia |
|---|---|---|
| Build first: TX mini establishments + NY shops, luego FL barbershops, luego detector de booth rental | PARCIAL: TX, NY y FL listos; detector de booth (licenciatarios por dirección) NO | `REG` txTdlrSalons, nySalons, flDbprBarbers |
| A1 registros (NY, TX 7358 y CSVs, FL lic03bb y cosmetology, CO, IL, DE, WA massage, Seattle, Santa Clara) | PARCIAL: NY, TX suites, FL barbers; resto NO | |
| A2 SOS (Sunbiz, CO, NY, WA, TX) | PARCIAL: CO | |
| A3 Maps por categorías de salón, barbería, uñas, spa, lash, masaje, tattoo, gym | PARCIAL: depende de claves de industria del brain (salon_barber_ny, salon_suite_tx, barbershop_fl); sin gym ni tattoo | `BRAIN` industries |
| B2 clustering por dirección (10 o más suite, 3 a 8 multi silla, 1 a 2 owner operator) | NO | grep clustering vacío |
| B3 segmentación y S1 a S3 identidad por segmento | PARCIAL: renter vs owner por tipo de licencia NY (Suite Renter) y Mini Establishment TX; sin conteo por dirección | `REG` NY_SALON_TYPES |
| D1 Maps phone mobile y exclusivo; D2 append por nombre + domicilio (TX mailing, FL practitioner, Sunbiz officer) | PARCIAL: FL barbers y TX TABC mailing alimentan la parcela / traza; TX suites usan business_telephone como receta D | `PARCEL` homeStreetSource |
| E5 flag de idioma (originalLanguage, descripción, lang del sitio) | NO | |
| H1 alertas de establecimientos nuevos (NY issue dates, TX license_number high water mark, FL original date) | PARCIAL: new_licensees por license_issue_date (NY sí; TX suites solo traen vencimiento, sin high water mark) | `REG` txTdlrSalonRow (sin licenseIssueDate) |
| G1 outcomes con reached_role (owner, renter_not_owner, front_desk, stylist_employee) | NO | |
| Tabla MUST: NY DOS, TX TDLR + CSVs, FL barbers + cosmetology, CO IL DE, SOS, Apify, clustering en Supabase, Telnyx FTC litigator | NY, TX (Socrata), FL barbers, Apify LISTOS; CSVs diarios, cosmetology, CO, IL cosmo, DE, clustering, Telnyx, FTC NO | |
| Legal: NY, FL DBPR sin teléfonos, MQA email UNKNOWN, TX PIA, CA DCA + CCPA, CO PD, IL ODbL, NJ, VA, PA venta, OH, WA DOL prohibido, OR, GA, NC, AZ restricted, tattoo counties, booking terms, Instagram, suite sites no scrape | LISTO por omisión para WA, AZ y booking (sin adaptadores); sin atribución ODbL | |
| Conclusión H5: registro donde nombra (NY, FL), reverse append de domicilio (TX), practitioner + SOS + reseñas (CO, IL, CA, NJ, VA, PA), business license + SOS + Maps (WA, AZ, UT, SC); segmentar por conteo antes de resolver; suites como pool primario | PARCIAL: NY, FL y TX suites cubiertos; reverse address append, conteo por dirección y estados sin registro NO | |
| Routing por idioma y cultura (H4, solo señales de idioma, nunca etnia) | NO | |

### Apéndice F: servicios profesionales y legal

| Elemento | Estado | Evidencia |
|---|---|---|
| Build first: TX insurance y TX real estate (traen etiquetas de dueño), PTIN nacional, FL insurance y real estate, RIAs y NY attorneys | PARCIAL: TX TDI, TX TREC, PTIN, FL DFS, FL RE y NY attorneys LISTOS; RIAs (SEC) NO | `REG` |
| S1 insurance (TX kvqi, kxv3, bupb; FL DFS 12 CSVs; SBS) | PARCIAL: kvqi + kxv3, FL individual | |
| S2 tax (PTIN, EA, FL CPA, CA DCA, WA, NY) | PARCIAL: PTIN, FL CPA, IL CPA | |
| S3 real estate (FL rgn1 a 14, TX, CA CurrList, NY, CO) | PARCIAL: FL 1 a 7, TX, AZ, IL | |
| S4 RIA (SEC zips, FOIA, IAPD) | NO | |
| S5 attorneys (NY) | LISTO | `REG` nyAttorneys |
| O1 clasificador de dueño: explícito (Owner, DRLP, designated broker, BK sin employer, CCO = Schedule A) vs heurístico (apellido en firma, DBA, solo, 5 carriers) vs empleado | PARCIAL: TDI Owner/DRLP como titleCode; TREC designated_supervisor_flag; PTIN dbaHasSurname; NY surnameInFirm; IL business='N'; sin clases owner_confirmed / probable / employee ni carriers | `REG` txTdiRow, txTrecRow, ptinRecord, nyAttorneyRow |
| G1 gate de tamaño e intención (empleados < 10, agentes < 25, AUM < 100M, antigüedad 2 a 15, área de práctica) | NO | |
| B0 a K4 buckets con teléfono exclusivo | LISTO (receta D para fl_dfs_individual, irs_ptin, ny_attorneys; reuse > 3) | `BRAIN` industries recipe D |
| AP append (DataZapp, city+zip para PO Box, BatchData en domicilios FL) | PARCIAL: BatchData tras parcela; sin modo PO Box | `PARCEL` streetOk rechaza PO Box (la fila se descarta, no se degrada) |
| LT, D1 a D3 validación | PARCIAL (BatchData) | |
| SC score de probabilidad e intención | PARCIAL (Owner Score, sin intención) | |
| Ventana para tax preparers fuera de 15 de marzo a 15 de abril | NO | |
| Tabla MUST: TX TDI (5 datasets), FL DFS (3), PTIN, TX TREC + FL RE + CA DRE + NY DOS, SEC, NY attorneys, Apify, DataZapp+Telnyx+FTC+litigator+reassigned | TDI (2 de 5), FL DFS (1 de 3), PTIN, TREC, FL RE, NY attorneys, Apify LISTOS; CA DRE, NY DOS RE, SEC, DataZapp, Telnyx, FTC, reassigned NO | |
| Legal: FL DFS allowed, TX TDI, CA CDI UNKNOWN, SBS UNKNOWN, NIPR prohibited, PTIN allowed, EA, SEC, FINRA avoid, NY attorneys 22 NYCRR 118, Florida Bar per record, TX y CA bars UNKNOWN, FL DBPR, TREC, DRE (nunca examinee list), NY DOS, CO, DCA, WA caution, TCPA B2B, FTSA, CCPA | LISTO por omisión (no se tocan NIPR, SBS, bars, DRE) | |
| Conclusión H3: cinco pipelines con un clasificador de dueño y un árbol de decisión de teléfono | PARCIAL: 4 de 5 pipelines tienen registro; clasificador compartido NO | |
| Diferenciador (a): clasificador owner vs employee entrenado con TX como ground truth | NO: TX Owner/DRLP/Employee no se usa como training set; solo se ingieren Owner y DRLP | `REG` TX_TDI_TYPES |

### Apéndice G: automotor, cuidado infantil y educación, gastronomía y hospitalidad

| Elemento | Estado | Evidencia |
|---|---|---|
| G build first: NY repair shops + mobile detailing y mecánicos por Maps | LISTO: `ny_repair_shops` (receta B) y `car_detailing`, `auto_repair` (receta A) | `REG`; `BRAIN` |
| G A1 registros (NY, WA, CT, DCA BAR, TX tow, Chicago) | PARCIAL: NY | |
| G A3 exclusión de marcas OSM (car_repair, car_wash, car) + DLN | PARCIAL: 189 marcas auto; sin DLN (no hay DLU/DLN en el adaptador, solo RS y RSB) | `BRANDS`; `REG` nyRepairShopRow |
| G B3 test de dueño (regex persona NY, DCA indicator, WA persona) | LISTO para NY | `REG` splitPersonName |
| G C1 probabilidad por antigüedad de licencia, entidad vs persona, apellido en reseñas | PARCIAL: license_age_years y title en score | `SCORE` |
| G D1 a F1 tipo de línea, append, validación | PARCIAL (BatchData) | |
| G tabla MUST: NY WA CT TX Chicago, DCA BAR, Apify, OSM, Telnyx, DataZapp + BatchData, FTC + litigator + reassigned | NY, Apify, OSM, BatchData LISTOS; resto NO | |
| G legal: NY, WA ODbL, CT PD, CA, TX, Chicago, FL TX MI UNKNOWN | LISTO por omisión | |
| G conclusión: dos caminos (tiendas fijas via registro + append; oficios móviles Maps first) | LISTO en estructura (receta B NY, receta A móviles) | `BRAIN` |
| G diferenciador (a) grafo de direcciones multi licencia (RS + ISP + DLU + TRS) | NO: solo RS y RSB, sin conteo por dirección | |
| H build first: hogares como prueba end to end, luego centros y estudios | PARCIAL: hogares NY, PA, TX LISTOS (receta C); centros NO (industria childcare_center receta B sin register_source) | `BRAIN` industries.childcare_center |
| H A1 registros (NY, PA, TX, CO, DE, WA, IL, OH) | PARCIAL: 3 de 8 | |
| H A3 exclusión de franquicias (Kumon, KinderCare, Primrose, Goddard...) | LISTO: grupo education_childcare con 29 marcas | `BRANDS` |
| H B1 split hogar / centro / school age | LISTO por segmentos de tipo de operación | `REG` segments |
| H C1 A + B en una fila; D1 tipo de línea del teléfono del registro | PARCIAL: receta C verifica con BatchData | |
| H E2 append por nombre + zip cuando falta calle (CO, NY omitidos) | NO: opt out NY se respeta y no se apendea (correcto); CO sin adaptador | |
| H G1 ledger con capacidad, estrellas, flag español | NO: capacidad y estrellas no se guardan como features | |
| H outcomes con parent line | NO | |
| H tabla MUST: 6 datasets, Telnyx, FTC + estatales, TCPA | 3 datasets y validación BatchData | |
| H legal: NY honrar omisión, PA, TX CC0, CO, DE, WA, CA restringido, FL 402.313, GA NC, MN, AZ, celulares residenciales con tope 2 intentos por semana y sin nap windows | PARCIAL: omisión NY y CA gate LISTOS; topes de intentos y ventanas de siesta NO | `REG` nyChildcareRow; `BRAIN` |
| H conclusión: registro primero para hogares, registro + SOS para centros, Maps first para educación sin licencia | PARCIAL: solo hogares | |
| I build first: STR operators, luego TX TABC con SOS officer join, luego Florida | PARCIAL: STR (NOLA, Orlando) y TABC LISTOS; SOS TX join NO; Florida NO | `REG` |
| I A1 registros (TABC, NY DOH, NY SLA, FL hrfood + chgownr, CA ABC, CO, Chicago, NOLA, Orlando) | PARCIAL: 4 de 9 | |
| I A3 exclusión de cadenas OSM + regla multi local por nombre legal | PARCIAL: OSM food 830 marcas; regla "misma licensee en más de 2 premises" NO | `BRANDS` |
| I B2 test de persona (TABC owner, NY DOH operator, FL licensee, STR holder) | LISTO para las 4 fuentes ingeridas | `REG` |
| I C2 entidades a persona (Sunbiz, TX SOS, NY chairman, reseñas, web) | PARCIAL: reseñas y web solo en recetas A y D; entidades TABC se saltan (owner_is_entity) | `JOBS` nameOwners |
| I D1 a F1 validación | PARCIAL (BatchData) | |
| I H1 ledger con tag de producto, fecha de cambio de dueño, contador FTSA | NO | |
| I tabla MUST: TABC, NY DOH, FL H&R + Sunbiz, NOLA + Orlando, OSM, Apify + reviews + LLM, validación | TABC, NY DOH, STR, OSM, Apify + reviews LISTOS; FL NO; validación PARCIAL | |
| I legal: TABC, NY, FL readme, CA ABC, CO, MO, WA LCB prohibido, NOLA CC0, Chicago, FTSA contador, tope 2 intentos por semana e internal DNC en 24 h | PARCIAL: WA LCB gate LISTO; contador y topes NO; opt_out suprime de inmediato (LISTO) | `BRAIN` guardrails; `GATES` |
| I conclusión: tres productos (restaurantes TX y NY, comida móvil Maps first, STR) | PARCIAL: 1 y 3 tienen registro; comida móvil sin clave de industria | |
| I diferenciador (a) owner change feed (chgownr_food, TABC status changes) | NO: chgownr no se ingiere; el diff TABC por new_licensees existe pero no detecta cambios de dueño | RPC new_licensees |
| Veredicto comparativo: construir H primero, después G, después I; medir en semana uno el mobile share de childcare (H8.1) y de talleres NY y WA (G8.4) | PARCIAL: los tres grupos tienen su primer registro; las dos mediciones de tipo de línea siguen ABIERTAS | |

### Conclusiones de los hypothesis loops, una por una

| Conclusión de la investigación | El código la refleja? | Evidencia |
|---|---|---|
| TX TDLR: owner_telephone es espejo, owner_name es etiqueta; el teléfono va como receta D con business_telephone | Sí | `REG` txTdlrSalonRow; `BRAIN` salon_suite_tx receta D |
| MN: reuso de teléfono hasta 189; tabla de frecuencia y exclusión de B2 y B3 manteniendo la identidad para append | Parcial: la frecuencia y el corte existen (> 3) pero la fila se descarta (namesDroppedReuse), no se manda a append | `JOBS` selectRegisterNames; `JOBSLIB` PHONE_REUSE_MAX |
| NPPES: repetición de AO, geografía y título antes de marcar; el bucket "differs" tiene un tercio de mesas HQ | Parcial: solo título | `REG` NPPES_EXCLUDED_TITLE |
| Sunbiz two hop: persona primero, entidad segundo, búsqueda por nombre de officer | No | sin Sunbiz |
| Grafo de directores médicos: director en 3 o más spas nunca se entrega como dueño | Sí (umbral 3, 622 directores TN) | `MEDSPA` directorOnlyContacts |
| Eliminación de franquicias, telehealth y agentes registrados antes de gastar | Sí (blocklists) | `MEDSPA`; `BRANDS` |
| Extracción de dueño desde reseñas: regla de dos menciones o respuesta firmada, LLM chico solo residual | Sí: voto por mayoría con confianza sumada, empate no entrega, respuestas del dueño incluidas, Haiku solo si el determinista no encuentra | `REVIEWS` pickOwnerName, reviewCorpus |
| Gate de tipo de línea Telnyx como primer paso pago de toda receta | No: el primer paso pago es BatchData phone/verification (0,7 centavos) que decide Mobile, DNC y TCPA a la vez | `JOBSLIB` VERIFY_CENTS_PER_NUMBER; `BRAIN` _note |
| DataZapp cell only como append primario, BatchData como segundo paso | No: BatchData skip trace es el único append (7 centavos por persona) | `JOBS` fase trace |
| FTC DNC por suscripción directa, rescrub 31 días, no depender de un vendor | Parcial: rescrub 31 días es gate; el DNC depende de BatchData | `GATES` |
| RealPhoneValidation caller_type business como evidencia de línea de negocio | No; la evidencia de línea de negocio es register_eq_maps en el ledger | `JOBS` business-line evidence |
| Permit velocity como señal de intención y capacidad de pago | Parcial: feature del score sin productor; Austin ingiere permisos pero no cuenta por contratista | `SCORE`; `REG` austinPermits |
| Routing por idioma (solo preferencia de idioma) | No | |
| Bucket 1 "licensed but invisible" como segmento primario de los primeros 90 días | Sí: bucket 1 se entrega con nota "licensed but invisible" y suma 0,1 en el score | buckets; `SCORE` sourceFactor |
| Umbrales de matching 0,87 nombre, 0,90 dirección, banda 0,80 a 0,87 a revisión manual | Sí (la banda se cuenta, no se entrega) | `src/lib/lead-engine-buckets.ts` |
| Receta B: exactamente un dueño en la parcela, calle con número y sufijo, sin PO Box, dos parcelas se saltan | Sí | `PARCEL` resolveHome, streetOk; `GATES` two_parcel_trace_present |
| Clean rate fuera de 10 a 70 por ciento indica filtro roto y bloquea la entrega | Sí | `GATES` CLEAN_RATE_MIN, CLEAN_RATE_MAX |
| Maps nunca es el entregable para abogados, CPAs y med spas | Sí | `GATES` NEVER_MAPS_DELIVERABLE |

## Parte 3. Resumen en números

### Fuentes del catálogo por tag y estado en el código

Se auditaron 247 filas de fuente (algunas filas del catálogo agrupan varias fuentes; se contó una fila por fila del catálogo, más la fila extra `pa_pals` que existe en código sin fila en el catálogo).

| Tag del catálogo | Filas | LISTO | PARCIAL | EN CURSO | NO | EXCLUIDO | FUERA DE ALCANCE |
|---|---|---|---|---|---|---|---|
| VERIFIED (total o en parte) | 170 | 43 | 8 | 2 | 85 | 14 | 18 |
| REPORTED | 49 | 2 | 0 | 0 | 30 | 16 | 1 |
| UNKNOWN | 11 | 0 | 1 | 0 | 10 | 0 | 0 |
| Otro (Given, Estimate, mixto, n/a) | 17 | 4 | 2 | 0 | 10 | 1 | 0 |
| Total | 247 | 49 | 11 | 2 | 135 | 31 | 19 |

Lectura: de las 170 fuentes VERIFIED, 53 (31 por ciento) tienen algo en código y 85 (50 por ciento) no tienen nada. Los 31 adaptadores de `REGISTER_ADAPTERS` cubren 30 filas del catálogo (CSLB cuenta una vez) más `pa_pals`. Ninguna fuente marcada AVOID o prohibida tiene adaptador: los 31 EXCLUIDOS son coherentes con los guardrails del brain.

### Trampas conocidas

| Estado | Cantidad | Cuáles |
|---|---|---|
| LISTO | 11 | TDLR espejo de teléfono, TDLR owner_name, BatchData desordenado y 403, NPPES techo skip, NPPES state y taxonomía primaria, NY DMV fecha texto, FL DFS guards, FL RE posicional, límites Socrata, NY OCFS omisión, CA CHHS gate |
| PARCIAL | 4 | MN reuso (umbral único > 3), CSLB CLEAR (sin exigir Maps vivo o permiso), NPPES wildcard (`nppes_medspa` aún manda comodín inicial), NPPES AO HQ (solo título) |
| NO | 3 | CT active='1', CMS zip 9 dígitos, SEC zips irregulares (las tres sin adaptador de origen) |

### Pedidos de verificación abiertos

97 pedidos: 4 RESUELTOS (precio Apify, PDF TN, layout FL RE, marcas NSI food), 12 PARCIALES, 81 ABIERTOS. De los 81 abiertos, 36 requieren cuenta, correo, compra o FOIA (nadie los puede cerrar desde el código) y 45 son medibles con un GET o un adaptador. Las mediciones de tipo de línea (Telnyx) suman 12 de los 45 y bloquean el modelo de costos de todos los grupos.

### Requisitos del 07 (secciones ejecutivas y apéndices A a G)

Se evaluaron 194 filas de requisito en la Parte 2 (stack global, moats, plan de 90 días, piso de cumplimiento, pasos de workflow, build first, filas MUST, checks legales y conclusiones de hipótesis).

| Estado | Cantidad | Porcentaje |
|---|---|---|
| LISTO | 47 | 24 |
| PARCIAL (incluye 11 filas resumen de tablas MUST y build order con mezcla) | 107 | 55 |
| EN CURSO | 1 | 1 |
| NO | 38 | 20 |
| EXCLUIDO | 1 | 0 |
| FUERA DE ALCANCE | 0 | 0 |

Las 18 conclusiones de hypothesis loop de la tabla final de la Parte 2: 9 reflejadas (Sí), 4 parciales (MN reuso, NPPES AO, FTC directo, permit velocity) y 5 no (Sunbiz two hop, Telnyx como gate, DataZapp primario, RPV caller_type, routing por idioma).

### Los diez faltantes más valiosos, ordenados por el costo por celda y la prioridad que da la propia investigación

| # | Faltante | Por qué primero, en palabras del 07 | Estado hoy | Dónde encajaría |
|---|---|---|---|---|
| 1 | Telnyx Number Lookup como primer paso pago (0,25 centavos) y medición del mobile share por registro | "The line type gate is the first paid step and the branch decision in every pipeline"; "the single missing number in the whole program" (Sección 7 módulo 2, Sección 9); MUST en las 9 tablas | NO; solo costo en `BRAIN` | nuevo servicio junto a `src/services/lead-engine-verify.service.ts`; bake off contra BatchData que el brain deja pendiente |
| 2 | FTC DNC por suscripción directa con dnc_file_version en el ledger, más listas estatales TX, FL, PA, IN, MO | "Legal requirement; do not depend on a vendor for this" (Sección 4); MUST en todos los grupos; el ledger hoy guarda dnc_file_version = null | PARCIAL (flag BatchData) | `JOBS` deliver, `MIG` lead_engine_row_ledger |
| 3 | FL Sunbiz SFTP (cordata, ficdata) con two hop y búsqueda por officer | "The best free owner register in the group" (D), MUST en B, D, E, I; Módulo 4 semanas 4 a 6; destraba FL en cuatro grupos | NO | nuevo adaptador `sunbiz` en `REG` (kind file, SFTP requiere fetcher propio) |
| 4 | DataZapp Phone Append cell only (2 a 3 centavos por match, cobra solo matches) con BatchData como reserva | "Recommended primary cell append"; mueve el costo de G y D en 3 centavos por celda (Sección 9); el brain lo deja a un bake off que no se corrió | NO | fase trace de `JOBS`; `BRAIN` unit_costs |
| 5 | CSLB: destrabar el portal 503 (User-Agent de browser, sesión, o pedido de terms) | Módulo 1 del plan de 90 días, "This is the demo"; 5.000 dueños a costo casi cero; 7 a 12 centavos por celda, prioridad 1 de 9 | EN CURSO (adaptador completo, portal rechaza) | `REG` cslb; pedido de terms abierto |
| 6 | Cablear `resolveMedSpaOwnerLive` al runner y completar el filtro corporativo de NPPES (repetición de AO, geografía) | D es "strategically the most valuable"; C: sin la regla de repetición "the differs bucket would be about a third HQ desks"; el código puro existe y está probado pero no produce filas | PARCIAL (sin llamadores) | `JOBS` names para industria med_spa; `REG` nppesOrganization |
| 7 | NPPES bulk V.2 mensual + semanal a Postgres, con CMS num_org_mem | MUST en C y D; sin bulk no hay AO repetition, surname in entity, solo NPI-1 share ni regex por nombre ("contains" solo en SQL) | NO | nueva carga; `MEDSPA` ya define el address key |
| 8 | Contador de intentos FTSA (3 por 24 h en FL), topes por semana (H, I) y CCPA (aviso, borrado, procedencia) | Piso de cumplimiento Sección 8; "manual dialing from the Next.js view complies; log attempts" (B, D, I) | NO | outcomes y hoja de marcado en `JOBSLIB`; `MIG` dial_outcomes |
| 9 | Clustering de licenciatarios por dirección (suites 10 o más, multi silla 3 a 8) y la mitad TX de 7358-krk7 (Electrical Contractor, A/C, Esthetician, tow) | E: "Address clustering in Supabase, MUST, the segment logic is the product"; A y G: TDLR es la fuente TX de contratistas y remolques | NO / PARCIAL (solo Mini Establishment) | SQL sobre lead_engine_names; segmentos extra en `REG` txTdlrSalons |
| 10 | TX TDI como training set (Owner, DRLP, Employee) y clasificador owner vs employee compartido | F: "Real moat with a specific reason: Texas provides labeled ground truth"; hoy solo se ingieren Owner y DRLP, sin filas Employee ni appointments bupb-23s9 | PARCIAL | `REG` TX_TDI_TYPES; `SCORE` como v1 |

Menciones que quedan justo afuera del top diez, por orden: routing por idioma (B, E; "Nalify specific edge"); reassigned numbers check en apendeados; permit velocity por contratista desde `austin_permits`; segmento tracking numbers (requiere carrier name, que Telnyx da y BatchData no); outcomes extendidos por grupo (reached_hq, reached_injector_employee, wrong_name, language_mismatch, renter_not_owner); owner change feed FL chgownr_food; SEC Form ADV para RIAs.
