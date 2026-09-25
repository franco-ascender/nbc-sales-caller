#!/usr/bin/env python3
"""Build src/data/lead-engine-zip-timezones.json from the free GeoNames US postal file.

Source: https://download.geonames.org/export/zip/US.zip (CC BY 4.0). Columns: country, zip, place,
state, state_code, county, county_code, ..., lat, lon, accuracy. Time zones come from the state,
with the split states resolved by county (the split lines follow county borders except where noted)
and a handful of ZIP-level exceptions. Output: every 3-digit prefix whose ZIPs share one zone is stored
once; prefixes that straddle a line are stored ZIP by ZIP. Compact and auditable.

Usage: python3 scripts/lead-engine-zip-timezones.py path/to/US.txt
"""
import json, sys
from collections import defaultdict

E, C, M, P, AZ, AK, HI, ADAK = ('America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                                 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Adak')
STATE = {**{s: E for s in 'CT DE DC GA ME MD MA NH NJ NY NC OH PA RI SC VT VA WV FL MI IN KY'.split()},
         **{s: C for s in 'AL AR IL IA LA MN MS MO OK WI TX KS NE ND SD TN'.split()},
         **{s: M for s in 'CO MT NM UT WY ID'.split()},
         'AZ': AZ, 'CA': P, 'WA': P, 'OR': P, 'NV': P, 'HI': HI, 'AK': AK}
# County -> zone, only where the county differs from the state default above.
COUNTY = {
    'FL': {c: C for c in 'Escambia|Santa Rosa|Okaloosa|Walton|Holmes|Washington|Bay|Jackson|Calhoun'.split('|')},
    'TX': {'El Paso': M, 'Hudspeth': M},
    'TN': {c: E for c in 'Anderson|Bledsoe|Blount|Bradley|Campbell|Carter|Claiborne|Cocke|Grainger|Greene|Hamblen|Hamilton|Hancock|Hawkins|Jefferson|Johnson|Knox|Loudon|McMinn|Meigs|Monroe|Morgan|Polk|Rhea|Roane|Scott|Sevier|Sullivan|Unicoi|Union|Washington'.split('|')},
    'KY': {c: C for c in 'Adair|Allen|Ballard|Barren|Breckinridge|Butler|Caldwell|Calloway|Carlisle|Christian|Clinton|Crittenden|Cumberland|Daviess|Edmonson|Fulton|Graves|Grayson|Green|Hancock|Hart|Henderson|Hickman|Hopkins|Livingston|Logan|Lyon|Marshall|McCracken|McLean|Metcalfe|Monroe|Muhlenberg|Ohio|Russell|Simpson|Todd|Trigg|Union|Warren|Webster'.split('|')},
    'IN': {c: C for c in 'Gibson|Jasper|Lake|LaPorte|Newton|Perry|Porter|Posey|Spencer|Starke|Vanderburgh|Warrick'.split('|')},
    'MI': {c: C for c in 'Gogebic|Iron|Dickinson|Menominee'.split('|')},
    'ND': {c: M for c in 'Adams|Billings|Bowman|Golden Valley|Grant|Hettinger|Slope|Stark|Dunn|Sioux'.split('|')},
    'SD': {c: M for c in 'Bennett|Butte|Corson|Custer|Dewey|Fall River|Haakon|Harding|Jackson|Lawrence|Meade|Mellette|Oglala Lakota|Shannon|Pennington|Perkins|Todd|Ziebach'.split('|')},
    'NE': {c: M for c in 'Arthur|Banner|Box Butte|Chase|Cheyenne|Dawes|Deuel|Dundy|Garden|Grant|Hooker|Keith|Kimball|Morrill|Perkins|Scotts Bluff|Sheridan|Sioux'.split('|')},
    'KS': {c: M for c in 'Greeley|Hamilton|Sherman|Wallace'.split('|')},
    'ID': {c: P for c in 'Benewah|Bonner|Boundary|Clearwater|Kootenai|Latah|Lewis|Nez Perce|Shoshone'.split('|')},
    'OR': {'Malheur': M},
}
# ZIP-level exceptions: places on the "other" side of their county's line.
ZIP = {'32465': C,                     # Wewahitchka, north Gulf County FL (Port St. Joe stays Eastern)
       '89883': M, '89825': M,         # West Wendover and Jackpot NV keep Mountain with Utah/Idaho
       '99546': ADAK, '99547': ADAK}   # Adak and Atka AK

def zone(state, county, zip5):
    if zip5 in ZIP: return ZIP[zip5]
    return COUNTY.get(state, {}).get(county) or STATE.get(state)

def main(path):
    by_zip = {}
    for line in open(path, encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        if len(f) < 6 or not f[1].isdigit() or len(f[1]) != 5: continue
        z = zone(f[4], f[5], f[1])
        if z: by_zip[f[1]] = z
    groups = defaultdict(dict)
    for z, tz in by_zip.items(): groups[z[:3]][z] = tz
    prefix, zips = {}, {}
    for p, members in sorted(groups.items()):
        zones = set(members.values())
        if len(zones) == 1: prefix[p] = zones.pop()
        else: zips.update(members)
    out = {'_about': 'ZIP to IANA time zone. Built by scripts/lead-engine-zip-timezones.py from GeoNames US.txt (CC BY 4.0). '
                     'prefix: 3-digit ZIP prefixes with a single zone. zip: full ZIPs for prefixes that straddle a zone line. '
                     'Arizona is America/Phoenix statewide (Navajo Nation DST is not modelled).',
           'zips_seen': len(by_zip), 'prefix': prefix, 'zip': dict(sorted(zips.items()))}
    json.dump(out, open('src/data/lead-engine-zip-timezones.json', 'w'), indent=0, sort_keys=False)
    print(f"zips {len(by_zip)} prefixes {len(prefix)} zip-level {len(zips)}")

if __name__ == '__main__': main(sys.argv[1])
