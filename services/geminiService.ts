import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { SearchSource } from "../types";
import { base64ToUint8Array, decodeAudioData, float32To16BitPCM, arrayBufferToBase64 } from "./audioUtils";

const API_KEY = process.env.API_KEY || '';

// Helper to strip markdown fences from JSON response
const cleanJson = (text: string) => {
  return text.replace(/```json\n?|\n?```/g, '').trim();
};

// --- Retry Logic Helper ---
// Handles temporary rate limits (429) by waiting and retrying
const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Check for quota/rate limit errors (429 or specific text)
    const isQuotaError = error.message?.includes('429') || 
                         error.message?.includes('quota') || 
                         error.message?.includes('exhausted') ||
                         error.status === 429;

    if (retries > 0 && isQuotaError) {
      console.warn(`Quota hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2); // Exponential backoff: 2s -> 4s -> 8s
    }
    throw error;
  }
};

// 1. Text Translation Service
export const translateText = async (text: string): Promise<string> => {
  if (!API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional academic translator. Translate the following text into Simplified Chinese. 
      Maintain the academic tone.
      Handle multi-line sentences correctly by treating them as a continuous flow.
      
      Text: "${text}"
      
      Output ONLY the translation.`,
    });
    return response.text || "Translation failed.";
  });
};

// 2. OCR & Translation Service (Multimodal)
export const analyzeImageRegion = async (base64Image: string): Promise<{ originalText: string; translatedText: string }> => {
  if (!API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Remove data URL prefix
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          {
            text: `You are an expert academic translator.
            
            The user has selected a region of a PDF.
            
            Task:
            1. OCR: Transcribe the English text found in the image. Merge lines into coherent sentences.
            2. Translate: Translate the text into Simplified Chinese.
            
            Return JSON format:
            {
              "originalText": "transcribed text",
              "translatedText": "translation"
            }`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: { type: Type.STRING },
            translatedText: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from model");

    try {
      const jsonStr = cleanJson(text);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON", text);
      return { 
        originalText: "OCR Output (Raw)", 
        translatedText: text 
      };
    }
  });
};

// 3. Search Grounding Service
export const explainWithSearch = async (text: string): Promise<{ explanation: string; sources: SearchSource[] }> => {
  if (!API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Explain the following concept or text in Chinese. Use Google Search to ensure accuracy. Output the explanation directly.\n\nText:\n${text}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const explanation = response.text || "Could not generate explanation.";
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: SearchSource[] = [];

    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({
          title: chunk.web.title,
          uri: chunk.web.uri,
        });
      }
    });

    return { explanation, sources };
  });
};

// 4. Text-to-Speech (TTS) Service
export const generateSpeech = async (text: string): Promise<AudioBuffer> => {
  if (!API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data generated");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBytes = base64ToUint8Array(base64Audio);
    
    return decodeAudioData(audioBytes, audioContext, 24000, 1);
  });
};

// 5. Live API Session
export class LiveSession {
  private session: any;
  private onStatusChange: (status: string) => void;

  constructor(onStatusChange: (status: string) => void) {
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    this.onStatusChange("Connecting...");
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    try {
      this.session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
             voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          }
        }
      });
      this.onStatusChange("Connected");
    } catch (e) {
      console.error(e);
      this.onStatusChange("Connection Failed");
    }
  }

  disconnect() {
    if (this.session) {
      this.session = null;
    }
    this.onStatusChange("Disconnected");
  }
}