import React, { useState, useEffect, useRef } from 'react';
import CreatableSelect from 'react-select/creatable';
import { formatMoney } from '../utils/format';
import { productLabel, productsForSuppliers, suppliersForProduct } from '../utils/supplierCatalog';
import SearchableSelect, { portalSelectProps, portalMenuStyle } from './SearchableSelect';

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
    const [dialogPosition, setDialogPosition] = useState({ x: 50, y: 64 });
    const [dialogSize] = useState({ width: 900, height: 600 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [itemsToAdd, setItemsToAdd] = useState(1);
    const [wasFullscreenBeforeMinimize, setWasFullscreenBeforeMinimize] = useState(false);
    const dialogRef = useRef(null);
    const externalWindowRef = useRef(null);
    // La ventana externa avisa por postMessage; el listener se registra una vez y lee siempre el estado actual
    const latestHandlers = useRef({});
    
    const NAV_HEIGHT = -160;
    const NAV_HEIGHT_MINIMIZED = 64;

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        externalWindowRef.current = externalWindow;
    }, [externalWindow]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            e.preventDefault();
            const newX = e.clientX - dragOffset.x;
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

    useEffect(() => {
        return () => {
            if (externalWindowRef.current && !externalWindowRef.current.closed) {
                externalWindowRef.current.close();
            }
        };
    }, []);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.source !== externalWindowRef.current) return;
            if (event.data && event.data.type) {
                switch (event.data.type) {
                    case 'UPDATE_DATE':
                        setPurchaseData(prev => ({ ...prev, date: event.data.value }));
                        break;
                    case 'UPDATE_SUPPLIERS':
                        setPurchaseData(prev => ({ ...prev, selectedSuppliers: event.data.value }));
                        break;
                    case 'TOGGLE_SUPPLIER':
                        setPurchaseData(prev => {
                            const supplierId = event.data.supplierId;
                            const isChecked = event.data.isChecked;
                            const supplier = suppliers.find(s => s.id === supplierId);
                            
                            if (!supplier) return prev;
                            
                            let updatedSuppliers;
                            if (isChecked) {
                                if (!prev.selectedSuppliers.some(s => s.value === supplierId)) {
                                    updatedSuppliers = [...prev.selectedSuppliers, { value: supplierId, label: supplier.name }];
                                } else {
                                    updatedSuppliers = prev.selectedSuppliers;
                                }
                            } else {
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
                                productId: '',
                                productName: '',
                                supplierId: '',
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
                        // Reutilizamos nuestra función interna para aplicar validaciones
                        latestHandlers.current.updateItem(event.data.itemId, event.data.field, event.data.value);
                        break;
                    case 'SUBMIT_PURCHASE':
                        latestHandlers.current.handleSubmit();
                        break;
                    case 'CLOSE_DIALOG':
                        latestHandlers.current.onClose();
                        break;
                    default:
                        break;
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [suppliers]);

    useEffect(() => {
        if (externalWindow && !externalWindow.closed) {
            if (externalWindow.document.getElementById('purchase-form-container')) {
                updateExternalWindowData(externalWindow);
            } else {
                renderInExternalWindow(externalWindow);
            }
        }
    }, [externalWindow, purchaseData, inventory, suppliers, message]);

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

    const mapBackendUnitToFrontend = (backendUnit) => {
        switch (backendUnit) {
            case 'g': return 'kg';
            case 'ml': return 'l';
            case 'unidades': return 'u';
            default: return 'u';
        }
    };

    const getProductFromInventory = (productName) => {
        return inventory.find(p => p.name.toLowerCase() === productName.toLowerCase());
    };

    const addItems = (count = 1) => {
        const validCount = Math.max(1, Math.min(100, parseInt(count) || 1));
        const newItems = Array(validCount).fill(null).map(() => ({
            id: Date.now() + Math.random(),
            productId: '',
            productName: '',
            supplierId: '',
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

    const removeItem = (itemId) => {
        setPurchaseData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
        }));
    };

    // Actualizar item con lógica de validación de enteros para unidades
    const updateItem = (itemId, field, value) => {
        setPurchaseData(prev => {
            const updatedItems = prev.items.map(item => {
                if (item.id !== itemId) return item;

                let updates = { [field]: value };

                if (field === 'productId' || field === 'productName') {
                    const product = field === 'productId'
                        ? inventory.find(p => Number(p.id) === Number(value))
                        : getProductFromInventory(String(value || ''));
                    if (product) {
                        const linked = suppliersForProduct(suppliers, product.id);
                        const selectedIds = prev.selectedSuppliers.map(selected => Number(selected.value));
                        const sellers = selectedIds.length
                            ? linked.filter(supplier => selectedIds.includes(Number(supplier.id)))
                            : linked;
                        const newUnit = mapBackendUnitToFrontend(product.unit);
                        updates.productId = product.id;
                        updates.productName = product.name;
                        updates.unit = newUnit;
                        updates.unitPrice = product.price || 0;
                        updates.isExisting = true;
                        updates.supplierId = sellers.length === 1
                            ? sellers[0].id
                            : (sellers.some(supplier => Number(supplier.id) === Number(item.supplierId)) ? item.supplierId : '');
                        if (newUnit === 'u') updates.quantity = Math.floor(item.quantity);
                    } else if (String(value || '').trim()) {
                        updates.productId = '';
                        updates.productName = String(value).trim();
                        updates.isExisting = false;
                    } else {
                        updates.productId = '';
                        updates.productName = '';
                        updates.supplierId = '';
                        updates.isExisting = false;
                        updates.unit = 'u';
                        updates.unitPrice = 0;
                    }
                }

                // Si cambian a unidad manual 'u', redondear cantidad actual
                if (field === 'unit' && value === 'u') {
                    updates.quantity = Math.floor(item.quantity);
                }

                // Lógica principal de restricción decimal
                if (field === 'quantity') {
                    let parsedQty = parseFloat(value) || 0;
                    // Si la unidad actual del item es 'u', forzamos a entero
                    if (item.unit === 'u' || updates.unit === 'u') {
                        parsedQty = Math.floor(parsedQty);
                    }
                    updates.quantity = parsedQty;
                }

                const newItem = { ...item, ...updates };
                
                // Recalcular total
                const qty = parseFloat(newItem.quantity) || 0;
                const price = parseFloat(newItem.unitPrice) || 0;
                newItem.total = qty * price;

                return newItem;
            });

            const supplierIds = updatedItems
                .map(item => item.supplierId)
                .filter(Boolean)
                .map(Number);
            const selectedSuppliers = [...prev.selectedSuppliers];
            supplierIds.forEach(supplierId => {
                if (!selectedSuppliers.some(selected => Number(selected.value) === supplierId)) {
                    const supplier = suppliers.find(item => Number(item.id) === supplierId);
                    if (supplier) selectedSuppliers.push({ value: supplier.id, label: supplier.name });
                }
            });
            return { ...prev, selectedSuppliers, items: updatedItems };
        });
    };

    const calculatePurchaseTotal = () => {
        return purchaseData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    const handleSubmit = () => {
        if (!purchaseData.date) {
            setMessage('Por favor, ingrese una fecha.');
            return;
        }
        if (purchaseData.items.length === 0) {
            setMessage('Agregá al menos un producto o insumo a la orden.');
            return;
        }

        const hasInvalidItems = purchaseData.items.some(item =>
            !String(item.productName || '').trim() || !item.supplierId || item.quantity <= 0
        );

        if (hasInvalidItems) {
            setMessage('Elegí el producto o escribí uno nuevo, el proveedor y una cantidad mayor a cero.');
            return;
        }

        onSubmit({
            date: purchaseData.date,
            items: purchaseData.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                supplierId: item.supplierId,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unitPrice: parseFloat(item.unitPrice),
                total: item.total,
                isExisting: item.isExisting
            })),
        });

        setPurchaseData({
            date: '',
            selectedSuppliers: [],
            items: []
        });
        setMessage('');
    };

    const MINIMIZED_TOP_POSITION = 70;

    const handleMinimize = () => {
        if (!isMinimized) {
            setWasFullscreenBeforeMinimize(isFullscreen);
            setIsFullscreen(false);
            
            if (isFullscreen) {
                const centerX = Math.max(50, (window.innerWidth - 380) / 2);
                const centerY = Math.max(MINIMIZED_TOP_POSITION, (window.innerHeight - 48) / 2);
                setDialogPosition({ x: centerX, y: centerY });
            } else {
                setDialogPosition(prev => ({
                    ...prev,
                    y: MINIMIZED_TOP_POSITION
                }));
            }
        } else {
            if (wasFullscreenBeforeMinimize) {
                setIsFullscreen(true);
            } else {
                setDialogPosition(prev => ({
                    ...prev,
                    y: Math.max(NAV_HEIGHT, prev.y)
                }));
            }
        }
        setIsMinimized(!isMinimized);
    };

    const openInNewWindow = () => {
        const newWindow = window.open('', '_blank', 'width=1000,height=700,menubar=no,toolbar=no,location=no,status=no');
        
        if (newWindow) {
            setExternalWindow(newWindow);
            renderInExternalWindow(newWindow);
        }
    };

    const externalCatalog = () => ({
        inventory: (inventory || []).map(product => ({
            id: product.id,
            name: product.name,
            unit: mapBackendUnitToFrontend(product.unit),
            price: product.price || 0,
            sellerIds: suppliersForProduct(suppliers, product.id).map(supplier => Number(supplier.id)),
        })),
        suppliers: suppliers.map(supplier => ({ id: Number(supplier.id), name: supplier.name })),
    });

    const renderInExternalWindow = (win) => {
        if (!win || win.closed) return;

        const catalog = externalCatalog();
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es" style="height: 100%;">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Crear Compra - Diálogo</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    html, body { height: 100%; margin: 0; padding: 0; }
                    body { display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                    .dialog-container { display: flex; flex-direction: column; height: 100%; }
                    .dialog-content { flex: 1; overflow-y: auto; }
                    
                    @media (min-width: 1300px) {
                        .date-input-container { width: 250px !important; }
                        .add-button-container button { min-width: 200px; }
                    }
                    
                    table { border-collapse: separate; border-spacing: 0; width: 100%; }
                    th { position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 1px solid #e2e8f0; }
                </style>
                <script>
                    window.inventoryData = ${JSON.stringify(catalog.inventory)};
                    window.suppliersData = ${JSON.stringify(catalog.suppliers)};
                    window.selectedSupplierIds = ${JSON.stringify(purchaseData.selectedSuppliers.map(s => Number(s.value)))};

                    window.escapeHtml = function(text) {
                        return String(text == null ? '' : text).replace(/[&<>"']/g, function(c) {
                            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
                        });
                    };

                    // Sin proveedor elegido se busca en todo el inventario. Con proveedor, solo en lo que vende.
                    window.availableProducts = function() {
                        if (!window.selectedSupplierIds.length) return window.inventoryData;
                        return window.inventoryData.filter(function(p) {
                            return p.sellerIds.some(function(id) { return window.selectedSupplierIds.includes(id); });
                        });
                    };
                    
                    window.addSupplierByName = function(name) {
                        const supplier = window.suppliersData.find(function(item) { return item.name === name; });
                        if (!supplier || window.selectedSupplierIds.includes(supplier.id)) return;
                        const ids = window.selectedSupplierIds.concat([supplier.id]);
                        const selected = ids.map(function(id) {
                            const found = window.suppliersData.find(function(item) { return item.id === id; });
                            return { value: id, label: found ? found.name : String(id) };
                        });
                        window.opener.postMessage({ type: 'UPDATE_SUPPLIERS', value: selected }, '*');
                    };

                    window.removeSupplier = function(id) {
                        const ids = window.selectedSupplierIds.filter(function(current) { return current !== id; });
                        const selected = ids.map(function(currentId) {
                            const found = window.suppliersData.find(function(item) { return item.id === currentId; });
                            return { value: currentId, label: found ? found.name : String(currentId) };
                        });
                        window.opener.postMessage({ type: 'UPDATE_SUPPLIERS', value: selected }, '*');
                    };
                    
                    window.handleProductChange = function(itemId, value) {
                        window.opener.postMessage({
                            type: 'UPDATE_ITEM', 
                            itemId: itemId, 
                            field: 'productName',
                            value: value
                        }, '*');
                    };
                    
                    window.handleProductInput = function(itemId, value, inputElement) {
                        const product = window.availableProducts().find(p => p.name === value);
                        if (product) {
                            window.handleProductChange(itemId, value);
                            inputElement.blur();
                        }
                    };
                    
                    function formatMoney(amount) {
                        const num = Number(amount) || 0;
                        return '$' + new Intl.NumberFormat('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }).format(num);
                    }
                    
                    // Función para generar HTML de una fila de tabla (TR)
                    window.generateItemRowHTML = function(item) {
                        const isUnit = item.unit === 'u';
                        const step = isUnit ? '1' : '0.01';
                        
                        const statusBadge = item.isExisting 
                            ? '<span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">✓ Existente</span>'
                            : item.productName 
                                ? '<span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">⚠ Nuevo</span>' 
                                : '';

                        const product = window.inventoryData.find(p => p.id === Number(item.productId));
                        const sellers = product ? window.suppliersData.filter(s => product.sellerIds.includes(s.id)) : [];
                        const supplierChoices = (!item.isExisting && item.productName) ? window.suppliersData : sellers;
                        let supplierInfo = '';
                        if (item.isExisting && sellers.length === 1) {
                            supplierInfo = '<span class="block mt-1 text-[11px] text-slate-500">Proveedor: ' + window.escapeHtml(sellers[0].name) + '</span>';
                        } else if (supplierChoices.length > 0 && (supplierChoices.length > 1 || !item.isExisting)) {
                            const listId = 'supplier-search-' + item.id;
                            supplierInfo = '<input class="w-full mt-1 px-2 py-1 border border-slate-200 rounded-md text-xs" list="' + listId + '" placeholder="Buscar proveedor..."'
                                + ' value="' + window.escapeHtml((supplierChoices.find(s => s.id === Number(item.supplierId)) || {}).name || '') + '"'
                                + ' onchange="var name = this.value; var found = window.suppliersData.find(function(s) { return s.name === name; });'
                                + ' window.opener.postMessage({type:\\'UPDATE_ITEM\\', itemId: ' + item.id + ', field: \\'supplierId\\', value: found ? found.id : \\'\\'}, \\'*\\');" />'
                                + '<datalist id="' + listId + '">'
                                + supplierChoices.map(s => '<option value="' + window.escapeHtml(s.name) + '"></option>').join('')
                                + '</datalist>';
                        }
                        const productOptionsHtml = window.availableProducts()
                            .map(p => '<option value="' + window.escapeHtml(p.name) + '">' + window.escapeHtml(p.name) + ' (' + p.unit + ')</option>')
                            .join('');
                        
                        return \`
                            <tr id="item-row-\${item.id}" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td class="py-3 px-4">
                                    <input 
                                        type="text" 
                                        class="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                        value="\${item.productName}"
                                        placeholder="\${window.selectedSupplierIds.length ? 'Buscar en lo que vende el proveedor...' : 'Buscar producto o insumo...'}"
                                        oninput="window.handleProductInput(\${item.id}, this.value, this);"
                                        onblur="window.handleProductChange(\${item.id}, this.value);"
                                        list="products-\${item.id}"
                                    />
                                    <datalist id="products-\${item.id}">
                                        \${productOptionsHtml}
                                    </datalist>
                                    <div>\${statusBadge}</div>
                                    \${supplierInfo}
                                </td>
                                <td class="py-3 px-4 w-32">
                                    <input 
                                        type="number" 
                                        class="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 text-right"
                                        value="\${item.quantity}"
                                        min="\${isUnit ? '1' : '0.01'}"
                                        step="\${step}"
                                        onchange="window.opener.postMessage({type:'UPDATE_ITEM', itemId: \${item.id}, field: 'quantity', value: this.value}, '*');"
                                    />
                                </td>
                                <td class="py-3 px-4 w-32">
                                    <select 
                                        class="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 \${item.isExisting ? 'bg-slate-100 text-slate-500' : ''}"
                                        \${item.isExisting ? 'disabled' : ''}
                                        onchange="window.opener.postMessage({type:'UPDATE_ITEM', itemId: \${item.id}, field: 'unit', value: this.value}, '*');"
                                    >
                                        <option value="u" \${item.unit === 'u' ? 'selected' : ''}>Unidades</option>
                                        <option value="kg" \${item.unit === 'kg' ? 'selected' : ''}>Kilos (kg)</option>
                                        <option value="l" \${item.unit === 'l' ? 'selected' : ''}>Litros (l)</option>
                                    </select>
                                </td>
                                <td class="py-3 px-4 w-32">
                                    <input 
                                        type="number" 
                                        class="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 text-right"
                                        value="\${item.unitPrice}"
                                        min="0"
                                        step="0.01"
                                        onchange="window.opener.postMessage({type:'UPDATE_ITEM', itemId: \${item.id}, field: 'unitPrice', value: this.value}, '*');"
                                    />
                                </td>
                                <td class="py-3 px-4 w-32 font-bold text-slate-800 text-right">
                                    \${formatMoney(item.total || 0)}
                                </td>
                                <td class="py-3 px-4 w-12 text-center">
                                    <button 
                                        class="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors mx-auto"
                                        onclick="window.opener.postMessage({type:'REMOVE_ITEM', itemId: \${item.id}}, '*')"
                                        title="Eliminar insumo"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        \`;
                    };
                    
                    window.renderItemsGrid = function(items) {
                        const container = document.getElementById('items-grid-container');
                        if (!container) return;
                        
                        if (items.length === 0) {
                            container.innerHTML = \`
                                <div class="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                    </svg>
                                    <p>Haz clic en "Agregar" para comenzar a listar insumos</p>
                                </div>
                            \`;
                        } else {
                            container.innerHTML = \`
                                <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <table class="w-full text-left">
                                        <thead class="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                            <tr>
                                                <th class="py-3 px-4">Producto/Insumo</th>
                                                <th class="py-3 px-4 text-center">Cantidad</th>
                                                <th class="py-3 px-4 text-center">Unidad</th>
                                                <th class="py-3 px-4 text-right">Precio U.</th>
                                                <th class="py-3 px-4 text-right">Total</th>
                                                <th class="py-3 px-4 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            \${items.map(item => window.generateItemRowHTML(item)).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            \`;
                        }
                    };
                    
                    window.updateTotal = function(total) {
                        const el = document.getElementById('purchase-total');
                        if (el) el.textContent = 'Total Compra: ' + formatMoney(total);
                    };
                    
                    window.updateSuppliers = function(selectedIds) {
                        window.selectedSupplierIds = selectedIds;
                        const box = document.getElementById('selected-suppliers');
                        if (!box) return;
                        box.innerHTML = selectedIds.map(function(id) {
                            const supplier = window.suppliersData.find(function(item) { return item.id === id; });
                            const name = supplier ? window.escapeHtml(supplier.name) : id;
                            return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs">'
                                + name
                                + '<button type="button" class="text-blue-800 font-bold leading-none" onclick="window.removeSupplier(' + id + ')">×</button></span>';
                        }).join('');
                    };
                </script>
            </head>
            <body>
                <div id="purchase-form-container" class="dialog-container bg-slate-50 min-h-screen">
                    <div class="flex justify-between items-center px-5 py-4 bg-white border-b border-slate-200">
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
                    </div>

                    <div class="dialog-content p-5">
                        <div id="message-container"></div>
                        
                        <div class="flex gap-4 mb-5 flex-wrap items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div class="date-input-container w-40">
                                <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Fecha *</label>
                                <input 
                                    type="date" 
                                    id="date-input"
                                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" 
                                    value="${purchaseData.date}"
                                    onchange="window.opener.postMessage({type:'UPDATE_DATE', value: this.value}, '*')"
                                />
                            </div>
                            <div class="flex-1 min-w-[240px]">
                                <label class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Proveedores</label>
                                <input
                                    id="supplier-search"
                                    list="supplier-search-list"
                                    placeholder="Buscar proveedor..."
                                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                    onchange="window.addSupplierByName(this.value); this.value='';"
                                />
                                <datalist id="supplier-search-list">
                                    ${suppliers.map(supplier => `<option value="${String(supplier.name).replace(/"/g, '&quot;')}"></option>`).join('')}
                                </datalist>
                                <div id="selected-suppliers" class="flex flex-wrap gap-2 mt-2"></div>
                            </div>
                            <div class="add-button-container flex gap-2 items-center">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="100" 
                                    value="1"
                                    id="items-count-input"
                                    class="w-16 px-2 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500"
                                    onkeydown="if(event.key === 'Enter') { event.preventDefault(); const count = parseInt(this.value) || 1; window.opener.postMessage({type:'ADD_ITEMS', count: Math.max(1, Math.min(100, count))}, '*'); }"
                                />
                                <button 
                                    class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
                                    onclick="const input = document.getElementById('items-count-input'); const count = parseInt(input.value) || 1; window.opener.postMessage({type:'ADD_ITEMS', count: Math.max(1, Math.min(100, count))}, '*');"
                                >
                                    + Agregar Filas
                                </button>
                            </div>
                        </div>

                        <div id="items-grid-container"></div>
                    </div>

                    <div class="flex justify-between items-center px-5 py-4 bg-white border-t border-slate-200 mt-auto">
                        <div id="purchase-total" class="text-xl font-black text-blue-700">
                            Total Compra: $0.00
                        </div>
                        <div class="flex gap-3">
                            <button 
                                class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-sm transition-colors"
                                onclick="window.opener.postMessage({type:'CLOSE_DIALOG'}, '*'); window.close();"
                            >
                                Cancelar
                            </button>
                            <button 
                                class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-all"
                                onclick="window.opener.postMessage({type:'SUBMIT_PURCHASE'}, '*');"
                            >
                                ${userRole === 'Encargado' ? '✓ Enviar Solicitud' : '✓ Registrar Compra'}
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
        
        setTimeout(() => updateExternalWindowData(win), 50);
    };
    
    const updateExternalWindowData = (win) => {
        if (!win || win.closed) return;
        
        try {
            const dateInput = win.document.getElementById('date-input');
            if (dateInput && dateInput !== win.document.activeElement && dateInput.value !== purchaseData.date) {
                dateInput.value = purchaseData.date;
            }
            
            const catalog = externalCatalog();
            win.inventoryData = catalog.inventory;
            win.suppliersData = catalog.suppliers;

            const selectedIds = purchaseData.selectedSuppliers.map(s => Number(s.value));
            if (win.updateSuppliers) {
                win.updateSuppliers(selectedIds);
            }
            
            if (win.renderItemsGrid) {
                win.renderItemsGrid(purchaseData.items);
            }
            
            const total = purchaseData.items.reduce((sum, item) => sum + (item.total || 0), 0);
            if (win.updateTotal) {
                win.updateTotal(total);
            }
            
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

    const selectedSupplierIds = purchaseData.selectedSuppliers.map(supplier => Number(supplier.value));
    const catalog = selectedSupplierIds.length
        ? productsForSuppliers(inventory, suppliers, selectedSupplierIds)
        : (inventory || []);
    const productOptions = catalog.map(product => ({
        value: product.id,
        label: productLabel(product),
    }));
    const supplierOptions = (suppliers || []).map(supplier => ({ value: supplier.id, label: supplier.name }));

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '34px',
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
        menuPortal: portalMenuStyle,
        option: (base) => ({
            ...base,
            padding: '8px 10px'
        })
    };

    latestHandlers.current = { updateItem, handleSubmit, onClose };

    if (!isOpen || screenWidth < 1100) return null;

    if (externalWindow && !externalWindow.closed) return null;

    const getDialogClasses = () => {
        if (isFullscreen) {
            return 'fixed inset-0 z-[1000] bg-slate-50 flex flex-col overflow-hidden';
        }
        if (isMinimized) {
            return 'fixed w-[380px] h-12 z-[1000] bg-white rounded-xl shadow-xl overflow-hidden cursor-move';
        }
        return 'absolute z-[1000] bg-slate-50 rounded-xl shadow-xl flex flex-col overflow-hidden';
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
            <div className="dialog-header-draggable flex justify-between items-center px-4 py-3 bg-white border-b border-slate-200 cursor-move select-none">
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
                            if (isMinimized) setIsMinimized(false);
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

            {/* Content */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-auto p-4">
                        {message && (
                            <div className="px-4 py-2.5 rounded-lg mb-4 bg-red-100 text-red-600 border border-red-200 text-sm">
                                {message}
                            </div>
                        )}

                        {/* Fila superior: Fecha, Proveedores y Botones */}
                        <div className="flex gap-4 mb-5 flex-wrap items-end bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="w-40">
                                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                    Fecha *
                                </label>
                                <input
                                    type="date"
                                    value={purchaseData.date}
                                    onChange={(e) => setPurchaseData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div className="flex-1 min-w-[240px]">
                                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                                    Proveedores
                                </label>
                                <SearchableSelect
                                    isMulti
                                    options={suppliers.map(supplier => ({ value: supplier.id, label: supplier.name }))}
                                    value={purchaseData.selectedSuppliers.map(supplier => supplier.value)}
                                    onChange={ids => setPurchaseData(prev => ({
                                        ...prev,
                                        selectedSuppliers: ids.map(id => {
                                            const supplier = suppliers.find(item => Number(item.id) === Number(id));
                                            return { value: Number(id), label: supplier ? supplier.name : String(id) };
                                        })
                                    }))}
                                    placeholder="Buscar proveedor..."
                                />
                            </div>
                            
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={itemsToAdd}
                                    onChange={(e) => setItemsToAdd(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') addItems(itemsToAdd);
                                    }}
                                    className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => addItems(itemsToAdd)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
                                >
                                    + Agregar Filas
                                </button>
                            </div>
                        </div>

                        {/* Nueva Tabla de Insumos */}
                        {purchaseData.items.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-200">
                                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                </svg>
                                <p>Haz clic en "Agregar Filas" para comenzar a listar insumos</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[700px]">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                            <tr>
                                                <th className="py-3 px-4 w-[35%]">Producto/Insumo</th>
                                                <th className="py-3 px-4 w-[15%] text-center">Cantidad</th>
                                                <th className="py-3 px-4 w-[15%] text-center">Unidad</th>
                                                <th className="py-3 px-4 w-[15%] text-right">Precio Unit.</th>
                                                <th className="py-3 px-4 w-[15%] text-right">Total</th>
                                                <th className="py-3 px-4 w-[5%] text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {purchaseData.items.map((item) => {
                                                const isUnit = item.unit === 'u';
                                                
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 px-4">
                                                            <CreatableSelect
                                                                {...portalSelectProps}
                                                                options={productOptions}
                                                                value={item.productName ? { value: item.isExisting ? item.productId : item.productName, label: item.productName } : null}
                                                                onChange={(selected) => {
                                                                    if (!selected) updateItem(item.id, 'productName', '');
                                                                    else if (selected.__isNew__) updateItem(item.id, 'productName', selected.value);
                                                                    else updateItem(item.id, 'productId', selected.value);
                                                                }}
                                                                placeholder={purchaseData.selectedSuppliers.length ? 'Buscar en lo que vende el proveedor...' : 'Buscar producto o insumo...'}
                                                                formatCreateLabel={(input) => `Usar "${input}" (no está en el sistema)`}
                                                                isClearable
                                                                styles={selectStyles}
                                                                noOptionsMessage={() => purchaseData.selectedSuppliers.length ? 'Ese proveedor no tiene ese ítem. Podés escribir uno nuevo.' : 'Escribí el nombre si no está en el sistema'}
                                                                className="w-full"
                                                            />
                                                            {(() => {
                                                                if (!item.isExisting && item.productName) {
                                                                    return (
                                                                        <div className="mt-1.5">
                                                                            <SearchableSelect
                                                                                options={supplierOptions}
                                                                                value={item.supplierId}
                                                                                onChange={(supplierId) => updateItem(item.id, 'supplierId', supplierId)}
                                                                                placeholder="Buscar proveedor..."
                                                                            />
                                                                        </div>
                                                                    );
                                                                }
                                                                const sellers = suppliersForProduct(suppliers, item.productId);
                                                                if (!item.productId || sellers.length === 0) return null;
                                                                if (sellers.length === 1) {
                                                                    return <span className="inline-block mt-1 text-[11px] text-slate-500">Proveedor: {sellers[0].name}</span>;
                                                                }
                                                                return (
                                                                    <div className="mt-1.5">
                                                                        <SearchableSelect
                                                                            options={sellers.map(supplier => ({ value: supplier.id, label: supplier.name }))}
                                                                            value={item.supplierId}
                                                                            onChange={(supplierId) => updateItem(item.id, 'supplierId', supplierId)}
                                                                            placeholder="Buscar proveedor..."
                                                                        />
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="py-2.5 px-4">
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                                min={isUnit ? "1" : "0.01"}
                                                                step={isUnit ? "1" : "0.01"}
                                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 text-center"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-4">
                                                            <select
                                                                value={item.unit}
                                                                onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                                                disabled={item.isExisting}
                                                                className={`w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 text-center ${item.isExisting ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
                                                            >
                                                                <option value="u">Unidades</option>
                                                                <option value="kg">Kilos (kg)</option>
                                                                <option value="l">Litros (l)</option>
                                                            </select>
                                                        </td>
                                                        <td className="py-2.5 px-4">
                                                            <input
                                                                type="number"
                                                                value={item.unitPrice}
                                                                onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                                                                min="0"
                                                                step="0.01"
                                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 text-right"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                                                            {formatMoney(item.total || 0)}
                                                        </td>
                                                        <td className="py-2.5 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(item.id)}
                                                                className="w-7 h-7 rounded-full border-none bg-red-50 hover:bg-red-100 text-red-500 cursor-pointer flex items-center justify-center transition-colors mx-auto"
                                                                title="Eliminar fila"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                                </svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center px-6 py-4 bg-white border-t border-slate-200">
                        <div className="text-xl font-black text-blue-700">
                            Total Compra: {formatMoney(calculatePurchaseTotal())}
                        </div>
                        <div className="flex gap-3">
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
                                className="px-5 py-2.5 border-none rounded-lg bg-green-600 hover:bg-green-700 text-white cursor-pointer text-sm font-semibold transition-all shadow-sm"
                            >
                                {userRole === 'Encargado' ? '✓ Enviar Solicitud' : '✓ Registrar Compra'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DialogoCompras;
