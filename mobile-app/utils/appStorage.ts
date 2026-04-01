export interface DiagnosedPlant {
  id: string;
  uri: string;
  label: string;
  result: string;
  date: string;
}

export interface UserFeedback {
  id: string;
  name: string;
  category: string;
  message: string;
  date: string;
}

export const STORAGE_KEYS = {
  diagnosedPlants: 'diagnosed_plants',
  userFeedbacks: 'user_feedbacks',
} as const;

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const getSeverityLabel = (label: string) => {
  const normalized = label.toLowerCase();

  if (normalized.includes('healthy')) return 'Healthy';
  if (normalized.includes('mild') || normalized.includes('early')) return 'Needs attention';
  if (normalized.includes('severe') || normalized.includes('blight') || normalized.includes('rot')) return 'High priority';

  return 'Monitor';
};

export const buildPlantLabel = (result: string) => {
  const firstLine = result
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return 'Plant diagnosis';

  return firstLine.replace(/^[-*\d.\s]+/, '').slice(0, 48);
};

export const parseStoredPlants = (value: string | null) => safeJsonParse<DiagnosedPlant[]>(value, []);
export const parseStoredFeedbacks = (value: string | null) => safeJsonParse<UserFeedback[]>(value, []);
