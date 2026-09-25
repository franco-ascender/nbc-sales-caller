#!/usr/bin/env python3
"""
OWNER CELL ENGINE — one CLI for every lane in the master prompt.

  engine.py meter --new "FL CPAs" --cap 10          NEW JOB: fresh meter at this cap (archives the old one)
  engine.py meter --cap 50                          SAME JOB, next tranche: raise the cap; spent is never reset
  engine.py scrape  --tag pool --kw "pool builder" --cities "Tampa, FL;Charlotte, NC" [--limit 40] [--go]
  engine.py names   --tag flcpa --source fl_cpa|fl_re|tx_trec|az_adre|il_idfpr|pa_pals|nppes|firms
                    [--state FL] [--city TAMPA] [--county Harris] [--taxonomy Dentist] [--orgname "*med spa*"]
                    [--in scrape.json] [--n 200]
  engine.py parcel  --tag flcpa --in names_flcpa.json --state NC|FL|TX|AZ|IL|PA|GA|TN|WA
  engine.py trace   --tag flcpa --in picks_flcpa.json [--go]
  engine.py investors --tag inv --state NC --county Mecklenburg --min 3 --max 8 [--n 100]
  engine.py deliver --name "FL CPAs" --in traced_flcpa.json [more.json] [--dnc strict|flag]

Rules baked in: every paid step prints its estimate and refuses to run without --go;
the meter (spend.json) is checked BEFORE each paid call; any API error stops the run.
"""
import argparse, csv, json, os, re, sys, time, random, urllib.request, urllib.parse, urllib.error
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('ENGINE_WORK', os.path.join(ROOT, 'work')); os.makedirs(WORK, exist_ok=True)
SPEND = os.path.join(WORK, 'spend.json')
ENV = {}
for cand in [os.path.join(ROOT, '.env'), '/root/leadlist/.env']:
    if os.path.exists(cand):
        ENV = dict(l.strip().split('=', 1) for l in open(cand) if '=' in l and not l.startswith('#')); break
P_SCRAPE, P_VERIFY, P_TRACE = 0.0037, 0.007, 0.07
TOLLFREE = {'800', '888', '877', '866', '855', '844', '833', '822'}
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120'}

# ---------------------------------------------------------------- meter
def meter_load():
    if not os.path.exists(SPEND):
        json.dump({'cap': 0.0, 'spent': 0.0, 'log': []}, open(SPEND, 'w'))
    return json.load(open(SPEND))

def meter_line(s=None):
    s = s or meter_load(); return f"METER ${s['spent']:.2f} of ${s['cap']:.2f} cap"

def meter_charge(label, n, unit):
    s = meter_load(); cost = round(n * unit, 4)
    if s['spent'] + cost > s['cap'] + 1e-9:
        die(f"CAP: this step costs ${cost:.2f}; {meter_line(s)}. Raise the cap explicitly to continue.")
    s['spent'] = round(s['spent'] + cost, 4); s['log'].append({'step': label, 'n': n, 'cost': cost, 'ts': time.strftime('%Y-%m-%d %H:%M')})
    json.dump(s, open(SPEND, 'w'), indent=1); print(f"  charged ${cost:.2f} — {meter_line(s)}", flush=True)

def preflight(label, n, unit, go):
    s = meter_load(); cost = n * unit
    print(f"ESTIMATE: {label}: {n} × ${unit:.4f} = ${cost:.2f}   ({meter_line(s)})")
    if s['spent'] + cost > s['cap'] + 1e-9: die(f"Would exceed cap by ${s['spent']+cost-s['cap']:.2f}. Stop. Ask for a higher cap.")
    if not go: die("Dry run. Re-run with --go to spend this. (Rule: nothing is spent that wasn't in the last message.)", code=0)

def die(msg, code=1):
    print(("STOP: " if code else "") + msg, flush=True); sys.exit(code)

# ---------------------------------------------------------------- helpers
def p10(raw):
    d = re.sub(r'\D', '', raw or '')
    if len(d) == 11 and d[0] == '1': d = d[1:]
    return d if len(d) == 10 and d[0] not in '01' else None

def get_json(url, timeout=60, headers=None, data=None):
    req = urllib.request.Request(url, headers=headers or UA, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        die(f"HTTP {e.code} from {url.split('?')[0]} — body: {e.read()[:300]!r}")
    except Exception as e:
        die(f"{type(e).__name__}: {e} — {url.split('?')[0]}")

def arcgis(url, where, fields, n=5, timeout=40):
    u = url.rstrip('/') + '/query?' + urllib.parse.urlencode({'where': where, 'outFields': fields, 'returnGeometry': 'false', 'f': 'json', 'resultRecordCount': n})
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=timeout))
    except Exception as e:
        return None
    if 'error' in d: return None
    return [f['attributes'] for f in d.get('features', [])]

def download(url, path):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
            while True:
                b = r.read(1 << 20)
                if not b: break
                f.write(b)
    except urllib.error.HTTPError as e:
        die(f"HTTP {e.code} downloading {url}")

def street_ok(a):
    return bool(a) and bool(re.match(r'^\d+ +[A-Za-z0-9]', a.strip())) and not re.search(r'(?i)\b(ste|suite|unit|apt|floor|fl|pmb)\b|#|p\.?o\.? ?box', a)

def save(tag, kind, obj):
    p = os.path.join(WORK, f"{kind}_{tag}.json"); json.dump(obj, open(p, 'w'), indent=1); print(f"  → {p}  ({len(obj)} records)"); return p

def show_addresses(picks, k=3):
    print("ADDRESS CHECK (eyeball before any trace):")
    for p in picks[:k]: print(f"   {p['first']} {p['last']} | {p['street']} | {p['city']} {p['state']} {p.get('zip','')}")
    bad = [p for p in picks if not street_ok(p.get('street'))]
    if bad: print(f"   WARNING: {len(bad)} records have a suspicious street (e.g. {bad[0]['street']!r}). They are dropped.")
    return [p for p in picks if street_ok(p.get('street'))]

STATE_TZ = {'CT':'Eastern','DE':'Eastern','FL':'Eastern','GA':'Eastern','ME':'Eastern','MD':'Eastern','MA':'Eastern','NH':'Eastern','NJ':'Eastern','NY':'Eastern','NC':'Eastern','OH':'Eastern','PA':'Eastern','RI':'Eastern','SC':'Eastern','VT':'Eastern','VA':'Eastern','WV':'Eastern','MI':'Eastern','IN':'Eastern','KY':'Eastern','TN':'Central','AL':'Central','AR':'Central','IL':'Central','IA':'Central','KS':'Central','LA':'Central','MN':'Central','MS':'Central','MO':'Central','NE':'Central','ND':'Central','OK':'Central','SD':'Central','TX':'Central','WI':'Central','AZ':'Mountain','CO':'Mountain','ID':'Mountain','MT':'Mountain','NM':'Mountain','UT':'Mountain','WY':'Mountain','NV':'Pacific','CA':'Pacific','OR':'Pacific','WA':'Pacific','AK':'Alaska','HI':'Hawaii'}
TZ_EXC = {('TX','EL PASO'):'Mountain',('FL','PENSACOLA'):'Central',('FL','PANAMA CITY'):'Central',('FL','FORT WALTON BEACH'):'Central',('FL','DESTIN'):'Central',('FL','TALLAHASSEE'):'Eastern',('TN','KNOXVILLE'):'Eastern',('TN','CHATTANOOGA'):'Eastern',('TN','JOHNSON CITY'):'Eastern',('KY','LOUISVILLE'):'Eastern',('KY','LEXINGTON'):'Eastern',('KY','BOWLING GREEN'):'Central',('KY','PADUCAH'):'Central',('IN','EVANSVILLE'):'Central',('IN','GARY'):'Central',('MI','IRONWOOD'):'Central',('ID','BOISE'):'Mountain',('ID','COEUR D ALENE'):'Pacific',('OR','ONTARIO'):'Mountain',('ND','DICKINSON'):'Mountain',('SD','RAPID CITY'):'Mountain',('NE','SCOTTSBLUFF'):'Mountain',('KS','GOODLAND'):'Mountain'}
def tz(state, city): return TZ_EXC.get(((state or '').upper(), (city or '').upper()), STATE_TZ.get((state or '').upper(), ''))

# ---------------------------------------------------------------- scrape (Lane A)
def outscraper(queries, limit):
    key = ENV.get('OUTSCRAPER_API_KEY') or die('OUTSCRAPER_API_KEY missing from .env')
    parts = [('query', q) for q in queries] + [('limit', str(limit)), ('async', 'true'), ('region', 'US')]
    d = get_json('https://api.outscraper.cloud/maps/search-v3?' + urllib.parse.urlencode(parts), headers={'X-API-KEY': key}, timeout=90)
    loc = d.get('results_location') or die(f"Outscraper returned no results_location: {json.dumps(d)[:300]}")
    for _ in range(90):
        time.sleep(8); r = get_json(loc, headers={'X-API-KEY': key})
        if r.get('status') == 'Success':
            rows = []
            for b in r.get('data', []): rows.extend(b if isinstance(b, list) else [b])
            return rows
        if r.get('status') in ('Error', 'Failed'): die(f"Outscraper job failed: {json.dumps(r)[:300]}")
    die('Outscraper job timed out after 12 minutes')

def verify(phones):
    key = ENV.get('BATCHDATA_API_KEY') or die('BATCHDATA_API_KEY missing from .env')
    out = {}
    for i in range(0, len(phones), 100):
        chunk = phones[i:i+100]
        s = meter_load()
        if s['spent'] + len(chunk) * P_VERIFY > s['cap'] + 1e-9: die(f"CAP before verify chunk: {meter_line(s)} + ${len(chunk)*P_VERIFY:.2f}. Stopping cleanly; {len(out)} numbers verified so far.")
        r = get_json('https://api.batchdata.com/api/v1/phone/verification', headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', **UA}, data=json.dumps({'requests': chunk}).encode())
        for p in r.get('results', {}).get('phoneNumbers', []): out[p.get('number')] = p
        meter_charge('verify', len(chunk), P_VERIFY)
    return out

ALLOW = None
CHAIN = re.compile(r'(?i)\b(franchise|corporate|headquarters|inc\.? national|nationwide)\b')
def cmd_scrape(a):
    cities = [c.strip() for c in a.cities.split(';') if c.strip()]
    qs = [f"{a.kw}, {c}" for c in cities]
    preflight(f"scrape {len(qs)} queries × {a.limit} businesses, then verify each (${P_SCRAPE} + ${P_VERIFY})", len(qs) * a.limit, P_SCRAPE + P_VERIFY, a.go)
    rows = outscraper(qs, a.limit); meter_charge('scrape', len(rows), P_SCRAPE)
    seen, biz, drops = set(), [], Counter(); drops_unjudged = [0]
    global ALLOW
    ALLOW = re.compile(a.allow, re.I) if a.allow else re.compile('|'.join(re.escape(w) for w in a.kw.lower().replace('contractor', '').split() if len(w) > 3) or 'x^', re.I)
    for r in rows:
        p = p10(r.get('phone'))
        if not p: drops['no_phone'] += 1; continue
        if p in seen: drops['dup'] += 1; continue
        if p[:3] in TOLLFREE: drops['tollfree'] += 1; continue
        if (r.get('business_status') or 'OPERATIONAL') != 'OPERATIONAL': drops['closed'] += 1; continue
        if CHAIN.search(r.get('name') or ''): drops['chain'] += 1; continue
        hay = ' '.join(str(r.get(k) or '') for k in ('category', 'subtypes', 'name')).lower()
        if ALLOW and not ALLOW.search(hay):
            if r.get('category') or r.get('subtypes'): drops['off-category'] += 1; continue
            drops_unjudged[0] += 1   # Google gave no category — kept, counted
        seen.add(p)
        biz.append({'company': r.get('name'), 'phone': p, 'city': r.get('city'), 'state': r.get('state_code'), 'street': r.get('street'), 'zip': r.get('postal_code'),
                    'rating': r.get('rating'), 'reviews': r.get('reviews'), 'maps': f"https://www.google.com/maps/place/?q=place_id:{r.get('place_id')}" if r.get('place_id') else '',
                    'website': r.get('website'), 'category': r.get('category'), 'owner_first': '', 'owner_last': '', 'email': '', 'lane': 'A'})
    print(f"  scraped {len(rows)} · kept {len(biz)} · dropped {dict(drops)} · kept-without-category {drops_unjudged[0]} (allowlist: /{ALLOW.pattern}/)")
    if not biz: die('nothing to verify')
    v = verify([b['phone'] for b in biz]); mob = 0
    miss = [b['phone'] for b in biz if b['phone'] not in v]
    if miss: print(f"  NOTE: BatchData returned no record for {len(miss)} numbers (charged, treated as not mobile): {miss[:5]}")
    for b in biz:
        x = v.get(b['phone'], {}); b['type'] = x.get('type'); b['dnc'] = bool(x.get('dnc')); b['tcpa'] = bool(x.get('tcpa')); b['carrier'] = x.get('carrier')
        b['clean'] = (b['type'] or '').lower() == 'mobile' and not b['dnc'] and not b['tcpa']; mob += (b['type'] or '').lower() == 'mobile'
    cl = sum(b['clean'] for b in biz)
    print(f"RESULT {a.tag}: {len(biz)} verified → {mob} mobile ({mob/len(biz)*100:.0f}%) → {cl} clean ({cl/len(biz)*100:.0f}%)")
    save(a.tag, 'traced', biz)

# ---------------------------------------------------------------- names (free)
def split_name(s, fmt):
    s = (s or '').strip()
    if fmt == 'last_first':
        last, _, rest = s.partition(','); first = (rest.split() or [''])[0]
    else:
        t = s.split(); first, last = (t[0], t[-1]) if len(t) >= 2 else ('', s)
        if last.upper() in ('JR', 'SR', 'II', 'III', 'IV') and len(t) >= 3: last = t[-2]
    return first.title(), last.title()

def cmd_names(a):
    out = []
    st = (a.state or '').upper(); city = (a.city or '').upper()
    if a.source == 'fl_re':
        for rgn in (a.region or '1,2,3,4,5,6,7').split(','):
            path = os.path.join(WORK, f'RE_rgn{rgn}.csv')
            if not os.path.exists(path): download(f'https://www2.myfloridalicense.com/sto/file_download/extracts/RE_rgn{rgn}.csv', path)
            for r in csv.reader(open(path, encoding='latin-1')):
                if len(r) < 22 or r[4] != 'BK Broker' or r[14] != 'Current' or r[15] != 'Active' or r[9] != 'FL' or ',' not in r[2]: continue
                if a.pm and not re.search(r'(?i)property m|rental|leasing|mgmt|management', r[21]): continue
                if city and r[8].upper() != city: continue
                f, l = split_name(r[2], 'last_first')
                out.append({'first': f, 'last': l, 'company': r[21], 'street': r[5], 'city': r[8].title(), 'state': 'FL', 'zip': r[10][:5], 'source': 'FL DBPR'})
    elif a.source == 'fl_cpa':
        import openpyxl
        path = os.path.join(WORK, 'fl_cpa.xlsx')
        if not os.path.exists(path):
            page = urllib.request.urlopen(urllib.request.Request('https://www2.myfloridalicense.com/certified-public-accounting/public-records/', headers=UA), timeout=60).read().decode('utf8', 'ignore') if not os.path.exists('/home/claude/fl_cpa.xlsx') else ''
            if os.path.exists('/home/claude/fl_cpa.xlsx'): import shutil; shutil.copy('/home/claude/fl_cpa.xlsx', path)
            if not os.path.exists(path):
                m = re.search(r'https://www2\.myfloridalicense\.com/cpa/licensereports/cpalicensedata\d+\.xlsx', page) or die('FL CPA xlsx link not found on public-records page')
                download(m.group(0), path)
        ws = openpyxl.load_workbook(path, read_only=True)['CPAs (0101)']
        for r in ws.iter_rows(values_only=True):
            if r[0] != '0101' or r[13] != 'Current' or r[10] != 'FL' or not r[6]: continue
            if city and str(r[9]).upper() != city: continue
            f, l = split_name(r[5], 'last_first')
            out.append({'first': f, 'last': l, 'company': '', 'street': str(r[6]), 'city': str(r[9]).title(), 'state': 'FL', 'zip': str(r[11])[:5], 'source': 'FL DBPR CPA'})
    elif a.source == 'tx_trec':
        path = os.path.join(WORK, 'trec.csv')
        if not os.path.exists(path): download('https://data.texas.gov/api/views/s7ft-44qi/rows.csv?accessType=DOWNLOAD', path)
        for r in csv.DictReader(open(path)):
            if r['License Type'] != 'Broker Individual' or r['Status'] != 'Active' or not r['First Name']: continue
            if a.county and r['County'].upper() != a.county.upper(): continue
            out.append({'first': r['First Name'].title(), 'last': r['Last Name'].title(), 'company': r.get('Related License Full Name', ''), 'city': '', 'state': 'TX', 'county': r['County'], 'source': 'TREC'})
    elif a.source == 'az_adre':
        path = os.path.join(WORK, 'adre.csv')
        if not os.path.exists(path): download('https://services.azre.gov/PdbWeb/List/DownloadList/1', path)
        for r in csv.DictReader(open(path, encoding='latin-1')):
            if r['LicType'].strip() != 'Broker' or r['LicStatus'].strip() != 'Active' or not r['FirstName'].strip(): continue
            if a.county and r['MailingCounty'].strip().upper() != a.county.upper(): continue
            out.append({'first': r['FirstName'].strip().title(), 'last': r['LastName'].strip().title(), 'company': r['EmployerLegalName'], 'city': r['MailingCity'].title(), 'state': 'AZ', 'county': r['MailingCounty'].strip(), 'source': 'ADRE'})
    elif a.source == 'il_idfpr':
        desc = {'cpa': 'LICENSED CERTIFIED PUBLIC ACCOUNTANT', 'realtor': 'LICENSED REAL ESTATE MANAGING BROKER'}.get(a.industry, a.industry)
        w = f"license_status='ACTIVE' AND business='N' AND description='{desc}'" + (f" AND county='{a.county.upper()}'" if a.county else '')
        d = get_json('https://illinois-edp.data.socrata.com/resource/pzzh-kp68.json?' + urllib.parse.urlencode({'$where': w, '$limit': a.n * 5}))
        for r in d:
            if r.get('first_name') and r.get('last_name'):
                out.append({'first': r['first_name'].split()[0].title(), 'last': r['last_name'].title(), 'company': '', 'city': (r.get('city') or '').title(), 'state': 'IL', 'county': r.get('county', ''), 'source': 'IDFPR'})
    elif a.source == 'pa_pals':
        prof = {'realtor': 'Real Estate Commission', 'cpa': 'Accountancy'}.get(a.industry, a.industry)
        seen = set()
        for last in (a.surnames or 'Smith,Johnson,Williams,Brown,Jones,Davis,Miller,Wilson,Nguyen,Cohen,Rodriguez,Kim,Green,Thomas,Jackson,Lee,Patel,Martinez,Garcia,Anderson').split(','):
            for page in range(1, 8):
                body = json.dumps({'OptPersonFacility': 'Person', 'LastName': last, 'FirstName': '', 'IsFacility': 0, 'State': 'Pennsylvania', 'County': a.county or '', 'PageNo': page}).encode()
                try: rs = json.load(urllib.request.urlopen(urllib.request.Request('https://www.pals.pa.gov/api/Search/SearchForPersonOrFacilty', data=body, headers={'Content-Type': 'application/json', **UA}), timeout=30))
                except Exception: break
                if not rs: break
                for r in rs:
                    if r.get('ProfessionType') == prof and r.get('Status') == 'Active' and r.get('FirstName') and r['LicenseNumber'] not in seen:
                        seen.add(r['LicenseNumber'])
                        out.append({'first': r['FirstName'].title(), 'last': r['LastName'].title(), 'company': '', 'city': (r.get('City') or '').title(), 'state': 'PA', 'county': r.get('County', ''), 'phone': p10(r.get('PhoneNo1')), 'email': r.get('Emailid1') or '', 'source': 'PALS'})
                if rs[0].get('TotalRecords', 0) <= page * 50: break
    elif a.source == 'nppes':
        OWN = re.compile(r'owner|president|partner|principal|ceo|founder|medical director|dds|dmd|dentist|doctor|chiropract|physician|director', re.I)
        BAD = re.compile(r'office manager|practice manager|business manager|credential|billing|administrator|coordinator|bookkeep|consultant|accountant', re.I)
        pats = [a.orgname] if a.orgname else [None]
        if a.industry == 'medspa' and not a.orgname: pats = ['*med spa*', '*medspa*', '*aesthetic*', '*laser*', '*rejuven*', '*glow*', '*botox*', '*skin*']
        for pat in pats:
            for skip in range(0, 1000, 200):
                q = {'version': '2.1', 'enumeration_type': 'NPI-2', 'state': st, 'limit': 200, 'skip': skip}
                if city: q['city'] = city
                if pat: q['organization_name'] = pat
                elif a.taxonomy: q['taxonomy_description'] = a.taxonomy
                d = get_json('https://npiregistry.cms.hhs.gov/api/?' + urllib.parse.urlencode(q)); rs = d.get('results', [])
                for r in rs:
                    b = r.get('basic', {}); t = b.get('authorized_official_title_or_position') or ''
                    if not OWN.search(t) or BAD.search(t) or not b.get('authorized_official_first_name'): continue
                    loc = [x for x in r.get('addresses', []) if x.get('address_purpose') == 'LOCATION']
                    out.append({'first': b['authorized_official_first_name'].title(), 'last': b['authorized_official_last_name'].title(), 'company': b.get('organization_name', ''), 'title': t, 'city': (loc[0]['city'] if loc else city).title(), 'state': st, 'source': 'NPPES'})
                if len(rs) < 200: break
    elif a.source == 'firms':
        # attorney-style: scraped firms (traced_<tag>.json from scrape) → surname in firm name → first name from website
        import html as H, concurrent.futures as cf
        STOP = set('law office offices of the firm group associates injury personal attorney attorneys lawyers lawyer at and inc pc pllc pa llp llc accident car auto trial legal counsel partners ltd cpa cpas accounting tax advisors financial solutions consulting services company co realty property management'.split())
        biz = json.load(open(a.inp))
        def work(b):
            toks = [t for t in re.findall(r"[A-Za-z'’]+", re.sub(r'[-:|].*$', '', b['company'] or '')) if t.lower() not in STOP and len(t) > 2 and t[0].isupper()]
            if not toks or not b.get('website'): return []
            try: txt = H.unescape(re.sub(r'<[^>]+>', ' ', urllib.request.urlopen(urllib.request.Request(b['website'], headers=UA), timeout=10).read(400000).decode('utf8', 'ignore')))
            except Exception: return []
            res = []
            for s in toks:
                m = [x for x in re.findall(r'\b([A-Z][a-z]{2,})\s+(?:[A-Z]\.?\s+)?' + re.escape(s) + r'\b', txt) if x.lower() not in STOP and x not in ('Attorney','Contact','About','Meet','Call','Why','Our','The','Choose','Choosing','Reviews','Insurance')]
                if m: res.append({'first': Counter(m).most_common(1)[0][0], 'last': s, 'company': b['company'], 'city': b['city'], 'state': b['state'], 'source': 'firm site'})
            return res
        with cf.ThreadPoolExecutor(12) as ex:
            for r in ex.map(work, biz): out += r
    else:
        die(f'unknown source {a.source}')
    seen = set(); uniq = []
    for n in out:
        k = (n['first'].upper(), n['last'].upper(), (n.get('city') or '').upper())
        if n['first'] and n['last'] and k not in seen: seen.add(k); uniq.append(n)
    random.seed(a.seed); random.shuffle(uniq); uniq = uniq[:a.n]
    print(f"NAMES {a.tag}: {len(uniq)} unique owner names from {a.source}" + (" — these already carry a HOME street address; skip `parcel`, go to `trace`." if a.source in ('fl_re', 'fl_cpa') else ("" if a.source != 'pa_pals' else f" — {sum(1 for n in uniq if n.get('phone'))} carry a phone: verify those directly (Recipe C).")))
    save(a.tag, 'names', uniq)

# ---------------------------------------------------------------- parcel (free) — name → home address
PARCEL = {
 'NC': {'url': 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0', 'fields': 'ownname,siteadd,scity,szip,parusecode', 'where': lambda f, l: f"ownname LIKE '%{l}%' AND ownname LIKE '%{f}%'", 'name': 'ownname', 'street': 'siteadd', 'city': 'scity', 'zip': 'szip'},
 'FL': {'url': 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0', 'fields': 'OWN_NAME,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,OWN_ADDR1,OWN_CITY,OWN_ZIPCD', 'where': lambda f, l: f"OWN_NAME LIKE '{l} {f}%'", 'name': 'OWN_NAME', 'street': 'PHY_ADDR1', 'city': 'PHY_CITY', 'zip': 'PHY_ZIPCD'},
 'AZ': {'url': 'https://services.arcgis.com/ykpntM6e3tHvzKRJ/arcgis/rest/services/Parcel_Data_View/FeatureServer/0', 'fields': 'OwnerName,OwnerAddressLine1,OwnerCity,OwnerState,OwnerZipCode', 'where': lambda f, l: f"OwnerName LIKE '{l} {f}%' AND PropertyUseDescription LIKE 'SFR%'", 'name': 'OwnerName', 'street': 'OwnerAddressLine1', 'city': 'OwnerCity', 'zip': 'OwnerZipCode'},
 'TX': {'url': 'https://services1.arcgis.com/7DRakJXKPEhwv0fM/arcgis/rest/services/stratmap25_landparcels_48453_travis_202508/FeatureServer/0', 'fields': 'OWNER_NAME,MAIL_LINE1,MAIL_CITY,MAIL_ZIP', 'where': lambda f, l: f"OWNER_NAME LIKE '{l} {f}%'", 'name': 'OWNER_NAME', 'street': 'MAIL_LINE1', 'city': 'MAIL_CITY', 'zip': 'MAIL_ZIP'},
 'GA': {'url': 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/arcgis/rest/services/Tax_Parcels/FeatureServer/0', 'fields': 'Owner,OwnerAddr1,OwnerAddr2,Address', 'where': lambda f, l: f"Owner LIKE '{l} {f}%'", 'name': 'Owner', 'street': 'OwnerAddr1', 'city': 'OwnerAddr2', 'zip': 'OwnerAddr2'},
 'TN': {'url': 'https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0', 'fields': 'Owner,OwnAddr1,OwnCity,OwnZip', 'where': lambda f, l: f"Owner LIKE '{l} {f}%'", 'name': 'Owner', 'street': 'OwnAddr1', 'city': 'OwnCity', 'zip': 'OwnZip'},
 'WA': {'url': 'https://services6.arcgis.com/z6WYi9VRHfgwgtyW/arcgis/rest/services/Parcels/FeatureServer/0', 'fields': 'OWNERNAME,OWNERLINE1,OWNERCITY,OWNERZIP', 'where': lambda f, l: f"OWNERNAME LIKE '{l} {f}%'", 'name': 'OWNERNAME', 'street': 'OWNERLINE1', 'city': 'OWNERCITY', 'zip': 'OWNERZIP'},
}
def parcel_lookup(n, state):
    f, l = n['first'].upper().replace("'", "''"), n['last'].upper().replace("'", "''")
    if state == 'TX' and os.path.exists(os.path.join(WORK, 'hcad_index.json')):
        hits = HCAD.get(f"{l}|{f}", [])
        return hits
    if state == 'IL':
        d = get_json('https://datacatalog.cookcountyil.gov/resource/3723-97qp.json?' + urllib.parse.urlencode({'$where': f"year='2025' AND owner_address_name like '{f}%{l}'", '$limit': 3, '$select': 'owner_address_name,owner_address_full,owner_address_city_name,owner_address_zipcode_1,prop_address_full'}))
        return [{'owner': x['owner_address_name'], 'street': x.get('owner_address_full'), 'city': x.get('owner_address_city_name'), 'zip': (x.get('owner_address_zipcode_1') or '')[:5]} for x in d if x.get('prop_address_full') and x.get('owner_address_full') and x['prop_address_full'].split()[0] == x['owner_address_full'].split()[0]]
    if state == 'PA':
        q = f"SELECT owner_1,location,zip_code FROM opa_properties_public WHERE owner_1 LIKE '{l} {f}%' AND (mailing_street IS NULL OR mailing_street=location) LIMIT 3"
        d = get_json('https://phl.carto.com/api/v2/sql?' + urllib.parse.urlencode({'q': q})).get('rows', [])
        return [{'owner': x['owner_1'], 'street': x['location'], 'city': 'Philadelphia', 'zip': (x.get('zip_code') or '')[:5]} for x in d]
    P = PARCEL.get(state) or die(f'no parcel source for {state} — Lane A only there')
    r = arcgis(P['url'], P['where'](f, l), P['fields'], 5)
    if r is None: return None
    out = []
    for x in r:
        o = (x.get(P['name']) or '').upper()
        if re.search(r'TRUST|LLC|INC\b|CORP', o): continue
        st = (x.get(P['street']) or '').strip(); city = (x.get(P['city']) or '').strip()
        if state == 'NC' and city: st = re.sub(rf'\s*,?\s*{re.escape(city.upper())}\s+NC$', '', st, flags=re.I); st = re.sub(r',.*$', '', st)
        if state == 'GA':
            m = re.match(r'^(.*?)\s+GA\s+(\d{5})', city or ''); city, z = (m.group(1), m.group(2)) if m else (city, '')
        z = str(x.get(P['zip']) or '')[:5] if state != 'GA' else z
        out.append({'owner': x.get(P['name']), 'street': st, 'city': city.title(), 'zip': z})
    return out

HCAD = {}
def hcad_index():
    """Build a LAST|FIRST → owner-occupied home index from HCAD real_acct.txt if present (Harris County TX)."""
    idx_p = os.path.join(WORK, 'hcad_index.json')
    if os.path.exists(idx_p): HCAD.update(json.load(open(idx_p))); return
    src = next((p for p in [os.path.join(WORK, 'real_acct.txt'), '/root/leadlist/states/tx/real_acct.txt'] if os.path.exists(p)), None)
    if not src: return
    print('  indexing HCAD (one-time, ~2 min)…', flush=True)
    idx = defaultdict(list)
    with open(src, encoding='latin-1') as f:
        H = {h: i for i, h in enumerate(f.readline().rstrip('\n').split('\t'))}
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < len(H) or c[H['state_class']] != 'A1' or c[H['mail_addr_1']] != c[H['site_addr_1']]: continue
            t = c[H['mailto']].replace('&', ' ').split()
            if len(t) < 2: continue
            idx[f"{t[0]}|{t[1]}"].append({'owner': c[H['mailto']], 'street': c[H['mail_addr_1']], 'city': c[H['mail_city']].title(), 'zip': c[H['mail_zip']][:5]})
    json.dump(idx, open(idx_p, 'w')); HCAD.update(idx)

def cmd_parcel(a):
    import concurrent.futures as cf
    names = json.load(open(a.inp)); st = a.state.upper()
    if st == 'TX': hcad_index()
    fails = [0]
    def one(n):
        if fails[0] >= 3: return None
        hits = parcel_lookup(n, st)
        if hits is None: fails[0] += 1; return None
        hits = [h for h in hits if street_ok(h['street'])]
        # name must actually match the owner string in LAST FIRST or FIRST LAST order (not just contain both tokens)
        f, l = n['first'].upper(), n['last'].upper()
        hits = [h for h in hits if re.search(rf"\b{re.escape(l)}\b[, ]+(?:[A-Z]+ )?{re.escape(f)}\w*", (h['owner'] or '').upper()) or re.search(rf"\b{re.escape(f)}\b[A-Z ]*\b{re.escape(l)}\b", (h['owner'] or '').upper())]
        owners = {re.sub(r'[^A-Z]', '', (h['owner'] or '').upper())[:12] for h in hits}
        if not hits or len(owners) != 1: return None   # zero, or two different people → skip
        h = hits[0]; return dict(n, street=h['street'], city=h['city'] or n.get('city', ''), state=st, zip=h['zip'], owner=h['owner'])
    with cf.ThreadPoolExecutor(6) as ex: picks = [p for p in ex.map(one, names) if p]
    if fails[0] >= 3: die(f'{st} parcel endpoint failed/timed out 3 times — stopping (no retry loop). Try again later or use another county.')
    print(f"PARCEL {a.tag}: {len(picks)} of {len(names)} names resolved to exactly one home ({len(picks)/max(len(names),1)*100:.0f}%)")
    picks = show_addresses(picks); save(a.tag, 'picks', picks)

# ---------------------------------------------------------------- investors / developers (Lane C)
def cmd_investors(a):
    P = PARCEL.get(a.state.upper()) or die('no parcel source for that state')
    st = a.state.upper()
    if st != 'NC': die('investors grouping is implemented for NC statewide; other states: pull the county file and group locally (see master prompt Lane C).')
    p = {'where': f"cntyname = '{a.county}' AND ownname IS NOT NULL", 'outStatistics': json.dumps([{'statisticType': 'count', 'onStatisticField': 'parno', 'outStatisticFieldName': 'n'}]), 'groupByFieldsForStatistics': 'ownname,mailadd,mcity', 'having': f'COUNT(parno) >= {a.min} AND COUNT(parno) <= {a.max}', 'orderByFields': 'n DESC', 'f': 'json', 'resultRecordCount': 2000}
    d = get_json(P['url'] + '/query?' + urllib.parse.urlencode(p), timeout=150)
    BAD = re.compile(r'LLC|INC\b|TRUST|ASSOC|CHURCH|CITY|COUNTY|BANK|CORP|\bLP\b|\bL P\b|LTD|PARTNERS|HOMES|PROPERTIES|HOLDINGS|GROUP|COMPANY|\bCO\b|DEVELOPMENT|INVEST|CAPITAL|HOUSING|AUTHORITY|STATE|BOARD|SCHOOL|HOA|ASSN|MINISTR|FOUNDATION|VENTURES|REALTY|ENTERPRISES|FUND|ESTATES|BUILDERS|CONSTRUCTION|RENTALS|MANAGEMENT|PARTNERSHIP|CAROLINA|UNIVERSITY|HOSPITAL|COMMUNITY|\bLAND\b|DEPARTMENT|DEPT|TOWN OF|APARTMENTS|ET AL|ETAL|&')
    out = []
    for r in [x['attributes'] for x in d.get('features', [])]:
        o = (r.get('ownname') or '').strip(); m = (r.get('mailadd') or '').strip()
        if not o or BAD.search(o.upper()) or not re.match(r'^[A-Z][A-Z\-\']+ [A-Z\. ]*[A-Z][A-Z\-\']+$', o): continue
        mm = re.match(r'^(.*?)\s+(\d{5})(?:-\d{4})?\s*$', m); street = mm.group(1) if mm else m; z = mm.group(2) if mm else ''
        if not street_ok(street) or (z and not z.startswith('2')): continue
        t = o.split(); first, last = t[0], t[-1]
        if last in ('JR', 'SR', 'II', 'III'): last = t[-2]
        out.append({'first': first.title(), 'last': last.title(), 'company': f'{r["n"]} properties', 'street': street, 'city': (r.get('mcity') or '').title(), 'state': st, 'zip': z, 'owner': o, 'properties': r['n'], 'source': 'parcels'})
    random.seed(a.seed); random.shuffle(out); out = out[:a.n]
    print(f"INVESTORS {a.tag}: {len(out)} individual owners with {a.min}-{a.max} properties in {a.county}")
    out = show_addresses(out); save(a.tag, 'picks', out)

# ---------------------------------------------------------------- trace (Lane B/C/D-2, paid)
def cmd_trace(a):
    picks = json.load(open(a.inp)); picks = show_addresses(picks)
    key = ENV.get('BATCHDATA_API_KEY') or die('BATCHDATA_API_KEY missing')
    # Recipe C shortcut: names that already carry a phone get verified, not traced
    withphone = [p for p in picks if p.get('phone')]; totrace = [p for p in picks if not p.get('phone')]
    preflight(f"trace {len(totrace)} + verify {len(withphone)}", len(totrace), P_TRACE, a.go) if totrace else preflight(f"verify {len(withphone)}", len(withphone), P_VERIFY, a.go)
    if withphone:
        v = verify([p['phone'] for p in withphone])
        for p in withphone:
            x = v.get(p['phone'], {}); p['type'] = x.get('type'); p['dnc'] = bool(x.get('dnc')); p['tcpa'] = bool(x.get('tcpa')); p['lane'] = 'C-registry'
    for i in range(0, len(totrace), 50):
        chunk = totrace[i:i+50]
        reqs = [{'propertyAddress': {'street': p['street'], 'city': p['city'], 'state': p['state'], 'zip': p.get('zip', '')}, 'name': {'first': p['first'], 'last': p['last']}} for p in chunk]
        s = meter_load()
        if s['spent'] + len(chunk) * P_TRACE > s['cap'] + 1e-9: die(f"CAP before trace chunk: {meter_line(s)} + ${len(chunk)*P_TRACE:.2f}. Stopping cleanly; {i} traced so far (saved).")
        r = get_json('https://api.batchdata.com/api/v1/property/skip-trace', headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', **UA}, data=json.dumps({'requests': reqs}).encode())
        meter_charge('skip trace', len(chunk), P_TRACE)
        for p, res in zip(chunk, r['results']['persons']):
            ph = sorted(res.get('phoneNumbers', []), key=lambda x: -(x.get('score') or 0))
            mob = [x for x in ph if (x.get('type') or '').lower() == 'mobile']
            best = next((x for x in mob if not x.get('dnc') and not x.get('tcpa')), mob[0] if mob else None)
            p['phone'] = best.get('number') if best else ''; p['type'] = best.get('type') if best else (ph[0].get('type') if ph else None)
            p['dnc'] = bool(best.get('dnc')) if best else False; p['tcpa'] = bool(best.get('tcpa')) if best else False
            em = res.get('emails') or []; p['email'] = (em[0].get('email') if isinstance(em[0], dict) else em[0]) if em else ''
            p['lane'] = 'B'
    for p in picks:
        p['company'] = p.get('company') or ''; p['owner_first'] = p['first']; p['owner_last'] = p['last']; p['maps'] = ''; p['rating'] = ''; p['reviews'] = ''
        p['clean'] = (p.get('type') or '').lower() == 'mobile' and not p.get('dnc') and not p.get('tcpa')
    n = len(picks); mob = sum((p.get('type') or '').lower() == 'mobile' for p in picks); cl = sum(p['clean'] for p in picks)
    print(f"RESULT {a.tag}: {n} traced → {mob} mobile ({mob/n*100:.0f}%) → {cl} clean ({cl/n*100:.0f}%)")
    save(a.tag, 'traced', picks)

# ---------------------------------------------------------------- deliver
def cmd_deliver(a):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    rows = []
    for p in a.inp: rows += json.load(open(p))
    prior = set()
    for mp in [a.master, '/mnt/user-data/outputs/MASTER - all owner cells.csv']:
        if mp and os.path.exists(mp):
            for r in csv.DictReader(open(mp, encoding='utf-8')):
                d = p10(r.get('Cell Phone', ''));
                if d: prior.add(d)
    HDR = ['#', 'Cell Phone', 'Company', 'Google Maps Link', 'Rating', 'Reviews', 'City', 'State', 'Time Zone', 'Owner Name', 'Email', 'Status', 'Called', 'Outcome', 'Notes']
    seen, out, dropped = set(), [], Counter()
    for r in rows:
        ph = r.get('phone')
        if not ph or (r.get('type') or '').lower() != 'mobile': dropped['not mobile'] += 1; continue
        if r.get('tcpa'): dropped['litigator'] += 1; continue
        if r.get('dnc') and a.dnc == 'strict': dropped['dnc'] += 1; continue
        if ph in seen: dropped['dup'] += 1; continue
        if ph in prior: dropped['already delivered'] += 1; continue
        seen.add(ph)
        status = 'DNC — cell, do not cold call' if r.get('dnc') else 'CALLABLE — cell, not DNC, not litigator'
        out.append([f"({ph[:3]}) {ph[3:6]}-{ph[6:]}", r.get('company') or '', r.get('maps') or '', r.get('rating') or '', r.get('reviews') or '', r.get('city') or '', r.get('state') or '', tz(r.get('state'), r.get('city')), (f"{r.get('owner_first','')} {r.get('owner_last','')}").strip(), r.get('email') or '', status, '', '', ''])
    out.sort(key=lambda r: (r[10].startswith('DNC'), r[6], -(r[4] or 0) if isinstance(r[4], (int, float)) else 0))
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'List'
    HF = PatternFill('solid', fgColor='1F3864'); ws.append(HDR)
    for c in ws[1]: c.fill = HF; c.font = Font(name='Arial', size=10, bold=True, color='FFFFFF'); c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    for i, r in enumerate(out, 1): ws.append([i] + r)
    for row in ws.iter_rows(min_row=2):
        for c in row: c.font = Font(name='Arial', size=10)
    ws.freeze_panes = 'A2'
    if out: ws.auto_filter.ref = f"A1:{get_column_letter(len(HDR))}{len(out)+1}"
    for i, w in enumerate([5, 15, 34, 30, 7, 8, 16, 6, 10, 22, 26, 34, 10, 14, 30], 1): ws.column_dimensions[get_column_letter(i)].width = w
    s = meter_load(); cl = sum(1 for r in out if r[10].startswith('CALLABLE'))
    sm = wb.create_sheet('Summary')
    for line in [(a.name, ''), ('Built', time.strftime('%Y-%m-%d')), ('Records in', len(rows)), ('Delivered', len(out)), ('  callable (cell, not DNC)', cl), ('  DNC-flagged (flag mode)', len(out) - cl), ('Dropped', json.dumps(dict(dropped))), ('Yield (callable / records in)', f"{cl/max(len(rows),1)*100:.0f}%"), ('Spend this run', f"${s['spent']:.2f} of ${s['cap']:.2f} cap"), ('Cost per callable cell', f"${s['spent']/max(cl,1):.3f}"), ('DNC scrub date', time.strftime('%Y-%m-%d') + ' — re-scrub every 31 days')]: sm.append(list(line))
    lg = wb.create_sheet('Legal Notes')
    for line in ['DNC and litigator scrub accurate on the build date above. Re-scrub every 31 days.', 'Manual dialling only. No autodialer, predictive dialer, prerecorded message or ringless voicemail.', 'Call 8am–9pm in the recipient\'s time zone (use the Time Zone column).', 'Many of these are owners\' personal cells; sole proprietors count as residential subscribers for DNC purposes (Chennette v. Porch.com, 9th Cir. 2022). Have counsel sign off on the calling workflow before volume.', 'Identify yourself and your company. Keep an internal do-not-call list; honour opt-outs immediately and permanently.', 'No cold texting.', 'Rows marked DNC (flag mode only) are for email / ad retargeting, not cold calls.']: lg.append([line])
    lg.column_dimensions['A'].width = 120
    outp = os.path.join(a.outdir, f"{a.name}.xlsx"); os.makedirs(a.outdir, exist_ok=True); wb.save(outp)
    print(f"DELIVERED {outp}: {len(out)} rows ({cl} callable) · dropped {dict(dropped)} · {meter_line(s)}")

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sub = ap.add_subparsers(dest='cmd', required=True)
    m = sub.add_parser('meter'); m.add_argument('--cap', type=float); m.add_argument('--reset', action='store_true'); m.add_argument('--new', metavar='JOB', help='start a fresh meter for a new job (archives the old one as spend_<JOB>.json)')
    s = sub.add_parser('scrape'); s.add_argument('--tag', required=True); s.add_argument('--kw', required=True); s.add_argument('--cities', required=True); s.add_argument('--limit', type=int, default=40); s.add_argument('--go', action='store_true'); s.add_argument('--allow', help='regex; row must match on category/subtypes/name (default: words of --kw)')
    n = sub.add_parser('names'); n.add_argument('--tag', required=True); n.add_argument('--source', required=True); n.add_argument('--state'); n.add_argument('--city'); n.add_argument('--county'); n.add_argument('--industry'); n.add_argument('--taxonomy'); n.add_argument('--orgname'); n.add_argument('--region'); n.add_argument('--pm', action='store_true'); n.add_argument('--surnames'); n.add_argument('--in', dest='inp'); n.add_argument('--n', type=int, default=200); n.add_argument('--seed', type=int, default=1)
    p = sub.add_parser('parcel'); p.add_argument('--tag', required=True); p.add_argument('--in', dest='inp', required=True); p.add_argument('--state', required=True)
    i = sub.add_parser('investors'); i.add_argument('--tag', required=True); i.add_argument('--state', required=True); i.add_argument('--county', required=True); i.add_argument('--min', type=int, default=3); i.add_argument('--max', type=int, default=8); i.add_argument('--n', type=int, default=100); i.add_argument('--seed', type=int, default=1)
    t = sub.add_parser('trace'); t.add_argument('--tag', required=True); t.add_argument('--in', dest='inp', required=True); t.add_argument('--go', action='store_true')
    d = sub.add_parser('deliver'); d.add_argument('--name', required=True); d.add_argument('--in', dest='inp', nargs='+', required=True); d.add_argument('--dnc', choices=['strict', 'flag'], default='strict'); d.add_argument('--master'); d.add_argument('--outdir', default='/mnt/user-data/outputs')
    a = ap.parse_args()
    if a.cmd == 'meter':
        if a.new and os.path.exists(SPEND):
            os.replace(SPEND, os.path.join(WORK, f"spend_{re.sub(r'[^A-Za-z0-9]+','_',a.new)}_{time.strftime('%Y%m%d%H%M')}.json")); print(f"  archived previous meter; new job: {a.new}")
        s = meter_load()
        if a.reset: s = {'cap': s['cap'], 'spent': 0.0, 'log': []}
        if a.cap is not None: s['cap'] = a.cap
        json.dump(s, open(SPEND, 'w'), indent=1); print(meter_line(s))
        for l in s['log'][-10:]: print(f"   {l['ts']}  {l['step']:<12} n={l['n']:<5} ${l['cost']:.2f}")
    else: globals()['cmd_' + a.cmd](a)

if __name__ == '__main__': main()
