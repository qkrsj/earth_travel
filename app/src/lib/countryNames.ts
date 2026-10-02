import { useEffect, useState } from 'react';
import { api } from './api';
import type { CountryProps } from './types';

let cache: Promise<Map<string, CountryProps>> | null = null;

/** 나라 코드 → 이름 (서버의 국가 GeoJSON 에서 한 번만 불러와 캐시) */
export function loadCountryNames() {
  cache ??= api.countries()
    .then((fc) => new Map(fc.features.map((f) => [f.properties.code, f.properties])))
    .catch((e) => { cache = null; throw e; });
  return cache;
}

export function useCountryNames() {
  const [names, setNames] = useState<Map<string, CountryProps>>(new Map());
  useEffect(() => {
    let alive = true;
    loadCountryNames().then((m) => alive && setNames(m)).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return names;
}
