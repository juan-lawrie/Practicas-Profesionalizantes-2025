import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';

const DialogoCompras = ({ 
    isOpen, 
    onClose, 
    inventory = [], 
    suppliers = [], 
    userRole,
    onSubmit,
    externalWindow,
    setExternalWindow
}) => {
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [purchaseData, setPurchaseData] = useState({
        date: '',
        selectedSuppliers: [],
        items: []
    });
    const [message, setMessage] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [dialogPosition, setDialogPosition] = useState({ x: 50, y: 64 }); // y >= NAV_HEIGHT (64px)
    const [dialogSize] = useState({ width: 900, height: 600 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [itemsToAdd, setItemsToAdd] = useState(1);
    const [wasFullscreenBeforeMinimize, setWasFullscreenBeforeMinimize] = useState(false);
    const dialogRef = useRef(null);
    const externalWindowRef = useRef(null);
    
    // Altura del nav para limitar el movimiento del diálogo (ajusta este valor si tu navbar tiene otra altura)
    const NAV_HEIGHT = -160;
    // Límite superior para cuando el diálogo está minimizado (debe ser positivo para no desaparecer)
    const NAV_HEIGHT_MINIMIZED = 64;

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Actualizar ref de ventana externa
    useEffect(() => {
        externalWindowRef.current = externalWindow;
    }, [externalWindow]);

    // Manejar arrastre del diálogo - CORREGIDO con límite superior del nav
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            e.preventDefault();
            const newX = e.clientX - dragOffset.x;
            // Usar límite más restrictivo cuando está minimizado para que no desaparezca
            const minY = isMinimized ? NAV_HEIGHT_MINIMIZED : NAV_HEIGHT;
            const newY = Math.max(minY, e.clientY - dragOffset.y);
            setDialogPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset, isMinimized]);

    // Limpiar ventana externa al cerrar
    useEffect(() => {
        return () => {
            if (externalWindowRef.current && !externalWindowRef.current.closed) {
                externalWindowRef.current.close();
            }
        };
    }, []);

    // Escuchar mensajes de la ventana externa
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.type) {
                switch (event.data.type) {
                    case 'UPDATE_DATE':
                        setPurchaseData(prev => ({ ...prev, date: event.data.value }));
                        break;
                    case 'UPDATE_SUPPLIERS':
                        setPurchaseData(prev => ({ ...prev, selectedSuppliers: event.data.value }));
                        break;
                    case 'TOGGLE_SUPPLIER':
                        // Nuevo handler para toggle individual de proveedor
                        setPurchaseData(prev => {
                            const supplierId = event.data.supplierId;
                            const isChecked = event.data.isChecked;
                            const supplier = suppliers.find(s => s.id === supplierId);
                            
                            if (!supplier) return prev;
                            
                            let updatedSuppliers;
                            if (isChecked) {
                                // Agregar si no existe
                                if (!prev.selectedSuppliers.some(s => s.value === supplierId)) {
                                    updatedSuppliers = [...prev.selectedSuppliers, { value: supplierId, label: supplier.name }];
                                } else {
                                    updatedSuppliers = prev.selectedSuppliers;
                                }
                            } else {
                                // Quitar
                                updatedSuppliers = prev.selectedSuppliers.filter(s => s.value !== supplierId);
                            }
                            
                            return { ...prev, selectedSuppliers: updatedSuppliers };
                        });
                        break;
                    case 'UPDATE_ITEMS':
                        setPurchaseData(prev => ({ ...prev, items: event.data.value }));
                        break;
                    case 'ADD_ITEMS':
                        const count = event.data.count || 1;
                        setPurchaseData(prev => ({
                            ...prev,
                            items: [...prev.items, ...Array(count).fill(null).map(() => ({
                                id: Date.now() + Math.random(),
                                productName: '',
                                quantity: 1,
                                unit: 'u',
                                unitPrice: 0,
                                total: 0,
                                isExisting: false
                            }))]
                        }));
                        break;
                    case 'REMOVE_ITEM':
                        setPurchaseData(prev => ({
                            ...prev,
                            items: prev.items.filter(item => item.id !== event.data.itemId)
                        }));
                        break;
                    case 'UPDATE_ITEM':
                        setPurchaseData(prev => ({
                            ...prev,
                            items: prev.items.map(item => {
                                if (item.id !== event.data.itemId) return item;
                                const updatedItem = { ...item, ...event.data.updates };
                                // Recalcular total
                                const qty = parseFloat(updatedItem.quantity) || 0;
                                const price = parseFloat(updatedItem.unitPrice) || 0;
                                updatedItem.total = qty * price;
                                return updatedItem;
                            })
                        }));
                        break;
                    case 'SUBMIT_PURCHASE':
                        handleSubmit();
                        break;
                    case 'CLOSE_DIALOG':
                        onClose();
                        break;
                    default:
                        break;
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onClose]);

    // Renderizar en ventana externa cuando cambian los datos
    // Solo actualiza el DOM existente sin reescribir todo (evita parpadeo)
    useEffect(() => {
        if (externalWindow && !externalWindow.closed) {
            // Verificar si ya está inicializada la ventana
            if (externalWindow.document.getElementById('purchase-form-container')) {
                // Ya inicializada - solo actualizar datos
                updateExternalWindowData(externalWindow);
            } else {
                // Primera vez - renderizar HTML completo
                renderInExternalWindow(externalWindow);
            }
        }
    }, [externalWindow, purchaseData, inventory, suppliers]);

    // CORREGIDO: handleMouseDown ahora calcula offset relativo a la posición actual del diálogo
    const handleMouseDown = (e) => {
        if (e.target.closest('.dialog-header-draggable') && !e.target.closest('button') && !e.target.closest('input')) {
            e.preventDefault();
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - dialogPosition.x,
                y: e.clientY - dialogPosition.y
            });
        }
    };

    // Función para mapear unidades del backend al frontend
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

    // Obtener producto del inventario por nombre
    const getProductFromInventory = (productName) => {
        return inventory.find(p => p.name.toLowerCase() === productName.toLowerCase());
    };

    // Agregar items (tarjetas)
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
        setPurchaseData(prev => ({
            ...prev,
            items: [...prev.items, ...newItems]
        }));
    };

    // Eliminar item
    const removeItem = (itemId) => {
        setPurchaseData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
        }));
    };

    // Actualizar item
    const updateItem = (itemId, field, value) => {
        setPurchaseData(prev => {
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

    // Calcular total de la compra
    const calculatePurchaseTotal = () => {
        return purchaseData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    // Manejar submit
    const handleSubmit = () => {
        // Validaciones
        if (!purchaseData.date) {
            setMessage('Por favor, ingrese una fecha.');
            return;
        }

        if (purchaseData.selectedSuppliers.length === 0) {
            setMessage('Por favor, seleccione al menos un proveedor.');
            return;
        }

        if (purchaseData.items.length === 0) {
            setMessage('Por favor, agregue al menos un producto.');
            return;
        }

        const hasInvalidItems = purchaseData.items.some(item => 
            !item.productName || item.quantity <= 0
        );

        if (hasInvalidItems) {
            setMessage('Por favor, complete todos los productos y cantidades.');
            return;
        }

        // Enviar al componente padre
        onSubmit({
            date: purchaseData.date,
            supplierIds: purchaseData.selectedSuppliers.map(s => s.value),
            items: purchaseData.items.map(item => ({
                productName: item.productName,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unitPrice: parseFloat(item.unitPrice),
                total: item.total,
                isExisting: item.isExisting
            })),
            totalAmount: calculatePurchaseTotal()
        });

        // Limpiar formulario
        setPurchaseData({
            date: '',
            selectedSuppliers: [],
            items: []
        });
        setMessage('');
    };

    // Altura fija para el diálogo minimizado (debajo del navbar)
    const MINIMIZED_TOP_POSITION = 70;

    // CORREGIDO: Minimizar guardando estado previo y posicionando consistentemente
    const handleMinimize = () => {
        if (!isMinimized) {
            // Al minimizar, guardar si estaba en fullscreen
            setWasFullscreenBeforeMinimize(isFullscreen);
            setIsFullscreen(false);
            
            // Posicionar el diálogo minimizado
            if (isFullscreen) {
                // Si venía de fullscreen, centrar horizontalmente en la pantalla
                const centerX = Math.max(50, (window.innerWidth - 380) / 2);
                const centerY = Math.max(MINIMIZED_TOP_POSITION, (window.innerHeight - 48) / 2);
                setDialogPosition({ x: centerX, y: centerY });
            } else {
                // Si no estaba en fullscreen, mantener X pero usar altura fija
                setDialogPosition(prev => ({
                    ...prev,
                    y: MINIMIZED_TOP_POSITION
                }));
            }
        } else {
            // Al restaurar, volver al estado anterior
            if (wasFullscreenBeforeMinimize) {
                setIsFullscreen(true);
            } else {
                // Asegurar que no esté por encima del nav al restaurar
                setDialogPosition(prev => ({
                    ...prev,
                    y: Math.max(NAV_HEIGHT, prev.y)
                }));
            }
        }
        setIsMinimized(!isMinimized);
    };

    // Abrir en ventana externa
    const openInNewWindow = () => {
        const newWindow = window.open('', '_blank', 'width=1000,height=700,menubar=no,toolbar=no,location=no,status=no');
        
        if (newWindow) {
            setExternalWindow(newWindow);
            renderInExternalWindow(newWindow);
        }
    };

    // Renderizar contenido en ventana externa - SOLO se llama una vez al abrir
    const renderInExternalWindow = (win) => {
        if (!win || win.closed) return;

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es" style="height: 100%;">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Crear Compra - Diálogo</title>
                <script src="https://cdn.tailwindcss.com"><\/script>
                <style>
                    html, body { height: 100%; margin: 0; padding: 0; }
                    body { display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                    .dialog-container { display: flex; flex-direction: column; height: 100%; }
                    .dialog-content { flex: 1; overflow-y: auto; }
                    
                    /* Responsive styles para pantallas >= 1300px */
                    @media (min-width: 1300px) {
                        .date-input-container { width: 250px !important; }
                        .supplier-label { min-width: 200px; }
                        .add-button-container button { min-width: 200px; }
                    }
                    
                    /* Grid adaptativo con mínimo 345px por columna */
                    .items-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(345px, 1fr));
                        gap: 0.75rem;
                    }
                </style>
                <script>
                    // Inventario disponible para detección
                    window.inventoryData = ${JSON.stringify(inventory.map(p => ({
                        name: p.name,
                        unit: mapBackendUnitToFrontend(p.unit),
                        price: p.price || 0
                    })))};
                    
                    // Lista de proveedores disponibles
                    window.suppliersData = ${JSON.stringify(suppliers.map(s => ({
                        id: s.id,
                        name: s.name
                    })))};
                    
                    // Función para manejar cambio de proveedor (actualiza UI localmente)
                    window.handleSupplierChange = function(supplierId, isChecked) {
                        // Actualizar estilo del label localmente para feedback inmediato
                        const checkbox = document.getElementById('supplier-' + supplierId);
                        if (checkbox) {
                            const label = checkbox.closest('label');
                            if (label) {
                                if (isChecked) {
                                    label.className = 'supplier-label flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all bg-blue-100 border border-blue-500';
                                } else {
                                    label.className = 'supplier-label flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all bg-slate-50 border border-slate-200 hover:bg-slate-100';
                                }
                            }
                        }
                        // Enviar al padre
                        window.opener.postMessage({
                            type: 'TOGGLE_SUPPLIER',
                            supplierId: supplierId,
                            isChecked: isChecked
                        }, '*');
                    };
                    
                    // Función para manejar cambio de producto con detección
                    window.handleProductChange = function(itemId, value) {
                        const product = window.inventoryData.find(p => p.name.toLowerCase() === value.toLowerCase());
                        if (product) {
                            window.opener.postMessage({
                                type: 'UPDATE_ITEM', 
                                itemId: itemId, 
                                updates: {
                                    productName: product.name,
                                    unit: product.unit,
                                    unitPrice: product.price,
                                    isExisting: true
                                }
                            }, '*');
                        } else if (value) {
                            window.opener.postMessage({
                                type: 'UPDATE_ITEM', 
                                itemId: itemId, 
                                updates: {
                                    productName: value,
                                    isExisting: false
                                }
                            }, '*');
                        }
                    };
                    
                    // Función para detección instantánea al escribir
                    window.handleProductInput = function(itemId, value, inputElement) {
                        const product = window.inventoryData.find(p => p.name === value);
                        if (product) {
                            window.handleProductChange(itemId, value);
                            inputElement.blur();
                        }
                    };
                    
                    // Función para generar HTML de una tarjeta de item
                    window.generateItemCardHTML = function(item) {
                        const borderClass = item.isExisting ? 'border-green-500' : item.productName ? 'border-amber-500' : 'border-slate-200';
                        const bgClass = item.isExisting ? 'bg-gradient-to-br from-green-50 to-slate-50' : item.productName ? 'bg-gradient-to-br from-amber-50 to-slate-50' : 'bg-slate-50';
                        const inputBorderClass = item.isExisting ? 'border-green-500' : item.productName ? 'border-amber-500' : 'border-slate-200';
                        const statusBadge = item.isExisting 
                            ? '<span class="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">✓ Existente</span>'
                            : item.productName 
                                ? '<span class="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">⚠ Nuevo</span>' 
                                : '';
                        
                        return \`
                            <div id="item-card-\${item.id}" class="relative p-3.5 rounded-xl border transition-all hover:shadow-md \${bgClass} \${borderClass}">
                                <button 
                                    class="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center"
                                    onclick="window.opener.postMessage({type:'REMOVE_ITEM', itemId: \${item.id}}, '*')"
                                >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </button>
                                
                                <div class="mb-2.5">
                                    <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Producto/Insumo</label>
                                    <input 
                                        type="text" 
                                        id="product-input-\${item.id}"
                                        class="w-full px-2.5 py-2 border rounded-md text-sm focus:outline-none focus:border-blue-500 \${inputBorderClass}"
                                        value="\${item.productName}"
                                        placeholder="Buscar o escribir nuevo..."
                                        oninput="window.handleProductInput(\${item.id}, this.value, this);"
                                        onblur="window.handleProductChange(\${item.id}, this.value);"
                                        list="products-\${item.id}"
                                    />
                                    <datalist id="products-\${item.id}">
                                        \${window.inventoryData.map(p => '<option value="' + p.name + '">' + p.name + ' (' + p.unit + ')</option>').join('')}
                                    </datalist>
                                    \${statusBadge}
                                </div>

                                <div class="flex gap-2 mb-2.5">
                                    <div class="flex-1">
                                        <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Cantidad</label>
                                        <input 
                                            type="number" 
                                            id="quantity-input-\${item.id}"
                                            class="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                            value="\${item.quantity}"
                                            min="0.01"
                                            step="0.01"
                                            onchange="window.opener.postMessage({type:'UPDATE_ITEM', itemId: \${item.id}, updates: {quantity: parseFloat(this.value) || 0}}, '*');"
                                        />
                                    </div>
                                    <div class="flex-1">
                                        <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Unidad</label>
                                        <select 
                                            id="unit-select-\${item.id}"
                                            class="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 \${item.isExisting ? 'bg-slate-100 text-slate-500' : ''}"
                                            \${item.isExisting ? 'disabled' : ''}
                                            onchange="window.opener.postMessage({type:'UPDATE_ITEM', itemId: \${item.id}, updates: {unit: this.value}}, '*');"
                                        >
                                            <option value="u" \${item.unit === 'u' ? 'selected' : ''}>Unidades</option>
                                            <option value="kg" \${item.unit === 'kg' ? 'selected' : ''}>Kilos (kg)</option>
                                            <option value="l" \${item.unit === 'l' ? 'selected' : ''}>Litros (l)</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="mb-2.5">
                                    <label class="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Precio Unitario</label>
                                    <input 
                                        type="number" 
                                        id="price-input-\${item.id}"
                                        class="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                        value="\${item.unitPrice}"
                                        min="0"
                                        step="0.01"
                                        onchange="window.opener.postMessage({type:'UPDATE_ITEM', itemId: \${item.id}, updates: {unitPrice: parseFloat(this.value) || 0}}, '*');"
                                    />
                                </div>

                                <div class="flex justify-between items-center pt-2.5 border-t border-slate-200 mt-2.5">
                                    <span class="text-xs text-slate-500">Total:</span>
                                    <span id="total-\${item.id}" class="text-base font-bold text-slate-800">$\${(item.total || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        \`;
                    };
                    
                    // Función para renderizar grid de items
                    window.renderItemsGrid = function(items) {
                        const container = document.getElementById('items-grid-container');
                        if (!container) return;
                        
                        if (items.length === 0) {
                            container.innerHTML = \`
                                <div class="text-center py-10 text-slate-400">
                                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                    </svg>
                                    <p>Haz clic en "Agregar Producto/Insumo" para comenzar</p>
                                </div>
                            \`;
                        } else {
                            container.innerHTML = \`
                                <div class="items-grid">
                                    \${items.map(item => window.generateItemCardHTML(item)).join('')}
                                </div>
                            \`;
                        }
                    };
                    
                    // Función para actualizar total
                    window.updateTotal = function(total) {
                        const el = document.getElementById('purchase-total');
                        if (el) el.textContent = 'Total de la Compra: $' + total.toFixed(2);
                    };
                    
                    // Función para actualizar proveedores
                    window.updateSuppliers = function(selectedIds) {
                        document.querySelectorAll('.supplier-label').forEach(label => {
                            const checkbox = label.querySelector('input[type="checkbox"]');
                            if (checkbox) {
                                const supplierId = parseInt(checkbox.id.replace('supplier-', ''));
                                const isSelected = selectedIds.includes(supplierId);
                                checkbox.checked = isSelected;
                                if (isSelected) {
                                    label.className = 'supplier-label flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all bg-blue-100 border border-blue-500';
                                } else {
                                    label.className = 'supplier-label flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all bg-slate-50 border border-slate-200 hover:bg-slate-100';
                                }
                            }
                        });
                    };
                <\/script>
            </head>
            <body>
                <div id="purchase-form-container" class="dialog-container bg-slate-50 min-h-screen">
                    <!-- Header -->
                    <div class="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                                </svg>
                            </div>
                            <span class="text-base font-bold text-slate-800">
                                ${userRole === 'Encargado' ? 'Solicitar Nueva Compra' : 'Registrar Nueva Compra'}
                            </span>
                        </div>
                        <button 
                            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-sm transition-colors"
                            onclick="window.opener.postMessage({type:'CLOSE_DIALOG'}, '*'); window.close();"
                        >
                            Cerrar
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="dialog-content p-5">
                        <div id="message-container"></div>
                        
                        <!-- Fecha, Proveedores y Botón Agregar en una fila -->
                        <div class="flex gap-4 mb-5 flex-wrap items-end">
                            <div class="date-input-container w-40">
                                <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Fecha *</label>
                                <input 
                                    type="date" 
                                    id="date-input"
                                    class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                                    value="${purchaseData.date}"
                                    onchange="window.opener.postMessage({type:'UPDATE_DATE', value: this.value}, '*')"
                                />
                            </div>
                            <div class="flex-1 min-w-[200px]">
                                <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Proveedores *</label>
                                <div id="suppliers-container" class="flex flex-wrap gap-2">
                                    ${suppliers.map(s => `
                                        <label class="supplier-label flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${purchaseData.selectedSuppliers.some(sel => sel.value === s.id) ? 'bg-blue-100 border border-blue-500' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'}">
                                            <input 
                                                type="checkbox" 
                                                id="supplier-${s.id}"
                                                class="w-4 h-4 accent-blue-500"
                                                ${purchaseData.selectedSuppliers.some(sel => sel.value === s.id) ? 'checked' : ''}
                                                onchange="window.handleSupplierChange(${s.id}, this.checked)"
                                            />
                                            <span class="text-sm text-slate-700">${s.name}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                            <!-- Botón Agregar en la misma fila -->
                            <div class="add-button-container flex gap-2 items-center">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="100" 
                                    value="1"
                                    id="items-count-input"
                                    class="w-16 px-2 py-2.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500"
                                    onkeydown="if(event.key === 'Enter') { event.preventDefault(); const count = parseInt(this.value) || 1; window.opener.postMessage({type:'ADD_ITEMS', count: Math.max(1, Math.min(100, count))}, '*'); }"
                                />
                                <button 
                                    class="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
                                    onclick="const input = document.getElementById('items-count-input'); const count = parseInt(input.value) || 1; window.opener.postMessage({type:'ADD_ITEMS', count: Math.max(1, Math.min(100, count))}, '*');"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                    </svg>
                                    Agregar
                                </button>
                            </div>
                        </div>

                        <!-- Grid de Items -->
                        <div id="items-grid-container"></div>
                    </div>

                    <!-- Footer -->
                    <div class="flex justify-between items-center px-5 py-4 bg-slate-50 border-t border-slate-200 mt-auto">
                        <div id="purchase-total" class="text-lg font-bold text-slate-800">
                            Total de la Compra: $0.00
                        </div>
                        <div class="flex gap-2">
                            <button 
                                class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-sm transition-colors"
                                onclick="window.opener.postMessage({type:'CLOSE_DIALOG'}, '*'); window.close();"
                            >
                                Cancelar
                            </button>
                            <button 
                                class="px-5 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold text-sm transition-all"
                                onclick="window.opener.postMessage({type:'SUBMIT_PURCHASE'}, '*');"
                            >
                                ${userRole === 'Encargado' ? 'Enviar Solicitud' : 'Registrar Compra'}
                            </button>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        
        // Después de escribir el HTML, actualizar con los datos actuales
        setTimeout(() => updateExternalWindowData(win), 50);
    };
    
    // Actualizar datos en ventana externa SIN reescribir todo el documento (evita parpadeo)
    const updateExternalWindowData = (win) => {
        if (!win || win.closed) return;
        
        try {
            // Actualizar fecha solo si el valor cambió y el input no tiene foco
            const dateInput = win.document.getElementById('date-input');
            if (dateInput && dateInput !== win.document.activeElement && dateInput.value !== purchaseData.date) {
                dateInput.value = purchaseData.date;
            }
            
            // Actualizar proveedores seleccionados
            const selectedIds = purchaseData.selectedSuppliers.map(s => s.value);
            if (win.updateSuppliers) {
                win.updateSuppliers(selectedIds);
            }
            
            // Actualizar grid de items
            if (win.renderItemsGrid) {
                win.renderItemsGrid(purchaseData.items);
            }
            
            // Actualizar total
            const total = purchaseData.items.reduce((sum, item) => sum + (item.total || 0), 0);
            if (win.updateTotal) {
                win.updateTotal(total);
            }
            
            // Actualizar mensaje si existe
            const msgContainer = win.document.getElementById('message-container');
            if (msgContainer) {
                msgContainer.innerHTML = message 
                    ? `<div class="px-4 py-3 rounded-lg mb-4 bg-red-100 text-red-600 border border-red-200 text-sm">${message}</div>` 
                    : '';
            }
        } catch (e) {
            console.error('Error updating external window:', e);
        }
    };

    // Opciones para react-select
    const productOptions = inventory.map(p => ({ 
        value: p.name, 
        label: `${p.name} (${mapBackendUnitToFrontend(p.unit)})`,
        unit: mapBackendUnitToFrontend(p.unit),
        price: p.price
    }));

    // Estilos para react-select
    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '36px',
            fontSize: '13px',
            borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none',
            '&:hover': { borderColor: '#cbd5e0' }
        }),
        menu: (base) => ({
            ...base,
            zIndex: 50,
            fontSize: '13px'
        }),
        option: (base) => ({
            ...base,
            padding: '8px 10px'
        })
    };

    // No renderizar si no está abierto o si la pantalla es pequeña
    if (!isOpen || screenWidth < 1100) return null;

    // Si hay ventana externa abierta, no mostrar el diálogo inline
    if (externalWindow && !externalWindow.closed) return null;

    // Clases para el contenedor principal del diálogo
    const getDialogClasses = () => {
        if (isFullscreen) {
            return 'fixed inset-0 z-[1000] bg-white flex flex-col overflow-hidden';
        }
        if (isMinimized) {
            // Minimizado pero posicionable - ancho aumentado para texto completo
            return 'fixed w-[380px] h-12 z-[1000] bg-white rounded-xl shadow-xl overflow-hidden cursor-move';
        }
        return 'absolute z-[1000] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden';
    };

    return (
        <div 
            ref={dialogRef}
            className={getDialogClasses()}
            style={!isFullscreen ? {
                top: dialogPosition.y,
                left: dialogPosition.x,
                width: isMinimized ? 380 : dialogSize.width,
                height: isMinimized ? 48 : dialogSize.height
            } : undefined}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="dialog-header-draggable flex justify-between items-center px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 cursor-move select-none">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-800">
                        {userRole === 'Encargado' ? 'Solicitar Nueva Compra' : 'Registrar Nueva Compra'}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={openInNewWindow}
                        className="w-7 h-7 border-none rounded-md bg-slate-100 hover:bg-slate-200 cursor-pointer flex items-center justify-center transition-colors"
                        title="Abrir en nueva ventana"
                    >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </button>
                    <button
                        onClick={handleMinimize}
                        className="w-7 h-7 border-none rounded-md bg-slate-100 hover:bg-slate-200 cursor-pointer flex items-center justify-center transition-colors"
                        title={isMinimized ? 'Restaurar' : 'Minimizar'}
                    >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isMinimized ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/>
                            )}
                        </svg>
                    </button>
                    <button
                        onClick={() => {
                            if (isMinimized) {
                                setIsMinimized(false);
                            }
                            setIsFullscreen(!isFullscreen);
                        }}
                        className="w-7 h-7 border-none rounded-md bg-slate-100 hover:bg-slate-200 cursor-pointer flex items-center justify-center transition-colors"
                        title={isFullscreen ? 'Restaurar' : 'Pantalla completa'}
                    >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isFullscreen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/>
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                            )}
                        </svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 border-none rounded-md bg-red-100 hover:bg-red-200 cursor-pointer flex items-center justify-center transition-colors"
                        title="Cerrar"
                    >
                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content - hidden when minimized */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-auto p-4">
                        {/* Mensaje */}
                        {message && (
                            <div className="px-4 py-2.5 rounded-lg mb-4 bg-red-100 text-red-600 border border-red-200 text-sm">
                                {message}
                            </div>
                        )}

                        {/* Fila superior: Fecha, Proveedores y Botón Agregar */}
                        <div className="flex gap-4 mb-5 flex-wrap items-end">
                            <div className="w-40 2xl:w-[250px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                    Fecha *
                                </label>
                                <input
                                    type="date"
                                    value={purchaseData.date}
                                    onChange={(e) => setPurchaseData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                    Proveedores *
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {suppliers.map(supplier => (
                                        <label
                                            key={supplier.id}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all 2xl:min-w-[200px] ${
                                                purchaseData.selectedSuppliers.some(s => s.value === supplier.id)
                                                    ? 'bg-blue-100 border border-blue-500'
                                                    : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={purchaseData.selectedSuppliers.some(s => s.value === supplier.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setPurchaseData(prev => ({
                                                            ...prev,
                                                            selectedSuppliers: [...prev.selectedSuppliers, { value: supplier.id, label: supplier.name }]
                                                        }));
                                                    } else {
                                                        setPurchaseData(prev => ({
                                                            ...prev,
                                                            selectedSuppliers: prev.selectedSuppliers.filter(s => s.value !== supplier.id)
                                                        }));
                                                    }
                                                }}
                                                className="w-4 h-4 accent-blue-500"
                                            />
                                            <span className="text-sm text-slate-700">{supplier.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {/* Botón Agregar en la misma fila */}
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={itemsToAdd}
                                    onChange={(e) => setItemsToAdd(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addItems(itemsToAdd);
                                        }
                                    }}
                                    className="w-16 px-2 py-2.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => addItems(itemsToAdd)}
                                    className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap 2xl:min-w-[200px] 2xl:justify-center"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                                    </svg>
                                    Agregar
                                </button>
                            </div>
                        </div>

                        {/* Grid de tarjetas de productos */}
                        {purchaseData.items.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                </svg>
                                <p>Haz clic en "Agregar Producto/Insumo" para comenzar</p>
                            </div>
                        ) : (
                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(345px, 1fr))' }}>
                                {purchaseData.items.map((item) => (
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

                                        {/* Producto/Insumo con búsqueda */}
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
                                                    ...selectStyles,
                                                    control: (base, state) => ({
                                                        ...base,
                                                        minHeight: '36px',
                                                        fontSize: '13px',
                                                        borderColor: state.isFocused ? '#3b82f6' : item.isExisting ? '#22c55e' : item.productName ? '#f59e0b' : '#e2e8f0',
                                                        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none'
                                                    })
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
                                                    className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

                                        {/* Precio unitario */}
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
                                                className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center px-5 py-4 bg-slate-50 border-t border-slate-200">
                        <div className="text-lg font-bold text-slate-800">
                            Total de la Compra: ${calculatePurchaseTotal().toFixed(2)}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 border-none rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer text-sm font-semibold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="px-5 py-2.5 border-none rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white cursor-pointer text-sm font-semibold transition-all"
                            >
                                {userRole === 'Encargado' ? 'Enviar Solicitud' : 'Registrar Compra'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DialogoCompras;
