export interface SelectionData {
  type: 'image' | 'text';
  content: string; // Base64 image data OR plain text
  id: number;
}

export interface TranslationResult {
  id: number;
  originalText: string;
  translatedText: string;
  type: 'image' | 'text';
  imageUrl?: string; // Only if type is image
  explanation?: string;
  searchSources?: Array<{ title: string; uri: string }>;
  timestamp: number;
}

export enum AppMode {
  UPLOAD = 'UPLOAD',
  READING = 'READING',
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}