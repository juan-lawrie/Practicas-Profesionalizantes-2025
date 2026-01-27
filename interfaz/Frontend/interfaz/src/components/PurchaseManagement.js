import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import api from '../services/api';
import PurchaseRequests from './PurchaseRequests';
import PurchaseHistory from './PurchaseHistory';
import DialogoCompras from './Dialogo_Compras';

// Componente híbrido que usa datalist en Firefox/Safari y dropdown personalizado en Chrome/Brave
const SearchableProductInput = ({ value, onChange, inventory, mapBackendUnitToFrontend, isExistingProduct, itemIndex }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Detectar si está corriendo en Chrome o Brave
    const isChromiumBrowser = () => {
        return window.chrome !== undefined || 
               navigator.userAgent.includes('Chrome') || 
               navigator.userAgent.includes('Brave') ||
               navigator.userAgent.includes('Chromium');
    };

    const isChromium = isChromiumBrowser();

    // Generar opciones filtradas para el dropdown personalizado
    useEffect(() => {
        if (isChromium) {
            if (value && value.length > 0) {
                const filtered = inventory.filter(product => 
                    product.name.toLowerCase().includes(value.toLowerCase())
                ).slice(0, 8);
                setFilteredOptions(filtered);
            } else {
                setFilteredOptions(inventory.slice(0, 8));
            }
        }
    }, [value, inventory, isChromium]);

    // Cerrar dropdown al hacer clic fuera (solo para Chromium)
    useEffect(() => {
        if (!isChromium) return;
        
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                inputRef.current && !inputRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChromium]);

    const handleInputChange = (e) => {
        onChange(e.target.value);
        if (isChromium) {
            setIsOpen(true);
        }
    };

    const handleOptionClick = (productName) => {
        onChange(productName);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const getBorderColor = () => {
        if (isExistingProduct(value)) return '#28a745';
        if (value && !isExistingProduct(value)) return '#ffc107';
        return '#ced4da';
    };

    const getStatusMessage = () => {
        if (!value) return null;
        if (isExistingProduct(value)) {
            return <small className="text-green-600 text-xs">✓ Producto existente - unidad detectada automáticamente</small>;
        }
        return <small className="text-amber-500 text-xs">⚠ Producto nuevo - debe ingresar manualmente la unidad</small>;
    };

    // Crear un ID único para el datalist
    const datalistId = `product-list-${itemIndex}`;

    return (
        <div className="searchable-product-input-container">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={() => isChromium && setIsOpen(true)}
                placeholder="Escribe para buscar un producto existente o ingresa uno nuevo"
                required
                className={`searchable-product-input w-full ${isExistingProduct(value) ? 'border-green-500' : value && !isExistingProduct(value) ? 'border-amber-400' : 'border-slate-300'}`}
                list={!isChromium ? datalistId : undefined}
            />
            
            {/* Datalist para Firefox/Safari */}
            {!isChromium && (
                <datalist id={datalistId}>
                    {inventory.map((product, index) => (
                        <option 
                            key={`${product.id}-${index}`} 
                            value={product.name}
                        >
                            {product.name} ({mapBackendUnitToFrontend(product.unit)}) - {product.quantity}
                        </option>
                    ))}
                </datalist>
            )}

            {/* Dropdown personalizado para Chrome/Brave */}
            {isChromium && isOpen && filteredOptions.length > 0 && (
                <div 
                    ref={dropdownRef} 
                    className="searchable-product-dropdown chromium-browser"
                >
                    {filteredOptions.map((product, index) => (
                        <div
                            key={`${product.id}-${index}`}
                            className="searchable-product-option"
                            onClick={() => handleOptionClick(product.name)}
                        >
                            <span className="product-name">
                                {product.name}
                            </span>
                            <span className="product-unit">({mapBackendUnitToFrontend(product.unit)})</span>
                            <span className="product-stock">{product.quantity}</span>
                        </div>
                    ))}
                </div>
            )}
            {getStatusMessage()}
        </div>
    );
};

const PurchaseManagement = ({ userRole, inventory = [], suppliers = [], products = [], purchases = [], reloadPurchases, reloadProducts }) => {
    const [pendingPurchases, setPendingPurchases] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [view, setView] = useState('requests'); // 'requests', 'history', or 'create'
    const [message, setMessage] = useState('');
    const [showAddPurchase, setShowAddPurchase] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // ID de la compra a eliminar (legacy)
    const [showConfirmPurchase, setShowConfirmPurchase] = useState(false); // Confirmación para registrar compra
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false); // Modal para confirmar eliminación
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [newPurchase, setNewPurchase] = useState({
        date: '',
        supplierId: '', // Legacy - mantener para compatibilidad
        selectedSupplierIds: [], // Nuevo: array de IDs de proveedores seleccionados
        items: [] // Array de items con id único para sistema de tarjetas
    });
    const [itemsToAdd, setItemsToAdd] = useState(1); // Cantidad de tarjetas a agregar

    // Helper para toggle de proveedores en pantallas pequeñas
    const toggleSupplier = (supplierId) => {
        setNewPurchase(prev => {
            const isSelected = prev.selectedSupplierIds.includes(supplierId);
            if (isSelected) {
                return { ...prev, selectedSupplierIds: prev.selectedSupplierIds.filter(id => id !== supplierId) };
            } else {
                return { ...prev, selectedSupplierIds: [...prev.selectedSupplierIds, supplierId] };
            }
        });
    };
    
    // Estados para el diálogo en pantallas grandes
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [showDialog, setShowDialog] = useState(false);
    const [externalWindow, setExternalWindow] = useState(null);

    // Manejar resize de pantalla
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Determinar si usar diálogo (pantallas >= 1100px)
    const useDialogMode = screenWidth >= 1100;

    // Función para mapear unidades del backend al frontend - DEBE estar antes de productOptions
    const mapBackendUnitToFrontend = (backendUnit) => {
        switch (backendUnit) {
            case 'g':
                return 'kg';
            case 'ml':
                return 'l';
            case 'unidades':
                return 'u';
            default:
                return 'u';
        }
    };

    // Opciones para react-select con unidad incluida
    const productOptions = inventory.map(product => ({
        value: product.name,
        label: `${product.name} (${mapBackendUnitToFrontend(product.unit)})`,
        unit: mapBackendUnitToFrontend(product.unit),
        price: product.price
    }));

    const fetchPendingPurchases = async () => {
        try {
            console.log('Fetching pending purchases...');
            const response = await api.get('/purchases/pending-approval/');
            console.log('Pending purchases response:', response.data);
            setPendingPurchases(response.data);
        } catch (error) {
            console.error('Error fetching pending purchases:', error);
            // setMessage('Error al cargar las solicitudes de compra.');
        }
    };

    const fetchPurchaseHistory = async () => {
        try {
            console.log('Fetching purchase history...');
            const response = await api.get('/purchases/history/');
            console.log('Purchase history response:', response.data);
            setPurchaseHistory(response.data);
        } catch (error) {
            console.error('Error fetching purchase history:', error);
            setMessage('Error al cargar el historial de compras.');
        }
    };

    // Función para obtener el ID del producto por nombre
    const getProductIdByName = (inventory, name) => {
        const product = inventory.find(p => p.name === name);
        return product ? product.id : null;
    };

    // Función para verificar si un producto existe en el inventario
    const isExistingProduct = (productName) => {
        return inventory.some(p => p.name === productName);
    };

    // Función para calcular el total de un item
    const calculateItemTotal = (quantity, unitPrice) => {
        const safeQuantity = isNaN(quantity) ? 0 : (quantity || 0);
        const safeUnitPrice = isNaN(unitPrice) ? 0 : (unitPrice || 0);
        return safeQuantity * safeUnitPrice;
    };

    // Función para agregar nuevos items (tarjetas) a la compra
    const addItems = (count = 1) => {
        const validCount = Math.max(1, Math.min(100, parseInt(count) || 1));
        const newItems = Array(validCount).fill(null).map(() => ({
            id: Date.now() + Math.random(),
            productName: '',
            quantity: 1,
            unit: 'u',
            unitPrice: 0,
            total: 0,
            isExisting: false
        }));
        setNewPurchase(prev => ({
            ...prev,
            items: [...prev.items, ...newItems]
        }));
    };

    // Función para eliminar un item de la compra por id
    const removeItem = (itemId) => {
        setNewPurchase(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
        }));
    };

    // Obtener producto del inventario por nombre
    const getProductFromInventory = (productName) => {
        return inventory.find(p => p.name.toLowerCase() === productName.toLowerCase());
    };

    // Función para actualizar un item por id
    const updateItem = (itemId, field, value) => {
        setNewPurchase(prev => {
            const updatedItems = prev.items.map(item => {
                if (item.id !== itemId) return item;

                let updates = { [field]: value };

                if (field === 'productName') {
                    const product = getProductFromInventory(value);
                    if (product) {
                        updates.unit = mapBackendUnitToFrontend(product.unit);
                        updates.unitPrice = product.price || 0;
                        updates.isExisting = true;
                    } else {
                        updates.isExisting = false;
                        if (!value) {
                            updates.unit = 'u';
                            updates.unitPrice = 0;
                        }
                    }
                }

                const newItem = { ...item, ...updates };
                
                // Recalcular total
                if (field === 'quantity' || field === 'unitPrice' || field === 'productName') {
                    const qty = parseFloat(newItem.quantity) || 0;
                    const price = parseFloat(newItem.unitPrice) || 0;
                    newItem.total = qty * price;
                }

                return newItem;
            });

            return { ...prev, items: updatedItems };
        });
    };

    // Función para calcular el total de la compra
    const calculatePurchaseTotal = () => {
        return newPurchase.items.reduce((sum, item) => sum + item.total, 0);
    };

    const handleAddPurchase = async (e) => {
        e.preventDefault();

        // Validaciones (las mismas que antes)
        if (!newPurchase.date) {
            setMessage('Por favor, ingrese una fecha.');
            return;
        }

        // Soportar tanto supplierId (legacy) como selectedSupplierIds (nuevo)
        const hasSupplier = newPurchase.supplierId || (newPurchase.selectedSupplierIds && newPurchase.selectedSupplierIds.length > 0);
        if (!hasSupplier) {
            setMessage('Por favor, seleccione al menos un proveedor.');
            return;
        }

        // Validar que todos los items tengan producto y cantidad
        const hasInvalidItems = newPurchase.items.some(item => 
            !item.productName || item.quantity <= 0
        );

        if (hasInvalidItems) {
            setMessage('Por favor, complete todos los productos y cantidades.');
            return;
        }

        // Mostrar modal de confirmación (más visible)
        setShowConfirmPurchase(true);
    };

    // Confirmar registro de compra (ejecuta la petición)
    const confirmAddPurchase = async () => {
        setShowConfirmPurchase(false);
        try {
            // Obtener los IDs de proveedores (soportar tanto legacy como nuevo formato)
            const supplierIds = newPurchase.selectedSupplierIds.length > 0 
                ? newPurchase.selectedSupplierIds 
                : (newPurchase.supplierId ? [parseInt(newPurchase.supplierId)] : []);

            // Crear una compra por cada proveedor seleccionado
            for (const supplierId of supplierIds) {
                const purchaseData = {
                    date: newPurchase.date,
                    supplier_id: parseInt(supplierId),
                    items: newPurchase.items.map(item => ({
                        product_id: getProductIdByName(inventory, item.productName),
                        productName: item.productName,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                        unitPrice: parseFloat(item.unitPrice),
                        total: parseFloat(item.total)
                    })),
                    total_amount: calculatePurchaseTotal(),
                };

                console.log('Enviando datos de compra:', purchaseData);
                const response = await api.post('/purchases/', purchaseData);
                console.log('Respuesta del servidor:', response.data);
            }

            setMessage(userRole === 'Gerente' ? 
                (supplierIds.length > 1 ? 'Compras registradas y completadas con éxito.' : 'Compra registrada y completada con éxito.') : 
                (supplierIds.length > 1 ? 'Solicitudes de compra enviadas. Esperando aprobación del gerente.' : 'Solicitud de compra enviada. Esperando aprobación del gerente.')
            );

            // Limpiar el formulario
            setNewPurchase({
                date: '',
                supplierId: '',
                selectedSupplierIds: [],
                items: []
            });
            setItemsToAdd(1);

            // Recargar las compras
            if (userRole === 'Gerente') {
                fetchPurchaseHistory();
            } else {
                fetchPendingPurchases();
            }
            if (reloadProducts) {
                reloadProducts();
            }
        } catch (error) {
            console.error('Error al registrar la compra:', error);
            setMessage('Error al registrar la compra. Por favor, intente nuevamente.');
        }
    };

    // Función para cancelar la confirmación de compra
    const handleCancelPurchase = () => {
        setShowConfirmPurchase(false);
        setMessage('');
    };

    // Función para iniciar confirmación de eliminación (abre modal)
    const handleDeletePurchase = (purchaseId) => {
        setPendingDeleteId(purchaseId);
        setShowConfirmDeleteModal(true);
    };

    // Función que confirma y ejecuta la eliminación
    const confirmDeletePurchase = async () => {
        if (!pendingDeleteId) return;
        try {
            await api.delete(`/purchases/${pendingDeleteId}/`);
            // Actualizar la lista de historial
            setPurchaseHistory(prev => prev.filter(p => p.id !== pendingDeleteId));
            setPendingDeleteId(null);
            setShowConfirmDeleteModal(false);
            setMessage('✅ Compra eliminada del historial exitosamente.');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error al eliminar la compra:', error);
            setMessage('Error al eliminar la compra.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // Cancelar diálogo de eliminación
    const handleCancelDeleteModal = () => {
        setPendingDeleteId(null);
        setShowConfirmDeleteModal(false);
        setMessage('');
    };

    useEffect(() => {
        // Establecer la vista inicial basada en el rol
        if (userRole === 'Encargado') {
            setView('create');
        } else {
            setView('requests');
        }
    }, [userRole]);

    useEffect(() => {
        if (userRole === 'Gerente') {
            fetchPendingPurchases();
        }
        fetchPurchaseHistory();
    }, [userRole]);

    const handleApprove = async (purchaseId) => {
        try {
            console.log('Approving purchase:', purchaseId);
            await api.post(`/purchases/${purchaseId}/approve/`);
            console.log('Purchase approved successfully');
            setMessage('Compra aprobada con éxito.');
            // Actualizar la lista de compras pendientes (la compra aprobada ya no debería aparecer)
            setPendingPurchases(prev => {
                const filtered = prev.filter(p => p.id !== purchaseId);
                console.log('Updated pending purchases:', filtered);
                return filtered;
            });
            // Recargar el historial para mostrar la compra aprobada
            fetchPurchaseHistory();
            // Limpiar el mensaje después de 3 segundos
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error approving purchase:', error);
            setMessage('Error al aprobar la compra.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleReject = async (purchaseId) => {
        try {
            console.log('Rejecting purchase:', purchaseId);
            await api.post(`/purchases/${purchaseId}/reject/`);
            console.log('Purchase rejected successfully');
            setMessage('Compra rechazada y eliminada con éxito.');
            // Actualizar la lista de compras pendientes (la compra rechazada ya no debería aparecer)
            setPendingPurchases(prev => {
                const filtered = prev.filter(p => p.id !== purchaseId);
                console.log('Updated pending purchases after rejection:', filtered);
                return filtered;
            });
            // Limpiar el mensaje después de 3 segundos
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error rejecting purchase:', error);
            setMessage('Error al rechazar la compra.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // Manejar submit desde el diálogo
    const handleDialogSubmit = async (purchaseData) => {
        try {
            // Por cada proveedor seleccionado, crear una compra
            for (const supplierId of purchaseData.supplierIds) {
                const data = {
                    date: purchaseData.date,
                    supplier_id: parseInt(supplierId),
                    items: purchaseData.items.map(item => ({
                        product_id: getProductIdByName(inventory, item.productName),
                        productName: item.productName,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                        unitPrice: parseFloat(item.unitPrice),
                        total: parseFloat(item.total)
                    })),
                    total_amount: purchaseData.totalAmount,
                };

                console.log('Enviando datos de compra desde diálogo:', data);
                await api.post('/purchases/', data);
            }

            setMessage(userRole === 'Gerente' ? 
                'Compra(s) registrada(s) y completada(s) con éxito.' : 
                'Solicitud(es) de compra enviada(s). Esperando aprobación del gerente.'
            );

            setShowDialog(false);
            
            // Cerrar ventana externa si existe
            if (externalWindow && !externalWindow.closed) {
                externalWindow.close();
            }
            setExternalWindow(null);

            // Recargar las compras
            if (userRole === 'Gerente') {
                fetchPurchaseHistory();
            } else {
                fetchPendingPurchases();
            }
            if (reloadProducts) {
                reloadProducts();
            }
            
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error al registrar la compra desde diálogo:', error);
            setMessage('Error al registrar la compra. Por favor, intente nuevamente.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // Cerrar diálogo
    const handleCloseDialog = () => {
        setShowDialog(false);
        if (externalWindow && !externalWindow.closed) {
            externalWindow.close();
        }
        setExternalWindow(null);
    };

    return (
        <div className="purchase-management-container">
            <h2>Gestión de Compras</h2>
            {message && <p className="message">{message}</p>}

            {/* Modal de confirmación para registrar compra */}
            {showConfirmPurchase && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
                    <div className="bg-white p-5 rounded-lg w-[90%] max-w-[480px] shadow-xl">
                        <h3 className="mt-0">Confirmar registro de compra</h3>
                        <p>¿Estás seguro que deseas {userRole === 'Gerente' ? 'registrar esta compra' : 'enviar esta solicitud de compra'}?</p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={confirmAddPurchase} className="action-button primary">Confirmar</button>
                            <button onClick={handleCancelPurchase} className="action-button secondary">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmación para eliminar compra del historial */}
            {showConfirmDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
                    <div className="bg-white p-5 rounded-lg w-[90%] max-w-[480px] shadow-xl">
                        <h3 className="mt-0">Confirmar eliminación</h3>
                        <p>¿Estás seguro que deseas eliminar esta compra del historial? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={confirmDeletePurchase} className="action-button primary">Eliminar</button>
                            <button onClick={handleCancelDeleteModal} className="action-button secondary">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="purchase-tabs-container flex flex-wrap gap-1 xs:gap-1.5 sm:gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                <button
                    className={`purchase-tab-btn flex-1 min-w-[90px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${
                        view === 'create'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'bg-transparent text-slate-600 hover:bg-white/50 hover:text-slate-800'
                    }`}
                    onClick={() => setView('create')}
                >
                    {userRole === 'Encargado' ? 'Solicitar Compra' : 'Crear Compra'}
                </button>
                {userRole === 'Gerente' && (
                    <button
                        className={`purchase-tab-btn flex-1 min-w-[90px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${
                            view === 'requests'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'bg-transparent text-slate-600 hover:bg-white/50 hover:text-slate-800'
                        }`}
                        onClick={() => setView('requests')}
                    >
                        <span className="hidden xs:inline">Solicitudes Pendientes</span>
                        <span className="xs:hidden">Pendientes</span>
                    </button>
                )}
                <button
                    className={`purchase-tab-btn flex-1 min-w-[90px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${
                        view === 'history'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'bg-transparent text-slate-600 hover:bg-white/50 hover:text-slate-800'
                    }`}
                    onClick={() => setView('history')}
                >
                    <span className="hidden xs:inline">Historial de Compras</span>
                    <span className="xs:hidden">Historial</span>
                </button>
            </div>

            {view === 'create' ? (
                <>
                    {/* Diálogo para pantallas >= 1100px */}
                    {useDialogMode && (
                        <div className="relative min-h-[600px]">
                            {!showDialog && !externalWindow ? (
                                <div className="flex flex-col items-center justify-center py-15 px-5 text-center">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6">
                                        <svg width="40" height="40" fill="none" stroke="white" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-3">
                                        {userRole === 'Encargado' ? 'Solicitar Nueva Compra' : 'Registrar Nueva Compra'}
                                    </h3>
                                    <p className="text-slate-500 mb-6 max-w-[400px]">
                                        Haz clic en el botón para abrir el formulario de compra. 
                                        Podrás agregar múltiples productos y seleccionar proveedores.
                                    </p>
                                    <button
                                        onClick={() => setShowDialog(true)}
                                        className="px-7 py-3.5 border-none rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white cursor-pointer text-base font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all"
                                    >
                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                                        </svg>
                                        Abrir Formulario de Compra
                                    </button>
                                </div>
                            ) : null}
                            
                            <DialogoCompras
                                isOpen={showDialog}
                                onClose={handleCloseDialog}
                                inventory={inventory}
                                suppliers={suppliers}
                                userRole={userRole}
                                onSubmit={handleDialogSubmit}
                                externalWindow={externalWindow}
                                setExternalWindow={setExternalWindow}
                            />
                        </div>
                    )}

                    {/* Formulario tradicional para pantallas < 1100px */}
                    {!useDialogMode && (
                        <div className="purchase-form">
                            <h3>{userRole === 'Encargado' ? 'Solicitar Nueva Compra' : 'Registrar Nueva Compra'}</h3>
                            <form onSubmit={handleAddPurchase}>
                                {/* Fecha y Proveedores - En fila para xs+ (515px+), columna para <515px */}
                                <div className="flex flex-col xs:flex-row xs:items-end gap-3 mb-4">
                                    <div className="form-group mb-0 w-full xs:w-[160px] xs:flex-shrink-0">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Fecha *</label>
                                        <input
                                            type="date"
                                            value={newPurchase.date}
                                            onChange={(e) => setNewPurchase({ ...newPurchase, date: e.target.value })}
                                            required
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="form-group mb-0 flex-1">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Proveedores *</label>
                                        <div className="flex flex-wrap gap-2">
                                            {suppliers.map(supplier => {
                                                const isSelected = newPurchase.selectedSupplierIds.includes(supplier.id);
                                                // Clases de ancho específicas por proveedor para xs hasta lg (515px-1099px)
                                                const widthClass = supplier.name === 'Casa Central' 
                                                    ? 'xs:w-[131px] lg:w-auto' 
                                                    : supplier.name === 'L&L' 
                                                        ? 'xs:w-[73px] lg:w-auto' 
                                                        : '';
                                                return (
                                                    <label
                                                        key={supplier.id}
                                                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${widthClass} ${
                                                            isSelected
                                                                ? 'bg-blue-100 border border-blue-500'
                                                                : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSupplier(supplier.id)}
                                                            className="w-4 h-4 accent-blue-500"
                                                        />
                                                        <span className="text-sm text-slate-700">{supplier.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Botón Agregar tarjetas */}
                                <div className="flex gap-2 items-center mb-4">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={itemsToAdd}
                                        onChange={(e) => setItemsToAdd(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addItems(itemsToAdd);
                                            }
                                        }}
                                        className="w-16 px-2 py-2.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addItems(itemsToAdd)}
                                        className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                                        </svg>
                                        Agregar Producto/Insumo
                                    </button>
                                </div>

                                {/* Grid de tarjetas de productos */}
                                {newPurchase.items.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                        </svg>
                                        <p>Haz clic en "Agregar Producto/Insumo" para comenzar</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                                        {newPurchase.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`relative p-3.5 rounded-xl border transition-all hover:shadow-md ${
                                                    item.isExisting 
                                                        ? 'bg-gradient-to-br from-green-50 to-slate-50 border-green-500' 
                                                        : item.productName 
                                                            ? 'bg-gradient-to-br from-amber-50 to-slate-50 border-amber-500' 
                                                            : 'bg-slate-50 border-slate-200'
                                                }`}
                                            >
                                                {/* Botón eliminar */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.id)}
                                                    className="absolute top-2 right-2 w-6 h-6 rounded-full border-none bg-red-100 hover:bg-red-200 text-red-500 cursor-pointer flex items-center justify-center transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                                    </svg>
                                                </button>

                                                {/* Producto/Insumo */}
                                                <div className="mb-2.5">
                                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                                                        Producto/Insumo
                                                    </label>
                                                    <Select
                                                        options={productOptions}
                                                        value={item.productName ? { value: item.productName, label: item.productName } : null}
                                                        onChange={(selected) => {
                                                            if (selected) {
                                                                updateItem(item.id, 'productName', selected.value);
                                                            } else {
                                                                updateItem(item.id, 'productName', '');
                                                            }
                                                        }}
                                                        placeholder="Buscar o escribir..."
                                                        isClearable
                                                        styles={{
                                                            control: (base, state) => ({
                                                                ...base,
                                                                minHeight: '36px',
                                                                fontSize: '13px',
                                                                borderColor: state.isFocused ? '#3b82f6' : item.isExisting ? '#22c55e' : item.productName ? '#f59e0b' : '#e2e8f0',
                                                                boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none'
                                                            }),
                                                            menu: (base) => ({ ...base, zIndex: 50, fontSize: '13px' }),
                                                            option: (base) => ({ ...base, padding: '8px 10px' })
                                                        }}
                                                        noOptionsMessage={() => 'Escribe para agregar nuevo'}
                                                    />
                                                    {item.isExisting && (
                                                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                                                            ✓ Existente - Datos detectados
                                                        </span>
                                                    )}
                                                    {!item.isExisting && item.productName && (
                                                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                                                            ⚠ Nuevo - Ingrese datos manualmente
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Cantidad y Unidad */}
                                                <div className="flex gap-2 mb-2.5">
                                                    <div className="flex-1">
                                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                                                            Cantidad
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                            min="0.01"
                                                            step="0.01"
                                                            className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                                                            Unidad
                                                        </label>
                                                        <select
                                                            value={item.unit}
                                                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                                            disabled={item.isExisting}
                                                            className={`w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 ${item.isExisting ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
                                                        >
                                                            <option value="u">Unidades</option>
                                                            <option value="kg">Kilos (kg)</option>
                                                            <option value="l">Litros (l)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Precio Unitario */}
                                                <div className="mb-2.5">
                                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                                                        Precio Unitario
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>

                                                {/* Total */}
                                                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 mt-2.5">
                                                    <span className="text-xs text-slate-500">Total:</span>
                                                    <span className="text-base font-bold text-slate-800">
                                                        ${(item.total || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="total-section mt-4">
                                    <h4>Total de la Compra: ${calculatePurchaseTotal().toFixed(2)}</h4>
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full mt-4 px-6 py-3 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                    </svg>
                                    {userRole === 'Encargado' ? 'Enviar Solicitud' : 'Registrar Compra'}
                                </button>
                            </form>
                        </div>
                    )}
                </>
            ) : view === 'requests' ? (
                <PurchaseRequests
                    purchases={pendingPurchases}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    userRole={userRole}
                />
            ) : (
                <PurchaseHistory 
                    purchases={purchaseHistory} 
                    onDeletePurchase={handleDeletePurchase}
                    confirmDelete={confirmDelete}
                    onCancelDelete={handleCancelDeleteModal}
                    userRole={userRole}
                    inventory={inventory}
                />
            )}
        </div>
    );
};

export default PurchaseManagement;
