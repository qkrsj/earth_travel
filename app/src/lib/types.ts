export interface User { id: string; email: string; nickname: string }

export interface CountryProps { code: string; name: string; nameKo: string }
export interface CountryFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSON.Geometry;
  properties: CountryProps;
}
export interface CountryCollection { type: 'FeatureCollection'; features: CountryFeature[] }

export interface CountryVisit { countryCode: string; visitCount: number; cityCount: number }

export interface City { id: number; name: string; countryCode: string; lat: number; lng: number; population: number }
export interface CityVisit { cityId: number; color: string }

export type Visibility = 'public' | 'private';

export interface RecordSummary {
  id: string;
  title: string;
  excerpt: string;
  cityId: number;
  cityName: string;
  countryCode: string;
  tripStart: string | null;
  tripEnd: string | null;
  visibility: Visibility;
  coverUrl: string | null;
  photoCount: number;
  author: { id: string; nickname: string };
  createdAt: string;
}

export interface Stop { id?: number; name: string; note: string; day: number | null }
export interface Photo { id?: number; url: string; storageKey: string; caption: string }

export interface TravelRecord {
  id: string;
  userId: string;
  cityId: number;
  countryCode: string;
  title: string;
  content: string;
  tripStart: string | null;
  tripEnd: string | null;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  city: { id: number; name: string; countryCode: string; lat: number; lng: number };
  author: { id: string; nickname: string };
  stops: Stop[];
  photos: Photo[];
}

export interface Page<T> { records: T[]; nextCursor: string | null }
