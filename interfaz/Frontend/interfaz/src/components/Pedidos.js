import React, { useState } from 'react';
import Select from 'react-select';
import { formatMovementDate } from '../utils/date';
import { safeToFixed } from '../utils/format';
import api, { updateOrderStatus, updateOrder, getApiErrorMessage } from '../services/api';
import SearchableSelect from './SearchableSelect';
import { productNameOptions, sameName } from '../utils/filterOptions';
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

const Pedidos = ({ orders, setOrders, products, loadCashBalance }) => {
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [newOrder, setNewOrder] = useState({
        customerName: '',
        fecha_para_la_que_se_quiere_el_pedido: new Date().toISOString().split('T')[0],
        paymentMethods: {
            efectivo: false,
            debito: false,
            credito: false,
            transferencia: false,
        },
        items: [{ productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }],
        notes: '',
        cashReceived: '',
    });
    const [message, setMessage] = useState('');
    const [editingOrderId, setEditingOrderId] = useState(null);
    const [editOrderForm, setEditOrderForm] = useState(null);
    const [confirmDelivery, setConfirmDelivery] = useState(null);
    const [exitEnCambio, setExitEnCambio] = useState(null);

    const [ordersIdFilter, setOrdersIdFilter] = useState('');
    const [ordersIdFilterOp, setOrdersIdFilterOp] = useState('equals');
    const [ordersCustomerFilter, setOrdersCustomerFilter] = useState('');
    const [ordersCustomerFilterOp, setOrdersCustomerFilterOp] = useState('contains');
    
    // NUEVOS ESTADOS DE FECHA (Simplificados)
    const [ordersDateFrom, setOrdersDateFrom] = useState('');
    const [ordersDateTo, setOrdersDateTo] = useState('');

    const [ordersPaymentMethodFilter, setOrdersPaymentMethodFilter] = useState([]);
    const [ordersStatusFilter, setOrdersStatusFilter] = useState([]);
    const [ordersProductFilter, setOrdersProductFilter] = useState('');
    const [ordersUnitsFilter, setOrdersUnitsFilter] = useState('');
    const [ordersUnitsFilterOp, setOrdersUnitsFilterOp] = useState('equals');
    
    // Estado para controlar qué pedidos tienen abierto el menú de productos
    const [openProducts, setOpenProducts] = useState({});
    // Estado para controlar si los filtros están desplegados
    const [showFilters, setShowFilters] = useState(false);
    
    const toggleProducts = (orderId) => {
        setOpenProducts(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const addItem = () => {
        setNewOrder({
            ...newOrder,
            items: [...newOrder.items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]
        });
    };

    const removeItem = (index) => {
        if (newOrder.items.length > 1) {
            const updatedItems = newOrder.items.filter((_, i) => i !== index);
            setNewOrder({ ...newOrder, items: updatedItems });
        }
    };

    const updateItem = (index, field, value) => {
        const updatedItems = [...newOrder.items];
        const currentItem = { ...updatedItems[index] };
    
        if (field === 'product') {
            const selectedProduct = value;
            currentItem.productId = selectedProduct ? selectedProduct.value : '';
            currentItem.productName = selectedProduct ? selectedProduct.label : '';
            const productData = products.find(p => p.id === currentItem.productId);
            if (productData) {
                currentItem.unitPrice = productData.price;
            }
        } else {
            currentItem[field] = value;
        }
    
        // Recalculate total for the item
        const quantity = parseFloat(currentItem.quantity) || 0;
        const unitPrice = parseFloat(currentItem.unitPrice) || 0;
        currentItem.total = quantity * unitPrice;
    
        updatedItems[index] = currentItem;
        setNewOrder({ ...newOrder, items: updatedItems });
    };

    const handlePaymentMethodChange = (method) => {
        setNewOrder(prevOrder => ({
            ...prevOrder,
            paymentMethods: {
                ...prevOrder.paymentMethods,
                [method]: !prevOrder.paymentMethods[method]
            }
        }));
    };

    const calculateOrderTotal = () => {
        return newOrder.items.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    const calculateEditOrderTotal = () => {
        if (!editOrderForm) return 0;
        return calculateItemsTotal(editOrderForm.items);
    };

    const orderTotal = calculateOrderTotal();
    const paysWithCash = newOrder.paymentMethods.efectivo;
    const cashReceivedNum = parseFloat(newOrder.cashReceived) || 0;
    const changeAmount = paysWithCash ? round2(Math.max(0, cashReceivedNum - orderTotal)) : 0;
    const remainingCash = paysWithCash ? round2(orderTotal - cashReceivedNum) : 0;

    const openEditOrder = (order) => {
        const paidTotal = round2(Number(order.paidTotalAtChange ?? order.totalAmount) || 0);
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
                    total: round2(qty * unitPrice),
                };
            }),
            notes: order.notes || '',
        });
    };

    const closeEditOrder = () => {
        setEditingOrderId(null);
        setEditOrderForm(null);
    };

    const addEditItem = () => {
        setEditOrderForm(prev => ({
            ...prev,
            items: [...prev.items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }],
        }));
    };

    const removeEditItem = (index) => {
        if (editOrderForm.items.length <= 1) return;
        setEditOrderForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const updateEditItem = (index, field, value) => {
        setEditOrderForm(prev => {
            const updatedItems = [...prev.items];
            const currentItem = { ...updatedItems[index] };

            if (field === 'product') {
                const selectedProduct = value;
                currentItem.productId = selectedProduct ? selectedProduct.value : '';
                currentItem.productName = selectedProduct ? selectedProduct.label : '';
                const productData = products.find(p => p.id === currentItem.productId);
                if (productData) {
                    currentItem.unitPrice = Number(productData.price) || 0;
                }
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
            setMessage('❌ Error: Debe tener al menos un producto válido.');
            return;
        }

        try {
            const payload = {
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
            };
            const res = await updateOrder(editingOrderId, payload);
            const updated = normalizeOrder(res.data);
            setOrders(prev => prev.map(order =>
                order.id === editingOrderId ? { ...order, ...updated } : order
            ));
            closeEditOrder();
            setMessage(`✅ Pedido #${editingOrderId} actualizado correctamente.`);
        } catch (err) {
            console.error('Error actualizando pedido:', err, err.response?.data);
            setMessage('❌ Error al actualizar el pedido. Revisá la consola.');
        }
    };

    const handleAddOrder = async (e) => {
        e.preventDefault();
        
        if (!newOrder.customerName.trim()) {
            setMessage('❌ Error: Debe ingresar el nombre del cliente.');
            return;
        }

        const selectedPaymentMethods = Object.entries(newOrder.paymentMethods)
            .filter(([_, isSelected]) => isSelected)
            .map(([method]) => method);

        if (selectedPaymentMethods.length === 0) {
            setMessage('❌ Error: Debe seleccionar al menos un método de pago.');
            return;
        }

        if (newOrder.paymentMethods.efectivo) {
            if (!newOrder.cashReceived || cashReceivedNum <= 0) {
                setMessage('❌ Error: Ingrese el monto entregado en efectivo.');
                return;
            }
            if (remainingCash > 0.01) {
                setMessage(`❌ Error: Faltan $${safeToFixed(remainingCash)} para cubrir el total del pedido.`);
                return;
            }
        }
        
        const validItems = newOrder.items.filter(item => 
            item.productName.trim() && item.quantity > 0 && item.unitPrice > 0
        );
        
        if (validItems.length === 0) {
            setMessage('❌ Error: Debe seleccionar al menos un producto con cantidad y precio válidos.');
            return;
        }
        
        try {
            const payload = {
                customer_name: newOrder.customerName,
                fecha_para_la_que_se_quiere_el_pedido: newOrder.fecha_para_la_que_se_quiere_el_pedido,
                payment_method: selectedPaymentMethods.join(', '),
                items: validItems.map(i => ({ 
                    product_name: i.productName, 
                    quantity: Number(i.quantity), 
                    unit_price: Number(i.unitPrice), 
                    total: Number(i.total) 
                })),
                notes: newOrder.notes,
                total_amount: calculateOrderTotal(),
                cash_received: newOrder.paymentMethods.efectivo ? cashReceivedNum : null,
                change_given: newOrder.paymentMethods.efectivo ? changeAmount : null,
            };

            const res = await api.post('/orders/', payload);
            if (res && res.data) {
                const createdNormalized = normalizeOrder(res.data);
                setOrders(prev => [...prev, createdNormalized]);
                setNewOrder({ 
                    customerName: '', 
                    fecha_para_la_que_se_quiere_el_pedido: new Date().toISOString().split('T')[0],
                    paymentMethods: { efectivo: false, debito: false, credito: false, transferencia: false }, 
                    items: [{ productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }], 
                    notes: '',
                    cashReceived: '',
                });
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

    const applyStatusUpdate = async (orderId, newStatus) => {
        try {
            const res = await updateOrderStatus(orderId, newStatus);
            const updated = res?.data ? normalizeOrder(res.data) : null;
            setOrders(prev => prev.map(order => {
                if (order.id !== orderId) return order;
                return updated ? { ...order, ...updated } : { ...order, status: newStatus };
            }));
            if (newStatus === 'Entregado' && loadCashBalance) {
                await loadCashBalance();
            }
            setMessage(`✅ Estado del pedido #${orderId} actualizado a "${newStatus}"`);
        } catch (error) {
            console.error('Error actualizando estado del pedido:', error);
            setMessage(`❌ ${getApiErrorMessage(error, 'Error al actualizar el estado del pedido. Revisá la consola.')}`);
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
    const productFilterOptions = productNameOptions(products, {
        type: 'Producto',
        extraNames: orders.flatMap(order => (order.items || []).map(item => item.productName)),
    });

    return (
        <div className="management-container">
            <h2 className="text-3xl font-extrabold mb-4">Gestión de Pedidos de Clientes</h2>
            {message && <p className="message">{message}</p>}
            <div className="flex items-center gap-4 mb-6">
                {!showAddOrder && (
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={() => setShowAddOrder(true)}>
                        Registrar Nuevo Pedido de Cliente
                    </button>
                )}
                {/* Botón para abrir historial de pedidos */}
                {!showAddOrder && window.innerWidth >= 1200 && (
                    <button
                        className="bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold py-2 px-4 rounded shadow hover:from-blue-700 hover:to-blue-500 transition-colors"
                        onClick={() => window.dispatchEvent(new CustomEvent('openPedDialogo'))}
                    >
                         Abrir Historial de Pedidos
                    </button>
                )}
            </div>
            {showAddOrder && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
                        <form onSubmit={handleAddOrder}>
                            <h3 className="text-lg font-bold mb-4">Registrar Pedido de Cliente</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre del cliente</label>
                                    <input 
                                        type="text" 
                                        value={newOrder.customerName} 
                                        onChange={e => setNewOrder({ ...newOrder, customerName: e.target.value })} 
                                        placeholder="Nombre del cliente" 
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        required
                                    />
                                </div>
                                <div>

                                    <label className="block text-sm font-medium text-gray-700">Fecha de Entrega</label>
                                    <input 
                                        type="date" 
                                        value={newOrder.fecha_para_la_que_se_quiere_el_pedido} 
                                        onChange={e => setNewOrder({ ...newOrder, fecha_para_la_que_se_quiere_el_pedido: e.target.value })} 
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Métodos de Pago</label>
                                    <div className="mt-2 flex space-x-4">
                                        {Object.keys(newOrder.paymentMethods).map(method => (
                                            <label key={method} className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-5 w-5 text-indigo-600"
                                                    checked={newOrder.paymentMethods[method]}
                                                    onChange={() => handlePaymentMethodChange(method)}
                                                />
                                                <span className="ml-2 text-gray-700">{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {paysWithCash && (
                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Monto entregado (efectivo)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={newOrder.cashReceived}
                                                onChange={e => setNewOrder({ ...newOrder, cashReceived: e.target.value })}
                                                placeholder="Ej: 10000"
                                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                required={paysWithCash}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Total del pedido</label>
                                            <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md font-semibold">
                                                ${safeToFixed(orderTotal)}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Vuelto</label>
                                            <div className={`mt-1 px-3 py-2 border rounded-md font-bold ${
                                                remainingCash > 0.01
                                                    ? 'bg-red-50 border-red-300 text-red-700'
                                                    : 'bg-green-100 border-green-300 text-green-800'
                                            }`}>
                                                {remainingCash > 0.01
                                                    ? `Faltan $${safeToFixed(remainingCash)}`
                                                    : `$${safeToFixed(changeAmount)}`}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <h4 className="text-md font-bold mt-6 mb-2">Productos del Pedido</h4>
                            
                            {newOrder.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-4 items-center mb-2">
                                    <div className="col-span-6">
                                        <Select
                                            options={productOptions}
                                            value={productOptions.find(opt => opt.value === item.productId)}
                                            onChange={selectedOption => updateItem(index, 'product', selectedOption)}
                                            placeholder="Buscar y seleccionar producto..."
                                            isClearable
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => updateItem(index, 'quantity', e.target.value)}
                                            placeholder="Cant." 
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            min="1"
                                            required 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={item.unitPrice} 
                                            readOnly 
                                            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 sm:text-sm"
                                            placeholder="Precio" 
                                        />
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span>${safeToFixed(item.total)}</span>
                                    </div>
                                    <div className="col-span-1">
                                        {newOrder.items.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                &#x274C;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button type="button" onClick={addItem} className="mt-2 text-indigo-600 hover:text-indigo-900">
                                &#x2795; Agregar Producto
                            </button>
                            
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">Notas adicionales</label>
                                <textarea 
                                    value={newOrder.notes} 
                                    onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} 
                                    placeholder="Notas adicionales del pedido"
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-none"
                                />
                            </div>
                            
                            <div className="mt-4 text-right font-bold text-lg">
                                Total del Pedido: ${safeToFixed(calculateOrderTotal())}
                            </div>
                            
                            <div className="mt-6 flex justify-end space-x-4">
                                <button type="button" className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded" onClick={() => setShowAddOrder(false)}>Cancelar</button>
                                <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Registrar Pedido</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
    
            <h3 className="text-lg font-bold mt-6 mb-4 min-[1200px]:hidden">Historial de Pedidos de Clientes</h3>
            
            {/* Filtros de Pedidos */}
            <div className="bg-white rounded-lg shadow-md mb-5 min-[1200px]:hidden">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="w-full px-4 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                    <h4 className="text-base font-bold text-gray-800">🔍 Filtros de Pedidos</h4>
                    <svg className={`w-6 h-6 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                {showFilters && (
                <div className="p-4 border-t border-gray-200">
                
                {/* Filtro por ID */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ID del Pedido</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={ordersIdFilterOp} 
                            onChange={e => setOrdersIdFilterOp(e.target.value)}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                {/* Filtro por Cliente */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cliente</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={ordersCustomerFilterOp} 
                            onChange={e => setOrdersCustomerFilterOp(e.target.value)}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                            <option value="contains">Contiene</option>
                            <option value="equals">Es igual</option>
                        </select>
                        <input 
                            type="text" 
                            value={ordersCustomerFilter} 
                            onChange={e => setOrdersCustomerFilter(e.target.value)} 
                            placeholder="Nombre del cliente..." 
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                {/* FILTRO DE FECHAS (Calendario Nativo) */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Filtrar por Fechas</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Desde</label>
                            <input 
                                type="date" 
                                value={ordersDateFrom} 
                                onChange={e => setOrdersDateFrom(e.target.value)} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Hasta</label>
                            <input 
                                type="date" 
                                value={ordersDateTo} 
                                onChange={e => setOrdersDateTo(e.target.value)} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                </div>
                
                {/* Filtro por Métodos de Pago */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Métodos de Pago</label>
                    <div className="flex flex-wrap gap-3">
                        {['debito', 'credito', 'transferencia', 'efectivo'].map(method => (
                            <label key={method} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={ordersPaymentMethodFilter.includes(method)} 
                                    onChange={e => {
                                        if (e.target.checked) {
                                            setOrdersPaymentMethodFilter([...ordersPaymentMethodFilter, method]);
                                        } else {
                                            setOrdersPaymentMethodFilter(ordersPaymentMethodFilter.filter(m => m !== method));
                                        }
                                    }} 
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                {/* Filtro por Estados */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Estados</label>
                    <div className="flex flex-wrap gap-3">
                        {ORDER_STATUSES.map(status => (
                            <label key={status} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={ordersStatusFilter.includes(status)} 
                                    onChange={e => {
                                        if (e.target.checked) {
                                            setOrdersStatusFilter([...ordersStatusFilter, status]);
                                        } else {
                                            setOrdersStatusFilter(ordersStatusFilter.filter(s => s !== status));
                                        }
                                    }} 
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{status}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                {/* Filtro por Producto */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar Producto</label>
                    <SearchableSelect
                        options={productFilterOptions}
                        value={ordersProductFilter}
                        onChange={setOrdersProductFilter}
                        placeholder="Elegir producto..."
                    />
                </div>
                
                {/* Filtro por Unidades */}
                <div className="mb-0">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Unidades</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={ordersUnitsFilterOp} 
                            onChange={e => setOrdersUnitsFilterOp(e.target.value)}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                            <option value="equals">=</option>
                            <option value="greater">&gt;</option>
                            <option value="greaterOrEqual">&gt;=</option>
                            <option value="less">&lt;</option>
                            <option value="lessOrEqual">&lt;=</option>
                        </select>
                        <input 
                            type="number" 
                            value={ordersUnitsFilter} 
                            onChange={e => setOrdersUnitsFilter(e.target.value)} 
                            placeholder="Cantidad..." 
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>
                </div>
                )}
            </div>
            
            <ul
                className="list-container grid grid-cols-1 md:grid-cols-2 gap-4 min-[1200px]:hidden"
            >
                {orders.filter(order => {
                    // Filtro por ID
                    if (ordersIdFilter) {
                        const orderId = Number(order.id);
                        const filterValue = Number(ordersIdFilter);
                        if (ordersIdFilterOp === 'equals' && orderId !== filterValue) return false;
                        if (ordersIdFilterOp === 'lt' && orderId >= filterValue) return false;
                        if (ordersIdFilterOp === 'lte' && orderId > filterValue) return false;
                        if (ordersIdFilterOp === 'gt' && orderId <= filterValue) return false;
                        if (ordersIdFilterOp === 'gte' && orderId < filterValue) return false;
                    }
                    
                    // Filtro por cliente
                    if (ordersCustomerFilter) {
                        const customerName = (order.customerName || '').toLowerCase();
                        const filterLower = ordersCustomerFilter.toLowerCase();
                        if (ordersCustomerFilterOp === 'contains' && !customerName.includes(filterLower)) return false;
                        if (ordersCustomerFilterOp === 'equals' && customerName !== filterLower) return false;
                    }
                    
                    // FILTRO DE FECHA SIMPLIFICADO (Calendario)
                    if (ordersDateFrom || ordersDateTo) {
                        if (!order.fecha_de_orden_del_pedido) return false;
                        const orderDate = new Date(order.fecha_de_orden_del_pedido);
                        if (isNaN(orderDate.getTime())) return false;
                        
                        // Formato YYYY-MM-DD para comparación directa de strings
                        const y = orderDate.getFullYear();
                        const m = String(orderDate.getMonth() + 1).padStart(2, '0');
                        const d = String(orderDate.getDate()).padStart(2, '0');
                        const orderDateStr = `${y}-${m}-${d}`;
                        
                        if (ordersDateFrom && orderDateStr < ordersDateFrom) return false;
                        if (ordersDateTo && orderDateStr > ordersDateTo) return false;
                    }
                    
                    // Filtro por método de pago
                    if (ordersPaymentMethodFilter.length > 0) {
                        if (!ordersPaymentMethodFilter.includes(order.paymentMethod)) return false;
                    }
                    
                    // Filtro por estado
                    if (ordersStatusFilter.length > 0) {
                        if (!ordersStatusFilter.includes(order.status)) return false;
                    }
                    
                    // Filtro por producto
                    if (ordersProductFilter) {
                        const hasProduct = order.items.some(item => sameName(item.productName, ordersProductFilter));
                        if (!hasProduct) return false;
                    }
                    
                    // Filtro por unidades
                    if (ordersUnitsFilter) {
                        const filterValue = Number(ordersUnitsFilter);
                        const hasMatchingQuantity = order.items.some(item => {
                            const quantity = Number(item.quantity) || 0;
                            if (ordersUnitsFilterOp === 'equals' && quantity === filterValue) return true;
                            if (ordersUnitsFilterOp === 'greater' && quantity > filterValue) return true;
                            if (ordersUnitsFilterOp === 'greaterOrEqual' && quantity >= filterValue) return true;
                            if (ordersUnitsFilterOp === 'less' && quantity < filterValue) return true;
                            if (ordersUnitsFilterOp === 'lessOrEqual' && quantity <= filterValue) return true;
                            return false;
                        });
                        if (!hasMatchingQuantity) return false;
                    }
                    
                    return true;
                }).map(order => (
                    <li key={order.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow mb-4">
                        {/* Header del pedido */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-blue-200">
                            <div className="flex flex-col gap-3">
                                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 break-words">
                                    Pedido #{order.id}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 break-words">
                                    Registrado: {formatMovementDate(order.fecha_de_orden_del_pedido)}
                                </p>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold ${getStatusClasses(order.status)}`}>
                                        {order.status}
                                    </span>
                                    <select 
                                        value={order.status} 
                                        onChange={e => handleStatusChangeRequest(order, e.target.value)}
                                        className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-xs sm:text-sm"
                                    >
                                        {ORDER_STATUSES.map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                    {order.status === 'En cambio' && (
                                        <button
                                            type="button"
                                            onClick={() => openEditOrder(order)}
                                            className="w-full sm:w-auto px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs sm:text-sm font-semibold"
                                        >
                                            Editar pedido
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Contenido del pedido */}
                        <div className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                            {/* Cliente y Entrega */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm sm:text-base break-words">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-gray-700">Cliente:</span>
                                    <span className="text-gray-900">{order.customerName}</span>
                                </div>
                                <span className="hidden sm:inline text-gray-400">|</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-gray-700">Entrega:</span>
                                    <span className="text-gray-900">
                                        {order.fecha_para_la_que_se_quiere_el_pedido ? 
                                            new Date(order.fecha_para_la_que_se_quiere_el_pedido).toISOString().split('T')[0].replace(/-/g, '/') 
                                            : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Método de Pago */}
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                                <span className="font-bold text-gray-700">Método de Pago:</span>
                                <span className="font-medium break-words">{order.paymentMethod}</span>
                            </div>
                            
                            {/* Productos */}
                            <div>
                                <button
                                    className="flex items-center gap-2 font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2 text-sm sm:text-base"
                                    onClick={() => toggleProducts(order.id)}
                                    aria-expanded={!!openProducts[order.id]}
                                    aria-controls={`productos-${order.id}`}
                                >
                                    <span>Productos solicitados</span>
                                    <svg className={`w-4 h-4 sm:w-5 sm:h-5 transform transition-transform ${openProducts[order.id] ? 'rotate-90' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                {openProducts[order.id] && (
                                    <ul id={`productos-${order.id}`} className="bg-gray-50 rounded-md p-2 sm:p-3 space-y-1 border border-gray-200">
                                        {order.items.map((item, index) => (
                                            <li key={index} className="text-gray-800 text-xs sm:text-sm break-words">
                                                <span className="font-medium">{item.productName}</span> - {item.quantity || 0} unidades 
                                                × ${safeToFixed(item.unitPrice)} = <span className="font-semibold">${safeToFixed(item.total)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            
                            {/* Total */}
                            <div className="pt-2 sm:pt-3 border-t border-gray-200">
                                <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 break-words">
                                    Total: <span className="text-black">${safeToFixed(order.totalAmount)}</span>
                                </span>
                            </div>
                            
                            {/* Notas */}
                            {order.notes && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 sm:p-3 rounded">
                                    <span className="font-bold text-gray-700 text-sm sm:text-base">Notas:</span>
                                    <p className="text-gray-800 mt-1 text-xs sm:text-sm break-words">{order.notes}</p>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {editingOrderId && editOrderForm && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
                        <form onSubmit={handleSaveEditOrder}>
                            <h3 className="text-lg font-bold mb-4">Editar Pedido #{editingOrderId}</h3>
                            <p className="text-sm text-orange-700 mb-4 bg-orange-50 border border-orange-200 rounded p-3">
                                Podés cambiar el pedido completo o modificar uno o más productos.
                            </p>

                            {editOrderForm.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-4 items-center mb-2">
                                    <div className="col-span-6">
                                        <Select
                                            options={productOptions}
                                            value={productOptions.find(opt => opt.value === item.productId)}
                                            onChange={selectedOption => updateEditItem(index, 'product', selectedOption)}
                                            placeholder="Buscar y seleccionar producto..."
                                            isClearable
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => updateEditItem(index, 'quantity', e.target.value)}
                                            placeholder="Cant."
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md sm:text-sm"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            value={item.unitPrice}
                                            readOnly
                                            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md sm:text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span>${safeToFixed(round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)))}</span>
                                    </div>
                                    <div className="col-span-1">
                                        {editOrderForm.items.length > 1 && (
                                            <button type="button" onClick={() => removeEditItem(index)} className="text-red-500 hover:text-red-700">
                                                &#x274C;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button type="button" onClick={addEditItem} className="mt-2 text-indigo-600 hover:text-indigo-900">
                                &#x2795; Agregar Producto
                            </button>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">Notas</label>
                                <textarea
                                    value={editOrderForm.notes}
                                    onChange={e => setEditOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md sm:text-sm resize-none"
                                />
                            </div>

                            <PaymentDifferencePanel
                                paidTotal={editOrderForm.paidTotal}
                                newTotal={calculateEditOrderTotal()}
                            />

                            <div className="mt-4 text-right font-bold text-lg">
                                Nuevo total del pedido: ${safeToFixed(calculateEditOrderTotal())}
                            </div>

                            <div className="mt-6 flex justify-end space-x-4">
                                <button type="button" className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded" onClick={closeEditOrder}>
                                    Cancelar
                                </button>
                                <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded">
                                    Guardar cambios
                                </button>
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
};

export default Pedidos;