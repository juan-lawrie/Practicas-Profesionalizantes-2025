// Archivo de configuración simple para la API.
// NOTA: Anteriormente este archivo exportaba directamente una instancia de axios y
// en `services/api.js` se importaba como si fuera un objeto de configuración (API_CONFIG),
// provocando que baseURL quedara undefined y las peticiones fueran relativas a `http://localhost:3000`.
// Resultado: 404 Cannot POST /auth/login/.

const isAndroidEmulator = window.location.hostname === '10.0.2.2';

const API_CONFIG = {
  baseURL: isAndroidEmulator
    ? 'http://10.0.2.2:8000/api'
    : 'http://localhost:8000/api',
  timeout: 10000
};

API_CONFIG.hcaptchaSiteKey = '10000000-ffff-ffff-ffff-000000000001';

export default API_CONFIG;