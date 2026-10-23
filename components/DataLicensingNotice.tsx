// "Data and licensing" notice shown below the viewer. It carries the CC BY-NC-SA 4.0
// attribution the research data require (citation, licence, changes) and the sources of the
// twelve map layers. DATA_LICENSE.md is the full record; lib/licensing.test.tsx keeps the two
// in step.

export const SOURCE_VERSION_DOI = '10.20383/103.0957';
export const CURRENT_VERSION_DOI = '10.20383/103.01279';
export const ARTICLE_DOI = '10.1093/inteam/vjae011';
export const DATA_LICENCE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

// Local map file -> the FRDR README layer it corresponds to, and the upstream source the FRDR
// dataset README records for that layer. Each correspondence rests on equal feature counts and
// corresponding attribute fields; the local files were not directly byte-compared with the
// deposited spatial files.
export const MAP_LAYER_SOURCES: ReadonlyArray<{ file: string; frdrLayer: string; source: string }> = [
  { file: 'gsl_basins.geojson', frdrLayer: 'GreatSlaveLake_Buffer50km', source: 'Study area of the Great Slave Lake model (no upstream source recorded)' },
  { file: 'gbs_basins.geojson', frdrLayer: 'GBS1to4', source: 'Natural Resources Canada, National Hydro Network (NHN)' },
  { file: 'advisory_lakes.geojson', frdrLayer: 'Lakes_with_Consumption_Advisories', source: 'GNWT Department of Health and Social Services (2016), site-specific fish consumption advice' },
  { file: 'commercial_fisheries.geojson', frdrLayer: 'NWT_Commercial_Fisheries', source: 'Northwest Territories Fishery Regulations, Schedule V (C.R.C., c.847)' },
  { file: 'historic_mines.geojson', frdrLayer: 'Historic_Mining_NWT', source: 'Silke (2009), The Operational History of Mines in the Northwest Territories' },
  { file: 'large_mines.geojson', frdrLayer: 'Large_Mining_Operations', source: 'Silke (2009), The Operational History of Mines in the Northwest Territories' },
  { file: 'mineral_claims.geojson', frdrLayer: 'Active_Mineral_Claims', source: 'GNWT Centre for Geomatics, Mineral Claims Mineral Tenure Data' },
  { file: 'oil_gas_claims.geojson', frdrLayer: 'Active_Oil_and_Natural_Gas_Claim_50km', source: 'GNWT Centre for Geomatics, Oil and Gas Mineral and Petroleum Resources Data' },
  { file: 'hydro_facilities.geojson', frdrLayer: 'Hydroelectric_Facilities', source: 'Northwest Territories Power Corporation (2009), Power Generation in Your Community' },
  { file: 'communities.geojson', frdrLayer: 'NWT_PopulationEstimate_2021', source: 'Statistics Canada (2017), 2016 Census Profile, Northwest Territories' },
  { file: 'climate_stations.geojson', frdrLayer: 'Climate_Stations_Modern', source: 'Canada Open Government (2015), Short-duration Rainfall Intensity-Duration-Frequency' },
  { file: 'thaw_slumps.geojson', frdrLayer: 'Thaw_Slump_Impacted_Waters', source: 'Kokelj et al. (2021), The Cryosphere 15:3059-3081; Kokoszka and Kokelj (2021), NWT Open Report 2020-013' },
];

const link = 'underline text-blue-700 dark:text-blue-300';

export function DataLicensingNotice() {
  return (
    <footer
      aria-labelledby="data-licensing-heading"
      className="border-t border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 print:hidden"
    >
      <h2 id="data-licensing-heading" className="font-semibold text-slate-800 dark:text-slate-100">
        Data and licensing
      </h2>
      <p>
        Research data: Jermilova, U., and Hintelmann, H. (2024), Assessing mercury exposure to aquatic
        ecosystems of the Mackenzie watershed using a Bayesian Network analysis, Federated Research Data
        Repository, <a className={link} href={`https://doi.org/${SOURCE_VERSION_DOI}`}>doi:{SOURCE_VERSION_DOI}</a>{' '}
        (the version cited by the article; current version{' '}
        <a className={link} href={`https://doi.org/${CURRENT_VERSION_DOI}`}>doi:{CURRENT_VERSION_DOI}</a>). Article:
        Jermilova et al. (2025), Integrated Environmental Assessment and Management 21(2):396-413,{' '}
        <a className={link} href={`https://doi.org/${ARTICLE_DOI}`}>doi:{ARTICLE_DOI}</a>.
      </p>
      <p>
        The data are licensed under{' '}
        <a className={link} href={DATA_LICENCE_URL}>CC BY-NC-SA 4.0</a>: attribution required,
        noncommercial use only, and adaptations must be shared under the same licence.
      </p>
      <p>
        Changes: this viewer shows an adapted copy, not the depositors&apos; files. The model and
        training-data summaries are an independent reconstruction from the deposited data, the map layers
        are provided as GeoJSON, and the dataset identifier was corrected. The depositors have not
        reviewed or endorsed this viewer.{' '}
        <a className={link} href="#data-licensing-sources">Full attribution and map layer sources</a>.
      </p>
      <p>
        The viewer software is licensed under the Apache License 2.0, which does not cover the data.
        Basemap and overlay credits appear in the map&apos;s attribution control.
      </p>
      <details id="data-licensing-sources" className="mt-1">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
          Map layer sources (as recorded in the FRDR dataset README)
        </summary>
        <p className="mt-1">
          Each local GeoJSON layer was matched to the FRDR README layer named below by feature-count
          and field correspondence. The local files were not directly byte-compared with the deposited
          spatial files.
        </p>
        <ul className="mt-1 list-disc pl-5">
          {MAP_LAYER_SOURCES.map((layer) => (
            <li key={layer.file}>
              <code>{layer.file}</code> (corresponds to FRDR layer {layer.frdrLayer}): {layer.source}.
            </li>
          ))}
        </ul>
        <p className="mt-1">
          Upstream sources keep their own terms; the CC BY-NC-SA 4.0 licence covers only rights its
          licensors can grant.
        </p>
      </details>
    </footer>
  );
}
