import React, { useState, useEffect, useRef } from 'react';
import { formatMovementDate } from '../utils/date';
import {
    safeToFixed as defaultSafeToFixed,
    formatStockWithUnit,
    formatCompraItemLine,
    formatNumber,
} from '../utils/format';

/**
 * Dialogo_interfaz_Consultar_Datos
 * Componente para mostrar la interfaz de consulta de datos en modo diálogo/fullscreen
 * Diseñado para pantallas de 1857px o mayores
 * Layout: 30% filtros (izquierda) | 70% tabla de resultados (derecha)
 */
export default function Dialogo_interfaz_Consultar_Datos(props) {
    const {
        getInMemoryToken,
        api,
        loadSales,
        loadCashMovements,
        inventory = [],
        suppliers = [],
        purchases = [],
        orders = [],
        cashMovements = [],
        sales = [],
        headerTranslationMap = {},
        safeToFixed = defaultSafeToFixed,
        isFullscreen = false,
        onClose = () => {}
    } = props;

    // Estados de consulta
    const [selectedQuery, setSelectedQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [queryResults, setQueryResults] = useState(null);
    const isRunningQueryRef = useRef(false);

    // Filtros de Stock
    const [stockIdFilter, setStockIdFilter] = useState('');
    const [stockIdFilterOp, setStockIdFilterOp] = useState('equals');
    const [stockNameFilter, setStockNameFilter] = useState('');
    const [stockQuantityFilter, setStockQuantityFilter] = useState('');
    const [stockQuantityOp, setStockQuantityOp] = useState('equals');
    const [stockQuantityUnit, setStockQuantityUnit] = useState('Kg');
    const [stockPriceFilter, setStockPriceFilter] = useState('');
    const [stockPriceOp, setStockPriceOp] = useState('equals');
    const [stockTypeFilter, setStockTypeFilter] = useState('');
    const [stockStatusFilter, setStockStatusFilter] = useState([]);

    // Filtros de Ventas
    const [salesIdFilter, setSalesIdFilter] = useState('');
    const [salesIdFilterOp, setSalesIdFilterOp] = useState('equals');
    const [salesProductFilter, setSalesProductFilter] = useState('');
    const [salesUserFilter, setSalesUserFilter] = useState('');
    const [salesTotalFilter, setSalesTotalFilter] = useState('');
    const [salesTotalOp, setSalesTotalOp] = useState('equals');
    const [salesQuantityFilter, setSalesQuantityFilter] = useState('');
    const [salesQuantityOp, setSalesQuantityOp] = useState('equals');
    // Filtros de Movimientos de Caja
    const [cashIdFilter, setCashIdFilter] = useState('');
    const [cashIdFilterOp, setCashIdFilterOp] = useState('equals');
    const [cashAmountFilter, setCashAmountFilter] = useState('');
    const [cashAmountFilterOp, setCashAmountFilterOp] = useState('equals');
    const [cashDescriptionFilter, setCashDescriptionFilter] = useState('');
    const [cashDescriptionFilterOp, setCashDescriptionFilterOp] = useState('contains');
    const [cashUserFilter, setCashUserFilter] = useState('');
    const [cashUserFilterOp, setCashUserFilterOp] = useState('contains');
    const [cashTypeFilter, setCashTypeFilter] = useState('');
    const [cashPaymentMethodFilter, setCashPaymentMethodFilter] = useState([]);
    const [cashSortOrder, setCashSortOrder] = useState('desc');

    // Filtros de Pedidos
    const [ordersIdFilter, setOrdersIdFilter] = useState('');
    const [ordersIdFilterOp, setOrdersIdFilterOp] = useState('equals');
    const [ordersCustomerFilter, setOrdersCustomerFilter] = useState('');
    const [ordersCustomerFilterOp, setOrdersCustomerFilterOp] = useState('contains');
    const [ordersPaymentMethodFilter, setOrdersPaymentMethodFilter] = useState([]);
    const [ordersStatusFilter, setOrdersStatusFilter] = useState([]);
    const [ordersProductFilter, setOrdersProductFilter] = useState('');
    const [ordersUnitsFilter, setOrdersUnitsFilter] = useState('');
    const [ordersUnitsFilterOp, setOrdersUnitsFilterOp] = useState('equals');

    // Filtros de Compras
    const [purchasesIdFilter, setPurchasesIdFilter] = useState('');
    const [purchasesIdFilterOp, setPurchasesIdFilterOp] = useState('equals');
    const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState('');
    const [purchasesSupplierFilterOp, setPurchasesSupplierFilterOp] = useState('contains');
    const [purchasesTotalFilter, setPurchasesTotalFilter] = useState('');
    const [purchasesTotalFilterOp, setPurchasesTotalFilterOp] = useState('equals');
    const [purchasesTypeFilter, setPurchasesTypeFilter] = useState([]);
    const [purchasesProductFilter, setPurchasesProductFilter] = useState('');
    const [purchasesQuantityFilter, setPurchasesQuantityFilter] = useState('');
    const [purchasesQuantityFilterOp, setPurchasesQuantityFilterOp] = useState('equals');
    const [purchasesQuantityUnit, setPurchasesQuantityUnit] = useState('Kg');

    // Filtros de Proveedores
    const [suppliersIdFilter, setSuppliersIdFilter] = useState('');
    const [suppliersIdFilterOp, setSuppliersIdFilterOp] = useState('equals');
    const [suppliersNameFilter, setSuppliersNameFilter] = useState('');
    const [suppliersNameFilterOp, setSuppliersNameFilterOp] = useState('contains');
    const [suppliersCuitFilter, setSuppliersCuitFilter] = useState('');
    const [suppliersCuitFilterOp, setSuppliersCuitFilterOp] = useState('contains');
    const [suppliersPhoneFilter, setSuppliersPhoneFilter] = useState('');
    const [suppliersPhoneFilterOp, setSuppliersPhoneFilterOp] = useState('contains');
    const [suppliersAddressFilter, setSuppliersAddressFilter] = useState('');
    const [suppliersAddressFilterOp, setSuppliersAddressFilterOp] = useState('contains');
    const [suppliersProductFilter, setSuppliersProductFilter] = useState('');
    const [suppliersProductFilterOp, setSuppliersProductFilterOp] = useState('contains');

    // Función auxiliar para parsear fechas (corregida para zonas horarias)
    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        
        // Si es formato ISO YYYY-MM-DD sin hora, tratarlo como fecha local (no UTC)
        if (typeof dateStr === 'string') {
            // Formato YYYY-MM-DD (input type="date")
            const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
                const [, year, month, day] = isoMatch;
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            
            // Formato DD/MM/YYYY
            const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dmyMatch) {
                const [, day, month, year] = dmyMatch;
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            
            // Formato MM/DD/YYYY
            const mdyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (mdyMatch) {
                const [, month, day, year] = mdyMatch;
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
        }
        
        // Para otros formatos (ISO con tiempo, timestamps, etc.)
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        
        // Último intento con split
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
            let [a, b, c] = parts.map(p => parseInt(p, 10));
            if (a > 1900) d = new Date(a, b - 1, c);
            else d = new Date(c, a - 1, b);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    };

    const formatDateForDisplay = (dateStr) => {
        const d = parseAnyDate(dateStr);
        if (!d) return dateStr;
        // Formatear manualmente para evitar problemas de zona horaria
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Formatear stock con unidades correctamente (igual que DataConsultation.js)

    // Calcular el estado del stock
    const getStockStatus = (item) => {
        const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
        const stock = parseFloat(item.stock) || 0;
        return stock < threshold ? 'Stock Bajo' : stock < (threshold * 2) ? 'Stock Medio' : 'Stock Alto';
    };

    // Funciones de ejecución de consultas (importadas/copiadas de DataConsultation)
    const executeStockQuery = async () => {
        const hasOtherFilters = stockIdFilter.trim() || stockNameFilter.trim() || stockQuantityFilter.trim() || stockPriceFilter.trim() || stockTypeFilter || stockStatusFilter.length > 0;
        
        if (!hasOtherFilters && (!startDate || !endDate)) {
            // Para stock no se requieren fechas si hay filtros
        }

        let filteredProducts = [...inventory];

        // Filtro de ID
        if (stockIdFilter.trim()) {
            const filterId = Number(stockIdFilter);
            filteredProducts = filteredProducts.filter(p => {
                const productId = Number(p.id);
                switch (stockIdFilterOp) {
                    case 'equals': return productId === filterId;
                    case 'greater': return productId > filterId;
                    case 'greaterOrEqual': return productId >= filterId;
                    case 'less': return productId < filterId;
                    case 'lessOrEqual': return productId <= filterId;
                    default: return productId === filterId;
                }
            });
        }

        // Filtro de nombre
        if (stockNameFilter.trim()) {
            const filterName = stockNameFilter.toLowerCase();
            filteredProducts = filteredProducts.filter(p => 
                (p.name || '').toLowerCase().includes(filterName)
            );
        }

        // Filtro de cantidad
        if (stockQuantityFilter.trim()) {
            const filterQty = parseFloat(stockQuantityFilter);
            if (!isNaN(filterQty)) {
                filteredProducts = filteredProducts.filter(p => {
                    let stock = parseFloat(p.stock) || 0;
                    // Convertir unidades si es necesario
                    const pUnit = (p.unit || '').toLowerCase();
                    if (stockQuantityUnit === 'Kg' && pUnit === 'g') stock = stock / 1000;
                    else if (stockQuantityUnit === 'L' && pUnit === 'ml') stock = stock / 1000;
                    
                    switch (stockQuantityOp) {
                        case 'equals': return stock === filterQty;
                        case 'gt': return stock > filterQty;
                        case 'gte': return stock >= filterQty;
                        case 'lt': return stock < filterQty;
                        case 'lte': return stock <= filterQty;
                        default: return stock === filterQty;
                    }
                });
            }
        }

        // Filtro de precio
        if (stockPriceFilter.trim()) {
            const filterPrice = parseFloat(stockPriceFilter);
            if (!isNaN(filterPrice)) {
                filteredProducts = filteredProducts.filter(p => {
                    const price = parseFloat(p.price) || 0;
                    switch (stockPriceOp) {
                        case 'equals': return price === filterPrice;
                        case 'gt': return price > filterPrice;
                        case 'gte': return price >= filterPrice;
                        case 'lt': return price < filterPrice;
                        case 'lte': return price <= filterPrice;
                        default: return price === filterPrice;
                    }
                });
            }
        }

        // Filtro de tipo
        if (stockTypeFilter) {
            filteredProducts = filteredProducts.filter(p => {
                const type = (p.type || p.category || '').toLowerCase();
                if (stockTypeFilter.toLowerCase() === 'insumo') return type === 'insumo';
                if (stockTypeFilter.toLowerCase() === 'producto') return type === 'producto';
                return true;
            });
        }

        // Filtro de estado (calculado dinámicamente)
        if (stockStatusFilter.length > 0) {
            filteredProducts = filteredProducts.filter(p => {
                const status = getStockStatus(p);
                return stockStatusFilter.includes(status);
            });
        }

        const productos = filteredProducts.filter(item => (item.type || item.category || '').toLowerCase() === 'producto');
        const insumos = filteredProducts.filter(item => (item.type || item.category || '').toLowerCase() === 'insumo');

        const results = {
            title: 'Estado del Stock',
            summary: {
                totalProducts: productos.length,
                totalInsumos: insumos.length,
                lowStockItems: filteredProducts.filter(item => getStockStatus(item) === 'Stock Bajo').length,
                totalStock: `Productos: ${productos.length} | Insumos: ${insumos.length}`
            },
            data: filteredProducts.map(p => ({
                id: p.id,
                name: p.name,
                stock: formatStockWithUnit(p.stock, p.unit),
                price: p.price,
                type: p.type || p.category,
                status: getStockStatus(p)
            }))
        };
        
        setQueryResults(results);
        return results;
    };

    const executeSuppliersQuery = async () => {
        let filteredSuppliers = [...suppliers];

        // Filtro de ID
        if (suppliersIdFilter.trim()) {
            const filterId = Number(suppliersIdFilter);
            filteredSuppliers = filteredSuppliers.filter(s => {
                const supplierId = Number(s.id);
                switch (suppliersIdFilterOp) {
                    case 'equals': return supplierId === filterId;
                    case 'greater': return supplierId > filterId;
                    case 'greaterOrEqual': return supplierId >= filterId;
                    case 'less': return supplierId < filterId;
                    case 'lessOrEqual': return supplierId <= filterId;
                    default: return supplierId === filterId;
                }
            });
        }

        // Filtro de nombre
        if (suppliersNameFilter.trim()) {
            const filterVal = suppliersNameFilter.toLowerCase();
            filteredSuppliers = filteredSuppliers.filter(s => {
                const name = (s.name || '').toLowerCase();
                return suppliersNameFilterOp === 'equals' ? name === filterVal : name.includes(filterVal);
            });
        }

        // Filtro de CUIT
        if (suppliersCuitFilter.trim()) {
            const filterVal = suppliersCuitFilter.toLowerCase();
            filteredSuppliers = filteredSuppliers.filter(s => {
                const cuit = (s.cuit || '').toLowerCase();
                return suppliersCuitFilterOp === 'equals' ? cuit === filterVal : cuit.includes(filterVal);
            });
        }

        // Filtro de teléfono
        if (suppliersPhoneFilter.trim()) {
            const filterVal = suppliersPhoneFilter.toLowerCase();
            filteredSuppliers = filteredSuppliers.filter(s => {
                const phone = (s.phone || '').toLowerCase();
                return suppliersPhoneFilterOp === 'equals' ? phone === filterVal : phone.includes(filterVal);
            });
        }

        // Filtro de dirección
        if (suppliersAddressFilter.trim()) {
            const filterVal = suppliersAddressFilter.toLowerCase();
            filteredSuppliers = filteredSuppliers.filter(s => {
                const address = (s.address || '').toLowerCase();
                return suppliersAddressFilterOp === 'equals' ? address === filterVal : address.includes(filterVal);
            });
        }

        // Filtro de producto
        if (suppliersProductFilter.trim()) {
            const filterVal = suppliersProductFilter.toLowerCase();
            filteredSuppliers = filteredSuppliers.filter(s => {
                if (Array.isArray(s.products)) {
                    return s.products.some(p => {
                        const productName = String(p.name || p.productName || p || '').toLowerCase();
                        return suppliersProductFilterOp === 'equals' ? productName === filterVal : productName.includes(filterVal);
                    });
                } else {
                    const productsStr = String(s.products || '').toLowerCase();
                    const productList = productsStr.split(',').map(p => p.trim());
                    return suppliersProductFilterOp === 'equals' 
                        ? productList.some(p => p === filterVal) 
                        : productList.some(p => p.includes(filterVal));
                }
            });
        }

        const results = {
            title: 'Información de Proveedores',
            summary: {
                totalSuppliers: filteredSuppliers.length,
                activeSuppliers: filteredSuppliers.length
            },
            data: filteredSuppliers.map(s => ({
                id: s.id,
                name: s.name,
                cuit: s.cuit || '',
                phone: s.phone || '',
                address: s.address || '',
                products: Array.isArray(s.products) 
                    ? s.products.map(p => p.name || p.productName || p || '').filter(Boolean).join(', ')
                    : (s.products || '')
            }))
        };
        
        setQueryResults(results);
        return results;
    };

    const executeSalesQuery = async () => {
        const hasOtherFilters = salesIdFilter.trim() || salesProductFilter.trim() || salesUserFilter.trim() || salesTotalFilter.trim() || salesQuantityFilter.trim();

        if (!hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese filtros de fecha o use filtros específicos.');
            return;
        }

        let allSales = Array.isArray(sales) ? sales : [];
        if (allSales.length === 0) {
            try {
                const loaded = await loadSales();
                allSales = Array.isArray(loaded) && loaded.length > 0 ? loaded : [];
            } catch (e) {
                allSales = [];
            }
        }

        // Transformar ventas a filas individuales (igual que DataConsultation.js)
        const rows = [];
        for (const s of allSales) {
            const date = s.timestamp || s.created_at || s.date || '';
            let itemsArr = [];
            if (Array.isArray(s.sale_items) && s.sale_items.length > 0) {
                itemsArr = s.sale_items.map(it => ({ 
                    product: it.product_name || it.product || it.name || '', 
                    quantity: Number(it.quantity ?? it.qty ?? 0)||0, 
                    unitPrice: Number(it.price ?? it.unit_price ?? 0)||0, 
                    total: (it.total !== undefined && it.total !== null) ? Number(it.total) : ((Number(it.quantity)||0)*(Number(it.price)||0)) 
                }));
            } else if (Array.isArray(s.items) && s.items.length > 0) {
                itemsArr = s.items.map(it => ({ 
                    product: it.product_name || it.productName || it.product || it.name || '', 
                    quantity: Number(it.quantity ?? it.qty ?? 0)||0, 
                    unitPrice: Number(it.price ?? it.unitPrice ?? it.unit_price ?? 0)||0, 
                    total: (it.total !== undefined && it.total !== null) ? Number(it.total) : ((Number(it.quantity)||0)*(Number(it.price)||0)) 
                }));
            }
            // Fallback: si la venta no tiene items detallados
            if (itemsArr.length === 0) {
                if (s.product) {
                    itemsArr = [{ product: s.product, quantity: s.quantity || 1, total: s.total || s.amount || 0 }];
                } else if (s.total_amount !== undefined || s.total !== undefined || s.amount !== undefined) {
                    const totalVal = Number(s.total_amount ?? s.total ?? s.amount ?? 0) || 0;
                    itemsArr = [{ product: s.product_name || s.product || 'Venta (sin items detallados)', quantity: 1, total: totalVal }];
                }
            }
            const saleUser = s.user || s.user_username || s.user_name || (s.user && s.user.username) || (s.user && s.user.name) || 'Sistema';
            for (const it of itemsArr) { 
                rows.push({ id: s.id ?? null, date, product: it.product, quantity: it.quantity, total: it.total, user: saleUser }); 
            }
        }

        let filtered = [...rows];

        // Filtro de fechas estándar
        if (startDate && endDate) {
            filtered = filtered.filter(s => {
                const saleDate = parseAnyDate(s.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) end.setHours(23, 59, 59, 999);
                return saleDate && start && end && saleDate >= start && saleDate <= end;
            });
        }

        // Filtro de ID
        if (salesIdFilter.trim()) {
            const filterId = Number(salesIdFilter);
            filtered = filtered.filter(s => {
                const saleId = Number(s.id);
                switch (salesIdFilterOp) {
                    case 'equals': return saleId === filterId;
                    case 'lt': return saleId < filterId;
                    case 'lte': return saleId <= filterId;
                    case 'gt': return saleId > filterId;
                    case 'gte': return saleId >= filterId;
                    default: return saleId === filterId;
                }
            });
        }

        // Filtro de producto
        if (salesProductFilter.trim()) {
            const filterVal = salesProductFilter.toLowerCase();
            filtered = filtered.filter(s => {
                const product = (s.product || '').toLowerCase();
                return product.includes(filterVal);
            });
        }

        // Filtro de usuario
        if (salesUserFilter.trim()) {
            const filterVal = salesUserFilter.toLowerCase();
            filtered = filtered.filter(s => {
                const user = (s.user || '').toLowerCase();
                return user.includes(filterVal);
            });
        }

        // Filtro de total
        if (salesTotalFilter.trim()) {
            const filterTotal = parseFloat(salesTotalFilter);
            filtered = filtered.filter(s => {
                const saleTotal = parseFloat(s.total) || 0;
                switch (salesTotalOp) {
                    case 'equals': return saleTotal === filterTotal;
                    case 'gt': return saleTotal > filterTotal;
                    case 'gte': return saleTotal >= filterTotal;
                    case 'lt': return saleTotal < filterTotal;
                    case 'lte': return saleTotal <= filterTotal;
                    default: return saleTotal === filterTotal;
                }
            });
        }

        // Filtro de cantidad
        if (salesQuantityFilter.trim()) {
            const filterQty = parseFloat(salesQuantityFilter);
            filtered = filtered.filter(s => {
                const saleQty = parseFloat(s.quantity) || 0;
                switch (salesQuantityOp) {
                    case 'equals': return saleQty === filterQty;
                    case 'gt': return saleQty > filterQty;
                    case 'gte': return saleQty >= filterQty;
                    case 'lt': return saleQty < filterQty;
                    case 'lte': return saleQty <= filterQty;
                    default: return saleQty === filterQty;
                }
            });
        }

        const totalRevenue = filtered.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

        const results = {
            title: 'Reporte de Ventas',
            summary: {
                totalSales: filtered.length,
                totalRevenue,
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            },
            data: filtered.map(s => ({
                id: s.id,
                date: s.date,
                product: s.product,
                quantity: s.quantity,
                total: s.total,
                user: s.user
            }))
        };

        setQueryResults(results);
        return results;
    };

    const executeOrdersQuery = async () => {
        const hasOtherFilters = ordersIdFilter.trim() || ordersCustomerFilter.trim() || ordersPaymentMethodFilter.length > 0 || ordersStatusFilter.length > 0 || ordersProductFilter.trim() || ordersUnitsFilter.trim();

        if (!hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese filtros de fecha o use filtros específicos.');
            return;
        }

        // Normalizar pedidos
        const normalizedOrders = orders.map(order => {
            let normalizedStatus = order.status || 'Pendiente';
            const statusLower = normalizedStatus.toLowerCase();
            
            if (statusLower.includes('preparación') || statusLower.includes('preparacion')) {
                normalizedStatus = 'En Preparación';
            } else if (statusLower.includes('listo') || statusLower === 'ready') {
                normalizedStatus = 'Listo';
            } else if (statusLower.includes('entregado') || statusLower.includes('delivered')) {
                normalizedStatus = 'Entregado';
            } else if (statusLower.includes('cancelado') || statusLower.includes('cancelled')) {
                normalizedStatus = 'Cancelado';
            } else if (statusLower.includes('pendiente') || statusLower === 'pending') {
                normalizedStatus = 'Pendiente';
            }
            
            return { ...order, status: normalizedStatus };
        });

        let filteredOrders = normalizedOrders;

        // Filtro de fechas estándar
        if (startDate && endDate) {
            filteredOrders = filteredOrders.filter(order => {
                const orderDate = parseAnyDate(order.created_at || order.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) end.setHours(23, 59, 59, 999);
                return orderDate && start && end && orderDate >= start && orderDate <= end;
            });
        }

        // Filtro de ID
        if (ordersIdFilter.trim()) {
            const filterId = Number(ordersIdFilter);
            filteredOrders = filteredOrders.filter(order => {
                const orderId = Number(order.id);
                switch (ordersIdFilterOp) {
                    case 'equals': return orderId === filterId;
                    case 'lt': return orderId < filterId;
                    case 'lte': return orderId <= filterId;
                    case 'gt': return orderId > filterId;
                    case 'gte': return orderId >= filterId;
                    default: return orderId === filterId;
                }
            });
        }

        // Filtro de cliente
        if (ordersCustomerFilter.trim()) {
            const filterVal = ordersCustomerFilter.toLowerCase();
            filteredOrders = filteredOrders.filter(order => {
                const customerName = (order.customerName || order.customer_name || '').toLowerCase();
                return ordersCustomerFilterOp === 'equals' 
                    ? customerName === filterVal 
                    : customerName.includes(filterVal);
            });
        }

        // Filtro por método de pago
        if (ordersPaymentMethodFilter.length > 0) {
            filteredOrders = filteredOrders.filter(order => {
                const paymentMethod = (order.paymentMethod || order.payment_method || '').toLowerCase();
                return ordersPaymentMethodFilter.some(method => paymentMethod.includes(method.toLowerCase()));
            });
        }

        // Filtro por estado
        if (ordersStatusFilter.length > 0) {
            filteredOrders = filteredOrders.filter(order => ordersStatusFilter.includes(order.status));
        }

        // Filtro por producto
        if (ordersProductFilter.trim()) {
            const filterVal = ordersProductFilter.toLowerCase();
            filteredOrders = filteredOrders.filter(order => {
                const items = Array.isArray(order.items) ? order.items : [];
                return items.some(item => {
                    const productName = (item.productName || item.product_name || '').toLowerCase();
                    return productName.includes(filterVal);
                });
            });
        }

        // Filtro por unidades/cantidad
        if (ordersUnitsFilter.trim()) {
            const filterUnits = parseFloat(ordersUnitsFilter);
            filteredOrders = filteredOrders.filter(order => {
                const items = Array.isArray(order.items) ? order.items : [];
                const totalUnits = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
                switch (ordersUnitsFilterOp) {
                    case 'equals': return totalUnits === filterUnits;
                    case 'gt': return totalUnits > filterUnits;
                    case 'gte': return totalUnits >= filterUnits;
                    case 'lt': return totalUnits < filterUnits;
                    case 'lte': return totalUnits <= filterUnits;
                    default: return totalUnits === filterUnits;
                }
            });
        }

        const results = {
            title: 'Reporte de Pedidos',
            summary: {
                totalOrders: filteredOrders.length,
                pendingOrders: filteredOrders.filter(o => o.status === 'Pendiente').length,
                inPreparationOrders: filteredOrders.filter(o => o.status === 'En Preparación').length,
                readyOrders: filteredOrders.filter(o => o.status === 'Listo').length,
                deliveredOrders: filteredOrders.filter(o => o.status === 'Entregado').length,
                canceledOrders: filteredOrders.filter(o => o.status === 'Cancelado').length,
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            },
            data: filteredOrders.map(order => {
                const itemsArray = Array.isArray(order.items) ? order.items : [];
                const productsList = itemsArray.map(it => it.productName || it.product_name || '').filter(Boolean);
                const unitsList = itemsArray.map(it => it.quantity !== undefined ? String(it.quantity) : '').filter(Boolean);
                return {
                    id: order.id,
                    date: order.created_at || order.date,
                    customerName: order.customerName || order.customer_name || '',
                    paymentMethod: order.paymentMethod || order.payment_method || '',
                    status: order.status,
                    items: itemsArray,
                    products: productsList.join(', '),
                    units: unitsList.join(', ')
                };
            })
        };

        setQueryResults(results);
        return results;
    };

    const executePurchasesQuery = async () => {
        const hasOtherFilters = purchasesIdFilter.trim() || purchasesSupplierFilter.trim() || purchasesTotalFilter.trim() || purchasesTypeFilter.length > 0 || purchasesProductFilter.trim();

        if (!hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese filtros de fecha o use filtros específicos.');
            return;
        }

        // Normalizar las compras para asegurar valores consistentes (igual que DataConsultation.js)
        const normalizedPurchases = purchases.map(purchase => {
            const itemsArray = Array.isArray(purchase.items) ? purchase.items.map(it => { 
                const productName = it.productName || it.product_name || it.product || it.name || ''; 
                const quantity = it.quantity ?? it.qty ?? 0; 
                const unitPrice = it.unitPrice ?? it.unit_price ?? it.price ?? 0; 
                const total = it.total ?? it.totalAmount ?? ((quantity ?? 0) * (unitPrice ?? 0)); 
                let category = it.category || it.type || it.productCategory || it.product_category || ''; 
                if ((!category || String(category).trim() === '') && productName) { 
                    try { 
                        const found = (inventory || []).find(p => p && p.name && String(p.name).toLowerCase() === String(productName).toLowerCase()); 
                        if (found && (found.type || found.category)) { 
                            category = found.type || found.category || ''; 
                        } 
                    } catch (e) { } 
                } 
                return { productName, quantity, unitPrice, total, category }; 
            }) : [];
            
            const supplierName = purchase.supplierName || purchase.supplier || '';
            const totalAmount = Number(purchase.totalAmount ?? purchase.total_amount ?? purchase.total ?? 0);
            const detectedTypes = Array.from(new Set(itemsArray.map(i => (i.category || '').toString().toLowerCase()).filter(Boolean)));
            let purchaseType = 'Producto'; 
            if (detectedTypes.length === 0) {
                purchaseType = 'Producto';
            } else if (detectedTypes.length === 1) {
                purchaseType = detectedTypes[0].includes('insumo') ? 'Insumo' : (detectedTypes[0].includes('producto') ? 'Producto' : 'Producto');
            } else {
                purchaseType = 'Mixto';
            }
            
            return { 
                id: purchase.id, 
                date: purchase.created_at || purchase.date, 
                supplier: supplierName, 
                items: itemsArray, 
                total: totalAmount, 
                status: purchase.status || 'Completada', 
                type: purchaseType 
            };
        });

        // Aplicar filtros independientes
        let filtered = normalizedPurchases;

        // Filtro de fechas estándar
        if (startDate && endDate) {
            filtered = filtered.filter(p => {
                const purchaseDate = parseAnyDate(p.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) end.setHours(23, 59, 59, 999);
                return purchaseDate && start && end && purchaseDate >= start && purchaseDate <= end;
            });
        }

        // Filtro de ID
        if (purchasesIdFilter.trim()) {
            const filterId = Number(purchasesIdFilter);
            filtered = filtered.filter(p => {
                const purchaseId = Number(p.id);
                switch (purchasesIdFilterOp) {
                    case 'equals': return purchaseId === filterId;
                    case 'lt': return purchaseId < filterId;
                    case 'lte': return purchaseId <= filterId;
                    case 'gt': return purchaseId > filterId;
                    case 'gte': return purchaseId >= filterId;
                    default: return purchaseId === filterId;
                }
            });
        }

        // Filtro de proveedor
        if (purchasesSupplierFilter.trim()) {
            const filterVal = purchasesSupplierFilter.toLowerCase();
            filtered = filtered.filter(p => {
                const supplier = (p.supplier || '').toLowerCase();
                return purchasesSupplierFilterOp === 'equals' ? supplier === filterVal : supplier.includes(filterVal);
            });
        }

        // Filtro de total
        if (purchasesTotalFilter.trim()) {
            const filterTotal = Number(purchasesTotalFilter);
            filtered = filtered.filter(p => {
                const purchaseTotal = Number(p.total) || 0;
                switch (purchasesTotalFilterOp) {
                    case 'equals': return purchaseTotal === filterTotal;
                    case 'lt': return purchaseTotal < filterTotal;
                    case 'lte': return purchaseTotal <= filterTotal;
                    case 'gt': return purchaseTotal > filterTotal;
                    case 'gte': return purchaseTotal >= filterTotal;
                    default: return purchaseTotal === filterTotal;
                }
            });
        }

        // Filtro de tipos
        if (purchasesTypeFilter.length > 0) {
            filtered = filtered.filter(p => purchasesTypeFilter.includes(p.type));
        }

        // Filtro por nombre de producto
        if (purchasesProductFilter.trim()) {
            filtered = filtered.filter(p => 
                p.items.some(item => 
                    String(item.productName || '').toLowerCase().includes(purchasesProductFilter.toLowerCase())
                )
            );
        }

        // Filtro por cantidad
        if (purchasesQuantityFilter.trim()) {
            filtered = filtered.filter(p => {
                return p.items.some(item => {
                    const itemQuantity = item.quantity || 0;
                    const filterQuantity = Number(purchasesQuantityFilter);
                    switch (purchasesQuantityFilterOp) {
                        case 'equals': return itemQuantity === filterQuantity;
                        case 'greater': return itemQuantity > filterQuantity;
                        case 'greaterOrEqual': return itemQuantity >= filterQuantity;
                        case 'less': return itemQuantity < filterQuantity;
                        case 'lessOrEqual': return itemQuantity <= filterQuantity;
                        default: return itemQuantity === filterQuantity;
                    }
                });
            });
        }

        const totalAmount = filtered.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

        const results = {
            title: 'Reporte de Compras',
            summary: {
                totalPurchases: filtered.length,
                totalAmount,
                byType: {
                    Producto: filtered.filter(p => p.type === 'Producto').length,
                    Insumo: filtered.filter(p => p.type === 'Insumo').length,
                    Mixto: filtered.filter(p => p.type === 'Mixto').length
                },
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            },
            data: filtered.map(p => ({
                id: p.id,
                date: p.date,
                supplier: p.supplier,
                type: p.type,
                items: p.items,
                total: p.total
            }))
        };

        setQueryResults(results);
        return results;
    };

    const executeCashMovementsQuery = async () => {
        const hasOtherFilters = cashIdFilter.trim() || cashAmountFilter.trim() || cashDescriptionFilter.trim() || cashUserFilter.trim() || cashTypeFilter || cashPaymentMethodFilter.length > 0;

        if (!hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese filtros de fecha o use filtros específicos.');
            return;
        }

        let movementsToProcess = cashMovements;
        if (!movementsToProcess || movementsToProcess.length === 0) {
            try {
                const freshMovements = await loadCashMovements();
                movementsToProcess = freshMovements || [];
            } catch (e) {
                movementsToProcess = [];
            }
        }

        const normalized = (movementsToProcess || []).map(m => {
            const rawDate = m.date || m.timestamp || m.created_at || '';
            let type = (m.type || '').toString();
            const tLower = type.toLowerCase();
            if (tLower.startsWith('e') || tLower.includes('entrada')) type = 'Entrada';
            else if (tLower.startsWith('s') || tLower.includes('salida')) type = 'Salida';
            const amount = typeof m.amount === 'number' ? m.amount : parseFloat(m.amount) || 0;
            return { id: m.id, date: rawDate, type, amount, description: m.description || '', user: m.user || 'Sistema', payment_method: m.payment_method || '' };
        });

        let filtered = normalized;

        // Filtro de fechas estándar
        if (startDate && endDate) {
            filtered = filtered.filter(m => {
                const movementDate = parseAnyDate(m.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) end.setHours(23, 59, 59, 999);
                return movementDate && start && end && movementDate >= start && movementDate <= end;
            });
        }

        // Filtro de ID
        if (cashIdFilter.trim()) {
            const filterId = Number(cashIdFilter);
            filtered = filtered.filter(m => {
                const movementId = Number(m.id);
                switch (cashIdFilterOp) {
                    case 'equals': return movementId === filterId;
                    case 'lt': return movementId < filterId;
                    case 'lte': return movementId <= filterId;
                    case 'gt': return movementId > filterId;
                    case 'gte': return movementId >= filterId;
                    default: return movementId === filterId;
                }
            });
        }

        // Filtro de tipo
        if (cashTypeFilter) {
            filtered = filtered.filter(m => m.type === cashTypeFilter);
        }

        // Filtro de método de pago
        if (cashPaymentMethodFilter.length > 0) {
            filtered = filtered.filter(m => {
                const pm = (m.payment_method || '').toLowerCase();
                return cashPaymentMethodFilter.some(method => pm.includes(method.toLowerCase()));
            });
        }

        // Ordenar
        filtered.sort((a, b) => {
            const dateA = parseAnyDate(a.date);
            const dateB = parseAnyDate(b.date);
            if (!dateA || !dateB) return 0;
            return cashSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        const totalIncome = filtered.filter(m => m.type === 'Entrada').reduce((sum, m) => sum + m.amount, 0);
        const totalExpenses = filtered.filter(m => m.type === 'Salida').reduce((sum, m) => sum + m.amount, 0);

        const results = {
            title: 'Movimientos de Caja',
            summary: {
                totalMovements: filtered.length,
                totalIncome: safeToFixed(totalIncome),
                totalExpenses: safeToFixed(totalExpenses),
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            },
            data: filtered.map(m => ({
                id: m.id,
                date: m.date,
                type: m.type,
                amount: m.amount,
                payment_method: m.payment_method,
                description: m.description,
                user: m.user
            }))
        };

        setQueryResults(results);
        return results;
    };

    const executeQuery = async () => {
        if (!selectedQuery) {
            setMessage('Debe seleccionar un tipo de consulta.');
            return;
        }
        if (startDate && endDate) {
            const start = parseAnyDate(startDate);
            const end = parseAnyDate(endDate);
            if (start > end) {
                setMessage('Error: La fecha de inicio no puede ser posterior a la fecha de fin.');
                return;
            }
        }
        setMessage('');
        setIsLoading(true);
        isRunningQueryRef.current = true;

        try {
            let results = null;
            switch (selectedQuery) {
                case 'stock': results = await executeStockQuery(); break;
                case 'proveedores': results = await executeSuppliersQuery(); break;
                case 'ventas': results = await executeSalesQuery(); break;
                case 'compras': results = await executePurchasesQuery(); break;
                case 'pedidos': results = await executeOrdersQuery(); break;
                case 'movimientos_caja': results = await executeCashMovementsQuery(); break;
                default: setMessage('Tipo de consulta no válido.'); return;
            }
            if (results) {
                // Se guarda el tipo que generó los datos: el desplegable puede cambiar después
                // y exportar con el tipo nuevo produciría un PDF con datos de otro reporte.
                setQueryResults({ ...results, queryType: selectedQuery });
            }
        } catch (error) {
            setMessage('Error ejecutando la consulta: ' + (error.message || error));
        } finally {
            setIsLoading(false);
            isRunningQueryRef.current = false;
        }
    };

    const exportData = async () => {
        if (!queryResults) return;
        const queryType = queryResults.queryType || selectedQuery;
        if (queryType !== selectedQuery) { setMessage('Cambiaste el tipo de consulta. Presioná "Consultar" antes de exportar.'); return; }
        try {
            const token = getInMemoryToken && getInMemoryToken();
            const response = await fetch('/api/export-data/', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : undefined },
                body: JSON.stringify({ query_type: queryType, data: queryResults.data, summary: queryResults.summary })
            });
            if (!response.ok) { setMessage('Error al exportar PDF.'); return; }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${queryType}_reporte.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setMessage('PDF exportado correctamente.');
        } catch (error) {
            setMessage('Error al exportar PDF.');
        }
    };

    // Renderizar items de compras con unidades correctas
    const renderCompraItems = (items) => {
        if (!Array.isArray(items)) return String(items || '');
        if (items.length === 0) return '';
        
        return items.map(item => {
            if (typeof item === 'object' && item.productName) {
                const productName = item.productName || item.product_name || item.name || '';
                const quantity = item.quantity || 0;
                
                if (!productName) return '';
                
                // Buscar el producto en inventory para obtener su unidad
                const foundProduct = inventory.find(p => 
                    p && p.name && p.name.toLowerCase() === productName.toLowerCase()
                );
                
                if (foundProduct && quantity > 0) {
                    return formatCompraItemLine(productName, quantity, foundProduct.unit);
                } else if (quantity > 0) {
                    return formatCompraItemLine(productName, quantity, 'u');
                } else {
                    return productName;
                }
            } else {
                return String(item || '');
            }
        }).filter(Boolean).join(', ');
    };

    // Renderizar valor de celda
    const renderCellValue = (value, key) => {
        if (value === null || value === undefined) return '';
        if (key === 'date') {
            try { return formatMovementDate(value); } catch (e) { return String(value); }
        }
        // Para items de compras, usar renderCompraItems
        if (key === 'items' && Array.isArray(value)) {
            return renderCompraItems(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return '';
            if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
                return value.join(', ');
            }
            return value.map(item => {
                if (typeof item === 'string' || typeof item === 'number') return String(item);
                const name = item.productName || item.product_name || item.name || '';
                const qty = item.quantity ?? '';
                return name + (qty !== '' ? ` (${qty})` : '');
            }).filter(Boolean).join('; ');
        }
        if (typeof value === 'object') {
            const name = value.productName || value.product_name || value.name;
            if (name) return name;
            try { return JSON.stringify(value); } catch (e) { return String(value); }
        }
        return String(value);
    };

    // Obtener columnas según el tipo de consulta
    const getColumns = () => {
        switch (selectedQuery) {
            case 'stock':
                return ['id', 'name', 'stock', 'price', 'type', 'status'];
            case 'proveedores':
                return ['id', 'name', 'cuit', 'phone', 'address', 'products'];
            case 'ventas':
                return ['id', 'date', 'product', 'quantity', 'total', 'user'];
            case 'pedidos':
                return ['id', 'date', 'customerName', 'paymentMethod', 'status', 'products', 'units'];
            case 'compras':
                return ['id', 'date', 'supplier', 'type', 'items', 'total'];
            case 'movimientos_caja':
                return ['id', 'date', 'type', 'amount', 'payment_method', 'description', 'user'];
            default:
                return queryResults?.data?.[0] ? Object.keys(queryResults.data[0]) : [];
        }
    };

    // Estilos de input TailwindCSS
    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
    const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";
    const filterRowClass = "flex flex-col gap-1 mb-3";

    return (
        <div className={`flex h-screen bg-gray-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
            {/* Panel izquierdo - Filtros (30%) */}
            <div className="w-[30%] bg-white border-r border-gray-200 overflow-y-auto p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Consultar Datos</h2>
                    {!isFullscreen && (
                        <button 
                            onClick={onClose} 
                            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                        >
                            ×
                        </button>
                    )}
                </div>

                {message && (
                    <div className={`p-3 rounded-md mb-4 text-sm ${message.includes('Error') || message.includes('🚫') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}

                {/* Selector de tipo de consulta */}
                <div className={filterRowClass}>
                    <label className={labelClass}>Tipo de Consulta</label>
                    <select 
                        value={selectedQuery} 
                        onChange={e => { setSelectedQuery(e.target.value); setQueryResults(null); }} 
                        className={selectClass}
                    >
                        <option value="">Seleccionar tipo de consulta</option>
                        <option value="stock">Estado de Stock</option>
                        <option value="proveedores">Información de Proveedores</option>
                        <option value="ventas">Reporte de Ventas</option>
                        <option value="compras">Reporte de Compras</option>
                        <option value="pedidos">Reporte de Pedidos</option>
                        <option value="movimientos_caja">Movimientos de Caja</option>
                    </select>
                </div>

                {/* Filtros de fecha */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={filterRowClass}>
                        <label className={labelClass}>Fecha inicio</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className={inputClass}
                        />
                    </div>
                    <div className={filterRowClass}>
                        <label className={labelClass}>Fecha fin</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* Filtros específicos por consulta */}
                <div className="flex-1 overflow-y-auto">
                    {/* Filtros de Stock */}
                    {selectedQuery === 'stock' && (
                        <div className="space-y-3 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 text-sm">Filtros de Stock</h4>
                            
                            <div className={filterRowClass}>
                                <label className={labelClass}>ID del Producto</label>
                                <div className="flex gap-2">
                                    <select value={stockIdFilterOp} onChange={e => setStockIdFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="greater">&gt;</option>
                                        <option value="greaterOrEqual">≥</option>
                                        <option value="less">&lt;</option>
                                        <option value="lessOrEqual">≤</option>
                                    </select>
                                    <input type="text" value={stockIdFilter} onChange={e => setStockIdFilter(e.target.value)} placeholder="ID" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Nombre</label>
                                <input type="text" value={stockNameFilter} onChange={e => setStockNameFilter(e.target.value)} placeholder="Buscar por nombre..." className={inputClass} />
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Cantidad en Stock</label>
                                <div className="flex gap-2">
                                    <select value={stockQuantityOp} onChange={e => setStockQuantityOp(e.target.value)} className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={stockQuantityFilter} onChange={e => setStockQuantityFilter(e.target.value)} placeholder="Cantidad" className={`flex-1 ${inputClass}`} />
                                    <select value={stockQuantityUnit} onChange={e => setStockQuantityUnit(e.target.value)} className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="Kg">Kg</option>
                                        <option value="L">L</option>
                                        <option value="U">U</option>
                                    </select>
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Precio</label>
                                <div className="flex gap-2">
                                    <select value={stockPriceOp} onChange={e => setStockPriceOp(e.target.value)} className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={stockPriceFilter} onChange={e => setStockPriceFilter(e.target.value)} placeholder="Precio" step="0.01" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Tipo de Producto</label>
                                <select value={stockTypeFilter} onChange={e => setStockTypeFilter(e.target.value)} className={selectClass}>
                                    <option value="">Todos los tipos</option>
                                    <option value="Producto">Producto</option>
                                    <option value="Insumo">Insumo</option>
                                </select>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Estado del Stock</label>
                                <div className="flex flex-wrap gap-3">
                                    {['Stock Alto', 'Stock Medio', 'Stock Bajo'].map(status => (
                                        <label key={status} className="flex items-center gap-1 text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={stockStatusFilter.includes(status)}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setStockStatusFilter(prev => 
                                                        checked ? [...new Set([...prev, status])] : prev.filter(x => x !== status)
                                                    );
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            {status}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros de Proveedores */}
                    {selectedQuery === 'proveedores' && (
                        <div className="space-y-3 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 text-sm">Filtros de Proveedores</h4>
                            
                            <div className={filterRowClass}>
                                <label className={labelClass}>ID del Proveedor</label>
                                <div className="flex gap-2">
                                    <select value={suppliersIdFilterOp} onChange={e => setSuppliersIdFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="greater">&gt;</option>
                                        <option value="greaterOrEqual">≥</option>
                                        <option value="less">&lt;</option>
                                        <option value="lessOrEqual">≤</option>
                                    </select>
                                    <input type="text" value={suppliersIdFilter} onChange={e => setSuppliersIdFilter(e.target.value)} placeholder="ID" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Nombre</label>
                                <div className="flex gap-2">
                                    <select value={suppliersNameFilterOp} onChange={e => setSuppliersNameFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={suppliersNameFilter} onChange={e => setSuppliersNameFilter(e.target.value)} placeholder="Nombre del proveedor" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>CUIT</label>
                                <div className="flex gap-2">
                                    <select value={suppliersCuitFilterOp} onChange={e => setSuppliersCuitFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={suppliersCuitFilter} onChange={e => setSuppliersCuitFilter(e.target.value)} placeholder="CUIT" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Teléfono</label>
                                <div className="flex gap-2">
                                    <select value={suppliersPhoneFilterOp} onChange={e => setSuppliersPhoneFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={suppliersPhoneFilter} onChange={e => setSuppliersPhoneFilter(e.target.value)} placeholder="Teléfono" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Dirección</label>
                                <div className="flex gap-2">
                                    <select value={suppliersAddressFilterOp} onChange={e => setSuppliersAddressFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={suppliersAddressFilter} onChange={e => setSuppliersAddressFilter(e.target.value)} placeholder="Dirección" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Productos/Insumos</label>
                                <div className="flex gap-2">
                                    <select value={suppliersProductFilterOp} onChange={e => setSuppliersProductFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={suppliersProductFilter} onChange={e => setSuppliersProductFilter(e.target.value)} placeholder="Nombre del producto" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros de Ventas */}
                    {selectedQuery === 'ventas' && (
                        <div className="space-y-3 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 text-sm">Filtros de Ventas</h4>
                            
                            
                            
                            <div className={filterRowClass}>
                                <label className={labelClass}>ID de Venta</label>
                                <div className="flex gap-2">
                                    <select value={salesIdFilterOp} onChange={e => setSalesIdFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="text" value={salesIdFilter} onChange={e => setSalesIdFilter(e.target.value)} placeholder="ID" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Producto</label>
                                <input type="text" value={salesProductFilter} onChange={e => setSalesProductFilter(e.target.value)} placeholder="Nombre del producto" className={inputClass} />
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Usuario</label>
                                <input type="text" value={salesUserFilter} onChange={e => setSalesUserFilter(e.target.value)} placeholder="Usuario" className={inputClass} />
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Total</label>
                                <div className="flex gap-2">
                                    <select value={salesTotalOp} onChange={e => setSalesTotalOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={salesTotalFilter} onChange={e => setSalesTotalFilter(e.target.value)} placeholder="Total" step="0.01" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Cantidad</label>
                                <div className="flex gap-2">
                                    <select value={salesQuantityOp} onChange={e => setSalesQuantityOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={salesQuantityFilter} onChange={e => setSalesQuantityFilter(e.target.value)} placeholder="Cantidad" step="0.01" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros de Pedidos */}
                    {selectedQuery === 'pedidos' && (
                        <div className="space-y-3 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 text-sm">Filtros de Pedidos</h4>
                            
                            
                            
                            <div className={filterRowClass}>
                                <label className={labelClass}>ID de Pedido</label>
                                <div className="flex gap-2">
                                    <select value={ordersIdFilterOp} onChange={e => setOrdersIdFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="text" value={ordersIdFilter} onChange={e => setOrdersIdFilter(e.target.value)} placeholder="ID" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Cliente</label>
                                <div className="flex gap-2">
                                    <select value={ordersCustomerFilterOp} onChange={e => setOrdersCustomerFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={ordersCustomerFilter} onChange={e => setOrdersCustomerFilter(e.target.value)} placeholder="Nombre del cliente" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Producto</label>
                                <input type="text" value={ordersProductFilter} onChange={e => setOrdersProductFilter(e.target.value)} placeholder="Nombre del producto" className={inputClass} />
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Método de Pago</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Efectivo', 'Débito', 'Crédito', 'Transferencia'].map(method => (
                                        <label key={method} className="flex items-center gap-1 text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={ordersPaymentMethodFilter.includes(method)}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setOrdersPaymentMethodFilter(prev => 
                                                        checked ? [...new Set([...prev, method])] : prev.filter(x => x !== method)
                                                    );
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            {method}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Estado</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Pendiente', 'En Preparación', 'Listo', 'Entregado', 'Cancelado'].map(status => (
                                        <label key={status} className="flex items-center gap-1 text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={ordersStatusFilter.includes(status)}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setOrdersStatusFilter(prev => 
                                                        checked ? [...new Set([...prev, status])] : prev.filter(x => x !== status)
                                                    );
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            {status}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Unidades</label>
                                <div className="flex gap-2">
                                    <select value={ordersUnitsFilterOp} onChange={e => setOrdersUnitsFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={ordersUnitsFilter} onChange={e => setOrdersUnitsFilter(e.target.value)} placeholder="Cantidad" step="1" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filtros de Compras */}
                    {selectedQuery === 'compras' && (
                        <div className="space-y-3 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 text-sm">Filtros de Compras</h4>
                            
                            
                            
                            <div className={filterRowClass}>
                                <label className={labelClass}>ID de Compra</label>
                                <div className="flex gap-2">
                                    <select value={purchasesIdFilterOp} onChange={e => setPurchasesIdFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="text" value={purchasesIdFilter} onChange={e => setPurchasesIdFilter(e.target.value)} placeholder="ID" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Proveedor</label>
                                <div className="flex gap-2">
                                    <select value={purchasesSupplierFilterOp} onChange={e => setPurchasesSupplierFilterOp(e.target.value)} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="contains">Contiene</option>
                                        <option value="equals">Es igual</option>
                                    </select>
                                    <input type="text" value={purchasesSupplierFilter} onChange={e => setPurchasesSupplierFilter(e.target.value)} placeholder="Nombre del proveedor" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Total</label>
                                <div className="flex gap-2">
                                    <select value={purchasesTotalFilterOp} onChange={e => setPurchasesTotalFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={purchasesTotalFilter} onChange={e => setPurchasesTotalFilter(e.target.value)} placeholder="Total" step="0.01" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Tipo</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Producto', 'Insumo'].map(type => (
                                        <label key={type} className="flex items-center gap-1 text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={purchasesTypeFilter.includes(type)}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setPurchasesTypeFilter(prev => 
                                                        checked ? [...new Set([...prev, type])] : prev.filter(x => x !== type)
                                                    );
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Buscar Producto/Insumo</label>
                                <input type="text" value={purchasesProductFilter} onChange={e => setPurchasesProductFilter(e.target.value)} placeholder="Nombre del producto o insumo" className={inputClass} />
                            </div>
                        </div>
                    )}

                    {/* Filtros de Movimientos de Caja */}
                    {selectedQuery === 'movimientos_caja' && (
                        <div className="space-y-3 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 text-sm">Filtros de Movimientos de Caja</h4>
                            
                            
                            
                            <div className={filterRowClass}>
                                <label className={labelClass}>ID de Movimiento</label>
                                <div className="flex gap-2">
                                    <select value={cashIdFilterOp} onChange={e => setCashIdFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="text" value={cashIdFilter} onChange={e => setCashIdFilter(e.target.value)} placeholder="ID" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Tipo</label>
                                <select value={cashTypeFilter} onChange={e => setCashTypeFilter(e.target.value)} className={selectClass}>
                                    <option value="">Todos</option>
                                    <option value="Entrada">Entrada</option>
                                    <option value="Salida">Salida</option>
                                </select>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Monto</label>
                                <div className="flex gap-2">
                                    <select value={cashAmountFilterOp} onChange={e => setCashAmountFilterOp(e.target.value)} className="w-20 px-2 py-2 border border-gray-300 rounded-md text-sm">
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input type="number" value={cashAmountFilter} onChange={e => setCashAmountFilter(e.target.value)} placeholder="Monto" step="0.01" className={`flex-1 ${inputClass}`} />
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Descripción</label>
                                <input type="text" value={cashDescriptionFilter} onChange={e => setCashDescriptionFilter(e.target.value)} placeholder="Buscar en descripción..." className={inputClass} />
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Usuario</label>
                                <input type="text" value={cashUserFilter} onChange={e => setCashUserFilter(e.target.value)} placeholder="Usuario" className={inputClass} />
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Método de Pago</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Efectivo', 'Débito', 'Crédito', 'Transferencia'].map(method => (
                                        <label key={method} className="flex items-center gap-1 text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={cashPaymentMethodFilter.includes(method)}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setCashPaymentMethodFilter(prev => 
                                                        checked ? [...new Set([...prev, method])] : prev.filter(x => x !== method)
                                                    );
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            {method}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className={filterRowClass}>
                                <label className={labelClass}>Ordenar por</label>
                                <select value={cashSortOrder} onChange={e => setCashSortOrder(e.target.value)} className={selectClass}>
                                    <option value="desc">Más recientes primero</option>
                                    <option value="asc">Más antiguos primero</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Botones de acción */}
                <div className="mt-4 pt-4 border-t space-y-2">
                    <button 
                        onClick={executeQuery} 
                        disabled={isLoading || !selectedQuery}
                        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isLoading ? 'Ejecutando...' : 'Ejecutar Consulta'}
                    </button>
                    <button 
                        onClick={exportData} 
                        disabled={!queryResults}
                        className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        Exportar Datos (PDF)
                    </button>
                </div>
            </div>

            {/* Panel derecho - Resultados (70%) */}
            <div className="w-[70%] bg-gray-50 overflow-auto p-4">
                {queryResults ? (
                    <div className="h-full flex flex-col">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">{queryResults.title}</h3>
                        
                        {/* Resumen */}
                        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {Object.entries(queryResults.summary).map(([key, value]) => {
                                    if (key === 'byType' && typeof value === 'object') {
                                        return (
                                            <div key={key} className="col-span-2">
                                                <span className="text-sm text-gray-500">Por Tipo:</span>
                                                <div className="flex gap-4 mt-1">
                                                    {Object.entries(value).map(([typeKey, typeValue]) => (
                                                        <span key={typeKey} className="text-sm">
                                                            <strong>{typeKey}:</strong> {typeValue}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={key} className="text-sm">
                                            <span className="text-gray-500">{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                                            <span className="font-semibold ml-1">{typeof value === 'number' ? formatNumber(value) : value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tabla de resultados */}
                        <div className="flex-1 bg-white rounded-lg shadow-sm overflow-auto">
                            {queryResults.data && queryResults.data.length > 0 ? (
                                <table className="w-full">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            {getColumns().map(col => (
                                                <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b">
                                                    {headerTranslationMap[col] || col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {queryResults.data.map((row, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                {getColumns().map((col, ci) => (
                                                    <td key={ci} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                        {renderCellValue(row[col], col)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    No hay datos que mostrar para los criterios seleccionados.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg">Seleccione una consulta y haga clic en "Ejecutar Consulta"</p>
                        <p className="text-sm mt-1">Los resultados se mostrarán aquí</p>
                    </div>
                )}
            </div>
        </div>
    );
}
