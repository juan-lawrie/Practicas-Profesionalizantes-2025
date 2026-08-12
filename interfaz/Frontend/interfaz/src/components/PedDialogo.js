import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { updateOrderStatus, updateOrder } from '../services/api';
import {
    round2,
    calculateItemsTotal,
    PaymentDifferencePanel,
    ConfirmDeliveryModal,
    ExitEnCambioModal,
} from './OrderPedidoModals';

const ORDER_STATUSES = ['Pendiente', 'En Preparación', 'Listo', 'En cambio', 'Entregado', 'Cancelado'];

const getStatusClasses = (status) => {
    switch (status) {
        case 'Pendiente': return 'bg-yellow-100 text-yellow-800';
        case 'En Preparación': return 'bg-blue-100 text-blue-800';
        case 'Listo': return 'bg-green-100 text-green-800';
        case 'En cambio': return 'bg-orange-100 text-orange-800';
        case 'Entregado': return 'bg-gray-100 text-gray-800';
        default: return 'bg-red-100 text-red-800';
    }
};

const normalizeOrder = (created) => ({
    id: created.id,
    fecha_para_la_que_se_quiere_el_pedido: created.fecha_para_la_que_se_quiere_el_pedido,
    fecha_de_orden_del_pedido: created.fecha_de_orden_del_pedido,
    created_at: created.fecha_de_orden_del_pedido || created.created_at,
    date: created.fecha_de_orden_del_pedido || created.created_at,
    customerName: created.customer_name || '',
    paymentMethod: created.payment_method || '',
    items: Array.isArray(created.items) ? created.items.map(it => ({
        productName: it.product_name || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        total: Number(it.total) || 0,
    })) : [],
    totalAmount: Number(created.total_amount) || 0,
    status: created.status || 'Pendiente',
    notes: created.notes || '',
    cashReceived: created.cash_received,
    changeGiven: created.change_given,
    paidTotalAtChange: created.paid_total_at_change != null ? Number(created.paid_total_at_change) : null,
    paymentDifference: created.payment_difference != null ? Number(created.payment_difference) : null,
});

const safeToFixed = (value, decimals = 2) => {
    const num = parseFloat(value);
    return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

const formatMovementDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'N/A';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch (e) {
        return 'N/A';
    }
};

function PedDialogo({ orders, setOrders, products = [], loadCashBalance, isOpen, onClose, onMinimize, isMinimized, onOpenNewTab, isFullscreen = false }) {
    const [ordersIdFilter, setOrdersIdFilter] = useState('');
    const [ordersIdFilterOp, setOrdersIdFilterOp] = useState('equals');
    const [ordersCustomerFilter, setOrdersCustomerFilter] = useState('');
    const [ordersCustomerFilterOp, setOrdersCustomerFilterOp] = useState('contains');

    // Fechas simplificadas a dos estados
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [ordersPaymentMethodFilter, setOrdersPaymentMethodFilter] = useState([]);
    const [ordersStatusFilter, setOrdersStatusFilter] = useState([]);
    const [ordersProductFilter, setOrdersProductFilter] = useState('');
    const [ordersUnitsFilter, setOrdersUnitsFilter] = useState('');
    const [ordersUnitsFilterOp, setOrdersUnitsFilterOp] = useState('equals');

    // Filtros rebatibles
    const [showFilters, setShowFilters] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState(null);
    const [editOrderForm, setEditOrderForm] = useState(null);
    const [editMessage, setEditMessage] = useState('');
    const [confirmDelivery, setConfirmDelivery] = useState(null);
    const [exitEnCambio, setExitEnCambio] = useState(null);

    // Estados para drag & drop
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dialogRef = useRef(null);

    const applyStatusUpdate = async (orderId, newStatus) => {
        try {
            const res = await updateOrderStatus(orderId, newStatus);
            const updated = res?.data ? normalizeOrder(res.data) : null;
            setOrders(prev =>
                prev.map(order => {
                    if (order.id !== orderId) return order;
                    return updated ? { ...order, ...updated } : { ...order, status: newStatus };
                })
            );
            if (newStatus === 'Entregado' && loadCashBalance) {
                await loadCashBalance();
            }
        } catch (err) {
            console.error('Error actualizando estado del pedido:', err);
        }
    };

    const handleStatusChangeRequest = (order, newStatus) => {
        if (newStatus === order.status) return;

        if (newStatus === 'Entregado') {
            setConfirmDelivery({ orderId: order.id, newStatus });
            return;
        }

        if (order.status === 'En cambio' && newStatus !== 'En cambio') {
            setExitEnCambio({ order, newStatus });
            return;
        }

        applyStatusUpdate(order.id, newStatus);
    };

    const productOptions = products
        .filter(p => p.category === 'Producto')
        .map(p => ({ value: p.id, label: p.name }));

    const openEditOrder = (order) => {
        const paidTotal = Number(order.paidTotalAtChange ?? order.totalAmount) || 0;
        setEditingOrderId(order.id);
        setEditOrderForm({
            paidTotal,
            items: (order.items || []).map(item => {
                const qty = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                return {
                    productId: products.find(p => p.name === item.productName)?.id || '',
                    productName: item.productName || '',
                    quantity: qty || 1,
                    unitPrice,
                    total: qty * unitPrice,
                };
            }),
            notes: order.notes || '',
        });
        setEditMessage('');
    };

    const closeEditOrder = () => {
        setEditingOrderId(null);
        setEditOrderForm(null);
        setEditMessage('');
    };

    const calculateEditOrderTotal = () => {
        if (!editOrderForm) return 0;
        return calculateItemsTotal(editOrderForm.items);
    };

    const addEditItem = () => {
        setEditOrderForm(prev => ({
            ...prev,
            items: [...prev.items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }],
        }));
    };

    const removeEditItem = (index) => {
        setEditOrderForm(prev => {
            if (prev.items.length <= 1) return prev;
            return { ...prev, items: prev.items.filter((_, i) => i !== index) };
        });
    };

    const updateEditItem = (index, field, value) => {
        setEditOrderForm(prev => {
            const updatedItems = [...prev.items];
            const currentItem = { ...updatedItems[index] };
            if (field === 'product') {
                currentItem.productId = value ? value.value : '';
                currentItem.productName = value ? value.label : '';
                const productData = products.find(p => p.id === currentItem.productId);
                if (productData) currentItem.unitPrice = Number(productData.price) || 0;
            } else {
                currentItem[field] = value;
            }
            const quantity = Number(currentItem.quantity) || 0;
            const unitPrice = Number(currentItem.unitPrice) || 0;
            currentItem.total = round2(quantity * unitPrice);
            updatedItems[index] = currentItem;
            return { ...prev, items: updatedItems };
        });
    };

    const handleSaveEditOrder = async (e) => {
        e.preventDefault();
        const validItems = editOrderForm.items.filter(item =>
            item.productName.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) > 0
        );
        if (validItems.length === 0) {
            setEditMessage('Debe tener al menos un producto válido.');
            return;
        }
        try {
            const res = await updateOrder(editingOrderId, {
                items: validItems.map(i => {
                    const qty = Number(i.quantity);
                    const unitPrice = Number(i.unitPrice);
                    return {
                        product_name: i.productName,
                        quantity: qty,
                        unit_price: unitPrice,
                        total: round2(qty * unitPrice),
                    };
                }),
                notes: editOrderForm.notes,
            });
            const updated = normalizeOrder(res.data);
            setOrders(prev => prev.map(order =>
                order.id === editingOrderId ? { ...order, ...updated } : order
            ));
            closeEditOrder();
        } catch (err) {
            console.error('Error actualizando pedido:', err);
            setEditMessage('Error al actualizar el pedido.');
        }
    };

    const handleMouseDown = (e) => {
        if (e.target.closest('.dialog-header') && !e.target.closest('button')) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            const minX = 0;
            const minY = 0;
            const dialogWidth = dialogRef.current?.offsetWidth || 400;
            const dialogHeight = dialogRef.current?.offsetHeight || 200;
            const maxX = window.innerWidth - 200;
            const maxY = window.innerHeight - 50;
            let newX = Math.max(minX, Math.min(maxX, e.clientX - dragOffset.x));
            let newY = Math.max(minY, Math.min(maxY, e.clientY - dragOffset.y));
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragOffset]);

    if (!isOpen) return null;

    const toDateOnlyString = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getQuantityInputProps = (unit = 'u') => {
        const normalized = String(unit || '').trim().toLowerCase();
        const integerUnits = ['u', 'unidad', 'unidades', 'un', 'unit', 'units'];
        return integerUnits.includes(normalized)
            ? { min: '1', step: '1' }
            : { min: '0.01', step: '0.01' };
    };

    const quantityInputProps = getQuantityInputProps('u');

    const filteredOrders = orders.filter(order => {
        if (ordersIdFilter) {
            const orderId = Number(order.id);
            const filterValue = Number(ordersIdFilter);
            if (ordersIdFilterOp === 'equals' && orderId !== filterValue) return false;
            if (ordersIdFilterOp === 'lt' && orderId >= filterValue) return false;
            if (ordersIdFilterOp === 'lte' && orderId > filterValue) return false;
            if (ordersIdFilterOp === 'gt' && orderId <= filterValue) return false;
            if (ordersIdFilterOp === 'gte' && orderId < filterValue) return false;
        }

        if (ordersCustomerFilter) {
            const customerName = String(order.customerName || '').toLowerCase();
            const filterLower = ordersCustomerFilter.toLowerCase();
            if (ordersCustomerFilterOp === 'contains' && !customerName.includes(filterLower)) return false;
            if (ordersCustomerFilterOp === 'equals' && customerName !== filterLower) return false;
        }

        if (dateFrom || dateTo) {
            const rawDate = order.fecha_de_orden_del_pedido || order.created_at || order.date;
            if (!rawDate) return false;

            const orderDateStr = toDateOnlyString(rawDate);
            if (!orderDateStr) return false;

            if (dateFrom && orderDateStr < dateFrom) return false;
            if (dateTo && orderDateStr > dateTo) return false;
        }

        if (ordersPaymentMethodFilter.length > 0) {
            const paymentMethod = String(order.paymentMethod || '').toLowerCase();
            if (!ordersPaymentMethodFilter.includes(paymentMethod)) return false;
        }

        if (ordersStatusFilter.length > 0) {
            if (!ordersStatusFilter.includes(order.status)) return false;
        }

        if (ordersProductFilter) {
            const hasProduct = Array.isArray(order.items)
                ? order.items.some(item =>
                    String(item.productName || '').toLowerCase().includes(ordersProductFilter.toLowerCase())
                )
                : false;
            if (!hasProduct) return false;
        }

        if (ordersUnitsFilter) {
            const filterValue = Number(ordersUnitsFilter);
            const hasMatchingQuantity = Array.isArray(order.items)
                ? order.items.some(item => {
                    const quantity = Number(item.quantity) || 0;
                    if (ordersUnitsFilterOp === 'equals' && quantity === filterValue) return true;
                    if (ordersUnitsFilterOp === 'greater' && quantity > filterValue) return true;
                    if (ordersUnitsFilterOp === 'greaterOrEqual' && quantity >= filterValue) return true;
                    if (ordersUnitsFilterOp === 'less' && quantity < filterValue) return true;
                    if (ordersUnitsFilterOp === 'lessOrEqual' && quantity <= filterValue) return true;
                    return false;
                })
                : false;
            if (!hasMatchingQuantity) return false;
        }

        return true;
    });

    return (
        <div
            ref={dialogRef}
            className={`fixed bg-white flex flex-col ${
                isFullscreen
                    ? 'inset-0 rounded-none'
                    : `rounded-lg shadow-2xl border-2 border-gray-300 ${isMinimized ? 'h-auto' : 'min-h-[600px]'}`
            }`}
            style={{
                left: isFullscreen ? 0 : `${position.x}px`,
                top: isFullscreen ? 0 : `${position.y}px`,
                width: isFullscreen ? '100vw' : (isMinimized ? 'auto' : '90vw'),
                maxWidth: isFullscreen ? '100vw' : (isMinimized ? 'fit-content' : '1400px'),
                height: isFullscreen ? '100vh' : 'auto',
                maxHeight: isFullscreen ? '100vh' : 'auto',
                zIndex: 1000,
                resize: (isFullscreen || isMinimized) ? 'none' : 'both',
                overflow: isMinimized ? 'hidden' : 'auto'
            }}
        >
            <div
                className={`dialog-header bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 ${isMinimized ? 'py-2 min-h-[56px]' : 'py-3'} ${isFullscreen ? '' : 'rounded-t-lg cursor-move'} flex items-center justify-between`}
                onMouseDown={isFullscreen ? undefined : handleMouseDown}
                style={isMinimized ? { overflow: 'hidden' } : {}}
            >
                <h3 className="text-lg font-bold flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                    <span>Historial de Pedidos</span>
                    {!isMinimized && <span className="text-sm font-normal">({filteredOrders.length} pedidos)</span>}
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!isFullscreen && (
                        <button
                            onClick={onOpenNewTab}
                            className="hover:bg-blue-800 p-1.5 rounded transition-colors"
                            title="Abrir en pestaña nueva"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </button>
                    )}
                    {!isFullscreen && (
                        <button
                            onClick={onMinimize}
                            className="hover:bg-blue-800 p-1.5 rounded transition-colors"
                            title={isMinimized ? "Maximizar" : "Minimizar"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isMinimized ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                )}
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="hover:bg-red-600 p-1.5 rounded transition-colors"
                        title="Cerrar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="flex-1 overflow-auto p-6 bg-gray-50">
                    <div className="bg-white rounded-lg shadow-md mb-6 border border-gray-200">
                        <button
                            onClick={() => setShowFilters(prev => !prev)}
                            className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                        >
                            <h4 className="text-lg font-bold text-gray-800">🔍 Filtros de Búsqueda</h4>
                            <svg className={`w-6 h-6 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showFilters && (
                            <div className="p-6 border-t border-gray-200">
                                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <label className="font-medium text-gray-700 sm:min-w-[80px]">ID:</label>
                                    <select
                                        value={ordersIdFilterOp}
                                        onChange={e => setOrdersIdFilterOp(e.target.value)}
                                        className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="equals">Es igual</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">&le;</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">&ge;</option>
                                    </select>
                                    <input
                                        type="number"
                                        value={ordersIdFilter}
                                        onChange={e => setOrdersIdFilter(e.target.value)}
                                        placeholder="ID del pedido..."
                                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <label className="font-medium text-gray-700 sm:min-w-[80px]">Cliente:</label>
                                    <select
                                        value={ordersCustomerFilterOp}
                                        onChange={e => setOrdersCustomerFilterOp(e.target.value)}
                                        className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={ordersCustomerFilter}
                                        onChange={e => setOrdersCustomerFilter(e.target.value)}
                                        placeholder="Nombre del cliente..."
                                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="font-medium text-gray-700 block mb-2">Filtrar por Fechas:</label>
                                    <div className={`flex gap-4 ${isFullscreen ? 'flex-row' : 'flex-col sm:flex-row'}`}>
                                        <div className="flex-1 bg-gray-50 p-4 rounded-md border border-gray-200">
                                            <label className="text-sm font-semibold text-gray-700 mb-2 block uppercase tracking-wide">Desde:</label>
                                            <input
                                                type="date"
                                                value={dateFrom}
                                                onChange={e => setDateFrom(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            />
                                        </div>

                                        <div className="flex-1 bg-gray-50 p-4 rounded-md border border-gray-200">
                                            <label className="text-sm font-semibold text-gray-700 mb-2 block uppercase tracking-wide">Hasta:</label>
                                            <input
                                                type="date"
                                                value={dateTo}
                                                onChange={e => setDateTo(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="font-medium text-gray-700 block mb-2">Métodos de Pago:</label>
                                    <div className="flex flex-wrap gap-4">
                                        {['debito', 'credito', 'transferencia', 'efectivo'].map(method => (
                                            <label key={method} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={ordersPaymentMethodFilter.includes(method)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setOrdersPaymentMethodFilter(prev => [...prev, method]);
                                                        } else {
                                                            setOrdersPaymentMethodFilter(prev => prev.filter(m => m !== method));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-gray-700 capitalize">{method}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="font-medium text-gray-700 block mb-2">Estados:</label>
                                    <div className="flex flex-wrap gap-4">
                                        {ORDER_STATUSES.map(status => (
                                            <label key={status} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={ordersStatusFilter.includes(status)}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setOrdersStatusFilter(prev => [...prev, status]);
                                                        } else {
                                                            setOrdersStatusFilter(prev => prev.filter(s => s !== status));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-gray-700">{status}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <label className="font-medium text-gray-700 sm:min-w-[120px]">Buscar Producto:</label>
                                    <input
                                        type="text"
                                        value={ordersProductFilter}
                                        onChange={e => setOrdersProductFilter(e.target.value)}
                                        placeholder="Nombre del producto..."
                                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="mb-0 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <label className="font-medium text-gray-700 sm:min-w-[80px]">Unidades:</label>
                                    <select
                                        value={ordersUnitsFilterOp}
                                        onChange={e => setOrdersUnitsFilterOp(e.target.value)}
                                        className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="equals">=</option>
                                        <option value="greater">&gt;</option>
                                        <option value="greaterOrEqual">&gt;=</option>
                                        <option value="less">&lt;</option>
                                        <option value="lessOrEqual">&lt;=</option>
                                    </select>
                                    <input
                                        type="number"
                                        {...quantityInputProps}
                                        value={ordersUnitsFilter}
                                        onChange={e => setOrdersUnitsFilter(e.target.value)}
                                        placeholder="Cantidad..."
                                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto bg-white rounded-lg shadow-md border border-gray-200">
                        {filteredOrders.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No hay pedidos que mostrar
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-800 text-white">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-sm font-semibold">ID</th>
                                        <th className="px-3 py-3 text-left text-sm font-semibold">Cliente</th>
                                        <th className="px-3 py-3 text-left text-sm font-semibold">Fecha</th>
                                        <th className="px-3 py-3 text-left text-sm font-semibold">Método</th>
                                        <th className="px-3 py-3 text-left text-sm font-semibold">Estado</th>
                                        <th className="px-3 py-3 text-right text-sm font-semibold">Total</th>
                                        <th className="px-3 py-3 text-left text-sm font-semibold">Productos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {filteredOrders.map(order => (
                                        <tr key={order.id} className="align-top hover:bg-gray-50">
                                            <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                <div className="font-semibold">#{order.id}</div>
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-700">
                                                <div className="font-medium">{order.customerName || 'N/A'}</div>
                                                <div className="text-xs text-gray-500">
                                                    Entrega: {order.fecha_para_la_que_se_quiere_el_pedido
                                                        ? new Date(order.fecha_para_la_que_se_quiere_el_pedido).toISOString().split('T')[0].replace(/-/g, '/')
                                                        : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                {formatMovementDate(order.fecha_de_orden_del_pedido)}
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                {order.paymentMethod || 'N/A'}
                                            </td>
                                            <td className="px-3 py-3 text-sm">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`inline-flex w-fit px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(order.status)}`}>
                                                        {order.status}
                                                    </span>
                                                    <select
                                                        value={order.status}
                                                        onChange={e => handleStatusChangeRequest(order, e.target.value)}
                                                        className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white"
                                                    >
                                                        {ORDER_STATUSES.map(status => (
                                                            <option key={status} value={status}>{status}</option>
                                                        ))}
                                                    </select>
                                                    {order.status === 'En cambio' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditOrder(order)}
                                                            className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-semibold"
                                                        >
                                                            Editar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-700 text-right whitespace-nowrap font-semibold">
                                                ${safeToFixed(order.totalAmount)}
                                            </td>
                                            <td className="px-3 py-3 text-sm text-gray-700 min-w-[280px]">
                                                <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                                                    <thead className="bg-gray-100 text-gray-700">
                                                        <tr>
                                                            <th className="px-2 py-2 text-left font-semibold">Producto</th>
                                                            <th className="px-2 py-2 text-right font-semibold">Cant.</th>
                                                            <th className="px-2 py-2 text-right font-semibold">P. unit.</th>
                                                            <th className="px-2 py-2 text-right font-semibold">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(order.items || []).map((item, index) => (
                                                            <tr key={`${order.id}-${index}`} className="border-t border-gray-200">
                                                                <td className="px-2 py-2 text-left">{item.productName || 'N/A'}</td>
                                                                <td className="px-2 py-2 text-right">{item.quantity || 0}</td>
                                                                <td className="px-2 py-2 text-right">${safeToFixed(item.unitPrice)}</td>
                                                                <td className="px-2 py-2 text-right">${safeToFixed(item.total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {editingOrderId && editOrderForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
                    <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
                        <form onSubmit={handleSaveEditOrder}>
                            <h3 className="text-lg font-bold mb-2">Editar Pedido #{editingOrderId}</h3>
                            {editMessage && <p className="text-red-600 text-sm mb-3">{editMessage}</p>}
                            {editOrderForm.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-3 items-center mb-2">
                                    <div className="col-span-5">
                                        <Select
                                            options={productOptions}
                                            value={productOptions.find(opt => opt.value === item.productId) || null}
                                            onChange={selectedOption => updateEditItem(index, 'product', selectedOption)}
                                            placeholder="Producto..."
                                            isClearable
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => updateEditItem(index, 'quantity', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" value={item.unitPrice} readOnly className="w-full px-2 py-1 bg-gray-100 border border-gray-300 rounded-md text-sm" />
                                    </div>
                                    <div className="col-span-2 text-right text-sm font-semibold">
                                        ${safeToFixed(round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)))}
                                    </div>
                                    <div className="col-span-1 text-center">
                                        {editOrderForm.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEditItem(index)}
                                                title="Quitar producto"
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                &#x274C;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addEditItem}
                                className="mt-2 text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                            >
                                &#x2795; Agregar Producto
                            </button>

                            <PaymentDifferencePanel
                                paidTotal={editOrderForm.paidTotal}
                                newTotal={calculateEditOrderTotal()}
                            />
                            <div className="mt-4 text-right font-bold">
                                Nuevo total del pedido: ${safeToFixed(calculateEditOrderTotal())}
                            </div>
                            <div className="mt-4 flex justify-end gap-3">
                                <button type="button" onClick={closeEditOrder} className="px-4 py-2 bg-gray-300 rounded-md">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-md">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDelivery && (
                <ConfirmDeliveryModal
                    orderId={confirmDelivery.orderId}
                    onConfirm={() => {
                        applyStatusUpdate(confirmDelivery.orderId, confirmDelivery.newStatus);
                        setConfirmDelivery(null);
                    }}
                    onCancel={() => setConfirmDelivery(null)}
                />
            )}

            {exitEnCambio && (
                <ExitEnCambioModal
                    order={exitEnCambio.order}
                    newStatus={exitEnCambio.newStatus}
                    onConfirm={() => {
                        applyStatusUpdate(exitEnCambio.order.id, exitEnCambio.newStatus);
                        setExitEnCambio(null);
                    }}
                    onCancel={() => setExitEnCambio(null)}
                />
            )}
        </div>
    );
}

export default PedDialogo;