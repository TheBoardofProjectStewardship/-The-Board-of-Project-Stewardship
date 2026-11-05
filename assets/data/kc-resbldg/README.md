# King County residential building SF shards

Used by `assets/js/build-here.js` to autofill finished living area (`SqFtTotLiving`) when a King County address is looked up.

- Source: [King County Assessor Residential Building.zip](https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip)
- Rebuild: `python3 scripts/build_kc_resbldg_index.py`
- Files: `{Major[:2]}.json` maps full 10-digit PIN → `[living, yearBuilt, stories, firstFloor, garage]`

Do not edit shard files by hand. Refresh from the Assessor extract.
