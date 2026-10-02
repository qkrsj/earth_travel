import { Platform } from 'react-native';
import type {
  City, CityVisit, CountryCollection, CountryVisit, Page, RecordSummary, TravelRecord, User, Visibility,
} from './types';

// 실기기에서 테스트할 때는 EXPO_PUBLIC_API_URL 을 PC 의 LAN IP 로 설정 (예: http://192.168.0.10:4000)
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL).replace(/\/$/, '');

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) { authToken = token; }
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, `서버에 연결할 수 없습니다 (${API_URL})`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(res.status, data.error ?? `요청 실패 (${res.status})`);
  }
  return data as T;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export interface RecordInput {
  title: string;
  content: string;
  tripStart: string | null;
  tripEnd: string | null;
  visibility: Visibility;
  stops: { name: string; note: string; day: number | null }[];
  photos: { storageKey: string; caption: string }[];
}

export interface ListParams { cityId?: number; countryCode?: string; cursor?: string | null; limit?: number }

export const api = {
  signup: (email: string, password: string, nickname: string) =>
    request<{ token: string; user: User }>('POST', '/auth/signup', { email, password, nickname }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User }>('GET', '/me'),

  countries: () => request<CountryCollection>('GET', '/geo/countries'),
  countryShape: (code: string) => request<CountryCollection>('GET', `/geo/countries/${code}`),
  cities: (code: string) => request<{ cities: City[] }>('GET', `/countries/${code}/cities`),
  city: (id: number) => request<{ city: City }>('GET', `/cities/${id}`),
  cityStats: (id: number) => request<{ publicCount: number; mineCount: number }>('GET', `/cities/${id}/stats`),

  myCountries: () => request<{ countries: CountryVisit[] }>('GET', '/me/countries'),
  setCountryVisits: (code: string, visitCount: number) =>
    request<{ countryCode: string; visitCount: number }>('PUT', `/me/countries/${code}`, { visitCount }),
  myCities: (code: string) => request<{ visits: CityVisit[] }>('GET', `/me/countries/${code}/cities`),
  setCityColor: (cityId: number, color: string) => request<CityVisit>('PUT', `/me/cities/${cityId}`, { color }),
  unvisitCity: (cityId: number) => request<void>('DELETE', `/me/cities/${cityId}`),

  publicRecords: (p: ListParams = {}) => request<Page<RecordSummary>>('GET', `/records/public${qs({ ...p })}`),
  myRecords: (p: ListParams = {}) => request<Page<RecordSummary>>('GET', `/me/records${qs({ ...p })}`),
  record: (id: string) => request<{ record: TravelRecord }>('GET', `/records/${id}`),
  createRecord: (cityId: number, input: RecordInput) =>
    request<{ record: TravelRecord }>('POST', '/records', { cityId, ...input }),
  updateRecord: (id: string, input: RecordInput) =>
    request<{ record: TravelRecord }>('PATCH', `/records/${id}`, input),
  deleteRecord: (id: string) => request<void>('DELETE', `/records/${id}`),

  /** 이미지 업로드. uri 는 ImagePicker 결과 */
  upload: async (asset: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
    const form = new FormData();
    const type = asset.mimeType ?? 'image/jpeg';
    const name = asset.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      form.append('file', blob, name);
    } else {
      // React Native 의 FormData 는 { uri, name, type } 객체를 파일로 전송
      form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
    }
    return request<{ key: string; url: string }>('POST', '/uploads', form);
  },
};
