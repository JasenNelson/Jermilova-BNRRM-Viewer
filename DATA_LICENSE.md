# Data licence and attribution

This file covers the research data in this repository: the data pack under
`public/bn-rrm/` (model, training-data summaries, review files and twelve map layers). It
also lists the map services the viewer loads at view time.

**Scope.** The Apache License 2.0 in `LICENSE` covers the software only (code, scripts,
configuration and software documentation). It does not cover the research data. The
research data and the adaptations of it in this repository are licensed under the Creative
Commons Attribution-NonCommercial-ShareAlike 4.0 International licence (CC BY-NC-SA 4.0),
https://creativecommons.org/licenses/by-nc-sa/4.0/ . The full legal code is published by
Creative Commons at that address (follow its "Legal Code" link); this repository links to it
rather than bundling a copy.

## Source dataset

The data were deposited in the Federated Research Data Repository (FRDR) by Una Jermilova
and Holger Hintelmann (Trent University). The FRDR record states the licence as "Creative
Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)", and the dataset's
README states "These data are available under a CC BY-NC-SA license".

| Version | DOI | FRDR publication date | Role here |
|---|---|---|---|
| Version 1 | https://doi.org/10.20383/103.0957 | 2024-05-28 | The version the article cites; the pack cites this one |
| Version 2 (current) | https://doi.org/10.20383/103.01279 | 2025-05-14 | Current version; FRDR records it as "a new version of" 10.20383/103.0957 |

Citation of the source version:

> Jermilova, U., and Hintelmann, H. (2024). Assessing mercury exposure to aquatic ecosystems
> of the Mackenzie watershed using a Bayesian Network analysis [Data set, Version 1].
> Federated Research Data Repository. https://doi.org/10.20383/103.0957

The dataset README's recommended citation (current version): Una Jermilova (2025) Assessing
mercury exposure to aquatic ecosystems of the Mackenzie watershed using a Bayesian Network
analysis. Federated Research Data Repository. doi: 10.20383/103.01279.

The article the data support:

> Jermilova, U., Kirk, J. L., Moe, S. J., Landis, W. G., Sharpe, E., McGovern, M.,
> Braaten, H. F. V., Gundersen, C. B., Dastoor, A. P., Schaefer, K., and Hintelmann, H. H.
> (2025). Assessing mercury exposure to water and fish of the Mackenzie watershed using a
> Bayesian network analysis. Integrated Environmental Assessment and Management 21(2):
> 396-413. https://doi.org/10.1093/inteam/vjae011

Its data-availability statement reads: "All data (including metadata and R script) are
publicly available in the supplemental information and the Federation Research Data
Repository (Doi: 10.20383/103.0957)." The article itself is published under a separate
licence (CC BY-NC) and is not included in this repository; only its bibliographic details
are used.

**Versions.** The pack's own records do not state which FRDR version its inputs were
downloaded from. This repository cites the version the article cites (Version 1). No data
in this repository was refreshed from, or re-derived from, Version 2; the current version is
listed so readers can find it.

## Changes made (CC BY-NC-SA 4.0 section 3(a)(1)(B))

The data here are adapted, not the depositors' original files, and the depositors have not
reviewed or endorsed this viewer.

- The model, training-data summaries and review files are an independent reconstruction
  made from the deposited data, R code and the article for the BN-RRM viewer this
  repository was copied from (see `pack.json`, `review/model_overview.json` and
  PROVENANCE.md). They are reformatted JSON, not the deposited spreadsheets or Netica files.
- The twelve map layers are GeoJSON files that correspond to layers described in the
  deposited spatial dataset (`ManuscriptSpatialData.zip`). Each local GeoJSON layer was
  matched to the FRDR README layer listed below by feature-count and field correspondence:
  it has the same number of features, and its attribute fields correspond to that layer's
  variable list under different names. The local files were not directly byte-compared with
  the deposited spatial files.
- In this repository, the FRDR dataset identifier in four pack files was corrected to
  10.20383/103.0957; no data value changed (PROVENANCE.md, `scripts/correct-frdr-doi.mjs`).

## The twelve map layers

Sources as recorded in the FRDR dataset README ("Was data derived from another source?" and
the spatial-data file descriptions). The README gives these as references; it does not
state licences for the upstream sources.

| Local file (`public/bn-rrm/packs/.../map/`) | FRDR layer | Features | Upstream source recorded in the FRDR README |
|---|---|---|---|
| `gsl_basins.geojson` | GreatSlaveLake_Buffer50km | 4 | None recorded; described as the study area for the Great Slave Lake (GSL) model |
| `gbs_basins.geojson` | GBS1to4 | 4 | Natural Resources Canada, National Hydro Network (NHN), GeoBase Series, accessed 2022-02-20, https://open.canada.ca/data/en/dataset/a4b190fe-e090-4e6d-881e-b87956c07977 |
| `advisory_lakes.geojson` | Lakes_with_Consumption_Advisories | 28 | GNWT Department of Health and Social Services (2016) Fish Consumption Guidance - Site Specific Fish Consumption Advice, accessed 2021-11-12, https://www.hss.gov.nt.ca/en/services/fish-consumption-guidance/site-specific-fish-consumption-advice |
| `commercial_fisheries.geojson` | NWT_Commercial_Fisheries | 110 | Fisheries Act, Northwest Territories Fishery Regulations, Schedule V (C.R.C., c.847), last amended 2020-04-01, Justice Laws website, https://laws-lois.justice.gc.ca/eng/acts/f-14/ |
| `historic_mines.geojson` | Historic_Mining_NWT | 80 | Silke, R. (2009) The Operational History of Mines in the Northwest Territories, Canada. Yellowknife, NWT. Funded by NWT Geoscience Office (NTGO) |
| `large_mines.geojson` | Large_Mining_Operations | 14 | Silke, R. (2009), as above |
| `mineral_claims.geojson` | Active_Mineral_Claims | 1070 | GNWT Centre for Geomatics, Mineral Claims Mineral Tenure Data, accessed 2022-03-28, https://www.geomatics.gov.nt.ca/en/resources/field_data_category_/economy-112/field_resource_category/data-3 |
| `oil_gas_claims.geojson` | Active_Oil_and_Natural_Gas_Claim_50km | 257 | GNWT Centre for Geomatics, Oil and Gas Mineral and Petroleum Resources Data, accessed 2022-03-28, https://www.iti.gov.nt.ca/en/services/oil-and-gas-rights-management/nwt-oil-and-gas-rights |
| `hydro_facilities.geojson` | Hydroelectric_Facilities | 6 | Northwest Territories Power Corporation (2009) Power Generation in Your Community (archived) |
| `communities.geojson` | NWT_PopulationEstimate_2021 | 33 | Statistics Canada (2017) Northwest Territories, Canada (table). Census Profile. 2016 Census. Statistics Canada Catalogue no. 98-316-X2016001 |
| `climate_stations.geojson` | Climate_Stations_Modern | 390 | Canada Open Government (2015) Short-duration Rainfall Intensity-Duration-Frequency, accessed 2022-01-22, https://open.canada.ca/data/en/dataset/15aa455c-9f9f-4405-8eee-4445d02fd35c |
| `thaw_slumps.geojson` | Thaw_Slump_Impacted_Waters | 3980 | Kokelj, S. V., et al. (2021) Thaw-driven mass wasting couples slope with downstream systems, and effects propagate through Arctic drainage networks. The Cryosphere 15, 3059-3081, https://doi.org/10.5194/tc-15-3059-2021; slope-thermokarst locations from Kokoszka, J., and Kokelj, S. V. (2021) NWT Open Report 2020-013, https://doi.org/10.46887/2020-013 |

**Limit of the licence.** CC BY-NC-SA 4.0 grants only rights "that the Licensor has
authority to license" (section 1(i)). Where a layer or value derives from an upstream source
above, that source's own terms and notices continue to apply, and neither the FRDR licence
nor this repository grants rights the upstream owner did not give.

## What CC BY-NC-SA 4.0 requires of anyone reusing the data

- **Attribution.** Credit the creators (cite the dataset above), give the licence link, and
  say what was changed (this file and the in-page "Data and licensing" notice do this).
- **NonCommercial.** The licence defines NonCommercial as "not primarily intended for or
  directed towards commercial advantage or monetary compensation". Any public deployment of
  this viewer with these data must be genuinely noncommercial. Offering the site free of
  charge does not by itself decide that question; who runs it and why also matter.
- **ShareAlike.** Adaptations of the data must be shared under CC BY-NC-SA 4.0 (or a
  BY-NC-SA Compatible License).
- **No additional restrictions.** Do not add terms or technical measures that stop others
  using the data as the licence allows.

## Map services loaded at view time

Tiles and overlay images are not stored in this repository. The viewer requests them from
the providers while the map is open, and shows each provider's attribution in the map's
attribution control.

| Service | Attribution shown | Terms |
|---|---|---|
| OpenStreetMap standard tiles, `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (Streets basemap) | Copyright sign, "OpenStreetMap" linked to https://www.openstreetmap.org/copyright, "contributors" | OSMF Tile Usage Policy, https://operations.osmfoundation.org/policies/tiles/ . The viewer runs in the browser, so it uses the browser's own User-Agent; it sends a Referer (`Referrer-Policy: strict-origin-when-cross-origin`), does not bypass HTTP caching and does not prefetch tiles. |
| OpenTopoMap tiles (Topographic basemap) | Map data: OpenStreetMap contributors, SRTM; Map style: OpenTopoMap (CC-BY-SA), each with a copyright sign and links | https://www.opentopomap.org/about (CC-BY-SA 3.0) |
| British Columbia government WMS, `https://openmaps.gov.bc.ca/geo/pub/ows` (optional overlays) | "Contains information licensed under the Open Government Licence - British Columbia.", linked to the licence | Open Government Licence - British Columbia, https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc . The licence applies to B.C. Data Catalogue records that specify it. |
| Pack map layers (above) | "Study-area layers: Jermilova and Hintelmann, FRDR (CC BY-NC-SA 4.0), adapted", linked | This file |

Removed basemaps: Esri World Imagery (Esri's documented basemap service requires an ArcGIS
account and access token, and the cited terms do not cover the legacy tile endpoint the
copied code used) and Stamen Terrain (the legacy Stamen tile URLs stopped working on
2023-10-31; the replacement requires a Stadia Maps account). No account, key or replacement
provider was added.
