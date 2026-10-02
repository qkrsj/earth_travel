import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';

const require = createRequire(import.meta.url);
countries.registerLocale(require('i18n-iso-countries/langs/ko.json'));
countries.registerLocale(require('i18n-iso-countries/langs/en.json'));

export interface CountryProps {
  code: string; // ISO 3166-1 alpha-2 (Kosovo = XK)
  name: string;
  nameKo: string;
}

export type Resolution = '110m' | '50m';

// world-atlas 에서 ISO 숫자 코드가 없는 지역 매핑
const UNCODED: Record<string, CountryProps> = {
  Kosovo: { code: 'XK', name: 'Kosovo', nameKo: '코소보' },
  'N. Cyprus': { code: 'CY', name: 'Cyprus', nameKo: '키프로스' },
  Somaliland: { code: 'SO', name: 'Somalia', nameKo: '소말리아' },
};

const cache = new Map<Resolution, FeatureCollection<Geometry, CountryProps>>();

export function getCountries(resolution: Resolution = '110m'): FeatureCollection<Geometry, CountryProps> {
  const hit = cache.get(resolution);
  if (hit) return hit;

  const topo = require(`world-atlas/countries-${resolution}.json`) as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;

  const features: Feature<Geometry, CountryProps>[] = [];
  for (const f of fc.features) {
    let props: CountryProps | undefined;
    const alpha2 = f.id != null ? countries.numericToAlpha2(String(f.id)) : undefined;
    if (alpha2) {
      props = {
        code: alpha2,
        name: countries.getName(alpha2, 'en') ?? f.properties.name,
        nameKo: countries.getName(alpha2, 'ko') ?? f.properties.name,
      };
    } else {
      props = UNCODED[f.properties.name];
    }
    if (!props) continue;
    features.push({ type: 'Feature', id: props.code, geometry: f.geometry, properties: props });
  }

  const result: FeatureCollection<Geometry, CountryProps> = { type: 'FeatureCollection', features };
  cache.set(resolution, result);
  return result;
}

/** 한 나라의 상세 지도 (같은 코드의 폴리곤이 여러 개면 FeatureCollection 으로 묶어 반환) */
export function getCountry(code: string): FeatureCollection<Geometry, CountryProps> | null {
  const upper = code.toUpperCase();
  const features = getCountries('50m').features.filter((f) => f.properties.code === upper);
  if (features.length === 0) return null;
  return { type: 'FeatureCollection', features };
}

export function isKnownCountry(code: string): boolean {
  const upper = code.toUpperCase();
  return getCountries('110m').features.some((f) => f.properties.code === upper)
    || getCountries('50m').features.some((f) => f.properties.code === upper);
}
