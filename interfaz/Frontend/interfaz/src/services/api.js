import axios from 'axios';
import API_CONFIG from '../config/api';

// Función de logging segura para API
const safeConsole = (type, message, data = null) => {
  try {
    if (typeof console !== 'undefined' && console[type]) {
      if (data !== null) {
        console[type](message, data);
      } else {
        console[type](message);
      }
    }
  } catch (error) {
    // Si falla el logging, no hacer nada
  }
};

// Verificar si es Safari
const isSafariBrowser = () => {
  try {
    const userAgent = window.navigator?.userAgent || '';
    return /^((?!chrome|android).)*safari/i.test(userAgent);
  } catch (e) {
    return false;
  }
};

// Almacenamiento alternativo para Safari en modo privado
class SafeStorage {
  constructor() {
    this.memoryStorage = new Map();
    this.isPrivateMode = false;
    this.testStorage();
  }

  testStorage() {
    try {
      // Verificar si localStorage está definido y es accesible
      if (typeof localStorage === 'undefined' || localStorage === null) {
        this.isPrivateMode = true;
        return;
      }

      // Test básico - intentar escribir y leer un valor
      const testKey = '__safari_storage_test__';
      const testValue = 'safari_test_' + Date.now();
      
      localStorage.setItem(testKey, testValue);
      const retrievedValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      // Si no se pudo escribir/leer correctamente, es modo privado
      if (retrievedValue !== testValue) {
        this.isPrivateMode = true;
        return;
      }

      // Test adicional: verificar que localStorage.length funcione
      const initialLength = localStorage.length;
      localStorage.setItem(testKey, testValue);
      const newLength = localStorage.length;
      localStorage.removeItem(testKey);
      
      // En modo privado, length a veces no funciona correctamente
      if (typeof initialLength !== 'number' || typeof newLength !== 'number') {
        this.isPrivateMode = true;
        return;
      }

      // Si llegamos aquí, localStorage funciona normalmente
      this.isPrivateMode = false;
      
    } catch (e) {
      // Solo marcar como modo privado para errores específicos de seguridad
      const isSecurityError = 
        e.name === 'SecurityError' ||
        e.name === 'QuotaExceededError' || 
        e.code === 18 || // SECURITY_ERR
        e.code === 22 || // QUOTA_EXCEEDED_ERR
        (e.message && (
          e.message.includes('quota') ||
          e.message.includes('insecure') ||
          e.message.includes('security') ||
          e.message.includes('private')
        ));
      
      this.isPrivateMode = isSecurityError;
      
      // Log para debugging
      safeConsole('log', `🦁 Safari storage test error: ${e.name} - ${e.message}, isPrivate: ${isSecurityError}`);
    }
  }

  setItem(key, value) {
    try {
      if (this.isPrivateMode) {
        this.memoryStorage.set(key, value);
        return;
      }
      localStorage.setItem(key, value);
    } catch (e) {
      // Fallback a memoria si falla localStorage
      this.memoryStorage.set(key, value);
      this.isPrivateMode = true;
      safeConsole('warn', 'Fallback a almacenamiento en memoria para clave:', key);
    }
  }

  getItem(key) {
    try {
      if (this.isPrivateMode) {
        return this.memoryStorage.get(key) || null;
      }
      return localStorage.getItem(key);
    } catch (e) {
      // Fallback a memoria si falla localStorage
      return this.memoryStorage.get(key) || null;
    }
  }

  removeItem(key) {
    try {
      if (this.isPrivateMode) {
        this.memoryStorage.delete(key);
        return;
      }
      localStorage.removeItem(key);
    } catch (e) {
      // Fallback a memoria si falla localStorage
      this.memoryStorage.delete(key);
    }
  }

  isInPrivateMode() {
    return this.isPrivateMode;
  }
}

// Instancia global del almacenamiento seguro
const safeStorage = new SafeStorage();

// Función segura para obtener el token usando SafeStorage
const getToken = () => {
  try {
    const token = safeStorage.getItem('accessToken');
    
    // Verificar que el token sea válido
    if (!token || token === 'null' || token === 'undefined') {
      safeConsole('warn', 'Token no válido encontrado' + (safeStorage.isInPrivateMode() ? ' (modo privado)' : ''));
      return null;
    }
    
    // Verificación adicional - asegurar que no sea una cadena vacía
    if (token.trim() === '') {
      safeConsole('warn', 'Token vacío encontrado' + (safeStorage.isInPrivateMode() ? ' (modo privado)' : ''));
      return null;
    }
    
    // Verificación extra de la longitud del token JWT
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        safeConsole('warn', 'Token JWT malformado encontrado');
        return null;
      }
    } catch (parseError) {
      safeConsole('warn', 'Error verificando formato JWT:', parseError.message);
      return null;
    }
    
    return token;
  } catch (error) {
    safeConsole('warn', 'Error accediendo al token:', error.message);
    return null;
  }
};

// Crear instancia de axios configurada específicamente para Safari y cross-browser
const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Configuraciones específicas para Safari
  withCredentials: false, // CRUCIAL: false para Safari
  validateStatus: function (status) {
    return status >= 200 && status < 300;
  },
  // Configuraciones adicionales para Safari
  maxRedirects: 0,
  responseType: 'json',
  // Headers adicionales para Safari
  transformRequest: [function (data, headers) {
    // Asegurar headers correctos para Safari
    headers['Accept'] = 'application/json';
    headers['Content-Type'] = 'application/json';
    return JSON.stringify(data);
  }]
});

// Interceptor para manejar errores con mejoras específicas para Safari
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Detectar Safari de forma segura
    let isSafariBrowser = false;
    try {
      isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    } catch (e) {
      isSafariBrowser = false;
    }
    
    // Logging seguro para Safari
    try {
      if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
        safeConsole('log', 'Error de red - posible problema de CORS' + (isSafariBrowser ? ' en Safari' : ''));
      } else if (error.response) {
        safeConsole('log', `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        if (isSafariBrowser && (error.response.status === 401 || error.response.status === 403)) {
          safeConsole('log', 'Safari: Posible problema de autenticación o CORS');
        }
      } else if (error.request) {
        safeConsole('log', 'Error de petición - no hay respuesta del servidor' + (isSafariBrowser ? ' (Safari detectado)' : ''));
      } else {
        safeConsole('log', 'Error de configuración: ' + (error.message || 'Error desconocido'));
      }
    } catch (logError) {
      // Si falla el logging, no hacer nada
    }
    
    return Promise.reject(error);
  }
);

// Interceptor para agregar el token a todas las peticiones con mejoras específicas para Safari
api.interceptors.request.use(
  (config) => {
    // Detección temprana de Safari
    let isSafariBrowser = false;
    try {
      isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    } catch (e) {
      isSafariBrowser = false;
    }
    
    // Para requests de login (/auth/login/), NO agregar token
    const isLoginRequest = config.url && config.url.includes('/auth/login/');
    
    if (!isLoginRequest) {
      const token = getToken();
      
      // Logging específico para debugging en Safari
      if (isSafariBrowser) {
        safeConsole('log', '🦁 Safari: Preparando request a', config.url);
        safeConsole('log', '🦁 Safari: Token disponible:', token ? 'SÍ' : 'NO');
        if (token) {
          safeConsole('log', '🦁 Safari: Token longitud:', token.length);
          safeConsole('log', '🦁 Safari: Token inicia con:', token.substring(0, 10) + '...');
        }
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        safeConsole('warn', '⚠️ No hay token disponible para la request');
        // En Safari, si no hay token, registrar detalles adicionales
        if (isSafariBrowser) {
          safeConsole('warn', '🦁 Safari: Verificando almacenamiento...');
          safeConsole('warn', '🦁 Safari: Modo privado:', safeStorage.isInPrivateMode());
          try {
            const rawToken = safeStorage.getItem('accessToken');
            safeConsole('warn', '🦁 Safari: Token del almacenamiento:', rawToken ? 'Existe' : 'No existe');
          } catch (storageError) {
            safeConsole('warn', '🦁 Safari: Error accediendo almacenamiento:', storageError.message);
          }
        }
      }
    } else {
      // Es una request de login
      if (isSafariBrowser) {
        safeConsole('log', '🦁 Safari: Request de LOGIN detectado - NO agregando token');
      }
    }
    
    // Headers básicos siempre presentes
    config.headers['Accept'] = 'application/json';
    config.headers['Content-Type'] = 'application/json';
    
    // Headers adicionales específicos para Safari
    if (isSafariBrowser) {
      config.headers['Cache-Control'] = 'no-cache';
      config.headers['Pragma'] = 'no-cache';
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      
      // Asegurar que no haya headers conflictivos
      delete config.headers['Access-Control-Allow-Origin'];
      
      // Log final de headers para debugging
      safeConsole('log', '🦁 Safari: Headers finales:', {
        'Authorization': config.headers.Authorization ? 'Bearer [TOKEN]' : 'NO',
        'Content-Type': config.headers['Content-Type'],
        'Accept': config.headers['Accept'],
        'isLoginRequest': isLoginRequest
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
export { safeStorage };
