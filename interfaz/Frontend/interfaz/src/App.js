import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import api from './services/api';

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
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveLS = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

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
    // Definimos los roles de usuario disponibles.
    const roles = ['Gerente', 'Panadero', 'Encargado', 'Cajero'];
     
    // Estados para el sistema de autenticación
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const maxAttempts = 5;
     
    // Estado para el rol del usuario actualmente autenticado.
    const [userRole, setUserRole] = useState(null);
    // Estado para la página actual a mostrar.
    const [currentPage, setCurrentPage] = useState('login');
    
    // Estado para el inventario
    const [inventory, setInventory] = useState(loadLS(LS_KEYS.inventory, [
        { id: 1, name: 'Churro', stock: 50, type: 'Producto' },
        { id: 2, name: 'Café', stock: 120, type: 'Producto' },
        { id: 3, name: 'Harina', stock: 10, type: 'Insumo' },
        { id: 4, name: 'Azúcar', stock: 5, type: 'Insumo' },
        { id: 5, name: 'Combo Familiar', stock: 30, type: 'Producto' },
    ]));
    
    // Usuarios
    const [users, setUsers] = useState(loadLS(LS_KEYS.users, [
        { id: 1, name: 'Juan Perez', email: 'juan.perez@empresa.com', role: 'Gerente' },
        { id: 2, name: 'Ana Gomez', email: 'ana.gomez@empresa.com', role: 'Panadero' },
        { id: 3, name: 'Carlos Lopez', email: 'carlos.lopez@empresa.com', role: 'Cajero' },
        { id: 4, name: 'Marta Diaz', email: 'marta.diaz@empresa.com', role: 'Encargado' },
    ]));
    
    // Movimientos de caja
    const [cashMovements, setCashMovements] = useState(loadLS(LS_KEYS.cashMovements, [
        { id: 1, date: '2023-10-26', type: 'Entrada', amount: 1500, description: 'Ventas del día' },
        { id: 2, date: '2023-10-25', type: 'Salida', amount: 500, description: 'Pago a proveedor' },
    ]));
    
    // Proveedores
    const [suppliers, setSuppliers] = useState(loadLS(LS_KEYS.suppliers, [
        { id: 1, name: 'Distribuidora Central', cuit: '20123456789', address: 'Av. San Martín 1234', phone: '03421567890', products: 'Harina, Azúcar, Aceite' },
        { id: 2, name: 'Proveedor Express', cuit: '30123456789', address: 'Belgrano 567', phone: '03421567891', products: 'Medialunas, Café' },
    ]));
    
    // Compras
    const [purchases, setPurchases] = useState(loadLS(LS_KEYS.purchases, [
        { 
            id: 1, 
            date: '26/10/2023', 
            supplierId: 1, 
            supplierName: 'Distribuidora Central',
            items: [
                { productName: 'Harina', quantity: 10, unitPrice: 150.50, total: 1505.00 },
                { productName: 'Azúcar', quantity: 5, unitPrice: 120.00, total: 600.00 }
            ],
            totalAmount: 2105.00,
            status: 'Completada'
        },
        { 
            id: 2, 
            date: '25/10/2023', 
            supplierId: 2, 
            supplierName: 'Proveedor Express',
            items: [
                { productName: 'Medialunas', quantity: 50, unitPrice: 25.00, total: 1250.00 },
                { productName: 'Café', quantity: 10, unitPrice: 180.00, total: 1800.00 }
            ],
            totalAmount: 3050.00,
            status: 'Completada'
        }
    ]));
    
    // Pedidos
    const [orders, setOrders] = useState(loadLS(LS_KEYS.orders, [
        { 
            id: 1, 
            date: '27/10/2023', 
            supplierId: 1, 
            supplierName: 'Distribuidora Central',
            items: [
                { productName: 'Harina', quantity: 15, currentStock: 10, status: 'Pendiente' },
                { productName: 'Azúcar', quantity: 8, currentStock: 5, status: 'Pendiente' }
            ],
            status: 'Pendiente',
            notes: 'Reposición de stock bajo'
        },
        { 
            id: 2, 
            date: '26/10/2023', 
            supplierId: 2, 
            supplierName: 'Proveedor Express',
            items: [
                { productName: 'Medialunas', quantity: 30, currentStock: 20, status: 'Enviado' },
                { productName: 'Café', quantity: 5, currentStock: 8, status: 'Enviado' }
            ],
            status: 'Enviado',
            notes: 'Pedido semanal'
        }
    ]));

    // Estado para productos con información completa
    const [products, setProducts] = useState(loadLS(LS_KEYS.products, [
        { 
            id: 1, 
            name: 'Churro Clásico', 
            price: 10.00, 
            category: 'Producto', 
            stock: 50, 
            description: 'Churro tradicional recién hecho',
            status: 'Nuevo',
            hasSales: false
        },
        { 
            id: 2, 
            name: 'Café Americano', 
            price: 15.00, 
            category: 'Producto', 
            stock: 120, 
            description: 'Café negro americano',
            status: 'Nuevo',
            hasSales: false
        },
        { 
            id: 3, 
            name: 'Harina de Trigo', 
            price: 150.50, 
            category: 'Insumo', 
            stock: 10, 
            description: 'Harina de trigo para repostería',
            status: 'Nuevo',
            hasSales: false
        },
        { 
            id: 4, 
            name: 'Azúcar Refinada', 
            price: 120.00, 
            category: 'Insumo', 
            stock: 5, 
            description: 'Azúcar refinada blanca',
            status: 'Nuevo',
            hasSales: false
        },
        { 
            id: 5, 
            name: 'Combo Familiar', 
            price: 25.00, 
            category: 'Producto', 
            stock: 30, 
            description: 'Combo familiar con churros y bebidas',
            status: 'Nuevo',
            hasSales: false
        }
    ]));

    // useEffect para guardar en localStorage
    useEffect(() => { saveLS(LS_KEYS.inventory, inventory); }, [inventory]);
    useEffect(() => { saveLS(LS_KEYS.users, users); }, [users]);
    useEffect(() => { saveLS(LS_KEYS.cashMovements, cashMovements); }, [cashMovements]);
    useEffect(() => { saveLS(LS_KEYS.suppliers, suppliers); }, [suppliers]);
    useEffect(() => { saveLS(LS_KEYS.purchases, purchases); }, [purchases]);
    useEffect(() => { saveLS(LS_KEYS.orders, orders); }, [orders]);
    useEffect(() => { saveLS(LS_KEYS.products, products); }, [products]);

    // Función para validar la política de la contraseña
    const validatePassword = (pwd) => {
        if (pwd.length < passwordPolicy.minLength) {
            return 'La contraseña debe tener al menos 8 caracteres.';
        }
        if (passwordPolicy.hasUpperCase && !/[A-Z]/.test(pwd)) {
            return 'La contraseña debe contener al menos una letra mayúscula.';
        }
        if (passwordPolicy.hasLowerCase && !/[a-z]/.test(pwd)) {
            return 'La contraseña debe contener al menos una letra minúscula.';
        }
        if (passwordPolicy.hasNumber && !/[0-9]/.test(pwd)) {
            return 'La contraseña debe contener al menos un número.';
        }
        return '';
    };

    // Función para manejar el inicio de sesión con credenciales
    const handleLogin = async (e, credentials = null) => {
      e.preventDefault();
      
      // Usar las credenciales pasadas como parámetro o las del estado
      const emailToUse = credentials ? credentials.email : email;
      const passwordToUse = credentials ? credentials.password : password;
      
      try {
        const response = await api.post('/auth/login/', {
          email: emailToUse,
          password: passwordToUse
        });
        
        if (response.data.success) {
          setIsLoggedIn(true);
          setUserRole(response.data.user.role);
          setCurrentPage('dashboard');
          
          // Guardar el token para futuras peticiones
          localStorage.setItem('accessToken', response.data.tokens.access);
          
          // Resetear contadores de error
          setFailedAttempts(0);
          setLoginError('');
        }
      } catch (error) {
        console.error('Error de login:', error);
        
        // Incrementar intentos fallidos
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        
        // Verificar si se alcanzó el límite
        if (newFailedAttempts >= maxAttempts) {
          setIsLocked(true);
          setShowModal(true);
          setLoginError('Cuenta bloqueada por demasiados intentos fallidos');
        } else {
          // Mostrar mensaje de error específico
          if (error.response && error.response.status === 400) {
            setLoginError('Credenciales inválidas. Intento ' + newFailedAttempts + ' de ' + maxAttempts);
          } else {
            setLoginError('Error de conexión. Intento ' + newFailedAttempts + ' de ' + maxAttempts);
          }
        }
      }
    };

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
        localStorage.removeItem('accessToken'); // quitar solo el token
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
        setUsers(response.data);
        saveLS(LS_KEYS.users, response.data);
      } catch (error) {
        console.error('Error cargando usuarios:', error);
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
        // Simulación de alerta de bajo stock.
        const lowStockItems = inventory.filter(item => item.stock < 10);

        return (
            <div className="dashboard-container">
                <h2>Dashboard de {userRole}</h2>
                {['Gerente', 'Encargado', 'Panadero', 'Cajero'].includes(userRole) && (
                    <div className="alert-section">
                        <h3>Alerta de Stock Bajo</h3>
                        {lowStockItems.length > 0 ? (
                            <ul className="alert-list">
                                {lowStockItems.map(item => (
                                    <li key={item.id} className="alert-item">
                                        �� {item.name}: ¡Solo quedan {item.stock} unidades!
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>✅ Todos los productos e insumos tienen stock suficiente.</p>
                        )}
                    </div>
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
        const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Cajero' });
        const [message, setMessage] = useState('');

        const handleAddUser = (e) => {
            e.preventDefault();
            // Validar si el usuario ya existe por email.
            const userExists = users.some(u => u.email === newUser.email);
            if (userExists) {
                setMessage('Error: El email ya está registrado.');
                return;
            }
            // Agregar el nuevo usuario.
            const id = Math.max(...users.map(u => u.id)) + 1;
            setUsers([...users, { ...newUser, id }]);
            setNewUser({ name: '', email: '', role: 'Cajero' });
            setShowAddUser(false);
            setMessage('✅ Usuario creado exitosamente.');
        };

        const handleDeleteUser = (userId) => {
            // Regla de negocio: El gerente no puede eliminarse a sí mismo.
            const userToDelete = users.find(u => u.id === userId);
            if (userToDelete.role === 'Gerente') {
                setMessage('�� No puedes eliminar la cuenta de un Gerente.');
                return;
            }
            if (window.confirm(`¿Estás seguro de que quieres eliminar a ${userToDelete.name}?`)) {
                setUsers(users.filter(user => user.id !== userId));
                setMessage('✅ Usuario eliminado exitosamente.');
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
                        <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nombre Completo" required />
                        <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" required />
                        <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            {roles.filter(r => r !== 'Gerente').map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div className="button-group">
                            <button type="submit" className="action-button primary">Crear Usuario</button>
                            <button type="button" className="action-button secondary" onClick={() => setShowAddUser(false)}>Cancelar</button>
                        </div>
                    </form>
                )}

                <h3>Usuarios Existentes</h3>
                <ul className="list-container">
                    {users.map(user => (
                        <li key={user.id} className="list-item">
                            <span>{user.name} ({user.role})</span>
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
                // Actualizar inventario localmente
                const updatedInventory = inventory.map(p =>
                    p.id === product.id
                        ? { ...p, stock: p.stock + quantity }
                        : p
                );
                setInventory(updatedInventory);
                setChange({ product: '', quantity: '', reason: '' });
                setShowChangeForm(false);
            } catch (err) {
                console.error('Error registrando cambio de inventario:', err);
                alert('No se pudo registrar el cambio de inventario.');
            }
        };

        return (
            <div className="inventory-container">
                <h2>Inventario</h2>
                <h3>Consultar Inventario</h3>
                <ul className="list-container">
                    {inventory.map(item => (
                        <li key={item.id} className="list-item">
                            <span>{item.name}</span>
                            <span>Stock: {item.stock}</span>
                            <span>Tipo: {item.type}</span>
                        </li>
                    ))}
                </ul>
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

        // Precios de ejemplo
        const prices = { 'Churro': 10, 'Café': 20, 'Combo Familiar': 25 };

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
        const calculateTotal = (products) => {
            let newTotal = 0;
            for (const name in products) {
                newTotal += (prices[name] || 0) * products[name];
            }
            setTotal(newTotal);
        };

        // Registrar la venta.
        const handleRegisterSale = async () => {
            const canSell = Object.keys(selectedProducts).every(name => {
                const item = inventory.find(i => i.name === name);
                return item && item.stock >= selectedProducts[name];
            });

            if (!canSell) {
                alert('No hay suficiente stock para completar la venta.');
                return;
            }

            // 1) Actualizar inventario localmente
            const updatedInventory = inventory.map(item => {
                if (selectedProducts[item.name]) {
                    return { ...item, stock: item.stock - selectedProducts[item.name] };
                }
                return item;
            });
            setInventory(updatedInventory);

            // 2) Registrar entrada de caja localmente
            const id = cashMovements.length ? Math.max(...cashMovements.map(m => m.id)) + 1 : 1;
            const today = new Date().toISOString().split('T')[0];
            const description = `Venta: ${Object.entries(selectedProducts).map(([name, qty]) => `${name} x${qty}`).join(', ')}`;
            setCashMovements([...cashMovements, {
                id, date: today, type: 'Entrada', amount: total, description
            }]);

            // 3) Persistir en backend: venta y movimiento de caja
            try {
                await api.post('/sales/', {
                    total_amount: total,
                    payment_method: 'Efectivo',
                });
                await api.post('/cash-movements/', {
                    type: 'Entrada',
                    amount: total,
                    description,
                });
                setSelectedProducts({});
                setTotal(0);
                setMessage('✅ Venta registrada con éxito, stock actualizado y entrada de caja registrada.');
            } catch (err) {
                console.error('Error registrando venta:', err);
                setMessage('La venta se aplicó localmente, pero no se pudo persistir en el servidor.');
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
                const today = new Date().toISOString().split('T')[0];
                await api.post('/cash-movements/', payload);
                const id = cashMovements.length ? Math.max(...cashMovements.map(m => m.id)) + 1 : 1;
                setCashMovements([...cashMovements, { ...payload, id, date: today }]);
                setNewMovement({ type: 'Entrada', amount: '', description: '' });
                setShowMovementForm(false);
                setMessage('✅ Movimiento registrado exitosamente.');
            } catch (err) {
                console.error('Error registrando movimiento de caja:', err);
                setMessage('No se pudo registrar el movimiento de caja.');
            }
        };

        const availableProducts = inventory.filter(item => item.type === 'Producto');
        const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

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
                            {availableProducts.map(product => (
                                <button key={product.id} className="product-button" onClick={() => handleProductSelect(product.name)}>
                                    {product.name} (${prices[product.name] || 0})
                                </button>
                            ))}
                        </div>
                        <div className="cart-summary">
                            <h3>Resumen de Venta</h3>
                            <ul className="list-container">
                                {Object.entries(selectedProducts).map(([name, quantity]) => (
                                    <li key={name} className="list-item">
                                        {name} x {quantity} = ${quantity * (prices[name] || 0)}
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
                                ${currentBalance.toFixed(2)}
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
                const today = new Date().toISOString().split('T')[0];
                await api.post('/cash-movements/', payload);
                const id = cashMovements.length ? Math.max(...cashMovements.map(m => m.id)) + 1 : 1;
                setCashMovements([...cashMovements, { ...payload, id, date: today }]);
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
                low_stock_threshold: 10 
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
    
                // Validar si el producto ya existe localmente
                const productExists = inventory.some(p => p.name.toLowerCase() === newProduct.name.toLowerCase());
                if (productExists) {
                    setMessage('�� Error: El producto ya existe en el inventario.');
                    return;
                }
    
                try {
                    // Crear producto en el backend
                    const response = await api.post('/products/', {
                        name: newProduct.name.trim(),
                        description: newProduct.description.trim(),
                        price: parseFloat(newProduct.price),
                        stock: parseInt(newProduct.stock),
                        low_stock_threshold: parseInt(newProduct.low_stock_threshold)
                    });
    
                    // Actualizar inventario local
                    const createdProduct = response.data;
                    setInventory([...inventory, {
                        id: createdProduct.id,
                        name: createdProduct.name,
                        stock: createdProduct.stock,
                        type: 'Producto' // Por defecto como producto
                    }]);
    
                    // Limpiar formulario
                    setNewProduct({ 
                        name: '', 
                        description: '', 
                        price: 0, 
                        stock: 0, 
                        low_stock_threshold: 10 
                    });
                    setMessage('✅ Producto creado exitosamente en el sistema.');
                } catch (error) {
                    console.error('Error creando producto:', error);
                    if (error.response && error.response.status === 400) {
                        setMessage('🚫 Error: ' + (error.response.data.detail || 'Datos inválidos.'));
                    } else {
                        setMessage('🚫 Error: No se pudo crear el producto. Intenta nuevamente.');
                    }
                }
            };
    
            return (
                <div className="creation-container">
                    <h2>Crear Productos Nuevos</h2>
                    {message && <p className="message">{message}</p>}
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
                        <p>Precio</p>
                        <input 
                            type="number" 
                            value={newProduct.price} 
                            onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })} 
                            placeholder="Precio *" 
                            min="0.01"
                            step="0.01"
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
    
            // Función para validar fecha en formato dd/mm/aaaa
            const validateDate = (date) => {
                const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
                return dateRegex.test(date);
            };
    
            // Función para calcular el total de un item
            const calculateItemTotal = (quantity, unitPrice) => {
                return quantity * unitPrice;
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
                    const quantity = field === 'quantity' ? value : updatedItems[index].quantity;
                    const unitPrice = field === 'unitPrice' ? value : updatedItems[index].unitPrice;
                    updatedItems[index].total = calculateItemTotal(quantity, unitPrice);
                }
                
                setNewPurchase({ ...newPurchase, items: updatedItems });
            };
    
            // Función para calcular el total de la compra
            const calculatePurchaseTotal = () => {
                return newPurchase.items.reduce((sum, item) => sum + item.total, 0);
            };
    
            const handleAddPurchase = (e) => {
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
                
                // Crear la nueva compra
                const id = Math.max(...purchases.map(p => p.id)) + 1;
                const totalAmount = calculatePurchaseTotal();
                
                const purchaseToAdd = {
                    id,
                    date: newPurchase.date,
                    supplierId: parseInt(newPurchase.supplierId),
                    supplierName: selectedSupplier.name,
                    items: newPurchase.items,
                    totalAmount,
                    status: 'Completada'
                };
                
                // Actualizar inventario con los productos comprados
                const updatedInventory = [...inventory];
                newPurchase.items.forEach(item => {
                    const existingItem = updatedInventory.find(i => i.name === item.productName);
                    if (existingItem) {
                        existingItem.stock += item.quantity;
                    } else {
                        // Si el producto no existe, agregarlo al inventario
                        const newProductId = Math.max(...updatedInventory.map(i => i.id)) + 1;
                        updatedInventory.push({
                            id: newProductId,
                            name: item.productName,
                            stock: item.quantity,
                            type: 'Insumo' // Por defecto como insumo
                        });
                    }
                });
                
                setInventory(updatedInventory);
                setPurchases([...purchases, purchaseToAdd]);
                setNewPurchase({
                    date: '',
                    supplierId: '',
                    items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                });
                setShowAddPurchase(false);
                setMessage('✅ Compra registrada exitosamente y stock actualizado.');
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
                                            value={item.quantity} 
                                            onChange={e => updateItem(index, 'quantity', parseInt(e.target.value))} 
                                            placeholder="Cantidad" 
                                            min="1"
                                            required 
                                        />
                                        <input 
                                            type="number" 
                                            value={item.unitPrice} 
                                            onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value))} 
                                            placeholder="Precio Unitario" 
                                            min="0.01"
                                            step="0.01"
                                            required 
                                        />
                                        <span className="item-total">${item.total.toFixed(2)}</span>
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
                                <strong>Total de la Compra: ${calculatePurchaseTotal().toFixed(2)}</strong>
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
                                    <span className="purchase-status">{purchase.status}</span>
                                </div>
                                <div className="purchase-supplier">
                                    <strong>Proveedor:</strong> {purchase.supplierName}
                                </div>
                                <div className="purchase-items">
                                    <strong>Productos:</strong>
                                    <ul>
                                        {purchase.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity} x ${item.unitPrice} = ${item.total.toFixed(2)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="purchase-total-display">
                                    <strong>Total: ${purchase.totalAmount.toFixed(2)}</strong>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };
    
        // Componente de la interfaz de gestión de pedidos de mercadería (solo para Gerente).
        const OrderManagement = () => {
            const [showAddOrder, setShowAddOrder] = useState(false);
            const [newOrder, setNewOrder] = useState({
                supplierId: '',
                items: [{ productName: '', quantity: 1, currentStock: 0 }],
                notes: ''
            });
            const [message, setMessage] = useState('');
    
            // Función para agregar un nuevo item al pedido
            const addItem = () => {
                setNewOrder({
                    ...newOrder,
                    items: [...newOrder.items, { productName: '', quantity: 1, currentStock: 0 }]
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
                
                // Si se selecciona un producto, obtener su stock actual
                if (field === 'productName') {
                    const selectedProduct = inventory.find(p => p.name === value);
                    updatedItems[index].currentStock = selectedProduct ? selectedProduct.stock : 0;
                }
                
                setNewOrder({ ...newOrder, items: updatedItems });
            };
    
            const handleAddOrder = (e) => {
                e.preventDefault();
                
                // Validaciones según la especificación
                if (!newOrder.supplierId) {
                    setMessage('🚫 Error: Debe seleccionar un proveedor.');
                    return;
                }
                
                // Validar que al menos un producto tenga cantidad mayor a 0
                const validItems = newOrder.items.filter(item => 
                    item.productName.trim() && item.quantity > 0
                );
                
                if (validItems.length === 0) {
                    setMessage('🚫 Error: Debe seleccionar al menos un producto con cantidad mayor a 0.');
                    return;
                }
                
                // Verificar que el proveedor existe
                const selectedSupplier = suppliers.find(s => s.id === parseInt(newOrder.supplierId));
                if (!selectedSupplier) {
                    setMessage('🚫 Error: El proveedor seleccionado no existe.');
                    return;
                }
                
                // Verificar que todos los productos existen
                const invalidProducts = validItems.filter(item => 
                    !inventory.some(p => p.name === item.productName)
                );
                
                if (invalidProducts.length > 0) {
                    setMessage('🚫 Error: Algunos productos no existen en la base de datos.');
                    return;
                }
                
                // Crear el nuevo pedido
                const id = Math.max(...orders.map(o => o.id)) + 1;
                const today = new Date().toLocaleDateString('es-ES');
                
                const orderToAdd = {
                    id,
                    date: today,
                    supplierId: parseInt(newOrder.supplierId),
                    supplierName: selectedSupplier.name,
                    items: validItems.map(item => ({
                        ...item,
                        status: 'Pendiente'
                    })),
                    status: 'Pendiente',
                    notes: newOrder.notes
                };
                
                setOrders([...orders, orderToAdd]);
                setNewOrder({
                    supplierId: '',
                    items: [{ productName: '', quantity: 1, currentStock: 0 }],
                    notes: ''
                });
                setShowAddOrder(false);
                setMessage('✅ Pedido registrado exitosamente y listo para envío al proveedor.');
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
                    <h2>Gestión de Pedidos de Mercadería</h2>
                    {message && <p className="message">{message}</p>}
                    {!showAddOrder ? (
                        <button className="main-button" onClick={() => setShowAddOrder(true)}>Registrar Nuevo Pedido</button>
                    ) : (
                        <form className="form-container" onSubmit={handleAddOrder}>
                            <h3>Registrar Pedido de Mercadería</h3>
                            
                            <select 
                                value={newOrder.supplierId} 
                                onChange={e => setNewOrder({ ...newOrder, supplierId: e.target.value })} 
                                required
                            >
                                <option value="">Seleccionar Proveedor</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name} - {supplier.cuit}
                                    </option>
                                ))}
                            </select>
                            
                            <h4>Productos del Pedido</h4>
                            <div className="stock-info">
                                <p><strong>Stock Disponible:</strong></p>
                                <ul>
                                    {inventory.map(item => (
                                        <li key={item.id}>
                                            {item.name}: {item.stock} unidades
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            
                            {newOrder.items.map((item, index) => (
                                <div key={index} className="order-item">
                                    <div className="item-row">
                                        <select 
                                            value={item.productName} 
                                            onChange={e => updateItem(index, 'productName', e.target.value)} 
                                            required
                                        >
                                            <option value="">Seleccionar Producto</option>
                                            {inventory.map(product => (
                                                <option key={product.id} value={product.name}>
                                                    {product.name} (Stock: {product.stock})
                                                </option>
                                            ))}
                                        </select>
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => updateItem(index, 'quantity', parseInt(e.target.value))} 
                                            placeholder="Cantidad a pedir" 
                                            min="1"
                                            required 
                                        />
                                        <span className="current-stock">
                                            Stock actual: {item.currentStock}
                                        </span>
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
                            
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar Pedido</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddOrder(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Historial de Pedidos</h3>
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
                                            <option value="Enviado">Enviado</option>
                                            <option value="Recibido">Recibido</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="order-supplier">
                                    <strong>Proveedor:</strong> {order.supplierName}
                                </div>
                                <div className="order-items">
                                    <strong>Productos solicitados:</strong>
                                    <ul>
                                        {order.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity} unidades 
                                                (Stock actual: {item.currentStock})
                                                <span className={`item-status ${item.status.toLowerCase()}`}>
                                                    {item.status}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
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
    
        // Componente de la interfaz de consulta de datos (solo para Gerente).
        const DataConsultation = () => {
            const [selectedQuery, setSelectedQuery] = useState('');
            const [startDate, setStartDate] = useState('');
            const [endDate, setEndDate] = useState('');
            const [queryResults, setQueryResults] = useState(null);
            const [message, setMessage] = useState('');
    
            // Función para validar fecha en formato dd/mm/aaaa
            const validateDate = (date) => {
                const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
                return dateRegex.test(date);
            };
    
            // Función para convertir fecha dd/mm/aaaa a objeto Date
            const parseDate = (dateStr) => {
                const [day, month, year] = dateStr.split('/');
                return new Date(year, month - 1, day);
            };
    
            // Función para formatear fecha a dd/mm/aaaa
            const formatDate = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            };
    
            // Función para ejecutar consulta
            const executeQuery = () => {
                if (!selectedQuery) {
                    setMessage('🚫 Error: Debe seleccionar un tipo de consulta.');
                    return;
                }
    
               /* if (startDate && !validateDate(startDate)) {
                    setMessage('�� Error: La fecha de inicio debe estar en formato dd/mm/aaaa.');
                    return;
                }*/
    
                /*if (endDate && !validateDate(endDate)) {
                    setMessage('�� Error: La fecha de fin debe estar en formato dd/mm/aaaa.');
                    return;
                }*/
    
                if (startDate && endDate) {
                    const start = parseDate(startDate);
                    const end = parseDate(endDate);
                    if (start > end) {
                        setMessage('�� Error: La fecha de inicio no puede ser posterior a la fecha de fin.');
                        return;
                    }
                }
    
                setMessage('');
    
                // Ejecutar consulta según el tipo seleccionado
                switch (selectedQuery) {
                    case 'stock':
                        executeStockQuery();
                        break;
                    case 'proveedores':
                        executeSuppliersQuery();
                        break;
                    case 'ventas':
                        executeSalesQuery();
                        break;
                    case 'compras':
                        executePurchasesQuery();
                        break;
                    case 'pedidos':
                        executeOrdersQuery();
                        break;
                    case 'movimientos_caja':
                        executeCashMovementsQuery();
                        break;
                    default:
                        setMessage('🚫 Error: Tipo de consulta no válido.');
                }
            };
    
            // Consulta de stock
            const executeStockQuery = () => {
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
                setQueryResults(results);
            };
    
            // Consulta de proveedores
            const executeSuppliersQuery = () => {
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
                setQueryResults(results);
            };
    
            // Consulta de ventas (simulada)
            const executeSalesQuery = () => {
                const mockSales = [
                    { date: '26/10/2023', product: 'Churro', quantity: 25, total: 250.00 },
                    { date: '26/10/2023', product: 'Café', quantity: 15, total: 300.00 },
                    { date: '25/10/2023', product: 'Combo Familiar', quantity: 8, total: 200.00 }
                ];
    
                const filteredSales = mockSales.filter(sale => {
                    if (startDate && endDate) {
                        const saleDate = parseDate(sale.date);
                        const start = parseDate(startDate);
                        const end = parseDate(endDate);
                        return saleDate >= start && saleDate <= end;
                    }
                    return true;
                });
    
                const results = {
                    title: 'Reporte de Ventas',
                    summary: {
                        totalSales: filteredSales.length,
                        totalRevenue: filteredSales.reduce((sum, sale) => sum + sale.total, 0),
                        period: startDate && endDate ? `${startDate} - ${endDate}` : 'Todos los períodos'
                    },
                    data: filteredSales
                };
                setQueryResults(results);
            };
    
            // Consulta de compras
            const executePurchasesQuery = () => {
                const filteredPurchases = purchases.filter(purchase => {
                    if (startDate && endDate) {
                        const purchaseDate = parseDate(purchase.date);
                        const start = parseDate(startDate);
                        const end = parseDate(endDate);
                        return purchaseDate >= start && purchaseDate <= end;
                    }
                    return true;
                });
    
                const results = {
                    title: 'Reporte de Compras',
                    summary: {
                        totalPurchases: filteredPurchases.length,
                        totalAmount: filteredPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
                        period: startDate && endDate ? `${startDate} - ${endDate}` : 'Todos los períodos'
                    },
                    data: filteredPurchases.map(purchase => ({
                        id: purchase.id,
                        date: purchase.date,
                        supplier: purchase.supplierName,
                        total: purchase.totalAmount,
                        status: purchase.status
                    }))
                };
                setQueryResults(results);
            };
    
            // Consulta de pedidos
            const executeOrdersQuery = () => {
                const filteredOrders = orders.filter(order => {
                    if (startDate && endDate) {
                        const orderDate = parseDate(order.date);
                        const start = parseDate(startDate);
                        const end = parseDate(endDate);
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
                        period: startDate && endDate ? `${startDate} - ${endDate}` : 'Todos los períodos'
                    },
                    data: filteredOrders.map(order => ({
                        id: order.id,
                        date: order.date,
                        supplier: order.supplierName,
                        status: order.status,
                        items: order.items.length
                    }))
                };
                setQueryResults(results);
            };
    
            // Consulta de movimientos de caja
            const executeCashMovementsQuery = () => {
                const filteredMovements = cashMovements.filter(movement => {
                    if (startDate && endDate) {
                        const movementDate = parseDate(movement.date);
                        const start = parseDate(startDate);
                        const end = parseDate(endDate);
                        return movementDate >= start && movementDate <= end;
                    }
                    return true;
                });
    
                const results = {
                    title: 'Reporte de Movimientos de Caja',
                    summary: {
                        totalMovements: filteredMovements.length,
                        totalIncome: filteredMovements.filter(m => m.type === 'Entrada').reduce((sum, m) => sum + m.amount, 0),
                        totalExpenses: filteredMovements.filter(m => m.type === 'Salida').reduce((sum, m) => sum + m.amount, 0),
                        period: startDate && endDate ? `${startDate} - ${endDate}` : 'Todos los períodos'
                    },
                    data: filteredMovements.map(movement => ({
                        date: movement.date,
                        type: movement.type,
                        amount: movement.amount,
                        description: movement.description
                    }))
                };
                setQueryResults(results);
            };
    
            // Función para exportar datos
            const exportData = () => {
                if (!queryResults) {
                    setMessage('🚫 Error: No hay datos para exportar.');
                    return;
                }
    
                const dataStr = JSON.stringify(queryResults, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${selectedQuery}_report_${formatDate(new Date())}.json`;
                link.click();
                URL.revokeObjectURL(url);
                setMessage('✅ Datos exportados exitosamente.');
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
                                <label>Fecha de inicio (dd/mm/aaaa):</label>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={e => setStartDate(e.target.value)} 
                                    //placeholder="dd/mm/aaaa"
                                />
                            </div>
                            <div className="date-input">
                                <label>Fecha de fin (dd/mm/aaaa):</label>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={e => setEndDate(e.target.value)} 
                                    //placeholder="dd/mm/aaaa"
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
                                        <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {value}
                                    </div>
                                ))}
                            </div>
                            
                            <div className="results-table">
                                <table>
                                    <thead>
                                        <tr>
                                            {Object.keys(queryResults.data[0] || {}).map(key => (
                                                <th key={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queryResults.data.map((row, index) => (
                                            <tr key={index}>
                                                {Object.values(row).map((value, colIndex) => (
                                                    <td key={colIndex}>{value}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                description: ''
            });
            const [message, setMessage] = useState('');
    
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
    
            // Función para seleccionar un producto para editar
            const selectProductForEdit = (product) => {
                // Verificar que el producto no tenga ventas registradas
                if (product.hasSales) {
                    setMessage('�� Error: No se puede editar un producto que ya tiene ventas registradas.');
                    return;
                }
    
                setSelectedProduct(product);
                setEditingProduct({
                    name: product.name,
                    price: product.price,
                    category: product.category,
                    stock: product.stock,
                    description: product.description || ''
                });
                setMessage('');
            };
    
            // Función para guardar los cambios
            const handleSaveChanges = (e) => {
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
    
                // Verificar que no se eliminen datos obligatorios
                if (!editingProduct.name.trim() || editingProduct.price <= 0 || !editingProduct.category) {
                    setMessage('🚫 Error: No se pueden eliminar datos obligatorios (nombre, precio, categoría).');
                    return;
                }
    
                // Actualizar el producto
                const updatedProducts = products.map(product => 
                    product.id === selectedProduct.id 
                        ? { 
                            ...product, 
                            name: editingProduct.name,
                            price: editingProduct.price,
                            category: editingProduct.category,
                            stock: editingProduct.stock,
                            description: editingProduct.description
                        }
                        : product
                );
    
                setProducts(updatedProducts);
                setSelectedProduct(null);
                setEditingProduct({
                    name: '',
                    price: 0,
                    category: 'Producto',
                    stock: 0,
                    description: ''
                });
                setMessage('✅ Producto actualizado correctamente con los nuevos datos.');
            };
    
            // Función para cancelar la edición
            const handleCancelEdit = () => {
                setSelectedProduct(null);
                setEditingProduct({
                    name: '',
                    price: 0,
                    category: 'Producto',
                    stock: 0,
                    description: ''
                });
                setMessage('');
            };
    
            // Obtener solo productos nuevos (sin ventas registradas)
            const newProducts = products.filter(product => !product.hasSales);
    
            return (
                <div className="management-container">
                    <h2>Editar Productos Nuevos</h2>
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
                                </div>
                            </form>
                        </div>
                    )}
            </div>
        );
    };

    // Renderiza el componente de la página actual según el estado.
    const renderPage = () => {
        if (!isLoggedIn) {
            return <Login />;
        }
        switch (currentPage) {
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
        // Cargar inventario real
        loadInventory();
        // Cargar usuarios reales
        loadUsers();
      }
    }, [isLoggedIn]);

    return (
        <div className="app-container">
            {showModal && <LockedAccountModal />}
            {isLoggedIn && <Navbar />}
            {renderPage()}
        </div>
    );
};

export default App;