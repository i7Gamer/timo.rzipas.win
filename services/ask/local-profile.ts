export const LOOPBACK = '127.0.0.1';
export const graniteLocal = process.env.ASK_GRANITE === 'local';
export const localPorts = graniteLocal
  ? { en: 4521, de: 4522, gateway: 4523, ollama: 11436 }
  : { en: 4511, de: 4512, gateway: 4513, ollama: 11435 };
