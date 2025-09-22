import React, { useState, useEffect } from 'react';
import './App.css';
import api, { safeStorage, backendLogin, backendLogout } from './services/api';

const LS_KEYS = {
  inventory: 'inventory',
  users: 'users',
  cashMovements: 'cashMovements',
  suppliers: 'suppliers',
  purchases: 'purchases',
  orders: 'orders',
  products: 'products',
};

const loadLS = (key, fallback) => {
  try {
    // Verificar que safeStorage esté disponible
        if (typeof safeStorage === 'undefined' || !safeStorage || !safeStorage.isAvailable()) {
            // Si safeStorage no está disponible, retornamos fallback silenciosamente.
            return fallback;
        }

        const raw = safeStorage.getItem(key);
        if (raw === null || raw === undefined) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
  } catch (error) {
        console.debug && console.debug(`Error al cargar ${key} desde almacenamiento:`, error && error.message);
    return fallback;
  }
};

const saveLS = (key, value) => {
  try {
    // Verificar que safeStorage esté disponible
        if (typeof safeStorage === 'undefined' || !safeStorage || !safeStorage.isAvailable()) {
            // Silencioso: no intentar guardar si no hay storage confiable
            return true;
        }

        const serialized = JSON.stringify(value);
        return safeStorage.setItem(key, serialized);
  } catch (error) {
        console.debug && console.debug(`Error al guardar ${key} en almacenamiento:`, error && error.message);
    return true; // Devolver true para no bloquear la funcionalidad
  }
};

const removeLS = (key) => {
  try {
    // Verificar que safeStorage esté disponible
        if (typeof safeStorage === 'undefined' || !safeStorage || !safeStorage.isAvailable()) {
            return true;
        }

        return safeStorage.removeItem(key);
  } catch (error) {
        console.debug && console.debug(`Error al eliminar ${key}:`, error && error.message);
    return true; // Devolver true para no bloquear la funcionalidad
  }
};

// Función helper para obtener token de forma segura
const getAccessToken = () => {
    try {
        if (typeof safeStorage !== 'undefined' && safeStorage && safeStorage.isAvailable && safeStorage.isAvailable()) {
            return safeStorage.getItem('accessToken');
        }

        // Intentar localStorage como último recurso pero sin loguear repetidamente
        try {
            if (typeof localStorage !== 'undefined') return localStorage.getItem('accessToken');
        } catch (e) {
            // Silencioso: el warning principal ya lo hace safeStorage al inicializarse
        }

        return null;
    } catch (error) {
        console.debug && console.debug('Error obteniendo token:', error && error.message);
        return null;
    }
};

// Función helper para guardar token de forma segura (sin JSON.stringify)
const saveAccessToken = (token) => {
    try {
        // Preferir safeStorage (maneja fallback internamente)
        if (typeof safeStorage !== 'undefined' && safeStorage && safeStorage.isAvailable && safeStorage.isAvailable()) {
            return safeStorage.setItem('accessToken', token);
        }

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('accessToken', token);
                return true;
            }
        } catch (e) { /* silently ignore */ }

        return false;
    } catch (error) {
        console.debug && console.debug('Error guardando token:', error && error.message);
        return false;
    }
};

// Función helper para eliminar token de forma segura
const removeAccessToken = () => {
    try {
        if (typeof safeStorage !== 'undefined' && safeStorage && safeStorage.isAvailable && safeStorage.isAvailable()) {
            return safeStorage.removeItem('accessToken');
        }

        try { if (typeof localStorage !== 'undefined') { localStorage.removeItem('accessToken'); return true; } } catch (e) { /* ignore */ }

        return true;
    } catch (error) {
        console.debug && console.debug('Error eliminando token:', error && error.message);
        return true; // Devolver true para no bloquear el logout
    }
};

// Función helper para convertir valores a números de forma segura antes de usar toFixed
const safeToFixed = (value, decimals = 2) => {
  const num = parseFloat(value);
  return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

// NOTE: validatePassword and handleLogin are defined inside the App component
// because they need access to React state setters (setLoginError, setIsLoggedIn, ...).

const getProductIdByName = (inventory, name) => {
  const p = inventory.find(i => i.name === name);
  return p ? p.id : null;
};

// Simulación de la base de datos de usuarios con roles y credenciales
const mockUsers = [
  { email: 'gerente@example.com', password: 'Password123', role: 'Gerente' },
  { email: 'encargado@example.com', password: 'Password456', role: 'Encargado' },
  { email: 'panadero@example.com', password: 'Password789', role: 'Panadero' },
  { email: 'cajero@example.com', password: 'Password012', role: 'Cajero' },
];

const passwordPolicy = {
  minLength: 8,
  hasUpperCase: true,
  hasLowerCase: true,
  hasNumber: true,
};

const rolePermissions = {
  'Gerente': ['Dashboard', 'Inventario', 'Gestión de Usuarios', 'Ventas', 'Productos', 'Editar Productos', 'Proveedores', 'Compras', 'Pedidos', 'Consultas'],
  'Panadero': ['Dashboard', 'Inventario', 'Ventas', 'Compras'],
  'Encargado': ['Dashboard', 'Inventario', 'Ventas', 'Compras'],
  'Cajero': ['Dashboard', 'Ventas', 'Inventario', 'Compras'],
};

// Componente principal de la aplicación.
const App = () => {
    // Limpiar almacenamiento de productos y movimientos de caja al cargar la aplicación
    React.useEffect(() => {
        try {
            const removedProducts = removeLS(LS_KEYS.products);
            const removedCash = removeLS(LS_KEYS.cashMovements);
            console.log('🧹 Almacenamiento limpiado al iniciar:');
            console.log('- Productos:', removedProducts ? 'Éxito' : 'Con warnings');
            console.log('- Movimientos de caja:', removedCash ? 'Éxito' : 'Con warnings');
            console.log('✅ Datos se cargarán desde PostgreSQL');
        } catch (error) {
            console.warn('Error al limpiar almacenamiento:', error);
        }
    }, []);

    // Definimos los roles de usuario disponibles.
    const roles = ['Gerente', 'Panadero', 'Encargado', 'Cajero'];
     
    // Estados para el sistema de autenticación
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    // Indica si ya intentamos restaurar sesión al montar (para evitar parpadeos)
    const [sessionChecked, setSessionChecked] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const maxAttempts = 5;
     
    // Estado para el rol del usuario actualmente autenticado.
    const [userRole, setUserRole] = useState(null);
    // Estado para la página current a mostrar.
    const [currentPage, setCurrentPage] = useState('login');

        // Validación de contraseña mínima (se usa en creación de usuarios)
        const validatePassword = (pwd) => {
            if (!pwd || typeof pwd !== 'string') return 'La contraseña es obligatoria';
            if (pwd.length < (passwordPolicy?.minLength || 8)) return `La contraseña debe tener al menos ${(passwordPolicy?.minLength || 8)} caracteres`;
            if (passwordPolicy?.hasUpperCase && !/[A-Z]/.test(pwd)) return 'La contraseña debe contener al menos una mayúscula';
            if (passwordPolicy?.hasLowerCase && !/[a-z]/.test(pwd)) return 'La contraseña debe contener al menos una minúscula';
            if (passwordPolicy?.hasNumber && !/[0-9]/.test(pwd)) return 'La contraseña debe contener al menos un número';
            return null; // sin errores
        };

        // Manejo de login: realiza petición al backend, guarda token y actualiza estado
        const handleLogin = async (e, { email: userEmail, password: userPassword }) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            try {
                setLoginError('');
                // Validaciones mínimas
                if (!userEmail || !userPassword) {
                    setLoginError('Debes ingresar email y contraseña');
                    setFailedAttempts(prev => prev + 1);
                    return;
                }

                // Petición de login al backend
                // El view `TokenObtainPairView` espera `username` y `password` (no `email`).
                // En algunos entornos el proyecto también expone `api/auth/login/` que acepta `email`.
                let resp;
                const looksLikeEmail = typeof userEmail === 'string' && userEmail.includes('@');
                try {
                    if (looksLikeEmail) {
                        // Si el usuario ingresó un email, preferimos el endpoint que acepta email
                        resp = await api.post('/auth/login/', { email: userEmail, password: userPassword });
                    } else {
                        // Si no parece email, asumir username y usar endpoint JWT estándar
                        resp = await api.post('/token/', { username: userEmail, password: userPassword });
                    }
                } catch (innerErr) {
                    const status = innerErr?.response?.status;
                    // Si la llamada preferida falló con 404/400/401 intentamos el otro endpoint como fallback
                    if (status === 404 || status === 400 || status === 401) {
                        if (looksLikeEmail) {
                            console.warn(`/api/auth/login/ responded with ${status}, intentando /api/token/ como fallback`);
                            resp = await api.post('/token/', { username: userEmail, password: userPassword });
                        } else {
                            console.warn(`/api/token/ responded with ${status}, intentando /api/auth/login/ como fallback`);
                            resp = await api.post('/auth/login/', { email: userEmail, password: userPassword });
                        }
                    } else {
                        // Re-lanzar para que el catch exterior lo maneje
                        throw innerErr;
                    }
                }
                // Normalizar distintos formatos de respuesta de token
                const access = resp?.data?.access
                    || resp?.data?.accessToken
                    || resp?.data?.token
                    || resp?.data?.tokens?.access
                    || resp?.data?.tokens?.access_token
                    || resp?.data?.tokens?.token;

                if (!access) {
                    console.error('Respuesta de login sin token esperado:', resp?.data);
                    setLoginError('No se recibió token del servidor');
                    return;
                }

                // Guardar token usando helper (refresh está en cookie HttpOnly)
                try { saveAccessToken(access); } catch (err) { console.warn('No se pudo guardar token:', err); }

                setIsLoggedIn(true);
                // Obtener rol desde distintas posibles posiciones
                const roleFromResp = resp?.data?.user?.role || resp?.data?.role || (resp?.data?.user && resp.data.user.role) || 'Gerente';
                setUserRole(roleFromResp);
                setCurrentPage('dashboard');

                // Cargar datos iniciales directamente desde backend
                if (typeof loadUsersFromBackend === 'function') await loadUsersFromBackend();
                if (typeof loadProducts === 'function') await loadProducts();
                if (typeof loadSales === 'function') await loadSales();
                console.log('🔐 Login completo y datos iniciales cargados');
            } catch (error) {
                console.error('Error de login con backend:', error?.response?.data || error?.message || error);
                setFailedAttempts(prev => prev + 1);
                if (error.response && error.response.status === 401) setLoginError('Credenciales inválidas');
                else setLoginError('Error iniciando sesión. Revisa la consola.');
            }
        };
    
    // Estado para el inventario - SIEMPRE basado en products, PERO products SÍ usa localStorage
    const [inventory, setInventory] = useState(() => {
        console.log('📋 Inicializando inventario vacío (se generará desde products)');
        return []; // Empezar vacío - se generará desde products
    });
    
    // Usuarios - cargar desde backend, mantener persistencia
    const [users, setUsers] = useState([]);
    
    // Movimientos de caja - SIEMPRE cargar desde backend, NO usar localStorage
    const [cashMovements, setCashMovements] = useState(() => {
        console.log('💰 Inicializando movimientos de caja vacíos (se cargarán desde PostgreSQL)');
        return []; // Empezar vacío - se cargarán desde PostgreSQL
    });
    
    // Proveedores
    const [suppliers, setSuppliers] = useState(loadLS(LS_KEYS.suppliers, [
        { id: 1, name: 'Distribuidora Central', cuit: '20123456789', address: 'Av. San Martín 1234', phone: '03421567890', products: 'Harina, Azúcar, Aceite' },
        { id: 2, name: 'Proveedor Express', cuit: '30123456789', address: 'Belgrano 567', phone: '03421567891', products: 'Medialunas, Café' },
    ]));
    
    // Compras
    const [purchases, setPurchases] = useState([]);

    // Ventas (traídas desde backend)
    const [sales, setSales] = useState([]);

        // Normalize purchase object returned by server to frontend-friendly shape
        const normalizePurchaseFromServer = (p) => {
            if (!p) return p;
            const totalAmount = p.total_amount ?? p.totalAmount ?? 0;
            const supplierName = p.supplier_name ?? p.supplierName ?? p.supplier ?? '';
            const items = Array.isArray(p.items) ? p.items.map(item => ({
                ...item,
                total: item.total ?? item.totalAmount ?? (item.quantity && item.unitPrice ? item.quantity * item.unitPrice : 0)
            })) : [];
            return { ...p, totalAmount, supplierName, items };
        };
    
    // Pedidos de clientes
    const [orders, setOrders] = useState([]);

    // Estado para productos con información completa - COMPLETAMENTE basado en API del backend
    // Cargar historial de compras desde el backend al iniciar sesión
    useEffect(() => {
        const fetchPurchases = async () => {
            try {
                const response = await api.get('/purchases/');
                // Normalizar cada compra para asegurar campos frontend-friendly
                const normalized = Array.isArray(response.data) ? response.data.map(normalizePurchaseFromServer) : [];
                setPurchases(normalized);
            } catch (error) {
                console.error('Error al cargar compras desde el backend:', error);
            }
        };
        if (isLoggedIn) {
            fetchPurchases();
        }
    }, [isLoggedIn]);
    // Cargar pedidos desde backend al iniciar sesión (persistencia cross-browser)
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const token = getAccessToken();
                if (!token) return;
                const res = await api.get('/orders/');
                if (res && res.data) {
                    // Normalizar items y campos si es necesario
                    const backendOrders = res.data.map(o => ({
                        id: o.id,
                        date: o.date,
                        customerName: o.customer_name || o.customerName || o.customer_name || '',
                        paymentMethod: o.payment_method || o.paymentMethod || '',
                        items: Array.isArray(o.items) ? o.items.map(it => ({
                            productName: it.product_name || it.productName || '',
                            quantity: it.quantity,
                            unitPrice: it.unit_price || it.unitPrice || 0,
                            total: it.total || 0
                        })) : [],
                        totalAmount: o.total_amount || o.totalAmount || 0,
                        status: o.status || 'Pendiente',
                        notes: o.notes || ''
                    }));
                    setOrders(backendOrders);
                }
            } catch (error) {
                console.warn('Error cargando pedidos desde backend:', error && error.message);
            }
        };

        if (isLoggedIn) fetchOrders();
    }, [isLoggedIn]);
    // Intento de refresh silencioso al montar para restablecer sesión si existe la cookie HttpOnly
    useEffect(() => {
        const trySilentRefresh = async () => {
            try {
                console.debug('🔁 Intentando refresh silencioso al montar');
                // Si existía un access token almacenado localmente, limpiarlo antes de intentar
                // restaurar sesión desde la cookie HttpOnly. Esto evita usar un token stale
                // que pueda provocar que la UI muestre pantalla de cajero aun cuando el
                // usuario fue borrado en el backend.
                try {
                    const prev = getAccessToken();
                    if (prev) {
                        console.debug('💾 Token previo detectado en storage — limpiando antes del refresh');
                        try { removeAccessToken(); } catch (e) { console.debug('⚠️ No se pudo eliminar token previo:', e && e.message); }
                    }
                } catch (e) { /* silent */ }

                const resp = await fetch('/api/refresh-cookie/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                if (resp.ok) {
                    const data = await resp.json();
                    // Backend puede devolver { access: null } si el usuario fue borrado/inactivo
                    if (!data || !data.access) {
                        console.debug('🔐 Refresh silencioso: no hay access (usuario ausente o inactivo). Limpiando sesión.');
                        try { removeAccessToken(); } catch (e) {}
                        try { setIsLoggedIn(false); setCurrentPage('login'); } catch (e) {}
                    } else if (data && data.access) {
                        try { saveAccessToken(data.access); } catch (e) { console.debug('⚠️ No se pudo guardar access tras refresh silencioso:', e && e.message); }
                        setIsLoggedIn(true);
                        try { setCurrentPage('dashboard'); } catch (e) { console.debug('⚠️ No se pudo setear currentPage tras refresh silencioso:', e && e.message); }
                        // Asignar el rol devuelto por el backend si existe
                        if (data.role) {
                            setUserRole(data.role);
                        } else {
                            // Si no viene el rol, usar el anterior o el default
                            try { if (!userRole) setUserRole('Cajero'); } catch (e) { /* silent */ }
                        }
                        console.debug('✅ Refresh silencioso OK — sesión restablecida');
                    }
                    // Indicamos que ya fue chequeda la sesión
                    try { setSessionChecked(true); } catch (e) { /* silent */ }
                } else {
                    console.debug('ℹ️ Refresh silencioso no devolvió OK:', resp.status);
                    try { setSessionChecked(true); } catch (e) { /* silent */ }
                }
            } catch (e) {
                console.debug('⚠️ Error en refresh silencioso:', e && e.message);
                // Si el backend no está disponible (proxy error / ECONNRESET), asegurarnos de
                // limpiar token y mostrar la pantalla de login en vez de mantener UI de cajero.
                try {
                    console.warn('❌ Refresh silencioso falló — probablemente el backend no está accesible. Forzando logout temporalmente. Asegúrate de ejecutar `python manage.py runserver` en el backend.');
                } catch (ee) { /* ignore */ }
                try { removeAccessToken(); } catch (err) { /* silent */ }
                try { setIsLoggedIn(false); setCurrentPage('login'); } catch (err) { /* silent */ }
                try { setSessionChecked(true); } catch (e) { /* silent */ }
            }
        };
        trySilentRefresh();
    }, []);

    // Cuando el estado de autenticación cambia a logged in, cargar movimientos de caja y demás datos dependientes
    useEffect(() => {
        if (!isLoggedIn) return;
        (async () => {
            try {
                console.debug('🔔 isLoggedIn=true — cargando movimientos de caja desde backend');
                await loadCashMovements();
            } catch (e) {
                console.warn('⚠️ No se pudo cargar movimientos al autenticar:', e && e.message);
                // Si la razón fue que el backend no está accesible, forzar logout para evitar mostrar UI inconsistente
                if (e && (e.message && (e.message.includes('NetworkError') || e.message.includes('Failed to fetch') || e.message.includes('ECONNRESET')))) {
                    try { console.warn('❌ Fallo de red al cargar movimientos — backend inaccesible. Forzando logout.'); } catch (ee) {}
                    try { removeAccessToken(); } catch (err) {}
                    try { setIsLoggedIn(false); setCurrentPage('login'); } catch (err) {}
                }
            }
        })();
    }, [isLoggedIn]);

    const [products, setProducts] = useState(() => {
        console.log('🎯 Inicializando products - siempre vacío, se carga desde servidor');
        // NUNCA usar localStorage para productos - siempre empezar vacío
        return [];
    });

    // Estado para indicar cuando se están sincronizando productos
    const [isSyncing, setIsSyncing] = useState(false);

    // useEffect para guardar en localStorage (inventory NO se guarda, products SÍ se guarda)
    // useEffect(() => { saveLS(LS_KEYS.inventory, inventory); }, [inventory]); // DESHABILITADO - inventario se regenera desde products
    // useEffect(() => { saveLS(LS_KEYS.cashMovements, cashMovements); }, [cashMovements]); // DESHABILITADO - cashMovements se cargan desde PostgreSQL
    useEffect(() => { saveLS(LS_KEYS.suppliers, suppliers); }, [suppliers]);
    
    // Función para cargar usuarios desde el backend
    const loadUsersFromBackend = async () => {
        try {
            const response = await api.get('/users/');
            if (response.data) {
                // Transformar datos del backend para compatibilidad local
                const backendUsers = response.data.map(user => ({
                    id: user.id,
                    name: user.username,
                    email: user.email,
                    role: user.role ? user.role.name : 'Cajero', // Extraer nombre del rol
                    hashedPassword: 'backend-managed' // Password manejado por backend
                }));
                setUsers(backendUsers);
                console.log('✅ Usuarios cargados desde backend:', backendUsers.length);
            }
        } catch (error) {
            console.error('Error cargando usuarios desde backend:', error);
            // Mantener usuarios existentes si hay error
        }
    };
    
    // Cargar usuarios al inicializar la aplicación (solo si hay token)
    useEffect(() => {
        const token = getAccessToken();
        if (token && isLoggedIn) {
            loadUsersFromBackend();
        }
    }, [isLoggedIn]);
    // NOTA: Ya no guardamos `orders` en localStorage para evitar inconsistencias
    // useEffect(() => { saveLS(LS_KEYS.orders, orders); }, [orders]);
    // useEffect(() => { saveLS(LS_KEYS.products, products); }, [products]); // DESHABILITADO - products YA NO se guardan automáticamente en localStorage

        // useEffect para sincronización productos -> inventario
        useEffect(() => {
                console.log('🔄 SYNC: Sincronizando inventario desde products');

                // Verificar que products sea un array válido antes de usar map
                if (!Array.isArray(products)) {
                        console.log('⚠️ products no es un array válido, usando array vacío');
                        setInventory([]);
                        return;
                }

                // Reconstruir inventario desde products (actual desde API)
                const newInventory = products.map(product => ({
                        id: product.id,
                        name: product.name,
                        stock: product.stock,
                        type: product.category || 'Producto'
                }));

                console.log('🎯 Inventario sincronizado:', newInventory?.length ? `${newInventory.length} productos` : 'Array vacío');

                setInventory(newInventory);
        }, [products]);

    // Función para cerrar la sesión.
    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserRole(null);
        setCurrentPage('login');
        setEmail('');
        setPassword('');
        setLoginError('');
        setFailedAttempts(0);  // Resetear intentos fallidos
        setIsLocked(false);    // Desbloquear cuenta
        setShowModal(false);   // Cerrar modal
        removeAccessToken(); // quitar solo el token
    };

    // Función para manejar la navegación.
    const navigateTo = (page) => {
        setCurrentPage(page);
    };

    // Lógica para el modal de cuenta bloqueada
    const handleModalClose = () => {
        setShowModal(false);
    };
     
    const LockedAccountModal = () => (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>¡Cuenta Bloqueada!</h3>
                <p>Tu cuenta ha sido bloqueada debido a demasiados intentos fallidos.</p>
                <p>Intentos fallidos: {failedAttempts} de {maxAttempts}</p>
                <p>Por favor, contacta al administrador o espera 15 minutos.</p>
                <div className="modal-buttons">
                    <button className="modal-button" onClick={handleModalClose}>Cerrar</button>
                    <button className="modal-button retry-button" onClick={handleRetryLogin}>
                        Reintentar
                    </button>
                </div>
            </div>
        </div>
    );

    // Función para reintentar login
    const handleRetryLogin = () => {
        setFailedAttempts(0);
        setIsLocked(false);
        setShowModal(false);
        setLoginError('');
    };

    const loadInventory = async () => {
      try {
        const response = await api.get('/products/');
        setInventory(response.data);
        saveLS(LS_KEYS.inventory, response.data);
      } catch (error) {
        console.error('Error cargando inventario:', error);
      }
    };

        const loadUsers = async () => {
            try {
                const response = await api.get('/users/');
                if (response.data && Array.isArray(response.data)) {
                    const normalized = response.data.map(u => ({
                        id: u.id,
                        name: u.username ?? u.name ?? (typeof u === 'string' ? u : ''),
                        email: u.email ?? '',
                        role: (u.role && typeof u.role === 'object') ? (u.role.name ?? String(u.role)) : (u.role ?? 'Cajero'),
                        hashedPassword: 'backend-managed'
                    }));
                    setUsers(normalized);
                    saveLS(LS_KEYS.users, normalized);
                } else {
                    setUsers(response.data);
                    saveLS(LS_KEYS.users, response.data);
                }
            } catch (error) {
                console.error('Error cargando usuarios:', error);
            }
        };

    const loadProducts = async () => {
      try {
        setIsSyncing(true);
        console.log('🔄 Cargando productos del servidor...');
        const response = await api.get('/products/');
        const serverProducts = response.data;
        
        // Convertir productos del servidor al formato local
        const formattedProducts = serverProducts.map(product => ({
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category || 'Producto',
          stock: product.stock,
          description: product.description || '',
          status: 'Sincronizado',
          hasSales: false,
          lowStockThreshold: product.low_stock_threshold || 10
        }));
        
        // Solo actualizar si hay diferencias para evitar re-renders innecesarios
        setProducts(prevProducts => {
          if (JSON.stringify(prevProducts) !== JSON.stringify(formattedProducts)) {
            console.log('✅ Productos actualizados:', `${formattedProducts.length} productos del servidor`);
            return formattedProducts;
          } else {
            console.log('📋 Productos sin cambios - no se actualiza el estado');
            return prevProducts;
          }
        });
      } catch (error) {
        console.log('❌ Error cargando productos del servidor:', error.message);
        
        // Manejo específico para Safari y otros navegadores
        if (error.response) {
          if (error.response.status === 401) {
            console.log('🔒 Error de autenticación - reloguear necesario');
          } else {
            console.log(`🚫 Error del servidor: ${error.response.status}`);
          }
        } else if (error.request) {
          console.log('🌐 Error de conexión con el servidor');
        } else {
          console.log('⚠️ Error de configuración:', error.message);
        }
        
        // Solo actualizar a array vacío si no había productos antes
        setProducts(prevProducts => prevProducts.length > 0 ? prevProducts : []);
      } finally {
        setIsSyncing(false);
      }
    };

    // Función para cargar movimientos de caja desde el backend
        const loadCashMovements = async () => {
            try {
                console.debug('🔎 loadCashMovements invoked');
                // Intentar refresh explícito para asegurarnos de tener access antes de pedir movimientos
                try {
                    console.debug('🔁 Intentando refresh explícito antes de cargar movimientos');
                    await fetch('/api/refresh-cookie/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                } catch (e) {
                    console.debug('⚠️ Refresh explícito falló o no devolvió nuevo access (silent):', e && e.message);
                }

                console.log('💰 Cargando movimientos de caja del servidor...');
                const response = await api.get('/cash-movements/');
                const serverMovements = response.data || [];
        
                console.debug('🔍 Datos recibidos del servidor:', serverMovements.length, 'movimientos');
        
                // Convertir movimientos del servidor al formato local
                const formattedMovements = serverMovements.map(movement => ({
                    id: movement.id,
                    type: movement.type,
                    amount: parseFloat(movement.amount), // Asegurar que sea número
                    description: movement.description || '',
                    date: movement.timestamp || movement.created_at || new Date().toISOString(),
                    user: movement.user || 'Sistema'
                }));
        
                // Debug: Mostrar algunos movimientos para verificar
                console.debug('📋 Primeros 3 movimientos formateados:', formattedMovements.slice(0, 3));
        
                // Calcular saldo para debug
                const debugBalance = formattedMovements.reduce((sum, m) => {
                    const amount = m.type === 'Entrada' ? m.amount : -m.amount;
                    console.debug(`💰 ${m.type}: $${m.amount} (acumulado: $${sum + amount})`);
                    return sum + amount;
                }, 0);
        
                console.debug(`🎯 Saldo calculado en loadCashMovements: $${debugBalance}`);
        
                setCashMovements(formattedMovements);
                console.debug('✅ Movimientos de caja cargados:', `${formattedMovements.length} movimientos del servidor`);
            } catch (error) {
                console.error('❌ Error cargando movimientos de caja:', error && error.message ? error.message : error);
                // Mantener los movimientos anteriores si falla la carga
                setCashMovements(prevMovements => prevMovements.length > 0 ? prevMovements : []);
            }
        };

    // Función para cargar ventas desde el backend
    const loadSales = async () => {
      try {
        console.log('🛒 Cargando ventas del servidor...');
        const response = await api.get('/sales/');
                // Manejar respuesta paginada de DRF: { count, next, previous, results: [...] }
                let serverSales = [];
                if (Array.isArray(response.data)) {
                    serverSales = response.data;
                } else if (response.data && Array.isArray(response.data.results)) {
                    serverSales = response.data.results;
                } else if (response.data && typeof response.data === 'object' && response.data !== null) {
                    // A veces la API puede devolver un objeto con key 'data' o 'sales'
                    if (Array.isArray(response.data.data)) serverSales = response.data.data;
                    else if (Array.isArray(response.data.sales)) serverSales = response.data.sales;
                }

                // Guardar ventas completas en el estado para consultas y para marcar productos con ventas
                setSales(serverSales);
                console.log('✅ Ventas cargadas en estado:', `${serverSales.length} ventas del servidor`);
                console.log('📊 Ventas (primeros):', serverSales.slice(0,3));
      } catch (error) {
        console.log('❌ Error cargando ventas:', error.message);
      }
    };

    // Función para cargar cambios de inventario desde el backend
    const loadInventoryChanges = async () => {
      try {
        console.log('📦 Cargando cambios de inventario del servidor...');
        const response = await api.get('/inventory-changes/');
        const serverChanges = response.data;
        
        console.log('✅ Cambios de inventario cargados:', `${serverChanges.length} cambios del servidor`);
        console.log('📋 Cambios:', serverChanges);
      } catch (error) {
        console.log('❌ Error cargando cambios de inventario:', error.message);
      }
    };

    // Componente de la interfaz de inicio de sesión.
    const Login = () => {
      const [emailInput, setEmailInput] = useState('');
      const [passwordInput, setPasswordInput] = useState('');

      const onSubmit = (e) => {
        e.preventDefault();
        handleLogin(e, { email: emailInput, password: passwordInput });
      };

      return (
        <div className="login-container">
          <h1>Iniciar Sesión</h1>
          
          <form onSubmit={onSubmit}>
            <div className="input-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ejemplo@email.com"
                required
                autoComplete="email"
                disabled={isLocked}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLocked}
              />
            </div>
            
            {/* Mostrar mensaje de error */}
            <p className={loginError ? 'error-message' : 'error-message hidden'}>
              {loginError}
            </p>
            
            {/* Mostrar contador de intentos */}
            {failedAttempts > 0 && !isLocked && (
              <p className="attempts-message">
                Intentos fallidos: {failedAttempts} de {maxAttempts}
              </p>
            )}
            
            {/* Mostrar mensaje de bloqueo */}
            {isLocked && (
              <p className="lock-message">
                Tu cuenta ha sido bloqueada. Contacta al administrador.
              </p>
            )}
            
            {/* Formulario de login - sin funciones de test en producción */}
            <button 
              type="submit" 
              className="login-button" 
              disabled={isLocked}
            >
              {isLocked ? 'Cuenta Bloqueada' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      );
    };

    // Componente de la interfaz de navegación superior.
    const Navbar = () => {
        const itemsToShow = rolePermissions[userRole] || [];

        return (
            <nav className="navbar">
                <div className="user-info">
                    <span>Rol: {userRole}</span>
                    <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
                </div>
                <ul className="nav-list">
                    {itemsToShow.map(item => (
                        <li key={item}>
                            <button onClick={() => navigateTo(item.toLowerCase())} className={`nav-button ${currentPage === item.toLowerCase() ? 'active' : ''}`}>
                                {item}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        );
    };

    // Componente del tablero (Dashboard).
    const Dashboard = () => {
        // Obtener productos e insumos con stock bajo según su umbral personalizado
        const lowStockItems = products.filter(product => 
            product.stock < (product.lowStockThreshold || 10)
        );

        // Separar productos e insumos para mejor organización
        const lowStockProducts = lowStockItems.filter(item => item.category === 'Producto');
        const lowStockSupplies = lowStockItems.filter(item => item.category === 'Insumo');

        return (
            <div className="dashboard-container">
                <h2>Dashboard de {userRole}</h2>
                {['Gerente', 'Encargado', 'Panadero', 'Cajero'].includes(userRole) && (
                    lowStockItems.length > 0 && (
                        <div className="dashboard-alerts">
                            <h3>⚠️ Alerta de Stock Bajo</h3>
                            
                            {lowStockProducts.length > 0 && (
                                <div className="alert-section">
                                    <h4>📦 Productos con Stock Bajo:</h4>
                                    <ul className="alert-list">
                                        {lowStockProducts.map(item => (
                                            <li key={item.id} className="alert-item">
                                                <strong>{item.name}</strong>: ¡Solo quedan {item.stock} unidades! (Umbral: {item.lowStockThreshold || 10})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            
                            {lowStockSupplies.length > 0 && (
                                <div className="alert-section">
                                    <h4>🧾 Insumos con Stock Bajo:</h4>
                                    <ul className="alert-list">
                                        {lowStockSupplies.map(item => (
                                            <li key={item.id} className="alert-item">
                                                <strong>{item.name}</strong>: ¡Solo quedan {item.stock} unidades! (Umbral: {item.lowStockThreshold || 10})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )
                )}
                
                <div className="info-section">
                    <h3>Información General</h3>
                    <p>Bienvenido al sistema de gestión de churrería. Utiliza el menú superior para navegar por las diferentes funcionalidades.</p>
                </div>
            </div>
        );
    };

    // Componente de la interfaz de gestión de usuarios (solo para Gerente).
    const UserManagement = () => {
        const [showAddUser, setShowAddUser] = useState(false);
        const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Cajero', password: '' });
        const [message, setMessage] = useState('');

        const handleAddUser = async (e) => {
            e.preventDefault();
            
            // Validar campos obligatorios
            if (!newUser.name || !newUser.email || !newUser.password) {
                setMessage('Error: Todos los campos son obligatorios.');
                return;
            }
            
            // Validar formato de contraseña
            const passwordError = validatePassword(newUser.password);
            if (passwordError) {
                setMessage(`Error de contraseña: ${passwordError}`);
                return;
            }
            
            // Validar si el usuario ya existe por email en la lista local
            const userExists = users.some(u => u.email === newUser.email);
            if (userExists) {
                setMessage('Error: El email ya está registrado.');
                return;
            }

            try {
                // Crear usuario en el backend
                const response = await api.post('/users/create/', {
                    username: newUser.name,
                    email: newUser.email,
                    password: newUser.password,
                    role_name: newUser.role
                });

                if (response.data) {
                    // Recargar usuarios desde el backend para obtener datos actualizados
                    await loadUsersFromBackend();
                    
                    // Limpiar formulario
                    setNewUser({ name: '', email: '', role: 'Cajero', password: '' });
                    setShowAddUser(false);
                    setMessage('✅ Usuario creado exitosamente en el sistema.');
                    
                    console.log('Usuario creado exitosamente:', response.data);
                }
            } catch (error) {
                console.error('Error creando usuario:', error);
                if (error.response && error.response.status === 400) {
                    setMessage('Error: El usuario ya existe en el sistema.');
                } else {
                    setMessage('Error: No se pudo crear el usuario. Revisa la conexión.');
                }
            }
        };

    const handleDeleteUser = async (userId) => {
            // Regla de negocio: El gerente no puede eliminarse a sí mismo.
            const userToDelete = users.find(u => u.id === userId);
            if (!userToDelete) {
                setMessage('Usuario no encontrado.');
                return;
            }

            // Regla de negocio: no permitir eliminar a un Gerente desde la UI
            if (userToDelete.role === 'Gerente') {
                setMessage('No puedes eliminar la cuenta de un Gerente.');
                return;
            }

            if (!window.confirm(`¿Estás seguro de que quieres eliminar a ${userToDelete.name}? Esta acción es permanente.`)) {
                return;
            }

            try {
                // Llamada al backend para eliminar el usuario (ruta definida en backend: /api/users/<pk>/delete/)
                await api.delete(`/users/${userId}/delete/`);

                // Recargar usuarios desde el backend para mantener consistencia cross-browser
                await loadUsersFromBackend();

                setMessage('✅ Usuario eliminado exitosamente en el servidor.');
            } catch (error) {
                console.error('Error eliminando usuario:', error);
                if (error.response && error.response.status === 403) {
                    setMessage('No tienes permisos para eliminar este usuario.');
                } else if (error.response && error.response.status === 404) {
                    setMessage('Usuario no encontrado en el servidor.');
                } else {
                    setMessage('Error eliminando usuario. Revisa la conexión o los permisos.');
                }
            }
        };

        return (
            <div className="management-container">
                <h2>Gestión de Usuarios</h2>
                {message && <p className="message">{message}</p>}
                {!showAddUser ? (
                    <button className="main-button" onClick={() => setShowAddUser(true)}>Registrar Nuevo Usuario</button>
                ) : (
                    <form className="form-container" onSubmit={handleAddUser}>
                        <h3>Registrar Usuario con Roles</h3>
                        <input 
                            type="text" 
                            value={newUser.name} 
                            onChange={e => setNewUser({ ...newUser, name: e.target.value })} 
                            placeholder="Nombre Completo" 
                            required 
                        />
                        <input 
                            type="email" 
                            value={newUser.email} 
                            onChange={e => setNewUser({ ...newUser, email: e.target.value })} 
                            placeholder="Email" 
                            required 
                        />
                        <input 
                            type="password" 
                            value={newUser.password} 
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })} 
                            placeholder="Contraseña (mín. 8 caracteres, mayúscula, minúscula, número)" 
                            required 
                        />
                        <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            {roles.filter(r => r !== 'Gerente').map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div className="button-group">
                            <button type="submit" className="action-button primary">Crear Usuario</button>
                            <button type="button" className="action-button secondary" onClick={() => setShowAddUser(false)}>Cancelar</button>
                        </div>
                    </form>
                )}

                <h3>Usuarios Existentes ({users.length})</h3>
                <ul className="list-container">
                    {users.map(user => (
                        <li key={user.id} className="list-item">
                            <div className="user-info-container">
                                <div><strong>{user.name}</strong> ({user.role})</div>
                                <div className="user-email">{user.email}</div>
                            </div>
                            <button onClick={() => handleDeleteUser(user.id)} className="delete-button">Eliminar</button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Componente de la interfaz de consulta y registro de inventario.
    const InventoryView = () => {
        const [showChangeForm, setShowChangeForm] = useState(false);
        const [change, setChange] = useState({ product: '', quantity: '', reason: '' });

        const handleRegisterChange = async (e) => {
            e.preventDefault();
            const productName = change.product;
            const quantity = parseInt(change.quantity);
            const reason = change.reason;

            const product = inventory.find(p => p.name === productName);
            if (!product) {
                alert('Producto no encontrado.');
                return;
            }

            if (quantity < 0 && Math.abs(quantity) > product.stock) {
                alert('No hay suficiente stock para esta salida.');
                return;
            }

            const payload = {
                type: quantity >= 0 ? 'Entrada' : 'Salida',
                product: product.id,
                quantity: Math.abs(quantity),
                reason,
            };

            try {
                await api.post('/inventory-changes/', payload);
                
                // Recargar productos desde backend para mantener sincronización con PostgreSQL
                await loadProducts();
                
                setChange({ product: '', quantity: '', reason: '' });
                setShowChangeForm(false);
                console.log('✅ Cambio de inventario registrado y datos recargados desde PostgreSQL');
            } catch (err) {
                console.error('Error registrando cambio de inventario:', err);
                alert('No se pudo registrar el cambio de inventario.');
            }
        };

        return (
            <div className="inventory-container">
                <h2>Inventario</h2>
                <h3>Consultar Inventario</h3>
                
                <div className="inventory-categories">
                    <h4>Productos</h4>
                    <ul className="list-container">
                        {inventory
                            .filter(item => item.type === 'Producto')
                            .map(item => {
                                // Encontrar el producto correspondiente para obtener su umbral personalizado
                                const productDetails = products.find(p => p.name === item.name);
                                const threshold = productDetails ? productDetails.lowStockThreshold || 10 : 10;
                                const isLowStock = item.stock <= threshold;
                                
                                return (
                                    <li key={item.id} className="list-item">
                                        <span>{item.name}</span>
                                        <span>Stock: {item.stock}</span>
                                        <span className={isLowStock ? "stock-alert" : ""}>
                                            {isLowStock ? `⚠️ Stock Bajo (Umbral: ${threshold})` : ""}
                                        </span>
                                    </li>
                                );
                            })}
                    </ul>
                    
                    <h4>Insumos</h4>
                    <ul className="list-container">
                        {inventory
                            .filter(item => item.type === 'Insumo')
                            .map(item => {
                                // Encontrar el insumo correspondiente para obtener su umbral personalizado
                                const productDetails = products.find(p => p.name === item.name);
                                const threshold = productDetails ? productDetails.lowStockThreshold || 10 : 10;
                                const isLowStock = item.stock <= threshold;
                                
                                return (
                                    <li key={item.id} className="list-item">
                                        <span>{item.name}</span>
                                        <span>Stock: {item.stock}</span>
                                        <span className={isLowStock ? "stock-alert" : ""}>
                                            {isLowStock ? `⚠️ Stock Bajo (Umbral: ${threshold})` : ""}
                                        </span>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
                <hr />
                {['Gerente', 'Encargado', 'Panadero', 'Cajero'].includes(userRole) && (
                    <div className="inventory-change-section">
                        <h3>Registrar Cambios en el Inventario</h3>
                        {!showChangeForm ? (
                            <button className="main-button" onClick={() => setShowChangeForm(true)}>Registrar Entrada/Salida</button>
                        ) : (
                            <form className="form-container" onSubmit={handleRegisterChange}>
                                <select value={change.product} onChange={e => setChange({ ...change, product: e.target.value })} required>
                                    <option value="">Selecciona un producto/insumo</option>
                                    {inventory.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                                </select>
                                <input type="number" value={change.quantity} onChange={e => setChange({ ...change, quantity: parseInt(e.target.value) })} placeholder="Cantidad (Positivo para entrada, negativo para salida)" required />
                                <input type="text" value={change.reason} onChange={e => setChange({ ...change, reason: e.target.value })} placeholder="Motivo (ej: Desperdicio, Reposición)" required />
                                <div className="button-group">
                                    <button type="submit" className="action-button primary">Guardar Cambio</button>
                                    <button type="button" className="action-button secondary" onClick={() => setShowChangeForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Componente de la interfaz combinada de ventas y caja.
    const SalesView = () => {
        const [selectedProducts, setSelectedProducts] = useState({});
        const [total, setTotal] = useState(0);
        const [showMovementForm, setShowMovementForm] = useState(false);
        const [newMovement, setNewMovement] = useState({ type: 'Entrada', amount: '', description: '' });
        const [message, setMessage] = useState('');
        const [activeTab, setActiveTab] = useState('ventas'); // 'ventas' o 'caja'

        // Función para obtener el precio de un producto desde la lista de products
        const getProductPrice = (productName) => {
            const product = products.find(p => p.name === productName);
            return product ? product.price : 0;
        };

        // Función para obtener el stock de un producto
        const getProductStock = (productName) => {
            const product = products.find(p => p.name === productName);
            return product ? product.stock : 0;
        };

        // Manejar la selección de productos.
        const handleProductSelect = (productName) => {
            const newSelectedProducts = { ...selectedProducts };
            if (newSelectedProducts[productName]) {
                newSelectedProducts[productName] += 1;
            } else {
                newSelectedProducts[productName] = 1;
            }
            setSelectedProducts(newSelectedProducts);
            calculateTotal(newSelectedProducts);
        };

        // Calcular el total de la venta.
        const calculateTotal = (selectedProductsState) => {
            let newTotal = 0;
            for (const name in selectedProductsState) {
                newTotal += getProductPrice(name) * selectedProductsState[name];
            }
            setTotal(newTotal);
        };

        // Registrar la venta.
        const handleRegisterSale = async () => {
            // Verificar stock antes de procesar la venta
            const canSell = Object.keys(selectedProducts).every(name => {
                const productStock = getProductStock(name);
                return productStock >= selectedProducts[name];
            });

            if (!canSell) {
                alert('No hay suficiente stock para completar la venta.');
                return;
            }

            const description = `Venta: ${Object.entries(selectedProducts).map(([name, qty]) => `${name} x${qty}`).join(', ')}`;

            // Preparar los items de la venta para enviar al backend
            const saleItems = Object.entries(selectedProducts).map(([productName, quantity]) => {
                const product = products.find(p => p.name === productName);
                return {
                    product_id: product.id,
                    product_name: productName, // Para referencia
                    quantity: quantity,
                    price: product.price
                };
            });

            // Persistir en backend: venta y movimiento de caja
            try {
                await api.post('/sales/', {
                    total_amount: total,
                    payment_method: 'Efectivo',
                    items: saleItems // ← Enviar los productos vendidos
                });
                await api.post('/cash-movements/', {
                    type: 'Entrada',
                    amount: total,
                    description,
                });
                
                // Recargar TODOS los datos desde PostgreSQL para mantener sincronización
                await loadProducts(); // Actualiza stock después de la venta
                await loadCashMovements(); // Actualiza movimientos de caja
                
                setSelectedProducts({});
                setTotal(0);
                setMessage('✅ Venta registrada con éxito, stock actualizado y entrada de caja registrada.');
                console.log('🔄 Datos recargados desde PostgreSQL después de la venta');
            } catch (err) {
                console.error('Error registrando venta:', err);
                setMessage('❌ No se pudo registrar la venta en el servidor.');
            }
        };

        // Registrar movimiento de caja manual
        const handleRegisterMovement = async (e) => {
            e.preventDefault();
            const amount = parseFloat(newMovement.amount);
            const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

            if (newMovement.type === 'Salida' && amount > currentBalance) {
                setMessage(' Saldo insuficiente para registrar esta salida.');
                return;
            }

            const payload = {
                type: newMovement.type,
                amount,
                description: newMovement.description,
            };

            try {
                await api.post('/cash-movements/', payload);
                
                // Recargar movimientos de caja desde PostgreSQL para mantener sincronización
                await loadCashMovements();
                
                setNewMovement({ type: 'Entrada', amount: '', description: '' });
                setShowMovementForm(false);
                setMessage('✅ Movimiento registrado exitosamente.');
                console.log('🔄 Movimientos de caja recargados desde PostgreSQL');
            } catch (err) {
                console.error('Error registrando movimiento de caja:', err);
                setMessage('❌ No se pudo registrar el movimiento de caja.');
            }
        };

        // Obtener productos disponibles para la venta (solo productos con stock > 0 y categoría "Producto")
        const availableProducts = products.filter(product => 
            product.category === 'Producto' && product.stock > 0
        );
        
        // Calcular saldo con debug detallado
        console.log('🔍 Calculando saldo de caja...');
        console.log('📊 Total de movimientos disponibles:', cashMovements.length);
        
        const currentBalance = cashMovements.reduce((sum, m, index) => {
            const amount = m.type === 'Entrada' ? m.amount : -m.amount;
            console.log(`[${index}] ${m.type}: $${m.amount} | Acumulado: $${sum + amount}`);
            return sum + amount;
        }, 0);
        
        console.log(`💰 SALDO FINAL CALCULADO: $${currentBalance}`);

        return (
            <div className="sales-container">
                <h2>Registrar Venta</h2>
                
                {/* Tabs de navegación */}
                <div className="tab-navigation">
                    <button 
                        className={`tab-button ${activeTab === 'ventas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ventas')}
                    >
                        Registrar Venta
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'caja' ? 'active' : ''}`}
                        onClick={() => setActiveTab('caja')}
                    >
                        Movimientos de Caja
                    </button>
                </div>

                {message && <p className="message">{message}</p>}

                {/* Tab de Ventas */}
                {activeTab === 'ventas' && (
                    <div className="tab-content">
                        <div className="product-selection">
                            <h3>Selecciona Productos</h3>
                            {availableProducts.length === 0 ? (
                                <p>No hay productos disponibles para venta (productos con stock mayor a 0)</p>
                            ) : (
                                availableProducts.map(product => (
                                    <button 
                                        key={product.id} 
                                        className="product-button" 
                                        onClick={() => handleProductSelect(product.name)}
                                        disabled={product.stock === 0}
                                    >
                                        {product.name} (${product.price}) - Stock: {product.stock}
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="cart-summary">
                            <h3>Resumen de Venta</h3>
                            <ul className="list-container">
                                {Object.entries(selectedProducts).map(([name, quantity]) => (
                                    <li key={name} className="list-item">
                                        {name} x {quantity} = ${quantity * getProductPrice(name)}
                                    </li>
                                ))}
                            </ul>
                            <div className="total-display">
                                <strong>Total: ${total}</strong>
                            </div>
                            <button className="checkout-button" onClick={handleRegisterSale} disabled={total === 0}>
                                Confirmar Venta
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab de Caja */}
                {activeTab === 'caja' && (
                    <div className="tab-content">
                        <div className="balance-display">
                            <h3>Saldo Actual de Caja</h3>
                            <div className={`balance-amount ${currentBalance >= 0 ? 'positive' : 'negative'}`}>
                                ${safeToFixed(currentBalance)}
                            </div>
                        </div>
                        
                        {!showMovementForm ? (
                            <button className="main-button" onClick={() => setShowMovementForm(true)}>
                                Registrar Nuevo Movimiento
                            </button>
                        ) : (
                            <form className="form-container" onSubmit={handleRegisterMovement}>
                                <h3>Nuevo Movimiento</h3>
                                <select value={newMovement.type} onChange={e => setNewMovement({ ...newMovement, type: e.target.value })} required>
                                    <option value="Entrada">Entrada</option>
                                    <option value="Salida">Salida</option>
                                </select>
                                <input type="number" value={newMovement.amount} onChange={e => setNewMovement({ ...newMovement, amount: e.target.value })} placeholder="Monto" required />
                                <textarea value={newMovement.description} onChange={e => setNewMovement({ ...newMovement, description: e.target.value })} placeholder="Descripción (ej: Gasto de limpieza)" required />
                                <div className="button-group">
                                    <button type="submit" className="action-button primary">Registrar</button>
                                    <button type="button" className="action-button secondary" onClick={() => setShowMovementForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}
                        
                        <h3>Historial de Movimientos</h3>
                        <ul className="list-container">
                            {cashMovements.map(movement => (
                                <li key={movement.id} className="list-item">
                                    <span>{movement.date} - {movement.description}</span>
                                    <span className={movement.type === 'Entrada' ? 'positive' : 'negative'}>
                                        {movement.type === 'Entrada' ? '+' : '-'} ${movement.amount}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    // Componente de la interfaz de registro de movimientos de caja.
    const CashMovementView = () => {
        const [showMovementForm, setShowMovementForm] = useState(false);
        const [newMovement, setNewMovement] = useState({ type: 'Entrada', amount: '', description: '' });
        const [message, setMessage] = useState('');

        const handleRegisterMovement = async (e) => {
            e.preventDefault();
            const amount = parseFloat(newMovement.amount);
            // Simulación de saldo de caja.
            const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

            // Regla de negocio: Si es una salida, validar saldo.
            if (newMovement.type === 'Salida' && amount > currentBalance) {
                setMessage('�� Saldo insuficiente para registrar esta salida.');
                return;
            }

            const payload = {
                type: newMovement.type,
                amount,
                description: newMovement.description,
            };

            try {
                await api.post('/cash-movements/', payload);
                // Recargar movimientos desde el servidor para evitar inconsistencias/duplicados
                await loadCashMovements();
                setNewMovement({ type: 'Entrada', amount: '', description: '' });
                setShowMovementForm(false);
                setMessage('✅ Movimiento registrado exitosamente.');
            } catch (err) {
                console.error('Error registrando movimiento de caja:', err);
                setMessage('No se pudo registrar el movimiento.');
            }
        };

        return (
            <div className="cash-container">
                <h2>Registro de Caja</h2>
                {message && <p className="message">{message}</p>}
                {!showMovementForm ? (
                    <button className="main-button" onClick={() => setShowMovementForm(true)}>Registrar Nuevo Movimiento</button>
                ) : (
                    <form className="form-container" onSubmit={handleRegisterMovement}>
                        <h3>Nuevo Movimiento</h3>
                        <select value={newMovement.type} onChange={e => setNewMovement({ ...newMovement, type: e.target.value })} required>
                            <option value="Entrada">Entrada</option>
                            <option value="Salida">Salida</option>
                        </select>
                        <input type="number" value={newMovement.amount} onChange={e => setNewMovement({ ...newMovement, amount: e.target.value })} placeholder="Monto" required />
                        <textarea value={newMovement.description} onChange={e => setNewMovement({ ...newMovement, description: e.target.value })} placeholder="Descripción (ej: Gasto de limpieza)" required />
                        <div className="button-group">
                            <button type="submit" className="action-button primary">Registrar</button>
                            <button type="button" className="action-button secondary" onClick={() => setShowMovementForm(false)}>Cancelar</button>
                        </div>
                    </form>
                )}
                <h3>Historial de Movimientos</h3>
                <ul className="list-container">
                    {cashMovements.map(movement => (
                        <li key={movement.id} className="list-item">
                            <span>{movement.date} - {movement.description}</span>
                            <span className={movement.type === 'Entrada' ? 'positive' : 'negative'}>
                                {movement.type === 'Entrada' ? '+' : '-'} ${movement.amount}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Componente de la interfaz de creación de nuevos productos.
        // Componente de la interfaz de creación de nuevos productos.
        const ProductCreationView = () => {
            const [newProduct, setNewProduct] = useState({ 
                name: '', 
                description: '', 
                price: 0, 
                stock: 0, 
                low_stock_threshold: 10,
                category: 'Producto' // Añadimos la categoría por defecto
            });
            const [message, setMessage] = useState('');
    
            const handleCreateProduct = async (e) => {
                e.preventDefault();
                
                // Validaciones
                if (!newProduct.name.trim()) {
                    setMessage('🚫 Error: El nombre del producto es obligatorio.');
                    return;
                }
                
                if (newProduct.price <= 0) {
                    setMessage('🚫 Error: El precio debe ser mayor a 0.');
                    return;
                }
                
                if (newProduct.stock < 0) {
                    setMessage('�� Error: El stock no puede ser negativo.');
                    return;
                }
                
                if (newProduct.low_stock_threshold < 0) {
                    setMessage('🚫 Error: El umbral de stock bajo no puede ser negativo.');
                    return;
                }
    
                // Validar si el producto ya existe completamente (en inventario Y productos)
                const productExistsInInventory = inventory.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase());
                const productExistsInProducts = products.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase());
                
                if (productExistsInInventory && productExistsInProducts) {
                    setMessage('⚠️ Error: El producto ya existe completamente en el sistema.');
                    return;
                }
    
                try {
                    // Verificación específica para Safari antes de crear el producto
                    const token = getAccessToken();
                    if (!token) {
                        setMessage('🚫 Error: No hay token de autenticación. Por favor, vuelve a iniciar sesión.');
                        return;
                    }
                    
                    // Verificar formato del token JWT
                    try {
                        const parts = token.split('.');
                        if (parts.length !== 3) {
                            setMessage('🚫 Error: Token de autenticación inválido. Por favor, vuelve a iniciar sesión.');
                            return;
                        }
                    } catch (tokenError) {
                        setMessage('🚫 Error: Token de autenticación malformado. Por favor, vuelve a iniciar sesión.');
                        return;
                    }
                    
                    
                    // Crear producto en el backend
                    const response = await api.post('/products/', {
                        name: newProduct.name.trim(),
                        description: newProduct.description.trim(),
                        price: parseFloat(newProduct.price),
                        stock: parseInt(newProduct.stock),
                        low_stock_threshold: parseInt(newProduct.low_stock_threshold),
                        category: newProduct.category
                    });

                    // Recargar productos desde PostgreSQL para mantener sincronización
                    await loadProducts();

                    // Limpiar formulario
                    setNewProduct({ 
                        name: '', 
                        description: '', 
                        price: 0, 
                        stock: 0, 
                        low_stock_threshold: 10,
                        category: 'Producto'
                    });
                    setMessage('✅ Producto creado exitosamente y datos recargados desde PostgreSQL.');
                    console.log('🔄 Productos recargados desde PostgreSQL después de crear producto');
                } catch (error) {
                    console.log('❌ Error creando producto:', error);
                    
                    // Manejo específico de errores para Safari
                    if (error.response) {
                        // Error con respuesta del servidor
                        if (error.response.status === 400) {
                            setMessage('🚫 Error: ' + (error.response.data.detail || 'Datos inválidos.'));
                        } else if (error.response.status === 401) {
                            setMessage('🚫 Error: No tienes autorización. Inicia sesión nuevamente.');
                        } else if (error.response.status === 403) {
                            setMessage('🚫 Error: No tienes permisos para realizar esta acción.');
                        } else {
                            setMessage(`🚫 Error del servidor: ${error.response.status}`);
                        }
                    } else if (error.request) {
                        // Error de red o CORS
                        setMessage('🚫 Error: No se pudo conectar con el servidor. Verifica tu conexión.');
                    } else {
                        // Error de configuración
                        setMessage('🚫 Error: ' + (error.message || 'Error desconocido al crear el producto.'));
                    }
                }
            };
    
            return (
                <div className="creation-container">
                    <div style={{marginBottom: '10px'}}>
                        <h2>Crear Productos Nuevos</h2>
                    </div>
                    {message && <p className="message">{message}</p>}
                    <p>Crea nuevos productos e insumos. Los productos creados aparecerán automáticamente en la sección "Inventario" y "Editar Productos".</p>
                    
                    <h3>Agregar nuevo producto</h3>
                    <form className="form-container" onSubmit={handleCreateProduct}>
                        <input 
                            type="text" 
                            value={newProduct.name} 
                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
                            placeholder="Nombre del Producto *" 
                            required 
                        />
                        <textarea 
                            value={newProduct.description} 
                            onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} 
                            placeholder="Descripción del producto (opcional)"
                            rows="3"
                        />
                        <p>Categoría</p>
                        <select
                            value={newProduct.category}
                            onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                            required
                        >
                            <option value="Producto">Producto</option>
                            <option value="Insumo">Insumo</option>
                        </select>
                        <p>Precio</p>
                        <input 
                            type="number" 
                            value={newProduct.price} 
                            onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })} 
                            placeholder="Precio *" 
                           min="0"
                            //step="0.01"
                            required 
                        />
                        <p>Stock Inicial</p>
                        <input 
                            type="number" 
                            value={newProduct.stock} 
                            onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })} 
                            placeholder="Stock Inicial *" 
                            min="0"
                            required 
                        />
                        <p>Umbral de stock</p>
                        <input 
                            type="number" 
                            value={newProduct.low_stock_threshold} 
                            onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: parseInt(e.target.value) || 10 })} 
                            placeholder="Umbral de Stock Bajo (por defecto: 10)" 
                            min="0"
                        />
                        <button type="submit" className="main-button">Crear Producto</button>
                    </form>
                </div>
            );
        };

        // Componente de la interfaz de gestión de proveedores (solo para Gerente).
        const SupplierManagement = () => {
            const [showAddSupplier, setShowAddSupplier] = useState(false);
            const [newSupplier, setNewSupplier] = useState({ 
                name: '', 
                cuit: '', 
                address: '', 
                phone: '', 
                products: '' 
            });
            const [message, setMessage] = useState('');
    
            // Función para validar CUIT (11 dígitos)
            const validateCUIT = (cuit) => {
                return /^\d{11}$/.test(cuit);
            };
    
            // Función para validar teléfono (mínimo 8 dígitos, solo números)
            const validatePhone = (phone) => {
                return /^\d{8,}$/.test(phone);
            };
    
            const handleAddSupplier = (e) => {
                e.preventDefault();
                
                // Validaciones según la especificación
                if (!newSupplier.name.trim()) {
                    setMessage('🚫 Error: El nombre es obligatorio.');
                    return;
                }
                
                if (!validateCUIT(newSupplier.cuit)) {
                    setMessage('🚫 Error: El CUIT debe ser un número de 11 dígitos.');
                    return;
                }
                
                if (!validatePhone(newSupplier.phone)) {
                    setMessage('�� Error: El teléfono debe contener solo números, con un mínimo de 8 dígitos.');
                    return;
                }
                
                // Validar si el proveedor ya existe por CUIT
                const supplierExists = suppliers.some(s => s.cuit === newSupplier.cuit);
                if (supplierExists) {
                    setMessage('🚫 Error: El CUIT ya existe en el sistema.');
                    return;
                }
                
                // Agregar el nuevo proveedor
                const id = Math.max(...suppliers.map(s => s.id)) + 1;
                setSuppliers([...suppliers, { ...newSupplier, id }]);
                setNewSupplier({ name: '', cuit: '', address: '', phone: '', products: '' });
                setShowAddSupplier(false);
                setMessage('✅ Proveedor registrado exitosamente.');
            };
    
            const handleDeleteSupplier = (supplierId) => {
                const supplierToDelete = suppliers.find(s => s.id === supplierId);
                if (window.confirm(`¿Estás seguro de que quieres eliminar a ${supplierToDelete.name}?`)) {
                    setSuppliers(suppliers.filter(supplier => supplier.id !== supplierId));
                    setMessage('✅ Proveedor eliminado exitosamente.');
                }
            };
    
            return (
                <div className="management-container">
                    <h2>Gestión de Proveedores</h2>
                    {message && <p className="message">{message}</p>}
                    {!showAddSupplier ? (
                        <button className="main-button" onClick={() => setShowAddSupplier(true)}>Registrar Nuevo Proveedor</button>
                    ) : (
                        <form className="form-container" onSubmit={handleAddSupplier}>
                            <h3>Registrar Proveedor Nuevo</h3>
                            <input 
                                type="text" 
                                value={newSupplier.name} 
                                onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} 
                                placeholder="Nombre del Proveedor" 
                                required 
                            />
                            <input 
                                type="text" 
                                value={newSupplier.cuit} 
                                onChange={e => setNewSupplier({ ...newSupplier, cuit: e.target.value })} 
                                placeholder="CUIT (11 dígitos)" 
                                maxLength="11"
                                required 
                            />
                            <input 
                                type="text" 
                                value={newSupplier.address} 
                                onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })} 
                                placeholder="Dirección" 
                                required 
                            />
                            <input 
                                type="text" 
                                value={newSupplier.phone} 
                                onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} 
                                placeholder="Teléfono (mínimo 8 dígitos)" 
                                required 
                            />
                            <textarea 
                                value={newSupplier.products} 
                                onChange={e => setNewSupplier({ ...newSupplier, products: e.target.value })} 
                                placeholder="Productos que ofrece (separados por comas)" 
                                required 
                            />
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar Proveedor</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddSupplier(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Proveedores Registrados</h3>
                    <ul className="list-container">
                        {suppliers.map(supplier => (
                            <li key={supplier.id} className="list-item">
                                <div className="supplier-item">
                                    <div className="supplier-info">
                                        <span className="supplier-name">{supplier.name}</span>
                                        <div className="supplier-details">
                                            <small>CUIT: {supplier.cuit}</small>
                                            <br />
                                            <small>�� {supplier.phone} | 📍 {supplier.address}</small>
                                        </div>
                                    </div>
                                    <div className="supplier-products">
                                        <strong>Productos:</strong> {supplier.products}
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteSupplier(supplier.id)} className="delete-button">Eliminar</button>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };
    
        // Componente de la interfaz de gestión de compras (para Gerente, Encargado, Cajero, Panadero).
        const PurchaseManagement = () => {
            const [showAddPurchase, setShowAddPurchase] = useState(false);
            const [newPurchase, setNewPurchase] = useState({
                date: '',
                supplierId: '',
                items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
            });
            const [message, setMessage] = useState('');
            const [confirmDelete, setConfirmDelete] = useState(null); // ID de la compra a eliminar
    
            // Función para validar fecha en formato dd/mm/aaaa
            const validateDate = (date) => {
                const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
                return dateRegex.test(date);
            };
    
            // Función para calcular el total de un item
            const calculateItemTotal = (quantity, unitPrice) => {
                const safeQuantity = isNaN(quantity) ? 0 : (quantity || 0);
                const safeUnitPrice = isNaN(unitPrice) ? 0 : (unitPrice || 0);
                return safeQuantity * safeUnitPrice;
            };
    
            // Función para agregar un nuevo item a la compra
            const addItem = () => {
                setNewPurchase({
                    ...newPurchase,
                    items: [...newPurchase.items, { productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                });
            };
    
            // Función para eliminar un item de la compra
            const removeItem = (index) => {
                if (newPurchase.items.length > 1) {
                    const updatedItems = newPurchase.items.filter((_, i) => i !== index);
                    setNewPurchase({ ...newPurchase, items: updatedItems });
                }
            };
    
            // Función para actualizar un item
            const updateItem = (index, field, value) => {
                const updatedItems = [...newPurchase.items];
                updatedItems[index] = { ...updatedItems[index], [field]: value };
                
                // Recalcular el total del item
                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = field === 'quantity' ? (value || 0) : (updatedItems[index].quantity || 0);
                    const unitPrice = field === 'unitPrice' ? (value || 0) : (updatedItems[index].unitPrice || 0);
                    updatedItems[index].total = calculateItemTotal(quantity, unitPrice);
                }
                
                setNewPurchase({ ...newPurchase, items: updatedItems });
            };
    
            // Función para calcular el total de la compra
            const calculatePurchaseTotal = () => {
                return newPurchase.items.reduce((sum, item) => sum + item.total, 0);
            };
    
            const handleAddPurchase = async (e) => {
                e.preventDefault();
                
                // Validaciones según la especificación
              /*  if (!validateDate(newPurchase.date)) {
                    setMessage('🚫 Error: La fecha debe estar en formato dd/mm/aaaa.');
                    return;
                }*/
                
                if (!newPurchase.supplierId) {
                    setMessage('Debe seleccionar un proveedor.');
                    return;
                }
                
                // Validar que todos los items tengan datos válidos
                const invalidItems = newPurchase.items.some(item => 
                    !item.productName.trim() || item.quantity <= 0 || item.unitPrice <= 0
                );
                
                if (invalidItems) {
                    setMessage('🚫 Error: Todos los productos deben tener nombre, cantidad y precio válidos.');
                    return;
                }
                
                // Verificar que el proveedor existe
                const selectedSupplier = suppliers.find(s => s.id === parseInt(newPurchase.supplierId));
                if (!selectedSupplier) {
                    setMessage('🚫 Error: El proveedor seleccionado no existe.');
                    return;
                }
                
                // Crear la nueva compra (persistida en el backend)
                // Asegurarnos de calcular el total desde quantity * unitPrice para evitar campos stale
                const itemsForPayload = newPurchase.items.map(item => {
                    const quantity = Number(item.quantity) || 0;
                    const unitPrice = Number(item.unitPrice) || 0;
                    return {
                        productName: item.productName,
                        quantity,
                        unitPrice,
                        total: quantity * unitPrice
                    };
                });

                const totalAmount = itemsForPayload.reduce((sum, it) => sum + it.total, 0);

                const purchasePayload = {
                    date: newPurchase.date,
                    supplier: selectedSupplier.name,
                    supplier_id: parseInt(newPurchase.supplierId), // backend campo snake_case
                    items: itemsForPayload,
                    total_amount: totalAmount,
                    status: 'Completada'
                };

                try {
                    // Actualizar inventario con los productos comprados (también en el backend)
                    for (const item of newPurchase.items) {
                        // Buscar si el producto ya existe en el backend
                        const existingProduct = products.find(p => p.name === item.productName);
                        
                        if (existingProduct) {
                            // Si existe, actualizar el stock en el backend
                            const updatedProduct = {
                                ...existingProduct,
                                stock: existingProduct.stock + item.quantity
                            };
                            await api.put(`/products/${existingProduct.id}/`, updatedProduct);
                            console.log(`✅ Stock actualizado para ${item.productName}: +${item.quantity}`);
                        } else {
                            // Si no existe, crear nuevo producto/insumo en el backend
                            const newProduct = {
                                name: item.productName,
                                price: item.unitPrice,
                                category: 'Insumo',
                                stock: item.quantity,
                                description: `Agregado automáticamente desde una compra (${new Date().toLocaleString()})`,
                                low_stock_threshold: 10
                            };
                            await api.post('/products/', newProduct);
                            console.log(`✅ Nuevo insumo creado: ${item.productName} con stock ${item.quantity}`);
                        }
                    }
                    
                    // Persistir la compra en el backend
                    const resp = await api.post('/purchases/', purchasePayload);

                    // Recargar productos y sincronizar estado
                    await loadProducts();

                    // Añadir la compra retornada por el servidor al estado local (normalizar campos)
                    const savedPurchaseRaw = resp.data;
                    const savedPurchase = normalizePurchaseFromServer(savedPurchaseRaw);
                    setPurchases(prev => [...prev, savedPurchase]);

                    setNewPurchase({
                        date: '',
                        supplierId: '',
                        items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                    });
                    setShowAddPurchase(false);
                    setMessage('✅ Compra registrada exitosamente y guardada en el servidor.');
                } catch (error) {
                    console.error('❌ Error procesando compra:', error);
                    setMessage('❌ Error: No se pudo procesar la compra. Inténtalo nuevamente.');
                }
            };

            // Función para eliminar una compra del historial
            const handleDeletePurchase = async (purchaseId) => {
                if (confirmDelete === purchaseId) {
                    try {
                        // Intentar eliminar en backend
                        await api.delete(`/purchases/${purchaseId}/`);
                    } catch (error) {
                        console.warn('⚠️ No se pudo eliminar compra en backend, se procederá a eliminar localmente:', error);
                    }

                    // Confirmar eliminación local
                    const updatedPurchases = purchases.filter(purchase => purchase.id !== purchaseId);
                    setPurchases(updatedPurchases);
                    setConfirmDelete(null);
                    setMessage('✅ Compra eliminada del historial exitosamente.');
                } else {
                    // Mostrar confirmación
                    setConfirmDelete(purchaseId);
                    setMessage('⚠️ ¿Estás seguro de que deseas eliminar esta compra del historial? Haz clic nuevamente en "Eliminar" para confirmar.');
                }
            };

            // Función para cancelar la eliminación
            const handleCancelDelete = () => {
                setConfirmDelete(null);
                setMessage('');
            };
    
            return (
                <div className="management-container">
                    <h2>Gestión de Compras</h2>
                    {message && <p className="message">{message}</p>}
                    {!showAddPurchase ? (
                        <button className="main-button" onClick={() => setShowAddPurchase(true)}>Registrar Nueva Compra</button>
                    ) : (
                        <form className="form-container" onSubmit={handleAddPurchase}>
                            <h3>Registrar Compra</h3>
                            
                            <input 
                                type="date" 
                                value={newPurchase.date} 
                                onChange={e => setNewPurchase({ ...newPurchase, date: e.target.value })} 
                                placeholder="Fecha (dd/mm/aaaa)" 
                                required 
                            />
                            
                            <select 
                                value={newPurchase.supplierId} 
                                onChange={e => setNewPurchase({ ...newPurchase, supplierId: e.target.value })} 
                                required
                            >
                                <option value="">Seleccionar Proveedor</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name} - {supplier.cuit}
                                    </option>
                                ))}
                            </select>
                            
                            <h4>Productos de la Compra</h4>
                            {newPurchase.items.map((item, index) => (
                                <div key={index} className="purchase-item">
                                    <div className="item-row">
                                        <input 
                                            type="text" 
                                            value={item.productName} 
                                            onChange={e => updateItem(index, 'productName', e.target.value)} 
                                            placeholder="Nombre del Producto" 
                                            required 
                                        />
                                        <input 
                                            type="number" 
                                            value={item.quantity || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                updateItem(index, 'quantity', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Cantidad" 
                                            min="1"
                                            required 
                                        />
                                        <input 
                                            type="number" 
                                            value={item.unitPrice || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                updateItem(index, 'unitPrice', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Precio Unitario" 
                                            min="0.01"
                                            step="0.01"
                                            required 
                                        />
                                        <span className="item-total">${safeToFixed(item.total)}</span>
                                        {newPurchase.items.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)}
                                                className="remove-item-button"
                                            >
                                                ❌
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button type="button" onClick={addItem} className="add-item-button">
                                ➕ Agregar Producto
                            </button>
                            
                            <div className="purchase-total">
                                <strong>Total de la Compra: ${safeToFixed(calculatePurchaseTotal())}</strong>
                            </div>
                            
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar Compra</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddPurchase(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Historial de Compras</h3>
                    <ul className="list-container">
                        {purchases.map(purchase => (
                            <li key={purchase.id} className="purchase-list-item">
                                <div className="purchase-header">
                                    <strong>Compra #{purchase.id} - {purchase.date}</strong>
                                    <div className="purchase-actions">
                                        <span className="purchase-status">{purchase.status}</span>
                                        {userRole === 'Gerente' && (
                                            <div className="delete-controls">
                                                {confirmDelete === purchase.id ? (
                                                    <div className="confirm-delete">
                                                        <button 
                                                            className="action-button danger small"
                                                            onClick={() => handleDeletePurchase(purchase.id)}
                                                        >
                                                            ✓ Confirmar
                                                        </button>
                                                        <button 
                                                            className="action-button secondary small"
                                                            onClick={handleCancelDelete}
                                                        >
                                                            ✕ Cancelar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        className="action-button danger small"
                                                        onClick={() => handleDeletePurchase(purchase.id)}
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="purchase-supplier">
                                    <strong>Proveedor:</strong> {purchase.supplierName}
                                </div>
                                <div className="purchase-items">
                                    <strong>Productos:</strong>
                                    <ul>
                                        {purchase.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity} x ${item.unitPrice} = ${safeToFixed(item.total)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="purchase-total-display">
                                    <strong>Total: ${safeToFixed(purchase.totalAmount)}</strong>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };
    
        // Componente de la interfaz de gestión de pedidos de clientes (solo para Gerente).
        const OrderManagement = () => {
            const [showAddOrder, setShowAddOrder] = useState(false);
            const [newOrder, setNewOrder] = useState({
                customerName: '',
                date: new Date().toISOString().split('T')[0], // Fecha actual por defecto
                paymentMethod: '',
                items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }],
                notes: ''
            });
            const [message, setMessage] = useState('');
    
            // Función para agregar un nuevo item al pedido
            const addItem = () => {
                setNewOrder({
                    ...newOrder,
                    items: [...newOrder.items, { productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                });
            };
    
            // Función para eliminar un item del pedido
            const removeItem = (index) => {
                if (newOrder.items.length > 1) {
                    const updatedItems = newOrder.items.filter((_, i) => i !== index);
                    setNewOrder({ ...newOrder, items: updatedItems });
                }
            };
    
            // Función para actualizar un item
            const updateItem = (index, field, value) => {
                const updatedItems = [...newOrder.items];
                updatedItems[index] = { ...updatedItems[index], [field]: value };
                
                // Si se cambia el nombre del producto, buscar su precio en la lista de productos
                if (field === 'productName') {
                    const selectedProduct = products.find(p => p.name === value);
                    if (selectedProduct) {
                        updatedItems[index].unitPrice = selectedProduct.price;
                        updatedItems[index].total = (updatedItems[index].quantity || 0) * selectedProduct.price;
                    }
                }
                
                // Recalcular el total del item si se cambia cantidad o precio
                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = field === 'quantity' ? (value || 0) : (updatedItems[index].quantity || 0);
                    const unitPrice = field === 'unitPrice' ? (value || 0) : (updatedItems[index].unitPrice || 0);
                    updatedItems[index].total = quantity * unitPrice;
                }
                
                setNewOrder({ ...newOrder, items: updatedItems });
            };

            // Función para calcular el total del pedido
            const calculateOrderTotal = () => {
                return newOrder.items.reduce((sum, item) => sum + (item.total || 0), 0);
            };
    
            const handleAddOrder = async (e) => {
                e.preventDefault();
                
                // Validaciones
                if (!newOrder.customerName.trim()) {
                    setMessage('🚫 Error: Debe ingresar el nombre del cliente.');
                    return;
                }
                
                if (!newOrder.paymentMethod) {
                    setMessage('🚫 Error: Debe seleccionar un método de pago.');
                    return;
                }
                
                // Validar que al menos un producto tenga cantidad mayor a 0 y precio válido
                const validItems = newOrder.items.filter(item => 
                    item.productName.trim() && item.quantity > 0 && item.unitPrice > 0
                );
                
                if (validItems.length === 0) {
                    setMessage('🚫 Error: Debe seleccionar al menos un producto con cantidad y precio válidos.');
                    return;
                }
                
                // Enviar pedido al backend para persistencia cross-browser
                try {
                    const payload = {
                        customer_name: newOrder.customerName,
                        date: newOrder.date,
                        payment_method: newOrder.paymentMethod,
                        items: validItems.map(i => ({ product_name: i.productName, quantity: Number(i.quantity), unit_price: Number(i.unitPrice), total: Number(i.total) })),
                        notes: newOrder.notes
                    };

                    const res = await api.post('/orders/', payload);
                    if (res && res.data) {
                        // Insertar el pedido devuelto por el servidor
                        const created = res.data;
                        const createdNormalized = {
                            id: created.id,
                            date: created.date,
                            customerName: created.customer_name || created.customerName || '',
                            paymentMethod: created.payment_method || created.paymentMethod || '',
                            items: Array.isArray(created.items) ? created.items.map(it => ({ productName: it.product_name || it.productName || '', quantity: it.quantity, unitPrice: it.unit_price || it.unitPrice || 0, total: it.total || 0 })) : [],
                            totalAmount: created.total_amount || created.totalAmount || 0,
                            status: created.status || 'Pendiente',
                            notes: created.notes || ''
                        };

                        setOrders(prev => [...prev, createdNormalized]);
                        setNewOrder({ customerName: '', date: new Date().toISOString().split('T')[0], paymentMethod: '', items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }], notes: '' });
                        setShowAddOrder(false);
                        setMessage('✅ Pedido de cliente registrado exitosamente.');
                    } else {
                        setMessage('⚠️ Pedido creado localmente, pero no se obtuvo confirmación del servidor.');
                    }
                } catch (err) {
                    console.error('Error enviando pedido al backend:', err, err.response && err.response.data);
                    setMessage('❌ Error guardando el pedido en el servidor. Revisar consola.');
                }
            };
    
            const handleUpdateOrderStatus = (orderId, newStatus) => {
                setOrders(orders.map(order => 
                    order.id === orderId 
                        ? { ...order, status: newStatus }
                        : order
                ));
            };
    
            return (
                <div className="management-container">
                    <h2>Gestión de Pedidos de Clientes</h2>
                    {message && <p className="message">{message}</p>}
                    {!showAddOrder ? (
                        <button className="main-button" onClick={() => setShowAddOrder(true)}>Registrar Nuevo Pedido de Cliente</button>
                    ) : (
                        <form className="form-container" onSubmit={handleAddOrder}>
                            <h3>Registrar Pedido de Cliente</h3>
                            
                            <input 
                                type="text" 
                                value={newOrder.customerName} 
                                onChange={e => setNewOrder({ ...newOrder, customerName: e.target.value })} 
                                placeholder="Nombre del cliente" 
                                required
                            />
                            
                            <input 
                                type="date" 
                                value={newOrder.date} 
                                onChange={e => setNewOrder({ ...newOrder, date: e.target.value })} 
                                required
                            />
                            
                            <select 
                                value={newOrder.paymentMethod} 
                                onChange={e => setNewOrder({ ...newOrder, paymentMethod: e.target.value })} 
                                required
                            >
                                <option value="">Seleccionar método de pago</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="debito">Débito</option>
                                <option value="credito">Crédito</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                            
                            <h4>Productos del Pedido</h4>
                            
                            {newOrder.items.map((item, index) => (
                                <div key={index} className="order-item">
                                    <div className="item-row">
                                        <input 
                                            type="text" 
                                            value={item.productName} 
                                            onChange={e => updateItem(index, 'productName', e.target.value)} 
                                            placeholder="Nombre del producto" 
                                            list="products-list"
                                            required
                                        />
                                        <datalist id="products-list">
                                            {products.map((product, idx) => (
                                                <option key={idx} value={product.name} />
                                            ))}
                                        </datalist>
                                        <input 
                                            type="number" 
                                            value={item.quantity || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                updateItem(index, 'quantity', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Cantidad" 
                                            min="1"
                                            required 
                                        />
                                        <input 
                                            type="number" 
                                            value={item.unitPrice || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                updateItem(index, 'unitPrice', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Precio Unitario" 
                                            min="0.01"
                                            step="0.01"
                                            required 
                                        />
                                        <span className="item-total">${safeToFixed(item.total)}</span>
                                        {newOrder.items.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)}
                                                className="remove-item-button"
                                            >
                                                ❌
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button type="button" onClick={addItem} className="add-item-button">
                                ➕ Agregar Producto
                            </button>
                            
                            <textarea 
                                value={newOrder.notes} 
                                onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} 
                                placeholder="Notas adicionales del pedido" 
                            />
                            
                            <div className="purchase-total">
                                <strong>Total del Pedido: ${safeToFixed(calculateOrderTotal())}</strong>
                            </div>
                            
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar Pedido</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddOrder(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Historial de Pedidos de Clientes</h3>
                    <ul className="list-container">
                        {orders.map(order => (
                            <li key={order.id} className="order-list-item">
                                <div className="order-header">
                                    <strong>Pedido #{order.id} - {order.date}</strong>
                                    <div className="order-status-controls">
                                        <span className={`order-status ${order.status.toLowerCase()}`}>
                                            {order.status}
                                        </span>
                                        <select 
                                            value={order.status} 
                                            onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}
                                            className="status-select"
                                        >
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="En Preparación">En Preparación</option>
                                            <option value="Listo">Listo</option>
                                            <option value="Entregado">Entregado</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="order-customer">
                                    <strong>Cliente:</strong> {order.customerName}
                                </div>
                                <div className="order-payment">
                                    <strong>Método de Pago:</strong> {order.paymentMethod}
                                </div>
                                <div className="order-items">
                                    <strong>Productos solicitados:</strong>
                                    <ul>
                                        {order.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity || 0} unidades 
                                                x ${safeToFixed(item.unitPrice)} = ${safeToFixed(item.total)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="order-total-display">
                                    <strong>Total: ${safeToFixed(order.totalAmount)}</strong>
                                </div>
                                {order.notes && (
                                    <div className="order-notes">
                                        <strong>Notas:</strong> {order.notes}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };
    
        // Mapeo de traducción para encabezados de tablas
        const headerTranslationMap = {
            'name': 'Nombre',
            'cuit': 'CUIT',
            'phone': 'Teléfono',
            'address': 'Dirección',
            'products': 'Productos',
            'id': 'ID',
            'date': 'Fecha',
            'email': 'Email',
            'role': 'Rol',
            'username': 'Usuario',
            'type': 'Tipo',
            'amount': 'Monto',
            'description': 'Descripción',
            'price': 'Precio',
            'stock': 'Stock',
            'category': 'Categoría',
            'status': 'Estado',
            'supplier': 'Proveedor',
            'total': 'Total',
            'quantity': 'Cantidad',
            'product': 'Producto',
            // Traducciones para el resumen
            'totalSuppliers': 'Total de Proveedores',
            'activeSuppliers': 'Proveedores Activos',
            'totalSales': 'Total de Ventas',
            'totalRevenue': 'Ingresos Totales',
            'totalPurchases': 'Total de Compras',
            'totalAmount': 'Monto Total',
            'totalOrders': 'Total de Pedidos',
            'pendingOrders': 'Pedidos Pendientes',
            'sentOrders': 'Pedidos Enviados',
            'customerName': 'Cliente',
            'customer_name': 'Cliente',
            'paymentMethod': 'Método de Pago',
            'payment_method': 'Método de Pago',
            'products': 'Productos',
            'units': 'Unidades',
            'totalMovements': 'Total de Movimientos',
            'totalIncome': 'Ingresos Totales',
            'totalExpenses': 'Gastos Totales',
            'period': 'Período'
        };

        // Componente de la interfaz de consulta de datos (solo para Gerente).
        const DataConsultation = () => {
            const [selectedQuery, setSelectedQuery] = useState('');
            const [startDate, setStartDate] = useState('');
            const [endDate, setEndDate] = useState('');
            const [queryResults, setQueryResults] = useState(null);
            const [message, setMessage] = useState('');
            const [isLoading, setIsLoading] = useState(false);
    
            // Cargar consulta activa al montar el componente (solo si hay token)
            useEffect(() => {
                const token = getAccessToken();
                if (token) {
                    console.log('🔄 [useEffect] Iniciando carga de consulta activa y prueba directa');
                    loadActiveQuery();
                    // TEMPORAL: Ejecutar prueba directa
                    testDirectRequest();
                } else {
                    console.log('ℹ️ No hay token disponible, omitiendo carga de consulta activa');
                }
            }, []);

            // Función para cargar consulta activa desde el backend
            const loadActiveQuery = async () => {
                try {
                    // Verificar que tenemos un token antes de hacer la petición
                    const token = getAccessToken();
                    if (!token) {
                        return;
                    }

                    setIsLoading(true);
                    setMessage('');

                    const response = await api.get('/user-queries/active_query/');

                    if (response.data) {
                        setSelectedQuery(response.data.query_type);
                        setStartDate(response.data.start_date || '');
                        setEndDate(response.data.end_date || '');
                        setQueryResults(response.data.results_data);
                        setMessage('');
                    }
                } catch (error) {
                    setQueryResults(null);
                    if (error.response?.status === 404) {
                        console.log('No hay ninguna consulta guardada para este usuario. Realiza una consulta y guárdala para verla aquí.');
                    }
                } finally {
                    setIsLoading(false);
                }
            };

            // Función de prueba TEMPORAL para petición directa sin interceptor
            const testDirectRequest = async () => {
                try {
                    const token = getAccessToken();
                    if (!token) {
                        return;
                    }
                    const axiosRaw = await import('axios');
                    // Usar la ruta proxied `/api/...` para que CRA dev-server haga el proxy
                    // y las cookies HttpOnly establecidas por el backend lleguen al navegador.
                    const response = await axiosRaw.default.get('/api/user-queries/active_query/', {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        timeout: 10000,
                        withCredentials: true
                    });
                    return response.data;
                } catch (error) {
                    return null;
                }
            };

            // Función para guardar consulta en el backend
            const saveQueryToBackend = async (queryType, startDate, endDate, results) => {
                const payload = {
                    query_type: queryType,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    results_data: results
                };

                try {
                    // Primero intentar buscar si ya existe la consulta para este usuario y tipo
                    const listResp = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
                    const items = Array.isArray(listResp.data) ? listResp.data : (listResp.data?.results || []);

                    if (items && items.length > 0) {
                        // Existe: actualizar (PATCH)
                        const existing = items[0];
                        const id = existing.id;
                        try {
                            const patchResp = await api.patch(`/user-queries/${id}/`, payload);
                            if (patchResp?.data) {
                                console.log('✅ Consulta existente actualizada en backend (patch)');
                                return;
                            }
                        } catch (patchErr) {
                            console.warn('⚠️ Error parchando consulta existente, intentaremos POST como fallback:', patchErr?.response?.data || patchErr?.message || patchErr);
                            // Intentar POST como último recurso (race condition improbable)
                        }
                    }

                    // Si no existe o el PATCH falló, intentar crear (POST)
                    const postResp = await api.post('/user-queries/', payload);
                    if (postResp?.data) {
                        console.log('✅ Consulta guardada en backend (creada)');
                        return;
                    }
                } catch (error) {
                    // Manejo de errores: si falla por unique constraint (race) intentamos buscar y parchear
                    const status = error?.response?.status;
                    const data = error?.response?.data;
                    console.warn('Advertencia al guardar consulta (fase final), intentando recuperación:', status, data);

                    try {
                        const listResp2 = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
                        const items2 = Array.isArray(listResp2.data) ? listResp2.data : (listResp2.data?.results || []);
                        if (items2 && items2.length > 0) {
                            const existing = items2[0];
                            const id = existing.id;
                            const patchResp2 = await api.patch(`/user-queries/${id}/`, payload);
                            if (patchResp2?.data) {
                                console.log('✅ Consulta existente actualizada en backend (patch) [recovery]');
                                return;
                            }
                        }
                    } catch (recErr) {
                        console.error('Error intentando recuperar/actualizar consulta después de fallo:', recErr?.response?.data || recErr?.message || recErr);
                    }

                    console.error('Error final guardando consulta (no creada ni actualizada):', data || error.message || error);
                }
            };

            // Función para limpiar consulta activa
            const clearActiveQuery = async () => {
                try {
                    await api.post('/user-queries/clear_active_query/');
                    console.log('🧹 Consulta activa limpiada del backend');
                } catch (error) {
                    console.error('Error limpiando consulta:', error.response?.data || error.message);
                }
            };
    
            // Función para convertir fecha yyyy-mm-dd a dd/mm/yyyy
            const formatDateForDisplay = (dateStr) => {
                if (!dateStr) return '';
                const [year, month, day] = dateStr.split('-');
                return `${day}/${month}/${year}`;
            };
    
            // Función para convertir fecha dd/mm/yyyy a Date
            const parseDisplayDate = (dateStr) => {
                const [day, month, year] = dateStr.split('/');
                return new Date(year, month - 1, day);
            };
    
            // Función para convertir fecha yyyy-mm-dd a Date
            const parseInputDate = (dateStr) => {
                return new Date(dateStr);
            };

                // Función que intenta parsear una fecha en varios formatos comunes
                const parseAnyDate = (dateStr) => {
                    if (!dateStr) return null;
                    // Si ya es objeto Date
                    if (dateStr instanceof Date) return dateStr;
                    // dd/mm/yyyy
                    if (typeof dateStr === 'string' && dateStr.includes('/')) {
                        try {
                            return parseDisplayDate(dateStr);
                        } catch (e) {
                            // fallthrough
                        }
                    }
                    // yyyy-mm-dd or ISO
                    if (typeof dateStr === 'string' && dateStr.includes('-')) {
                        try {
                            return parseInputDate(dateStr);
                        } catch (e) {
                            // fallthrough
                        }
                    }
                    // intento genérico
                    const parsed = new Date(dateStr);
                    return isNaN(parsed.getTime()) ? null : parsed;
                };
    
            // Función para ejecutar consulta
            const executeQuery = async () => {
                if (!selectedQuery) {
                    setMessage('🚫 Error: Debe seleccionar un tipo de consulta.');
                    return;
                }
    
                if (startDate && endDate) {
                    const start = parseInputDate(startDate);
                    const end = parseInputDate(endDate);
                    if (start > end) {
                        setMessage('🚫 Error: La fecha de inicio no puede ser posterior a la fecha de fin.');
                        return;
                    }
                }
    
                setMessage('');
                setIsLoading(true);
    
                try {
                    let results = null;
                    
                    // Ejecutar consulta según el tipo seleccionado
                    switch (selectedQuery) {
                        case 'stock':
                            results = await executeStockQuery();
                            break;
                        case 'proveedores':
                            results = await executeSuppliersQuery();
                            break;
                        case 'ventas':
                            results = await executeSalesQuery();
                            break;
                        case 'compras':
                            results = await executePurchasesQuery();
                            break;
                        case 'pedidos':
                            results = await executeOrdersQuery();
                            break;
                        case 'movimientos_caja':
                            results = await executeCashMovementsQuery();
                            break;
                        default:
                            setMessage('🚫 Error: Tipo de consulta no válido.');
                            return;
                    }

                    if (results) {
                        setQueryResults(results);
                        // Guardar en backend de forma asíncrona
                        await saveQueryToBackend(selectedQuery, startDate, endDate, results);
                    }
                } catch (error) {
                    setMessage('🚫 Error ejecutando la consulta: ' + error.message);
                } finally {
                    setIsLoading(false);
                }
            };
    
            // Consulta de stock
            const executeStockQuery = async () => {
                const lowStockItems = inventory.filter(item => item.stock < 10);
                const results = {
                    title: 'Estado del Stock',
                    summary: {
                        totalProducts: inventory.length,
                        lowStockItems: lowStockItems.length,
                        totalStock: inventory.reduce((sum, item) => sum + item.stock, 0)
                    },
                    data: inventory.map(item => ({
                        name: item.name,
                        stock: item.stock,
                        type: item.type,
                        status: item.stock < 10 ? 'Stock Bajo' : item.stock < 20 ? 'Stock Medio' : 'Stock Alto'
                    }))
                };
                return results;
            };
    
            // Consulta de proveedores
            const executeSuppliersQuery = async () => {
                const results = {
                    title: 'Información de Proveedores',
                    summary: {
                        totalSuppliers: suppliers.length,
                        activeSuppliers: suppliers.length
                    },
                    data: suppliers.map(supplier => ({
                        name: supplier.name,
                        cuit: supplier.cuit,
                        phone: supplier.phone,
                        address: supplier.address,
                        products: supplier.products
                    }))
                };
                return results;
            };
    
            // Consulta de ventas (simulada)
            const executeSalesQuery = async () => {
                // Usar ventas reales traídas desde backend (estado `sales`).
                const allSales = Array.isArray(sales) ? sales : [];

                console.log('🔎 executeSalesQuery - sales length:', allSales.length);
                console.log('🔎 executeSalesQuery - sample sales (0..2):', allSales.slice(0,3));

                // Cada sale puede contener `sale_items` o `sale_items` anidados; normalizamos
                const rows = [];

                for (const s of allSales) {
                    // Fecha: preferir timestamp/created_at o timestamp formateado
                    const date = s.timestamp || s.created_at || s.date || '';

                    // Determinar items dentro de la venta
                    let itemsArr = [];
                    if (Array.isArray(s.sale_items) && s.sale_items.length > 0) {
                        itemsArr = s.sale_items.map(it => ({
                            product: it.product_name || it.product || it.name || '',
                            quantity: it.quantity || it.qty || 0,
                            total: it.price || it.total || 0
                        }));
                    } else if (Array.isArray(s.items) && s.items.length > 0) {
                        itemsArr = s.items.map(it => ({
                            product: it.product_name || it.productName || it.product || '',
                            quantity: it.quantity || it.qty || 0,
                            total: it.total || it.price || 0
                        }));
                    }

                    // Si no hay items explícitos, podemos intentar inferir de campos totales
                    if (itemsArr.length === 0 && s.product) {
                        itemsArr = [{ product: s.product, quantity: s.quantity || 1, total: s.total || s.amount || 0 }];
                    }

                    // Agregar una fila por cada item para que la tabla muestre productos individuales
                    for (const it of itemsArr) {
                        rows.push({ date, product: it.product, quantity: it.quantity, total: it.total });
                    }
                    console.log('🔎 executeSalesQuery - built rows count before filter:', rows.length);
                }

                // Filtrar por rango de fechas si aplica
                const filteredSales = rows.filter(sale => {
                    if (startDate && endDate) {
                        const saleDate = parseAnyDate(sale.date) || null;
                        const start = parseAnyDate(startDate);
                        const end = parseAnyDate(endDate);
                        if (!saleDate || !start || !end) return false;
                        return saleDate >= start && saleDate <= end;
                    }
                    return true;
                });

                console.log('🔎 executeSalesQuery - filtered rows count:', filteredSales.length);

                const results = {
                    title: 'Reporte de Ventas',
                    summary: {
                        totalSales: filteredSales.length,
                        totalRevenue: filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0),
                        period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
                    },
                    data: filteredSales.map(r => ({ date: r.date, product: r.product, quantity: r.quantity, total: r.total }))
                };
                return results;
            };
    
            // Consulta de compras
            const executePurchasesQuery = async () => {
                const filteredPurchases = purchases.filter(purchase => {
                    if (startDate && endDate) {
                        const purchaseDate = parseAnyDate(purchase.date);
                        const start = parseAnyDate(startDate);
                        const end = parseAnyDate(endDate);
                        if (!purchaseDate || !start || !end) return false;
                        return purchaseDate >= start && purchaseDate <= end;
                    }
                    return true;
                });
                // Normalizar cada compra para asegurar compatibilidad UI/PDF
                const normalized = filteredPurchases.map(purchase => {
                    const itemsArray = Array.isArray(purchase.items) ? purchase.items.map(it => ({
                        productName: it.productName || it.product_name || it.product || '',
                        quantity: it.quantity ?? it.qty ?? 0,
                        unitPrice: it.unitPrice ?? it.unit_price ?? it.price ?? 0,
                        total: it.total ?? it.totalAmount ?? ( (it.quantity ?? 0) * (it.unitPrice ?? it.unit_price ?? it.price ?? 0) )
                    })) : [];

                    const supplierName = purchase.supplierName || purchase.supplier_name || purchase.supplier || '';
                    const totalAmount = Number(purchase.totalAmount ?? purchase.total_amount ?? purchase.total ?? 0);

                    return {
                        id: purchase.id,
                        date: purchase.date,
                        supplier: supplierName,
                        supplier_name: supplierName,
                        items: itemsArray,
                        total: totalAmount,
                        totalAmount: totalAmount,
                        total_amount: totalAmount,
                        status: purchase.status || 'Completada'
                    };
                });

                const results = {
                    title: 'Reporte de Compras',
                    summary: {
                        totalPurchases: normalized.length,
                        totalAmount: normalized.reduce((sum, p) => sum + (Number(p.total) || 0), 0),
                        period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
                    },
                    data: normalized
                };

                setQueryResults(results);
                return results;
            };
    
            // Consulta de pedidos
            const executeOrdersQuery = async () => {
                const filteredOrders = orders.filter(order => {
                    if (startDate && endDate) {
                        const orderDate = parseAnyDate(order.date);
                        const start = parseAnyDate(startDate);
                        const end = parseAnyDate(endDate);
                        if (!orderDate || !start || !end) return false;
                        return orderDate >= start && orderDate <= end;
                    }
                    return true;
                });
    
                const results = {
                    title: 'Reporte de Pedidos',
                    summary: {
                        totalOrders: filteredOrders.length,
                        pendingOrders: filteredOrders.filter(o => o.status === 'Pendiente').length,
                        sentOrders: filteredOrders.filter(o => o.status === 'Enviado').length,
                        period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
                    },
                    data: filteredOrders.map(order => {
                        // Normalizar items: preferir lista completa de objetos { productName, quantity, unitPrice, total }
                        const itemsArray = Array.isArray(order.items) ? order.items : [];
                        // Crear representaciones para UI/PDF
                        const productsList = itemsArray.map(it => it.productName || it.product_name || it.product || '').filter(Boolean);
                        const unitsList = itemsArray.map(it => (it.quantity !== undefined && it.quantity !== null) ? String(it.quantity) : '').filter(Boolean);

                        return {
                            id: order.id,
                            date: order.date,
                            customerName: order.customerName || order.customer_name || '',
                            paymentMethod: order.paymentMethod || order.payment_method || '',
                            status: order.status,
                            // enviar items completos para que el backend PDF pueda usar nombres y cantidades
                            items: itemsArray,
                            // Campos derivados para mostrar en la tabla de UI y en caso de export
                            products: productsList.join(', '),
                            units: unitsList.join(', '),
                            // also include snake_case fields for backend PDF generator compatibility
                            customer_name: order.customerName || order.customer_name || '',
                            payment_method: order.paymentMethod || order.payment_method || ''
                        };
                    })
                };
                setQueryResults(results);
                return results;
            };
    
            // Consulta de movimientos de caja
            const executeCashMovementsQuery = async () => {
                // Si no hay movimientos cargados, intentar recargarlos desde backend
                if (!cashMovements || cashMovements.length === 0) {
                    console.log('ℹ️ No hay movimientos en memoria. Intentando cargar desde backend...');
                    try {
                        await loadCashMovements();
                    } catch (e) {
                        console.warn('⚠️ No se pudo recargar movimientos desde backend:', e && e.message);
                    }
                }

                // Aceptar múltiples campos de fecha y normalizar tipo/amount
                const normalized = (cashMovements || []).map(m => {
                    // Fecha preferida: date, timestamp, created_at
                    const rawDate = m.date || m.timestamp || m.created_at || m.date_iso || '';
                    // Normalizar tipo (Entrada/Salida)
                    let type = (m.type || '').toString();
                    const tLower = type.toLowerCase();
                    if (tLower.startsWith('e') || tLower.includes('entrada') || tLower === 'in') type = 'Entrada';
                    else if (tLower.startsWith('s') || tLower.includes('salida') || tLower === 'out') type = 'Salida';
                    else type = m.type || type;

                    const amount = (() => {
                        const a = m.amount;
                        const num = typeof a === 'number' ? a : parseFloat(a);
                        return isNaN(num) ? 0 : num;
                    })();

                    return {
                        id: m.id,
                        date: rawDate,
                        timestamp: rawDate,
                        type,
                        amount,
                        description: m.description || '',
                        user: m.user || (m.user_username || m.user_name) || 'Sistema',
                        // dejar la forma original por compatibilidad
                        _raw: m
                    };
                });

                console.debug('🔎 Movimientos normalizados (primeros 5):', normalized.slice(0,5));

                const filteredMovements = normalized.filter(movement => {
                    if (startDate && endDate) {
                        const movementDate = parseAnyDate(movement.date);
                        const start = parseAnyDate(startDate);
                        const end = parseAnyDate(endDate);
                        if (!movementDate || !start || !end) return false;
                        return movementDate >= start && movementDate <= end;
                    }
                    return true;
                });

                console.debug('🔎 Movimientos filtrados según rango (primeros 5):', filteredMovements.slice(0,5));
                console.debug(`ℹ️ Movimientos normalizados=${normalized.length}, filtrados=${filteredMovements.length}`);

                const totalIncome = filteredMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : 0), 0);
                const totalExpenses = filteredMovements.reduce((sum, m) => sum + (m.type === 'Salida' ? m.amount : 0), 0);

                const results = {
                    title: 'Reporte de Movimientos de Caja',
                    summary: {
                        totalMovements: filteredMovements.length,
                        totalIncome: safeToFixed(totalIncome),
                        totalExpenses: safeToFixed(totalExpenses),
                        period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
                    },
                    data: filteredMovements.map(movement => ({
                        id: movement.id,
                        date: movement.date,
                        timestamp: movement.timestamp,
                        type: movement.type,
                        amount: movement.amount,
                        description: movement.description,
                        user: movement.user
                    }))
                };
                setQueryResults(results);
                return results;
            };
    
            // Función para exportar datos
            const exportData = async () => {
                if (!queryResults) {
                    setMessage('🚫 Error: No hay datos para exportar.');
                    return;
                }
                try {
                    const token = getAccessToken();
                    const response = await fetch('/api/export-data/', {
                        method: 'POST',
                        credentials: 'include', // enviar cookies HttpOnly (refresh) si las hay
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : undefined
                        },
                        body: JSON.stringify({
                            query_type: selectedQuery,
                            data: queryResults.data
                        })
                    });
                    if (!response.ok) {
                        setMessage('🚫 Error al exportar PDF.');
                        return;
                    }
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedQuery}_reporte.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    setMessage('✅ PDF exportado correctamente.');
                } catch (error) {
                    setMessage('🚫 Error al exportar PDF.');
                }
            };
    
            return (
                <div className="management-container">
                    <h2>Consultar Datos</h2>
                    {message && <p className="message">{message}</p>}
                    
                    <div className="query-form">
                        <h3>Seleccionar Consulta</h3>
                        
                        <select 
                            value={selectedQuery} 
                            onChange={e => setSelectedQuery(e.target.value)}
                            className="query-select"
                        >
                            <option value="">Seleccionar tipo de consulta</option>
                            <option value="stock">Estado de Stock</option>
                            <option value="proveedores">Información de Proveedores</option>
                            <option value="ventas">Reporte de Ventas</option>
                            <option value="compras">Reporte de Compras</option>
                            <option value="pedidos">Reporte de Pedidos</option>
                            <option value="movimientos_caja">Movimientos de Caja</option>
                        </select>
                        
                        <div className="date-filters">
                            <div className="date-input">
                                <label>Fecha de inicio:</label>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={e => setStartDate(e.target.value)} 
                                />
                            </div>
                            <div className="date-input">
                                <label>Fecha de fin:</label>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={e => setEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                        
                        <div className="query-actions">
                            <button onClick={executeQuery} className="action-button primary">
                                Ejecutar Consulta
                            </button>
                            <button onClick={exportData} className="action-button secondary" disabled={!queryResults}>
                                Exportar Datos
                            </button>
                        </div>
                    </div>
    
                    {queryResults && (
                        <div className="query-results">
                            <h3>{queryResults.title}</h3>
                            
                            <div className="results-summary">
                                {Object.entries(queryResults.summary).map(([key, value]) => (
                                    <div key={key} className="summary-item">
                                        <strong>
                                            {headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                        </strong> {value}
                                    </div>
                                ))}
                            </div>
                            
                            <div className="results-table">
                                {queryResults.data && queryResults.data.length > 0 ? (
                                    (() => {
                                        // Helper para mostrar de forma segura valores que pueden ser arrays/objetos
                                        const renderCellValue = (value) => {
                                            if (value === null || value === undefined) return '';
                                            // Array -> intentar formatear cada elemento
                                            if (Array.isArray(value)) {
                                                if (value.length === 0) return '';
                                                // Si todos son primitivos, unirlos
                                                if (value.every(v => v === null || ['string','number','boolean'].includes(typeof v))) {
                                                    return value.filter(v => v !== null && v !== undefined).join(', ');
                                                }
                                                // Array de objetos: mapear a una representación legible
                                                return value.map(item => {
                                                    if (item === null || item === undefined) return '';
                                                    if (typeof item === 'string' || typeof item === 'number') return String(item);
                                                    // Intentar campos comunes
                                                    const name = item.productName || item.product_name || item.product || item.name || item.productName;
                                                    const qty = item.quantity ?? item.cantidad ?? item.qty ?? '';
                                                    const unit = item.unitPrice ?? item.unit_price ?? item.price ?? '';
                                                    const total = item.total ?? item.totalAmount ?? item.total_amount ?? '';
                                                    const parts = [];
                                                    if (name) parts.push(String(name));
                                                    if (qty !== '') parts.push(String(qty));
                                                    if (unit !== '') parts.push(`x ${safeToFixed(unit)}`);
                                                    if (total !== '') parts.push(`= ${safeToFixed(total)}`);
                                                    return parts.join(' ');
                                                }).filter(Boolean).join('; ');
                                            }

                                            // Object -> intentar formatear campos conocidos o hacer JSON
                                            if (typeof value === 'object') {
                                                const name = value.productName || value.product_name || value.name;
                                                if (name) {
                                                    const qty = value.quantity ?? value.cantidad ?? value.qty ?? '';
                                                    const unit = value.unitPrice ?? value.unit_price ?? value.price ?? '';
                                                    const total = value.total ?? value.totalAmount ?? value.total_amount ?? '';
                                                    const parts = [String(name)];
                                                    if (qty !== '') parts.push(String(qty));
                                                    if (unit !== '') parts.push(`x ${safeToFixed(unit)}`);
                                                    if (total !== '') parts.push(`= ${safeToFixed(total)}`);
                                                    return parts.join(' ');
                                                }
                                                try { return JSON.stringify(value); } catch (e) { return String(value); }
                                            }

                                            // Primitivos
                                            return String(value);
                                        };

                                        const sample = queryResults.data[0] || {};

                                        // Si es reporte de pedidos y tiene customerName, mostrar columnas amigables
                                        if (sample.customerName || sample.customer_name) {
                                            const cols = ['id','date','customerName','paymentMethod','status','products','units'];
                                            return (
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            {cols.map(key => (
                                                                <th key={key}>{headerTranslationMap[key] || key}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {queryResults.data.map((row, index) => (
                                                            <tr key={index}>
                                                                {cols.map((k, ci) => (
                                                                    <td key={ci}>{renderCellValue(row[k] ?? row[k === 'products' ? 'items' : k])}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            );
                                        }

                                        // Por defecto: columnas derivadas de las keys del primer objeto
                                        const keys = Object.keys(sample);
                                        return (
                                            <table>
                                                <thead>
                                                    <tr>
                                                        {keys.map(key => (
                                                            <th key={key}>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {queryResults.data.map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            {keys.map((k, cIdx) => (
                                                                <td key={cIdx}>{renderCellValue(row[k])}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        );
                                    })()
                                ) : (
                                    <p>No hay datos que mostrar para los criterios seleccionados.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        };
    
        // Componente de la interfaz de edición de productos nuevos (solo para Gerente).
        const EditNewProducts = () => {
            const [selectedProduct, setSelectedProduct] = useState(null);
            const [editingProduct, setEditingProduct] = useState({
                name: '',
                price: 0,
                category: 'Producto',
                stock: 0,
                description: '',
                lowStockThreshold: 10
            });
            const [message, setMessage] = useState('');
            const [confirmDelete, setConfirmDelete] = useState(false);
            const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    
            // Función para validar el nombre del producto
            const validateProductName = (name) => {
                return name.trim().length > 0 && name.trim().length <= 100;
            };
    
            // Función para validar el precio
            const validatePrice = (price) => {
                return price > 0;
            };
    
            // Función para validar la categoría
            const validateCategory = (category) => {
                return ['Producto', 'Insumo'].includes(category);
            };
    
            // Función para validar el stock
            const validateStock = (stock) => {
                return stock >= 0 && Number.isInteger(stock);
            };
            
            // Función para validar el umbral de stock bajo
            const validateLowStockThreshold = (threshold) => {
                return threshold >= 0 && Number.isInteger(threshold);
            };
    
            // Función para seleccionar un producto para editar
            const selectProductForEdit = (product) => {
                // Verificar que el producto no tenga ventas registradas
                if (product.hasSales) {
                    setMessage('⚠️ Error: No se puede editar un producto que ya tiene ventas registradas.');
                    return;
                }
    
                setSelectedProduct(product);
                setEditingProduct({
                    name: product.name,
                    price: product.price,
                    category: product.category,
                    stock: product.stock,
                    description: product.description || '',
                    lowStockThreshold: product.lowStockThreshold || 10
                });
                setMessage('');
            };
    
            // Función para guardar los cambios
            const handleSaveChanges = async (e) => {
                e.preventDefault();
    
                // Validaciones según la especificación
                if (!validateProductName(editingProduct.name)) {
                    setMessage('🚫 Error: El nombre del producto debe ser un texto no vacío con un máximo de 100 caracteres.');
                    return;
                }
    
                if (!validatePrice(editingProduct.price)) {
                    setMessage('🚫 Error: El precio debe ser un número decimal positivo mayor a cero.');
                    return;
                }
    
                if (!validateCategory(editingProduct.category)) {
                    setMessage('🚫 Error: La categoría debe existir en la lista de categorías registradas.');
                    return;
                }
    
                if (!validateStock(editingProduct.stock)) {
                    setMessage('🚫 Error: El stock inicial debe ser un número entero positivo o cero.');
                    return;
                }
                
                if (!validateLowStockThreshold(editingProduct.lowStockThreshold)) {
                    setMessage('🚫 Error: El umbral de stock bajo debe ser un número entero positivo o cero.');
                    return;
                }

                // Verificar que no se eliminen datos obligatorios
                if (!editingProduct.name.trim() || editingProduct.price <= 0 || !editingProduct.category) {
                    setMessage('🚫 Error: No se pueden eliminar datos obligatorios (nombre, precio, categoría).');
                    return;
                }

                try {
                    // Actualizar el producto en el backend primero
                    const updatedProduct = {
                        name: editingProduct.name,
                        price: editingProduct.price,
                        category: editingProduct.category,
                        stock: editingProduct.stock,
                        description: editingProduct.description,
                        lowStockThreshold: editingProduct.lowStockThreshold
                    };

                    await api.put(`/products/${selectedProduct.id}/`, updatedProduct);
                    
                    // Si se actualiza correctamente en el backend, recargar productos desde el servidor
                    await loadProducts();
                    
                    setSelectedProduct(null);
                    setEditingProduct({
                        name: '',
                        price: 0,
                        category: 'Producto',
                        stock: 0,
                        description: '',
                        lowStockThreshold: 10
                    });
                    setMessage('✅ Producto actualizado correctamente en el servidor. Los cambios se reflejan en todas las secciones.');
                } catch (error) {
                    console.error('Error actualizando producto en el servidor:', error);
                    setMessage('❌ Error: No se pudo actualizar el producto en el servidor. Los cambios no fueron guardados.');
                }
            };
    
            // Función para cancelar la edición
            const handleCancelEdit = () => {
                setSelectedProduct(null);
                setEditingProduct({
                    name: '',
                    price: 0,
                    category: 'Producto',
                    stock: 0,
                    description: '',
                    lowStockThreshold: 10
                });
                setMessage('');
                setConfirmDelete(false);
            };
            
            // Función para eliminar un producto
            const handleDeleteProduct = async () => {
                if (!selectedProduct) return;
                
                // Si el producto tiene ventas, no se puede eliminar
                if (selectedProduct.hasSales) {
                    setMessage('⚠️ Error: No se puede eliminar un producto que ya tiene ventas registradas.');
                    setConfirmDelete(false);
                    return;
                }
                
                if (!confirmDelete) {
                    setConfirmDelete(true);
                    setMessage('⚠️ ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.');
                    return;
                }
                
                try {
                    // Eliminar del backend primero
                    await api.delete(`/products/${selectedProduct.id}/`);
                    
                    // Si se elimina correctamente del backend, eliminar del estado local
                    const updatedProducts = products.filter(product => product.id !== selectedProduct.id);
                    
                    setProducts(updatedProducts);
                    setSelectedProduct(null);
                    setEditingProduct({
                        name: '',
                        price: 0,
                        category: 'Producto',
                        stock: 0,
                        description: '',
                        lowStockThreshold: 10
                    });
                    setConfirmDelete(false);
                    setMessage('✅ Producto eliminado correctamente del servidor y todas las secciones.');
                } catch (error) {
                    console.error('Error eliminando producto del servidor:', error);
                    setMessage('❌ Error: No se pudo eliminar el producto del servidor. El producto permanece en el sistema.');
                    setConfirmDelete(false);
                }
            };
            
            // Función para eliminar todos los productos
            const handleDeleteAllProducts = async () => {
                if (!deleteAllConfirm) {
                    setDeleteAllConfirm(true);
                    setMessage('⚠️ ¿Estás seguro de que deseas eliminar TODOS los productos sin ventas? Esta acción no se puede deshacer.');
                    return;
                }
                
                try {
                    // Obtener productos sin ventas que se pueden eliminar
                    const productsToDelete = products.filter(product => !product.hasSales);
                    
                    // Eliminar cada producto del backend
                    const deletePromises = productsToDelete.map(product => 
                        api.delete(`/products/${product.id}/`)
                    );
                    
                    await Promise.all(deletePromises);
                    
                    // Si se eliminan correctamente del backend, actualizar estado local
                    const productsWithSales = products.filter(product => product.hasSales);
                    
                    setProducts(productsWithSales);
                    setDeleteAllConfirm(false);
                    setMessage(`✅ ${productsToDelete.length} productos eliminados correctamente del servidor y todas las secciones.`);
                } catch (error) {
                    console.error('Error eliminando productos del servidor:', error);
                    setMessage('❌ Error: No se pudieron eliminar todos los productos del servidor.');
                    setDeleteAllConfirm(false);
                }
            };
    
            // Obtener solo productos nuevos (sin ventas registradas)
            const newProducts = products.filter(product => !product.hasSales);
    
            return (
                <div className="management-container">
                    <div style={{marginBottom: '10px'}}>
                        <h2>Editar Productos Nuevos</h2>
                    </div>
                    {message && <p className="message">{message}</p>}
                    
                    <div className="products-list">
                        <h3>Productos Disponibles para Edición</h3>
                        <p className="info-text">
                            Solo se muestran productos marcados como "nuevos" o sin ventas registradas.
                        </p>
                        
                        {newProducts.length === 0 ? (
                            <p className="no-products">No hay productos nuevos disponibles para editar.</p>
                        ) : (
                            <ul className="list-container">
                                {newProducts.map(product => (
                                    <li key={product.id} className="product-list-item">
                                        <div className="product-info">
                                            <strong>{product.name}</strong>
                                            <span className="product-price">${product.price}</span>
                                            <span className="product-category">{product.category}</span>
                                            <span className="product-stock">Stock: {product.stock}</span>
                                            <span className="product-threshold">Umbral Stock Bajo: {product.lowStockThreshold || 10}</span>
                                            {product.description && (
                                                <span className="product-description">{product.description}</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => selectProductForEdit(product)}
                                            className="edit-button"
                                            disabled={selectedProduct?.id === product.id}
                                        >
                                            {selectedProduct?.id === product.id ? 'Editando...' : 'Editar'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
    
                    {selectedProduct && (
                        <div className="edit-form">
                            <h3>Editar Producto: {selectedProduct.name}</h3>
                            
                            <form onSubmit={handleSaveChanges} className="form-container">
                                <div className="form-group">
                                    <label>Nombre del Producto *</label>
                                    <input 
                                        type="text" 
                                        value={editingProduct.name} 
                                        onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} 
                                        placeholder="Nombre del producto (máximo 100 caracteres)"
                                        maxLength="100"
                                        required 
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Precio *</label>
                                    <input 
                                        type="number" 
                                        value={editingProduct.price} 
                                        onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} 
                                        placeholder="Precio (mayor a 0)"
                                        min="0.01"
                                        step="0.01"
                                        required 
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Categoría *</label>
                                    <select 
                                        value={editingProduct.category} 
                                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                                        required
                                    >
                                        <option value="Producto">Producto</option>
                                        <option value="Insumo">Insumo</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Stock Inicial</label>
                                    <input 
                                        type="number" 
                                        value={editingProduct.stock} 
                                        onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} 
                                        placeholder="Stock inicial (0 o mayor)"
                                        min="0"
                                        required 
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Descripción</label>
                                    <textarea 
                                        value={editingProduct.description} 
                                        onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                                        placeholder="Descripción del producto (opcional)"
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Umbral de Stock Bajo *</label>
                                    <input 
                                        type="number" 
                                        value={editingProduct.lowStockThreshold} 
                                        onChange={e => setEditingProduct({...editingProduct, lowStockThreshold: parseInt(e.target.value)})} 
                                        placeholder="Nivel de stock para mostrar alertas (0 o mayor)"
                                        min="0"
                                        required 
                                    />
                                    <small className="form-helper-text">
                                        Cantidad mínima de stock antes de mostrar alertas en el Dashboard
                                    </small>
                                </div>
                                
                                <div className="button-group">
                                    <button type="submit" className="action-button primary">
                                        Guardar Cambios
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="action-button secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteProduct}
                                        className="action-button delete"
                                    >
                                        {confirmDelete ? "Confirmar Eliminación" : "Eliminar Producto"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    
                    <div className="manage-all-products">
                        <button 
                            onClick={handleDeleteAllProducts}
                            className="action-button delete-all"
                            disabled={newProducts.length === 0}
                        >
                            {deleteAllConfirm ? "Confirmar Eliminación de Todos" : "Eliminar Todos los Productos Sin Ventas"}
                        </button>
                    </div>
            </div>
        )};

    // Renderiza el componente de la página actual según el estado.
    const renderPage = () => {
        if (!isLoggedIn) {
            return <Login />;
        }

        // Defensive: ensure currentPage is a known page when logged in to avoid falling
        // into the default case which renders the "Página no encontrada." message
        const validPages = new Set(['dashboard','inventario','ventas','productos','gestión de usuarios','proveedores','compras','pedidos','consultas','editar productos','login']);
        let pageToRender = currentPage;
        if (!validPages.has(String(currentPage))) {
            console.warn('⚠️ currentPage inválido detectado, forzando a dashboard:', currentPage);
            pageToRender = 'dashboard';
        }

        switch (pageToRender) {
            case 'dashboard':
                return <Dashboard />;
            case 'inventario':
                return <InventoryView />;
            case 'ventas':
                return <SalesView />;
            case 'productos':
                return userRole === 'Gerente' ? <ProductCreationView /> : <div>Acceso Denegado</div>;
            case 'gestión de usuarios':
                return userRole === 'Gerente' ? <UserManagement /> : <div>Acceso Denegado</div>;
            case 'proveedores':
                return userRole === 'Gerente' ? <SupplierManagement /> : <div>Acceso Denegado</div>;
            case 'compras':
                return userRole === 'Gerente' || userRole === 'Encargado' || userRole === 'Cajero' || userRole === 'Panadero' ? <PurchaseManagement /> : <div>Acceso Denegado</div>;
            case 'pedidos':
                return userRole === 'Gerente' ? <OrderManagement /> : <div>Acceso Denegado</div>;
            case 'consultas':
                return userRole === 'Gerente' ? <DataConsultation /> : <div>Acceso Denegado</div>;
            case 'editar productos':
                return userRole === 'Gerente' ? <EditNewProducts /> : <div>Acceso Denegado</div>;
            default:
                return <div>Página no encontrada.</div>;
        }
    };

    useEffect(() => {
      if (isLoggedIn) {
        // Verificación especial para Safari - asegurar que el token esté disponible
        const token = getAccessToken();
        if (!token) {
          console.log('⚠️ No hay token disponible, esperando...');
          // Reintentar en 200ms para Safari
          setTimeout(() => {
            const retryToken = getAccessToken();
            if (retryToken && isLoggedIn) {
              loadUsers();
              loadProducts();
              console.log('🔐 Usuario logueado - cargando usuarios y productos del servidor (retry)');
            }
          }, 200);
          return;
        }
        
        // Cargar datos del servidor
        loadUsers();
        loadProducts();
        console.log('🔐 Usuario logueado - cargando usuarios y productos del servidor');
      }
    }, [isLoggedIn]);

    // Sincronización periódica de productos (cada 5 minutos, muy cuidadosa)
    useEffect(() => {
      let interval = null;
      let registerInteraction = null;
      
      if (isLoggedIn) {
        // Registrar interacciones del usuario para pausar sincronización
        registerInteraction = () => {
          window.lastUserInteraction = Date.now();
        };
        
        // Escuchar eventos de interacción
        document.addEventListener('click', registerInteraction);
        document.addEventListener('keydown', registerInteraction);
        document.addEventListener('input', registerInteraction);
        document.addEventListener('change', registerInteraction);
        
        interval = setInterval(() => {
          // Verificaciones múltiples para no interrumpir al usuario
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
          );
          
          // Verificar si hay formularios abiertos, modales, o consultas en progreso
          const hasOpenForms = document.querySelector('.form-container:not([style*="display: none"])') ||
                               document.querySelector('.modal-overlay') ||
                               document.querySelector('.tab-content') ||
                               document.querySelector('[class*="show"]') ||
                               document.querySelector('.consultation-results') ||
                               document.querySelector('.purchase-item') ||
                               document.querySelector('.order-item') ||
                               document.querySelector('.query-results'); // Proteger resultados de consulta
          
          // Verificar si estamos en la página de consultas con resultados
          const isInConsultationPage = currentPage === 'consultas';
          const hasQueryResults = document.querySelector('.query-results');
          
          // Verificar si el usuario ha interactuado recientemente (últimos 2 minutos)
          const lastInteraction = window.lastUserInteraction || 0;
          const now = Date.now();
          const recentInteraction = now - lastInteraction < 120000; // 2 minutos
          
          if (!isTyping && !hasOpenForms && !recentInteraction && !(isInConsultationPage && hasQueryResults)) {
            loadProducts();
            console.log('🔄 Sincronización automática de productos');
          } else {
            console.log('⏸️ Sincronización pausada - usuario activo:', {
              typing: isTyping,
              forms: !!hasOpenForms,
              recent: recentInteraction,
              consultingData: !!(isInConsultationPage && hasQueryResults)
            });
          }
        }, 300000); // 5 minutos
      }

      return () => {
        if (interval) {
          clearInterval(interval);
        }
        // Limpiar event listeners si existen
        if (registerInteraction) {
          document.removeEventListener('click', registerInteraction);
          document.removeEventListener('keydown', registerInteraction);
          document.removeEventListener('input', registerInteraction);
          document.removeEventListener('change', registerInteraction);
        }
      };
    }, [isLoggedIn, currentPage]);    // Sincronización cuando la ventana recupera el foco (menos agresiva)

    // Marcar productos que tienen ventas para que no sean considerados "sin ventas"
    // Depende solo de `sales`. Usamos un update funcional y solo aplicamos setProducts
    // cuando realmente cambie la bandera `hasSales`, para evitar bucles de render.
    useEffect(() => {
        if (!Array.isArray(sales) || sales.length === 0) return;

        // Construir set de nombres de producto que aparecen en las ventas
        const soldProductNames = new Set();
        sales.forEach(s => {
            const items = Array.isArray(s.sale_items) && s.sale_items.length ? s.sale_items : (Array.isArray(s.items) ? s.items : []);
            items.forEach(it => {
                const name = (it && (it.product_name || it.product || it.productName)) || '';
                if (name) soldProductNames.add(String(name).trim());
            });
        });

        setProducts(prev => {
            if (!Array.isArray(prev) || prev.length === 0) return prev;
            // Construir nuevo array pero solo cambiar si alguna bandera difiere
            let changed = false;
            const next = prev.map(p => {
                const shouldHaveSales = soldProductNames.has(p.name) || !!p.hasSales;
                if (shouldHaveSales !== !!p.hasSales) changed = true;
                return shouldHaveSales !== !!p.hasSales ? { ...p, hasSales: shouldHaveSales } : p;
            });
            return changed ? next : prev;
        });
    }, [sales]);
    useEffect(() => {
      const handleFocus = () => {
        if (isLoggedIn) {
          // Solo sincronizar si no hay formularios abiertos o inputs activos
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
          );
          
          // Verificar si hay formularios, modales abiertos o resultados de consulta
          const hasOpenForms = document.querySelector('.form-container:not([style*="display: none"])') ||
                               document.querySelector('.modal-overlay') ||
                               document.querySelector('.tab-content') ||
                               document.querySelector('[class*="show"]') ||
                               document.querySelector('.query-results'); // Proteger resultados de consulta
          
          // Verificar si estamos en la página de consultas con resultados
          const isInConsultationPage = currentPage === 'consultas';
          const hasQueryResults = document.querySelector('.query-results');
          
          if (!isTyping && !hasOpenForms && !(isInConsultationPage && hasQueryResults)) {
            // Solo sincronizar productos cada 30 segundos como máximo al enfocar
            const lastSync = window.lastFocusSync || 0;
            const now = Date.now();
            
            if (now - lastSync > 30000) { // 30 segundos
              loadProducts();
              window.lastFocusSync = now;
              console.log('👁️ Ventana enfocada - sincronizando productos (sin formularios abiertos)');
            } else {
              console.log('⏸️ Sincronización saltada - muy reciente o usuario trabajando');
            }
          } else {
            console.log('⏸️ Sincronización pausada - usuario interactuando con formularios o consultando datos');
          }
        }
      };

      const handleVisibilityChange = () => {
        if (!document.hidden && isLoggedIn) {
          // Aplicar la misma lógica que handleFocus
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
          );
          
          const hasOpenForms = document.querySelector('.form-container:not([style*="display: none"])') ||
                               document.querySelector('.modal-overlay') ||
                               document.querySelector('.tab-content') ||
                               document.querySelector('[class*="show"]') ||
                               document.querySelector('.query-results'); // Proteger resultados de consulta
          
          // Verificar si estamos en la página de consultas con resultados
          const isInConsultationPage = currentPage === 'consultas';
          const hasQueryResults = document.querySelector('.query-results');
          
          if (!isTyping && !hasOpenForms && !(isInConsultationPage && hasQueryResults)) {
            const lastSync = window.lastVisibilitySync || 0;
            const now = Date.now();
            
            if (now - lastSync > 30000) { // 30 segundos
              loadProducts();
              window.lastVisibilitySync = now;
              console.log('👁️ Pestaña visible - sincronizando productos (sin formularios abiertos)');
            }
          } else {
            console.log('⏸️ Sincronización pausada - usuario trabajando o consultando datos');
          }
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [isLoggedIn, currentPage]);

    if (!sessionChecked) {
        return (
            <div className="app-loading" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
                <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 18, marginBottom: 8}}>Comprobando sesión...</div>
                    <div style={{fontSize: 12, color: '#666'}}>Si esto tarda mucho, confirma que el backend esté corriendo.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Panel de desarrollo "DEV STATUS" eliminado para UI limpia. */}
            {showModal && <LockedAccountModal />}
            {isLoggedIn && <Navbar />}
            {renderPage()}
        </div>
    );
};

export default App;