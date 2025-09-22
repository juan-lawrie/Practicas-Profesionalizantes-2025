import axios from 'axios';
import API_CONFIG from '../config/api';

// Implementación segura de almacenamiento que evita errores de seguridad
// Mejora: comprobamos disponibilidad de localStorage una sola vez al cargar el módulo
// y silenciamos logs repetitivos. Si localStorage no está disponible, se usa
// un fallback en memoria de forma silenciosa.
const safeStorage = (() => {
  const memoryStorage = Object.create(null);
  let _localStorageAvailable = false;
  let _checked = false;
  let _warned = false;

  const checkAvailability = () => {
    if (_checked) return _localStorageAvailable;
    _checked = true;
    try {
      if (typeof localStorage === 'undefined') {
        _localStorageAvailable = false;
      } else {
        const testKey = '__localStorage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        _localStorageAvailable = true;
      }
    } catch (err) {
      _localStorageAvailable = false;
      // Solo warnear una vez para evitar inundar la consola (Safari en ciertos modos)
      if (!_warned) {
        _warned = true;
        console.debug && console.debug('localStorage inaccesible en este entorno; se usará almacenamiento en memoria como fallback. Mensaje del navegador:', err && err.message);
      }
    }
    return _localStorageAvailable;
  };

  return {
    isAvailable: () => checkAvailability(),
    getItem: (key) => {
      if (checkAvailability()) {
        try { return localStorage.getItem(key); } catch (e) { /* fallback silent */ }
      }
      return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
    },
    setItem: (key, value) => {
      if (checkAvailability()) {
        try { localStorage.setItem(key, value); return true; } catch (e) { /* fallback silent */ }
      }
      memoryStorage[key] = value;
      return true;
    },
    removeItem: (key) => {
      if (checkAvailability()) {
        try { localStorage.removeItem(key); return true; } catch (e) { /* fallback silent */ }
      }
      if (Object.prototype.hasOwnProperty.call(memoryStorage, key)) delete memoryStorage[key];
      return true;
    }
  };
})();

// Crear instancia de axios con configuración del backend
const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // necesario para enviar cookies HttpOnly desde el navegador
});

// Promesa compartida para evitar múltiples refresh en paralelo
let refreshPromise = null;

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    try {
      // Obtener token a través de safeStorage (que internamente prueba localStorage y/o memoria)
      let token = null;
      if (typeof safeStorage !== 'undefined' && safeStorage && typeof safeStorage.getItem === 'function') {
        token = safeStorage.getItem('accessToken');
      } else {
        // Fallback seguro: intentar localStorage dentro de try/catch
        try {
          if (typeof localStorage !== 'undefined') {
            token = localStorage.getItem('accessToken');
          }
        } catch (e) {
          console.debug && console.debug('localStorage inaccesible desde interceptor:', e && e.message);
        }
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Mensajes menos intrusivos (console.debug) para evitar inundar la consola
        console.debug && console.debug('🔑 Token agregado al interceptor');
      } else {
        console.debug && console.debug('⚠️ No hay token disponible para el interceptor');
      }
    } catch (error) {
      console.warn('❌ Error obteniendo token para interceptor:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const originalRequest = error?.config;
    if (!originalRequest) return Promise.reject(error);

    // No intentar refresh si la petición original es la misma ruta de refresh
    if (originalRequest.url && originalRequest.url.includes('/refresh-cookie')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // Si ya hay un refresh en curso, esperar esa promesa
      if (!refreshPromise) {
        // Usar fetch con credentials:'include' para forzar que el navegador envíe
        // la cookie HttpOnly al endpoint proxied `/api/refresh-cookie/` y evitar
        // recursiones por interceptores de axios.
        const refreshUrl = `${API_CONFIG.baseURL}/refresh-cookie/`;
        refreshPromise = fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(response => {
          if (!response.ok) throw new Error('Refresh fallido');
          return response.json();
        })
        .then(data => {
          if (data && data.access) {
            try {
              if (typeof safeStorage !== 'undefined' && safeStorage && typeof safeStorage.setItem === 'function') {
                safeStorage.setItem('accessToken', data.access);
              } else {
                try { localStorage.setItem('accessToken', data.access); } catch (e) { console.debug && console.debug('localStorage inaccesible al guardar access:', e && e.message); }
              }
              return data.access;
            } catch (e) {
              try { if (typeof safeStorage !== 'undefined' && safeStorage && typeof safeStorage.removeItem === 'function') safeStorage.removeItem('accessToken'); } catch (err) {}
              throw e;
            }
          }
          // Si el backend responde con access: null, limpiar token y forzar logout inmediato
          if (data && data.access === null) {
            try { if (typeof safeStorage !== 'undefined' && safeStorage && typeof safeStorage.removeItem === 'function') safeStorage.removeItem('accessToken'); } catch (e) {}
            // Forzar logout: recargar la página para limpiar el estado global
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
            throw new Error('Refresh fallido: access=null, sesión inválida');
          }
          throw new Error('Refresh fallido: no se devolvió access');
        })
        .catch(err => {
          try { if (typeof safeStorage !== 'undefined' && safeStorage && typeof safeStorage.removeItem === 'function') safeStorage.removeItem('accessToken'); } catch (e) {}
          throw err;
        })
        .finally(() => { refreshPromise = null; });
      }

      return refreshPromise.then(access => {
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        return axios(originalRequest);
      }).catch(err => Promise.reject(err));
    }

    return Promise.reject(error);
  }
);

// Helper para login que delega al endpoint legacy y backend que ahora setea refresh cookie
const backendLogin = async (email, password) => {
  return api.post('/auth/login/', { email, password });
};

const backendLogout = async () => {
  return api.post('/logout/');
};

export default api;

// Exportar safeStorage y helpers
export { safeStorage, backendLogin, backendLogout };