import axios from 'axios';
import API_CONFIG from '../config/api';

// Implementación segura de almacenamiento que evita errores de seguridad
const safeStorage = {
  // Almacenamiento de fallback en memoria para cuando localStorage no esté disponible
  memoryStorage: {},
  
  // Verificar si localStorage está disponible
  isAvailable: () => {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  },

  getItem: (key) => {
    try {
      if (safeStorage.isAvailable()) {
        return localStorage.getItem(key);
      } else {
        // Usar almacenamiento en memoria como fallback
        console.log(`📝 Usando almacenamiento en memoria para obtener: ${key}`);
        return safeStorage.memoryStorage[key] || null;
      }
    } catch (error) {
      console.warn('Error accediendo localStorage, usando memoria:', error);
      return safeStorage.memoryStorage[key] || null;
    }
  },
  
  setItem: (key, value) => {
    try {
      if (safeStorage.isAvailable()) {
        localStorage.setItem(key, value);
        return true;
      } else {
        // Usar almacenamiento en memoria como fallback
        console.log(`💾 Usando almacenamiento en memoria para guardar: ${key}`);
        safeStorage.memoryStorage[key] = value;
        return true;
      }
    } catch (error) {
      console.warn('Error guardando en localStorage, usando memoria:', error);
      safeStorage.memoryStorage[key] = value;
      return true;
    }
  },
  
  removeItem: (key) => {
    try {
      if (safeStorage.isAvailable()) {
        localStorage.removeItem(key);
        return true;
      } else {
        // Usar almacenamiento en memoria como fallback
        console.log(`🗑️ Usando almacenamiento en memoria para eliminar: ${key}`);
        delete safeStorage.memoryStorage[key];
        return true;
      }
    } catch (error) {
      console.warn('Error eliminando de localStorage, usando memoria:', error);
      delete safeStorage.memoryStorage[key];
      return true;
    }
  }
};

// Crear instancia de axios con configuración del backend
const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    try {
      const token = safeStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Error obteniendo token para interceptor:', error);
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
    if (error.response?.status === 401) {
      // Token expirado o no válido
      try {
        safeStorage.removeItem('accessToken');
      } catch (storageError) {
        console.warn('Error removiendo token expirado:', storageError);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Exportar safeStorage
export { safeStorage };