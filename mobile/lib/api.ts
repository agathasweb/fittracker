import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'https://fittracker-dev.agathasweb.com/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Interceptor de token (placeholder — guardar JWT em SecureStore)
api.interceptors.request.use((config) => {
  // TODO: const token = await SecureStore.getItemAsync('jwt');
  // if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type DailySummary = {
  date: string;
  tmb: number;
  get: number;
  kcal_eaten: number;
  kcal_burned: number;
  balance: number;
  macros: { protein: number; carbs: number; fat: number };
};

export type Food = {
  id: number;
  name: string;
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
};

export const getDailySummary = async (): Promise<DailySummary> => {
  const { data } = await api.get<DailySummary>('/dashboard/today');
  return data;
};

export const searchFoods = async (q?: string): Promise<Food[]> => {
  const { data } = await api.get<Food[]>('/foods', { params: { q } });
  return data;
};
