import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { formatMovementDate } from './utils/date';
import { 
    Search, Calendar, Download, Filter, 
    Package, Users, TrendingUp, ShoppingCart, 
    DollarSign, Truck, ChevronDown, ChevronUp, SlidersHorizontal,
    FileText, AlertCircle, List, ExternalLink
} from 'lucide-react';

// DataConsultation: componente extracto para evitar remounts por cambios en App
// Recibe como props los estados y funciones que necesita para no depender de clausuras
export default function DataConsultation(props) {
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
        safeToFixed = (v) => (Number(v)||0).toFixed(2)
    } = props;

    // mount/unmount side-effects intentionally silent in production UI
    useEffect(() => { return () => {}; }, []);

    // Estado para UI de filtros avanzados
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    
    // Estados para filtros colapsables
    const [showQueryDateSection, setShowQueryDateSection] = useState(true); 
    const [showStockStatusFilter, setShowStockStatusFilter] = useState(false); 
    const [showCashStatusFilter, setShowCashStatusFilter] = useState(false); 
    const [showOrdersStatusFilter, setShowOrdersStatusFilter] = useState(false); 
    const [showPaymentMethodFilter, setShowPaymentMethodFilter] = useState(false); 

    const [selectedQuery, setSelectedQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Filtros para la consulta de stock (filtros independientes)
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
    
    // Filtros para la consulta de ventas (filtros independientes)
    const [salesIdFilter, setSalesIdFilter] = useState('');
    const [salesIdFilterOp, setSalesIdFilterOp] = useState('equals');
    const [salesProductFilter, setSalesProductFilter] = useState('');
    const [salesUserFilter, setSalesUserFilter] = useState('');
    const [salesTotalFilter, setSalesTotalFilter] = useState('');
    const [salesTotalOp, setSalesTotalOp] = useState('equals');
    const [salesQuantityFilter, setSalesQuantityFilter] = useState('');
    const [salesQuantityOp, setSalesQuantityOp] = useState('equals');

    // Filtros independientes para movimientos de caja
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
    
    // Filtros independientes para pedidos
    const [ordersIdFilter, setOrdersIdFilter] = useState('');
    const [ordersIdFilterOp, setOrdersIdFilterOp] = useState('equals');
    const [ordersCustomerFilter, setOrdersCustomerFilter] = useState('');
    const [ordersCustomerFilterOp, setOrdersCustomerFilterOp] = useState('contains');
    const [ordersPaymentMethodFilter, setOrdersPaymentMethodFilter] = useState([]); 
    const [ordersStatusFilter, setOrdersStatusFilter] = useState([]); 
    const [ordersProductFilter, setOrdersProductFilter] = useState(''); 
    const [ordersUnitsFilter, setOrdersUnitsFilter] = useState(''); 
    const [ordersUnitsFilterOp, setOrdersUnitsFilterOp] = useState('equals'); 
    
    // Filtros independientes para compras
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
    
    // Filtros independientes para proveedores
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
    
    const [queryResultsState, _setQueryResultsState] = useState(null);
    const queryResults = queryResultsState;
    const lastQueryResultsRef = React.useRef(null);
    const isRunningQueryRef = React.useRef(false);

    const setQueryResults = (val) => {
        _setQueryResultsState(val);
        lastQueryResultsRef.current = val;
    };

    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {}, [queryResults]);

    const loadActiveQuery = async () => {
        try {
            const token = getInMemoryToken && getInMemoryToken();
            if (!token) return;
            if (isRunningQueryRef.current) return;
            setIsLoading(true);
            setMessage('');
            const response = await api.get('/user-queries/active_query/');
            if (response.data) {
                setSelectedQuery(response.data.query_type);
                setStartDate(response.data.start_date || '');
                setEndDate(response.data.end_date || '');
                if (!queryResults && response.data.results_data) {
                    // El tipo debe viajar junto a los datos para que la exportación no los mezcle
                    setQueryResults({ ...response.data.results_data, queryType: response.data.query_type });
                }
                setMessage('');
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                // Error cargando consulta activa
            }
        } finally { setIsLoading(false); }
    };

    const saveQueryToBackend = async (queryType, sDate, eDate, results) => {
        const payload = { query_type: queryType, start_date: sDate || null, end_date: eDate || null, results_data: results };
        try {
            const listResp = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
            const items = Array.isArray(listResp.data) ? listResp.data : (listResp.data?.results || []);
            if (items && items.length > 0) {
                const existing = items[0];
                const id = existing.id;
                try { const patchResp = await api.patch(`/user-queries/${id}/`, payload); if (patchResp?.data) return; } catch (patchErr) {}
            }
            const postResp = await api.post('/user-queries/', payload);
            if (postResp?.data) return;
        } catch (error) {
            try {
                const listResp2 = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
                const items2 = Array.isArray(listResp2.data) ? listResp2.data : (listResp2.data?.results || []);
                if (items2 && items2.length > 0) {
                    const existing = items2[0]; const id = existing.id; const patchResp2 = await api.patch(`/user-queries/${id}/`, payload); if (patchResp2?.data) return;
                }
            } catch (recErr) { }
        }
    };

    const clearActiveQuery = async () => { try { await api.post('/user-queries/clear_active_query/'); } catch (error) { } };

    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;

        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        }

        if (typeof dateStr === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        }

        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDateForDisplay = (dateStr) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const executeStockQuery = async () => {
        const formatStockWithUnit = (stock, unit) => {
            const stockNum = parseFloat(stock) || 0;
            if (!unit || unit === 'u' || unit === 'unidades' || unit === 'Unidades') {
                return `${stockNum}U`;
            } else if (unit === 'g' || unit === 'gramos') {
                const kg = (stockNum / 1000).toFixed(3);
                return `${parseFloat(kg)}Kg`;
            } else if (unit === 'ml' || unit === 'mililitros') {
                const liters = (stockNum / 1000).toFixed(3);
                return `${parseFloat(liters)}L`;
            }
            return `${stockNum}${unit}`;
        };

        let filteredInventory = [...(inventory || [])];

        if (stockIdFilter) {
            const filterValue = parseInt(stockIdFilter);
            if (!isNaN(filterValue)) {
                filteredInventory = filteredInventory.filter(item => {
                    const itemId = parseInt(item.id);
                    switch (stockIdFilterOp) {
                        case 'equals': return itemId === filterValue;
                        case 'greater': return itemId > filterValue;
                        case 'greaterOrEqual': return itemId >= filterValue;
                        case 'less': return itemId < filterValue;
                        case 'lessOrEqual': return itemId <= filterValue;
                        default: return true;
                    }
                });
            }
        }

        if (stockNameFilter) {
            filteredInventory = filteredInventory.filter(item => 
                String(item.name || '').toLowerCase().includes(stockNameFilter.toLowerCase())
            );
        }

        if (stockQuantityFilter) {
            filteredInventory = filteredInventory.filter(item => {
                const itemQuantity = parseFloat(item.stock) || 0;
                const filterQuantity = parseFloat(stockQuantityFilter) || 0;
                const itemUnit = (item.unit || 'u').toLowerCase();
                const filterUnit = stockQuantityUnit.toLowerCase();
                
                let normalizedItemQuantity = itemQuantity;
                let normalizedFilterQuantity = filterQuantity;
                
                if (itemUnit !== filterUnit) {
                    if (filterUnit === 'kg' && itemUnit === 'g') {
                        normalizedItemQuantity = itemQuantity / 1000;
                    } else if (filterUnit === 'l' && itemUnit === 'ml') {
                        normalizedItemQuantity = itemQuantity / 1000;
                    } else if (filterUnit === 'u' && (itemUnit === 'unidades' || itemUnit === '')) {
                        normalizedItemQuantity = itemQuantity;
                    } else {
                        return false;
                    }
                }
                
                switch (stockQuantityOp) {
                    case 'equals': return Math.abs(normalizedItemQuantity - normalizedFilterQuantity) < 0.001;
                    case 'gt': return normalizedItemQuantity > normalizedFilterQuantity;
                    case 'gte': return normalizedItemQuantity >= normalizedFilterQuantity;
                    case 'lt': return normalizedItemQuantity < normalizedFilterQuantity;
                    case 'lte': return normalizedItemQuantity <= normalizedFilterQuantity;
                    default: return normalizedItemQuantity === normalizedFilterQuantity;
                }
            });
        }

        if (stockPriceFilter) {
            filteredInventory = filteredInventory.filter(item => {
                const itemPrice = parseFloat(item.price || item.unit_price || 0);
                const filterPrice = parseFloat(stockPriceFilter) || 0;
                
                switch (stockPriceOp) {
                    case 'equals': return Math.abs(itemPrice - filterPrice) < 0.01;
                    case 'gt': return itemPrice > filterPrice;
                    case 'gte': return itemPrice >= filterPrice;
                    case 'lt': return itemPrice < filterPrice;
                    case 'lte': return itemPrice <= filterPrice;
                    default: return itemPrice === filterPrice;
                }
            });
        }

        if (stockTypeFilter) {
            filteredInventory = filteredInventory.filter(item => 
                (item.type || item.category || '').toLowerCase() === stockTypeFilter.toLowerCase()
            );
        }

        if (stockStatusFilter.length > 0) {
            filteredInventory = filteredInventory.filter(item => {
                const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
                const stock = parseFloat(item.stock) || 0;
                const itemStatus = stock < threshold ? 'Stock Bajo' : stock < (threshold * 2) ? 'Stock Medio' : 'Stock Alto';
                return stockStatusFilter.includes(itemStatus);
            });
        }

        const computeTotals = (itemsList) => {
            const totals = { productos: { kg: 0, l: 0, u: 0 }, insumos: { kg: 0, l: 0, u: 0 } };
            
            itemsList.forEach(item => {
                const stockNum = parseFloat(item.stock) || 0;
                const category = (item.type || item.category || '').toLowerCase();
                const unit = (item.unit || 'u').toLowerCase();
                
                if (category === 'producto') {
                    if (unit === 'g') {
                        totals.productos.kg += stockNum / 1000;
                    } else if (unit === 'ml') {
                        totals.productos.l += stockNum / 1000;
                    } else {
                        totals.productos.u += stockNum;
                    }
                } else if (category === 'insumo') {
                    if (unit === 'g') {
                        totals.insumos.kg += stockNum / 1000;
                    } else if (unit === 'ml') {
                        totals.insumos.l += stockNum / 1000;
                    } else {
                        totals.insumos.u += stockNum;
                    }
                }
            });
            
            const formatTotal = (value, unitSymbol) => {
                if (value === 0) return null;
                return `${value.toFixed(2)}${unitSymbol}`;
            };
            
            const productTotals = [
                formatTotal(totals.productos.kg, 'Kg'),
                formatTotal(totals.productos.l, 'L'),
                formatTotal(totals.productos.u, 'U')
            ].filter(Boolean);
            
            const insumoTotals = [
                formatTotal(totals.insumos.kg, 'Kg'),
                formatTotal(totals.insumos.l, 'L'),
                formatTotal(totals.insumos.u, 'U')
            ].filter(Boolean);
            
            return {
                productos: productTotals.length > 0 ? productTotals.join(' + ') : '0',
                insumos: insumoTotals.length > 0 ? insumoTotals.join(' + ') : '0'
            };
        };

        const stockTotals = computeTotals(filteredInventory);

        const productos = filteredInventory.filter(item => (item.type || item.category || '').toLowerCase() === 'producto');
        const insumos = filteredInventory.filter(item => (item.type || item.category || '').toLowerCase() === 'insumo');

        const results = {
            title: 'Estado del Stock',
            summary: {
                totalProducts: productos.length,
                totalInsumos: insumos.length,
                lowStockItems: filteredInventory.filter(item => {
                    const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
                    return (parseFloat(item.stock) || 0) < threshold;
                }).length,
                totalStock: `Productos: ${stockTotals.productos} | Insumos: ${stockTotals.insumos}`
            },
            data: filteredInventory.map(item => ({
                id: item.id,
                name: item.name,
                stock: formatStockWithUnit(item.stock, item.unit),
                type: item.type || item.category,
                price: item.price,
                status: (() => {
                    const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
                    const stock = parseFloat(item.stock) || 0;
                    return stock < threshold ? 'Stock Bajo' : stock < (threshold * 2) ? 'Stock Medio' : 'Stock Alto';
                })()
            }))
        };
        
        setQueryResults(results);
        return results;
    };

    const executeSuppliersQuery = async () => {
        const hasFilters = suppliersIdFilter.trim() || suppliersNameFilter.trim() || suppliersCuitFilter.trim() || 
                          suppliersPhoneFilter.trim() || suppliersAddressFilter.trim() || suppliersProductFilter.trim();

        let filteredSuppliers = suppliers;

        if (suppliersIdFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const supplierId = Number(supplier.id);
                const filterId = Number(suppliersIdFilter);
                
                switch (suppliersIdFilterOp) {
                    case 'equals': return supplierId === filterId;
                    case 'lt': return supplierId < filterId;
                    case 'lte': return supplierId <= filterId;
                    case 'gt': return supplierId > filterId;
                    case 'gte': return supplierId >= filterId;
                    default: return supplierId === filterId;
                }
            });
        }

        if (suppliersNameFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const name = String(supplier.name || '').toLowerCase();
                const filterValue = suppliersNameFilter.toLowerCase();
                
                switch (suppliersNameFilterOp) {
                    case 'equals': return name === filterValue;
                    case 'contains': return name.includes(filterValue);
                    default: return name.includes(filterValue);
                }
            });
        }

        if (suppliersCuitFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const cuit = String(supplier.cuit || '').toLowerCase();
                const filterValue = suppliersCuitFilter.toLowerCase();
                
                switch (suppliersCuitFilterOp) {
                    case 'equals': return cuit === filterValue;
                    case 'contains': return cuit.includes(filterValue);
                    default: return cuit.includes(filterValue);
                }
            });
        }

        if (suppliersPhoneFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const phone = String(supplier.phone || '').toLowerCase();
                const filterValue = suppliersPhoneFilter.toLowerCase();
                
                switch (suppliersPhoneFilterOp) {
                    case 'equals': return phone === filterValue;
                    case 'contains': return phone.includes(filterValue);
                    default: return phone.includes(filterValue);
                }
            });
        }

        if (suppliersAddressFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const address = String(supplier.address || '').toLowerCase();
                const filterValue = suppliersAddressFilter.toLowerCase();
                
                switch (suppliersAddressFilterOp) {
                    case 'equals': return address === filterValue;
                    case 'contains': return address.includes(filterValue);
                    default: return address.includes(filterValue);
                }
            });
        }

        if (suppliersProductFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const filterValue = suppliersProductFilter.toLowerCase().trim();
                
                if (Array.isArray(supplier.products)) {
                    return supplier.products.some(product => {
                        const productName = String(product.name || product.productName || product || '').toLowerCase().trim();
                        switch (suppliersProductFilterOp) {
                            case 'equals': return productName === filterValue;
                            case 'contains': return productName.includes(filterValue);
                            default: return productName.includes(filterValue);
                        }
                    });
                } else {
                    const productsStr = String(supplier.products || '');
                    const productList = productsStr.split(',').map(p => p.toLowerCase().trim());
                    switch (suppliersProductFilterOp) {
                        case 'equals': return productList.some(product => product === filterValue);
                        case 'contains': return productList.some(product => product.includes(filterValue));
                        default: return productList.some(product => product.includes(filterValue));
                    }
                }
            });
        }

        const results = { 
            title: 'Información de Proveedores', 
            summary: { 
                totalSuppliers: filteredSuppliers.length,
                activeSuppliers: filteredSuppliers.length,
                filtersApplied: hasFilters ? 'Sí' : 'No'
            }, 
            data: filteredSuppliers.map(supplier => ({
                id: supplier.id,
                name: supplier.name,
                cuit: supplier.cuit,
                phone: supplier.phone,
                address: supplier.address,
                products: Array.isArray(supplier.products) 
                    ? supplier.products.map(p => p.name || p.productName || p || '').filter(Boolean).join(', ')
                    : (supplier.products || '')
            }))
        };
        
        setQueryResults(results);
        return results;
    };

    const executeSalesQuery = async () => {
        const hasOtherFilters = salesIdFilter || salesProductFilter || salesUserFilter || salesTotalFilter || salesQuantityFilter;
        
        if (!hasOtherFilters && !startDate && !endDate) {
            setMessage('Por favor, ingrese al menos una fecha de inicio o una fecha de fin, o use filtros específicos.');
            return;
        }

        let allSales = Array.isArray(sales) ? sales : [];
        if ((!Array.isArray(allSales) || allSales.length === 0)) {
            try { 
                const loaded = await loadSales(); 
                allSales = Array.isArray(loaded) && loaded.length > 0 ? loaded : (Array.isArray(sales) ? sales : []); 
            } catch (e) { 
                allSales = Array.isArray(sales) ? sales : []; 
            }
        }
        
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
        
        let filteredSales = rows;
        
        if (salesIdFilter) {
            const filterValue = parseInt(salesIdFilter);
            if (!isNaN(filterValue)) {
                filteredSales = filteredSales.filter(sale => {
                    const saleId = parseInt(sale.id);
                    switch (salesIdFilterOp) {
                        case 'equals': return saleId === filterValue;
                        case 'greater': return saleId > filterValue;
                        case 'greaterOrEqual': return saleId >= filterValue;
                        case 'less': return saleId < filterValue;
                        case 'lessOrEqual': return saleId <= filterValue;
                        default: return true;
                    }
                });
            }
        }
        
        if (startDate || endDate) {
            filteredSales = filteredSales.filter(sale => {
                const saleDate = parseAnyDate(sale.date);
                const start = startDate ? parseAnyDate(startDate) : null;
                const end = endDate ? parseAnyDate(endDate) : null;
                if (!saleDate) return false;
                if (start && saleDate < start) return false;
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    if (saleDate > end) return false;
                }
                return true;
            });
        }
        
        if (salesProductFilter) {
            filteredSales = filteredSales.filter(sale => 
                String(sale.product || '').toLowerCase().includes(salesProductFilter.toLowerCase())
            );
        }
        
        if (salesUserFilter) {
            filteredSales = filteredSales.filter(sale => 
                String(sale.user || '').toLowerCase().includes(salesUserFilter.toLowerCase())
            );
        }
        
        if (salesTotalFilter) {
            filteredSales = filteredSales.filter(sale => {
                const saleTotal = Number(sale.total) || 0;
                const filterTotal = Number(salesTotalFilter) || 0;
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
        
        if (salesQuantityFilter) {
            filteredSales = filteredSales.filter(sale => {
                const saleQuantity = Number(sale.quantity) || 0;
                const filterQuantity = Number(salesQuantityFilter) || 0;
                switch (salesQuantityOp) {
                    case 'equals': return saleQuantity === filterQuantity;
                    case 'gt': return saleQuantity > filterQuantity;
                    case 'gte': return saleQuantity >= filterQuantity;
                    case 'lt': return saleQuantity < filterQuantity;
                    case 'lte': return saleQuantity <= filterQuantity;
                    default: return saleQuantity === filterQuantity;
                }
            });
        }
        
        const results = { 
            title: 'Reporte de Ventas', 
            summary: { 
                totalSales: filteredSales.length, 
                totalRevenue: filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0),
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` 
                    : startDate ? `Desde ${formatDateForDisplay(startDate)}` 
                    : endDate ? `Hasta ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredSales.map(r=>({ id: r.id, date: r.date, product: r.product, quantity: r.quantity, total: r.total, user: r.user })) 
        };
        
        setQueryResults(results);
        return results;
    };

    const executePurchasesQuery = async () => {
        const hasOtherFilters = purchasesIdFilter.trim() || purchasesSupplierFilter.trim() || purchasesTotalFilter.trim() || purchasesTypeFilter.length > 0 || purchasesProductFilter.trim();
        
        if (!hasOtherFilters && !startDate && !endDate) {
            setMessage('Por favor, ingrese al menos una fecha de inicio o una fecha de fin, o use filtros específicos.');
            return;
        }

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

        let filteredPurchases = normalizedPurchases;

        if (startDate || endDate) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseDate = parseAnyDate(purchase.date);
                const start = startDate ? parseAnyDate(startDate) : null;
                const end = endDate ? parseAnyDate(endDate) : null;
                if (!purchaseDate) return false;
                if (start && purchaseDate < start) return false;
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    if (purchaseDate > end) return false;
                }
                return true;
            });
        }
        
        if (purchasesIdFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseId = Number(purchase.id);
                const filterId = Number(purchasesIdFilter);
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
        
        if (purchasesSupplierFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const supplierName = String(purchase.supplier || '').toLowerCase();
                const filterValue = purchasesSupplierFilter.toLowerCase();
                switch (purchasesSupplierFilterOp) {
                    case 'equals': return supplierName === filterValue;
                    case 'contains': return supplierName.includes(filterValue);
                    default: return supplierName.includes(filterValue);
                }
            });
        }
        
        if (purchasesTotalFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseTotal = Number(purchase.total) || 0;
                const filterTotal = Number(purchasesTotalFilter) || 0;
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
        
        if (purchasesTypeFilter.length > 0) {
            filteredPurchases = filteredPurchases.filter(purchase => 
                purchasesTypeFilter.includes(purchase.type)
            );
        }
        
        if (purchasesProductFilter) {
            filteredPurchases = filteredPurchases.filter(purchase => 
                purchase.items.some(item => 
                    String(item.productName || '').toLowerCase().includes(purchasesProductFilter.toLowerCase())
                )
            );
        }
        
        if (purchasesQuantityFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                return purchase.items.some(item => {
                    const productName = item.productName || '';
                    let itemQuantity = item.quantity || 0;
                    const foundProduct = inventory.find(p => 
                        p && p.name && p.name.toLowerCase() === productName.toLowerCase()
                    );
                    
                    if (foundProduct) {
                        const productUnit = foundProduct.unit;
                        if (purchasesQuantityUnit === 'Kg' && productUnit === 'g') {
                        } else if (purchasesQuantityUnit === 'L' && productUnit === 'ml') {
                        } else if (purchasesQuantityUnit === 'U' && (productUnit !== 'g' && productUnit !== 'ml')) {
                        } else { return false; }
                    } else {
                        if (purchasesQuantityUnit !== 'U') return false;
                    }
                    
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
        
        const results = { 
            title: 'Reporte de Compras', 
            summary: { 
                totalPurchases: filteredPurchases.length, 
                totalAmount: filteredPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0),
                byType: {
                    Producto: filteredPurchases.filter(p => p.type === 'Producto').length,
                    Insumo: filteredPurchases.filter(p => p.type === 'Insumo').length
                },
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` 
                    : startDate ? `Desde ${formatDateForDisplay(startDate)}` 
                    : endDate ? `Hasta ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredPurchases.map(p => ({
                id: p.id, date: p.date, supplier: p.supplier, total: p.total, type: p.type, items: p.items
            }))
        };
        setQueryResults(results);
        return results;
    };

    const executeOrdersQuery = async () => {
        const hasOtherFilters = ordersIdFilter.trim() || ordersCustomerFilter.trim() || ordersPaymentMethodFilter.length > 0 || ordersStatusFilter.length > 0 || ordersProductFilter.trim() || ordersUnitsFilter.trim();
        
        if (!hasOtherFilters && !startDate && !endDate) {
            setMessage('Por favor, ingrese al menos una fecha de inicio o una fecha de fin, o use filtros específicos.');
            return;
        }

        const normalizedOrders = orders.map(order => {
            let normalizedStatus = order.status || 'Pendiente';
            const statusLower = normalizedStatus.toLowerCase();
            if (statusLower.includes('preparación') || statusLower.includes('preparacion')) {
                normalizedStatus = 'En Preparación';
            } else if (statusLower.includes('listo') || statusLower === 'ready') {
                normalizedStatus = 'Listo';
            } else if (statusLower.includes('entregado') || statusLower.includes('delivered') || statusLower.includes('enviado')) {
                normalizedStatus = 'Entregado';
            } else if (statusLower.includes('cancelado') || statusLower.includes('cancelled')) {
                normalizedStatus = 'Cancelado';
            } else if (statusLower.includes('pendiente') || statusLower === 'pending') {
                normalizedStatus = 'Pendiente';
            }
            return { ...order, status: normalizedStatus };
        });

        let filteredOrders = normalizedOrders;

        if (startDate || endDate) {
            filteredOrders = filteredOrders.filter(order => {
                const orderDate = parseAnyDate(order.created_at || order.date);
                const start = startDate ? parseAnyDate(startDate) : null;
                const end = endDate ? parseAnyDate(endDate) : null;
                if (!orderDate) return false;
                if (start && orderDate < start) return false;
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    if (orderDate > end) return false;
                }
                return true;
            });
        }
        
        if (ordersIdFilter.trim()) {
            filteredOrders = filteredOrders.filter(order => {
                const orderId = Number(order.id);
                const filterId = Number(ordersIdFilter);
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
        
        if (ordersCustomerFilter.trim()) {
            filteredOrders = filteredOrders.filter(order => {
                const customerName = String(order.customerName || order.customer_name || '').toLowerCase();
                const filterValue = ordersCustomerFilter.toLowerCase();
                switch (ordersCustomerFilterOp) {
                    case 'equals': return customerName === filterValue;
                    case 'contains': return customerName.includes(filterValue);
                    default: return customerName.includes(filterValue);
                }
            });
        }
        
        if (ordersPaymentMethodFilter.length > 0) {
            filteredOrders = filteredOrders.filter(order => {
                const paymentMethod = (order.paymentMethod || order.payment_method || '').toLowerCase();
                return ordersPaymentMethodFilter.some(method => {
                    return paymentMethod.includes(method.toLowerCase());
                });
            });
        }
        
        if (ordersStatusFilter.length > 0) {
            filteredOrders = filteredOrders.filter(order => {
                return ordersStatusFilter.includes(order.status);
            });
        }
        
        if (ordersProductFilter.trim()) {
            filteredOrders = filteredOrders.filter(order => {
                const itemsArray = Array.isArray(order.items) ? order.items : [];
                const filterValue = ordersProductFilter.toLowerCase();
                return itemsArray.some(item => {
                    const productName = String(item.productName || item.product_name || item.product || '').toLowerCase();
                    return productName.includes(filterValue);
                });
            });
        }
        
        if (ordersUnitsFilter.trim()) {
            const filterValue = parseFloat(ordersUnitsFilter);
            if (!isNaN(filterValue)) {
                filteredOrders = filteredOrders.filter(order => {
                    const itemsArray = Array.isArray(order.items) ? order.items : [];
                    return itemsArray.some(item => {
                        const quantity = parseFloat(item.quantity || 0);
                        switch (ordersUnitsFilterOp) {
                            case 'equals': return quantity === filterValue;
                            case 'greater': return quantity > filterValue;
                            case 'greaterOrEqual': return quantity >= filterValue;
                            case 'less': return quantity < filterValue;
                            case 'lessOrEqual': return quantity <= filterValue;
                            default: return quantity === filterValue;
                        }
                    });
                });
            }
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
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` 
                    : startDate ? `Desde ${formatDateForDisplay(startDate)}` 
                    : endDate ? `Hasta ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredOrders.map(order => { 
                let itemsArray = Array.isArray(order.items) ? order.items : [];
                if (ordersProductFilter.trim() || ordersUnitsFilter.trim()) {
                    itemsArray = itemsArray.filter(item => {
                        let matches = true;
                        if (ordersProductFilter.trim()) {
                            const productName = String(item.productName || item.product_name || item.product || '').toLowerCase();
                            matches = matches && productName.includes(ordersProductFilter.toLowerCase());
                        }
                        if (ordersUnitsFilter.trim()) {
                            const filterValue = parseFloat(ordersUnitsFilter);
                            if (!isNaN(filterValue)) {
                                const quantity = parseFloat(item.quantity || 0);
                                switch (ordersUnitsFilterOp) {
                                    case 'equals': matches = matches && quantity === filterValue; break;
                                    case 'greater': matches = matches && quantity > filterValue; break;
                                    case 'greaterOrEqual': matches = matches && quantity >= filterValue; break;
                                    case 'less': matches = matches && quantity < filterValue; break;
                                    case 'lessOrEqual': matches = matches && quantity <= filterValue; break;
                                }
                            }
                        }
                        return matches;
                    });
                }
                
                const productsList = itemsArray.map(it => it.productName || it.product_name || it.product || '').filter(Boolean); 
                const unitsList = itemsArray.map(it => (it.quantity !== undefined && it.quantity !== null) ? String(it.quantity) : '').filter(Boolean); 
                return { 
                    id: order.id, 
                    date: order.created_at || order.date, 
                    customerName: order.customerName || order.customer_name || '', 
                    paymentMethod: order.paymentMethod || order.payment_method || '', 
                    status: order.status,
                    items: itemsArray, 
                    products: productsList.join(', '), 
                    units: unitsList.join(', '), 
                    customer_name: order.customerName || order.customer_name || '', 
                    payment_method: order.paymentMethod || order.payment_method || '' 
                }; 
            }) 
        };
        setQueryResults(results);
        return results;
    };

    const executeCashMovementsQuery = async () => {
        const hasOtherFilters = cashIdFilter.trim() || cashAmountFilter.trim() || cashDescriptionFilter.trim() || cashUserFilter.trim() || cashTypeFilter || cashPaymentMethodFilter.length > 0;
        
        if (!hasOtherFilters && !startDate && !endDate) {
            setMessage('Por favor, ingrese al menos una fecha de inicio o una fecha de fin, o use filtros específicos.');
            return;
        }

        let movementsToProcess = cashMovements;
        if (!movementsToProcess || movementsToProcess.length === 0) {
            try {
                const freshMovements = await loadCashMovements();
                movementsToProcess = freshMovements;
            } catch (e) {
                movementsToProcess = [];
            }
        }

        const normalized = (movementsToProcess || []).map(m => {
            const rawDate = m.date || m.timestamp || m.created_at || m.date_iso || '';
            let type = (m.type || '').toString();
            const tLower = type.toLowerCase();
            if (tLower.startsWith('e') || tLower.includes('entrada') || tLower === 'in') type = 'Entrada';
            else if (tLower.startsWith('s') || tLower.includes('salida') || tLower === 'out') type = 'Salida';
            else type = m.type || type;
            const amount = (() => { const a = m.amount; const num = typeof a === 'number' ? a : parseFloat(a); return isNaN(num) ? 0 : num; })();
            return { id: m.id, date: rawDate, type, amount, description: m.description || '', user: m.user || (m.user_username || m.user_name) || 'Sistema', payment_method: m.payment_method || '', _raw: m };
        });

        let filteredMovements = normalized;

        if (startDate || endDate) {
            filteredMovements = filteredMovements.filter(movement => {
                const movementDate = parseAnyDate(movement.date);
                const start = startDate ? parseAnyDate(startDate) : null;
                const end = endDate ? parseAnyDate(endDate) : null;
                if (!movementDate) return false;
                if (start && movementDate < start) return false;
                if (end) {
                    end.setHours(23, 59, 59, 999);
                    if (movementDate > end) return false;
                }
                return true;
            });
        }
        
        if (cashIdFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const movementId = Number(movement.id);
                const filterId = Number(cashIdFilter);
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
        
        if (cashAmountFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const movementAmount = Number(movement.amount) || 0;
                const filterAmount = Number(cashAmountFilter) || 0;
                switch (cashAmountFilterOp) {
                    case 'equals': return movementAmount === filterAmount;
                    case 'lt': return movementAmount < filterAmount;
                    case 'lte': return movementAmount <= filterAmount;
                    case 'gt': return movementAmount > filterAmount;
                    case 'gte': return movementAmount >= filterAmount;
                    default: return movementAmount === filterAmount;
                }
            });
        }
        
        if (cashDescriptionFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const description = String(movement.description || '').toLowerCase();
                const filterValue = cashDescriptionFilter.toLowerCase();
                switch (cashDescriptionFilterOp) {
                    case 'equals': return description === filterValue;
                    case 'contains': return description.includes(filterValue);
                    default: return description.includes(filterValue);
                }
            });
        }
        
        if (cashUserFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const user = String(movement.user || '').toLowerCase();
                const filterValue = cashUserFilter.toLowerCase();
                switch (cashUserFilterOp) {
                    case 'equals': return user === filterValue;
                    case 'contains': return user.includes(filterValue);
                    default: return user.includes(filterValue);
                }
            });
        }
        
        if (cashTypeFilter) {
            filteredMovements = filteredMovements.filter(movement => movement.type === cashTypeFilter);
        }
        
        if (cashPaymentMethodFilter.length > 0) {
            filteredMovements = filteredMovements.filter(movement => {
                const description = (movement.description || '').toLowerCase();
                return cashPaymentMethodFilter.some(method => {
                    const methodLower = method.toLowerCase();
                    return description.includes(methodLower) || (movement.payment_method || '').toLowerCase().includes(methodLower);
                });
            });
        }

        filteredMovements.sort((a, b) => {
            const dateA = parseAnyDate(a.date);
            const dateB = parseAnyDate(b.date);
            if (!dateA || !dateB) return 0;
            if (cashSortOrder === 'desc') {
                return dateB.getTime() - dateA.getTime();
            } else {
                return dateA.getTime() - dateB.getTime();
            }
        });

        const totalIncome = filteredMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : 0), 0);
        const totalExpenses = filteredMovements.reduce((sum, m) => sum + (m.type === 'Salida' ? m.amount : 0), 0);
        const results = { 
            title: 'Reporte de Movimientos de Caja', 
            summary: { 
                totalMovements: filteredMovements.length, 
                totalIncome: safeToFixed(totalIncome), 
                totalExpenses: safeToFixed(totalExpenses),
                period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` 
                    : startDate ? `Desde ${formatDateForDisplay(startDate)}` 
                    : endDate ? `Hasta ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredMovements.map(movement => ({ id: movement.id, date: movement.date, type: movement.type, amount: movement.amount, description: movement.description, user: movement.user, payment_method: movement.payment_method })) 
        };
        
        setQueryResults(results);
        return results;
    };

    const exportData = async () => {
        if (!queryResults) { setMessage('🚫 Error: No hay datos para exportar.'); return; }
        const queryType = queryResults.queryType || selectedQuery;
        if (queryType !== selectedQuery) { setMessage('🚫 Cambiaste el tipo de consulta. Presioná "Consultar" antes de exportar.'); return; }
        try {
            const token = getInMemoryToken && getInMemoryToken();
            const response = await fetch('/api/export-data/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : undefined }, body: JSON.stringify({ query_type: queryType, data: queryResults.data, summary: queryResults.summary }) });
            if (!response.ok) { setMessage('🚫 Error al exportar PDF.'); return; }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${queryType}_reporte.pdf`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); setMessage('✅ PDF exportado correctamente.');
        } catch (error) { setMessage('🚫 Error al exportar PDF.'); }
    };

    const executeQuery = async () => {
        if (!selectedQuery) { setMessage('🚫 Debe seleccionar un tipo de consulta.'); return; }
        if (startDate && endDate) { const start = parseAnyDate(startDate); const end = parseAnyDate(endDate); if (start > end) { setMessage('🚫 Error: La fecha de inicio no puede ser posterior a la fecha de fin.'); return; } }
        setMessage(''); setIsLoading(true); isRunningQueryRef.current = true;
        try {
            let results = null;
            switch (selectedQuery) {
                case 'stock': results = await executeStockQuery(); break;
                case 'proveedores': results = await executeSuppliersQuery(); break;
                case 'ventas': results = await executeSalesQuery(); break;
                case 'compras': results = await executePurchasesQuery(); break;
                case 'pedidos': results = await executeOrdersQuery(); break;
                case 'movimientos_caja': results = await executeCashMovementsQuery(); break;
                default: setMessage('🚫 Error: Tipo de consulta no válido.'); return;
            }
            if (results) {
                // Se guarda el tipo que generó los datos: el desplegable puede cambiar después
                // y exportar con el tipo nuevo produciría un PDF con datos de otro reporte.
                const stamped = { ...results, queryType: selectedQuery };
                setQueryResults(stamped);
                try { await saveQueryToBackend(selectedQuery, startDate, endDate, stamped); } catch (e) { }
            }
        } catch (error) { setMessage('🚫 Error ejecutando la consulta: ' + (error.message || error)); }
        finally { setIsLoading(false); isRunningQueryRef.current = false; }
    };

    const renderCellValue = (value, key) => {
        if (value === null || value === undefined) return '';
        if (key === 'date') { try { return formatMovementDate(value); } catch (e) {} }
        if (Array.isArray(value)) {
            if (value.length === 0) return '';
            if (value.every(v => v === null || ['string','number','boolean'].includes(typeof v))) return value.filter(v => v !== null && v !== undefined).join(', ');
            return value.map(item => {
                if (item === null || item === undefined) return '';
                if (typeof item === 'string' || typeof item === 'number') return String(item);
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
        return String(value);
    };

    const handleOpenInNewTab = () => {
        const url = `${window.location.origin}${window.location.pathname}?consultas-fullscreen=true`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <>
            <div className="hidden wide:flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-lg border border-slate-200">
                    <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <Search size={40} className="text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">Consultar Datos</h2>
                    <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                        Para una mejor experiencia en pantallas grandes, utiliza la vista ampliada 
                        que se abrirá en una nueva pestaña con todas las funcionalidades de consulta.
                    </p>
                    <button 
                        onClick={handleOpenInNewTab}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
                    >
                        <ExternalLink size={22} />
                        Abrir Vista Ampliada
                    </button>
                    <p className="text-xs text-slate-400 mt-6">
                        Se abrirá en una nueva pestaña del navegador
                    </p>
                </div>
            </div>

            <div className="wide:hidden h-full flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800">
                
                <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-shrink-0 z-30 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded text-white">
                            <Search size={18} className="sm:w-5 sm:h-5" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold">Consultar Datos</h2>
                    </div>
                    <button 
                        onClick={exportData}
                        disabled={!queryResults}
                        className="flex items-center gap-1 sm:gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 sm:px-4 py-2 rounded font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={14} />
                        <span className="hidden xs:inline">Exportar PDF</span>
                    </button>
                </div>

                {message && (
                    <div className={`px-4 py-2 text-xs font-bold text-center ${message.includes('🚫') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}

                <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4">
                    
                    {/* TARJETA DE CONTROLES */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-shrink-0">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 shadow-sm">
                            <button
                                onClick={() => setShowQueryDateSection(!showQueryDateSection)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <FileText size={16} />
                                    Consulta y Rango de Fechas
                                </span>
                                {showQueryDateSection ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {showQueryDateSection && (
                                <div className="p-4 space-y-4 border-b border-blue-200">
                                    <div className="w-full">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Consulta *</label>
                                        <div className="relative">
                                            <select 
                                                value={selectedQuery} 
                                                onChange={e => { setSelectedQuery(e.target.value); setQueryResults(null); setShowAdvancedFilters(true); }} 
                                                className="w-full appearance-none pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- Elige una consulta --</option>
                                                <option value="stock">Estado de Stock</option>
                                                <option value="proveedores">Información de Proveedores</option>
                                                <option value="ventas">Reporte de Ventas</option>
                                                <option value="compras">Reporte de Compras</option>
                                                <option value="pedidos">Reporte de Pedidos</option>
                                                <option value="movimientos_caja">Movimientos de Caja</option>
                                            </select>
                                            <FileText size={16} className="absolute left-3 top-3 text-blue-600 pointer-events-none" />
                                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Ocultar Fechas para Stock y Proveedores */}
                                    {selectedQuery !== 'stock' && selectedQuery !== 'proveedores' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Inicio</label>
                                                <div className="relative">
                                                    <Calendar size={14} className="absolute left-2 sm:left-3 top-3 text-slate-400" />
                                                    <input 
                                                        type="date" 
                                                        value={startDate} 
                                                        onChange={e => setStartDate(e.target.value)} 
                                                        className="w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Fin</label>
                                                <div className="relative">
                                                    <Calendar size={14} className="absolute left-2 sm:left-3 top-3 text-slate-400" />
                                                    <input 
                                                        type="date" 
                                                        value={endDate} 
                                                        onChange={e => setEndDate(e.target.value)} 
                                                        className="w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Botones de Filtros y Consultar FUERA DEL REBATIBLE */}
                        <div className="p-3 sm:p-4 bg-white flex justify-end gap-2 sm:gap-3 rounded-b-xl">
                            {selectedQuery && (
                                <button 
                                    type="button" 
                                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 sm:px-4 py-2.5 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <SlidersHorizontal size={14} />
                                    <span className="hidden xs:inline">
                                        {showAdvancedFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                                    </span>
                                </button>
                            )}
                            <button 
                                onClick={executeQuery} 
                                disabled={isLoading} 
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-70 min-h-[42px]"
                            >
                                {isLoading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        <Search size={16} />
                                        <span className="hidden xs:inline">Consultar</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* FILTROS AVANZADOS COLAPSABLES */}
                        {selectedQuery && showAdvancedFilters && (
                            <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4 lg:p-6">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 sm:mb-4">Filtros Específicos</h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                                    
                                    {selectedQuery === 'stock' && (
                                        <>
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID Producto</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={stockIdFilterOp} onChange={e => setStockIdFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="greater">&gt;</option>
                                                            <option value="greaterOrEqual">≥</option>
                                                            <option value="less">&lt;</option>
                                                            <option value="lessOrEqual">≤</option>
                                                        </select>
                                                        <input type="text" value={stockIdFilter} onChange={e => setStockIdFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="ID..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre</label>
                                                    <input type="text" value={stockNameFilter} onChange={e => setStockNameFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none" placeholder="Buscar nombre..." />
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cantidad</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={stockQuantityOp} onChange={e => setStockQuantityOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                        </select>
                                                        <input type="number" value={stockQuantityFilter} onChange={e => setStockQuantityFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Cant..." />
                                                        <select value={stockQuantityUnit} onChange={e => setStockQuantityUnit(e.target.value)} className="w-12 sm:w-14 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="Kg">Kg</option>
                                                            <option value="L">L</option>
                                                            <option value="U">U</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Precio</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={stockPriceOp} onChange={e => setStockPriceOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                        </select>
                                                        <input type="number" value={stockPriceFilter} onChange={e => setStockPriceFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Monto..." />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
                                                    <select value={stockTypeFilter} onChange={e => setStockTypeFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none">
                                                        <option value="">Todos</option>
                                                        <option value="Producto">Producto</option>
                                                        <option value="Insumo">Insumo</option>
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => setShowStockStatusFilter(!showStockStatusFilter)}
                                                    className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                                                >
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Estado</label>
                                                    {showStockStatusFilter ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                                                </button>
                                                {showStockStatusFilter && (
                                                    <div className="flex flex-wrap gap-2 sm:gap-3 text-xs pt-2">
                                                        {['Stock Alto', 'Stock Medio', 'Stock Bajo'].map(st => (
                                                            <label key={st} className="flex items-center gap-1 cursor-pointer">
                                                                <input type="checkbox" checked={stockStatusFilter.includes(st)} onChange={e => { const chk = e.target.checked; setStockStatusFilter(p => chk ? [...p, st] : p.filter(x => x !== st)); }} />
                                                                <span className="text-[10px] sm:text-xs">{st.replace('Stock ', '')}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {selectedQuery === 'ventas' && (
                                        <>
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID Venta</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={salesIdFilterOp} onChange={e => setSalesIdFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="greater">&gt;</option>
                                                            <option value="greaterOrEqual">≥</option>
                                                            <option value="less">&lt;</option>
                                                            <option value="lessOrEqual">≤</option>
                                                        </select>
                                                        <input type="text" value={salesIdFilter} onChange={e => setSalesIdFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="ID..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Producto</label>
                                                    <input type="text" value={salesProductFilter} onChange={e => setSalesProductFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none" placeholder="Nombre..." />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Usuario</label>
                                                    <input type="text" value={salesUserFilter} onChange={e => setSalesUserFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none" placeholder="Usuario..." />
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Total Venta</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={salesTotalOp} onChange={e => setSalesTotalOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                        </select>
                                                        <input type="number" value={salesTotalFilter} onChange={e => setSalesTotalFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Monto..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cantidad Items</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={salesQuantityOp} onChange={e => setSalesQuantityOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                        </select>
                                                        <input type="number" value={salesQuantityFilter} onChange={e => setSalesQuantityFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Cant..." />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {selectedQuery === 'movimientos_caja' && (
                                        <>
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID Movimiento</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={cashIdFilterOp} onChange={e => setCashIdFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                        </select>
                                                        <input type="text" value={cashIdFilter} onChange={e => setCashIdFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="ID..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Monto</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={cashAmountFilterOp} onChange={e => setCashAmountFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                        </select>
                                                        <input type="number" value={cashAmountFilter} onChange={e => setCashAmountFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Monto..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
                                                    <select value={cashTypeFilter} onChange={e => setCashTypeFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none">
                                                        <option value="">Todos</option>
                                                        <option value="Entrada">Entrada</option>
                                                        <option value="Salida">Salida</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={cashDescriptionFilterOp} onChange={e => setCashDescriptionFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={cashDescriptionFilter} onChange={e => setCashDescriptionFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Texto..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Usuario</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={cashUserFilterOp} onChange={e => setCashUserFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={cashUserFilter} onChange={e => setCashUserFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Usuario..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Orden Fecha</label>
                                                    <select value={cashSortOrder} onChange={e => setCashSortOrder(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none">
                                                        <option value="desc">Más recientes primero</option>
                                                        <option value="asc">Más antiguos primero</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <button
                                                    onClick={() => setShowCashStatusFilter(!showCashStatusFilter)}
                                                    className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                                                >
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Tipo y Método de Pago</label>
                                                    {showCashStatusFilter ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                                                </button>
                                                {showCashStatusFilter && (
                                                    <div className="space-y-3 pt-2">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Tipo</label>
                                                            <select value={cashTypeFilter} onChange={e => setCashTypeFilter(e.target.value)} className="w-full text-xs p-1.5 border rounded outline-none">
                                                                <option value="">Todos</option>
                                                                <option value="Entrada">Entrada</option>
                                                                <option value="Salida">Salida</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Método de Pago</label>
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                {['debito', 'credito', 'transferencia', 'efectivo'].map(method => (
                                                                    <label key={method} className="flex items-center gap-1 cursor-pointer">
                                                                        <input type="checkbox" checked={cashPaymentMethodFilter.includes(method)} onChange={e => { const chk = e.target.checked; setCashPaymentMethodFilter(p => chk ? [...p, method] : p.filter(x => x !== method)); }} />
                                                                        <span className="text-[10px] sm:text-xs">{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {selectedQuery === 'pedidos' && (
                                        <>
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID Pedido</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={ordersIdFilterOp} onChange={e => setOrdersIdFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                        </select>
                                                        <input type="text" value={ordersIdFilter} onChange={e => setOrdersIdFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="ID..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cliente</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={ordersCustomerFilterOp} onChange={e => setOrdersCustomerFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={ordersCustomerFilter} onChange={e => setOrdersCustomerFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Cliente..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Producto</label>
                                                    <input type="text" value={ordersProductFilter} onChange={e => setOrdersProductFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none" placeholder="Nombre prod..." />
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <button
                                                    onClick={() => setShowOrdersStatusFilter(!showOrdersStatusFilter)}
                                                    className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                                                >
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Estado</label>
                                                    {showOrdersStatusFilter ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                                                </button>
                                                {showOrdersStatusFilter && (
                                                    <div className="grid grid-cols-2 gap-1 sm:gap-2 text-xs pt-2">
                                                        {['Pendiente', 'En Preparación', 'Listo', 'Entregado', 'Cancelado'].map(st => (
                                                            <label key={st} className="flex items-center gap-1 cursor-pointer">
                                                                <input type="checkbox" checked={ordersStatusFilter.includes(st)} onChange={e => { const chk = e.target.checked; setOrdersStatusFilter(p => chk ? [...p, st] : p.filter(x => x !== st)); }} />
                                                                <span className="truncate text-[10px] sm:text-xs">{st}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="pt-2 border-t border-slate-100">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Unidades</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={ordersUnitsFilterOp} onChange={e => setOrdersUnitsFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="greater">&gt;</option>
                                                            <option value="greaterOrEqual">≥</option>
                                                            <option value="less">&lt;</option>
                                                            <option value="lessOrEqual">≤</option>
                                                        </select>
                                                        <input type="number" value={ordersUnitsFilter} onChange={e => setOrdersUnitsFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Cant..." />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <button
                                                    onClick={() => setShowPaymentMethodFilter(!showPaymentMethodFilter)}
                                                    className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 p-2 rounded border border-slate-200 hover:border-slate-300 transition-colors"
                                                >
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Método de Pago</label>
                                                    {showPaymentMethodFilter ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                                                </button>
                                                {showPaymentMethodFilter && (
                                                    <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                                                        {['efectivo', 'debito', 'credito', 'transferencia'].map(method => (
                                                            <label key={method} className="flex items-center gap-1 cursor-pointer">
                                                                <input type="checkbox" checked={ordersPaymentMethodFilter.includes(method)} onChange={e => { const chk = e.target.checked; setOrdersPaymentMethodFilter(p => chk ? [...p, method] : p.filter(x => x !== method)); }} />
                                                                <span className="text-[10px] sm:text-xs">{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {selectedQuery === 'compras' && (
                                        <>
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID Compra</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={purchasesIdFilterOp} onChange={e => setPurchasesIdFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                        </select>
                                                        <input type="text" value={purchasesIdFilter} onChange={e => setPurchasesIdFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="ID..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Proveedor</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={purchasesSupplierFilterOp} onChange={e => setPurchasesSupplierFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={purchasesSupplierFilter} onChange={e => setPurchasesSupplierFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Proveedor..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Producto/Insumo</label>
                                                    <input type="text" value={purchasesProductFilter} onChange={e => setPurchasesProductFilter(e.target.value)} className="w-full text-xs p-1.5 mt-1 border rounded outline-none" placeholder="Buscar..." />
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Total</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={purchasesTotalFilterOp} onChange={e => setPurchasesTotalFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                        </select>
                                                        <input type="number" value={purchasesTotalFilter} onChange={e => setPurchasesTotalFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Monto..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cantidad (Items)</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={purchasesQuantityFilterOp} onChange={e => setPurchasesQuantityFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="greater">&gt;</option>
                                                            <option value="greaterOrEqual">≥</option>
                                                            <option value="less">&lt;</option>
                                                            <option value="lessOrEqual">≤</option>
                                                        </select>
                                                        <input type="number" value={purchasesQuantityFilter} onChange={e => setPurchasesQuantityFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Cant..." />
                                                        <select value={purchasesQuantityUnit} onChange={e => setPurchasesQuantityUnit(e.target.value)} className="w-12 sm:w-14 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="Kg">Kg</option>
                                                            <option value="L">L</option>
                                                            <option value="U">U</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tipos</label>
                                                    <div className="flex gap-3 text-xs">
                                                        {['Producto', 'Insumo'].map(t => (
                                                            <label key={t} className="flex items-center gap-1 cursor-pointer">
                                                                <input type="checkbox" checked={purchasesTypeFilter.includes(t)} onChange={e => { const chk = e.target.checked; setPurchasesTypeFilter(p => chk ? [...p, t] : p.filter(x => x !== t)); }} />
                                                                <span className="text-[10px] sm:text-xs">{t}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {selectedQuery === 'proveedores' && (
                                        <>
                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID Proveedor</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={suppliersIdFilterOp} onChange={e => setSuppliersIdFilterOp(e.target.value)} className="w-14 sm:w-16 text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="equals">=</option>
                                                            <option value="lt">&lt;</option>
                                                            <option value="lte">≤</option>
                                                            <option value="gt">&gt;</option>
                                                            <option value="gte">≥</option>
                                                        </select>
                                                        <input type="text" value={suppliersIdFilter} onChange={e => setSuppliersIdFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="ID..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={suppliersNameFilterOp} onChange={e => setSuppliersNameFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={suppliersNameFilter} onChange={e => setSuppliersNameFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Nombre..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">CUIT</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={suppliersCuitFilterOp} onChange={e => setSuppliersCuitFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={suppliersCuitFilter} onChange={e => setSuppliersCuitFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="CUIT..." />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-3 rounded border border-slate-200 space-y-3 shadow-sm">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Teléfono</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={suppliersPhoneFilterOp} onChange={e => setSuppliersPhoneFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={suppliersPhoneFilter} onChange={e => setSuppliersPhoneFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Teléfono..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Dirección</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={suppliersAddressFilterOp} onChange={e => setSuppliersAddressFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={suppliersAddressFilter} onChange={e => setSuppliersAddressFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Dirección..." />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Producto/Insumo que vende</label>
                                                    <div className="flex gap-1 mt-1">
                                                        <select value={suppliersProductFilterOp} onChange={e => setSuppliersProductFilterOp(e.target.value)} className="w-[85px] sm:w-[95px] lg:w-[100px] text-xs p-1.5 border rounded bg-slate-50 outline-none">
                                                            <option value="contains">Contiene</option>
                                                            <option value="equals">Igual</option>
                                                        </select>
                                                        <input type="text" value={suppliersProductFilter} onChange={e => setSuppliersProductFilter(e.target.value)} className="flex-1 text-xs p-1.5 border rounded outline-none min-w-0" placeholder="Producto..." />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                </div>
                            </div>
                        )}
                    </div>

                    {/* TARJETAS KPI (Resumen) */}
                    {queryResults && queryResults.summary && (
                        <div className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4">
                            {Object.entries(queryResults.summary).map(([key, value]) => {
                                if (key === 'byType' && typeof value === 'object' && value !== null) {
                                    return (
                                        <div key={key} className="bg-white p-2 sm:p-3 rounded-lg border border-slate-200 shadow-sm min-w-[120px] sm:min-w-[150px] flex-1">
                                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Por Tipo</span>
                                            <div className="text-xs sm:text-sm font-bold text-slate-700">
                                                {Object.entries(value).map(([tKey, tVal]) => (
                                                    <div key={tKey} className="flex justify-between border-b border-slate-50 last:border-0 py-0.5">
                                                        <span className="text-slate-500">{tKey}:</span>
                                                        <span>{tVal}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={key} className="bg-white p-2 sm:p-3 rounded-lg border border-slate-200 shadow-sm min-w-[100px] sm:min-w-[130px] flex-1">
                                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block truncate" title={headerTranslationMap[key] || key}>
                                            {headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                        </span>
                                        <span className="text-base sm:text-xl font-bold text-slate-800">
                                            {typeof value === 'number' ? value.toLocaleString() : value}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* TABLA DE RESULTADOS */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[200px] sm:min-h-[300px] max-h-[50vh] sm:max-h-[60vh]">
                        {!queryResults ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-4 sm:p-8 bg-slate-50/50">
                                <div className="bg-white p-3 sm:p-4 rounded-full shadow-sm mb-3">
                                    <Search size={28} className="sm:w-8 sm:h-8 text-slate-300" />
                                </div>
                                <h3 className="font-bold text-slate-600 text-sm sm:text-base">Esperando Parámetros</h3>
                                <p className="text-[10px] sm:text-xs mt-1 text-center max-w-sm">Configura la consulta y presiona "Consultar".</p>
                            </div>
                        ) : queryResults.data && queryResults.data.length > 0 ? (
                            <>
                                <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                                    <h3 className="font-bold text-slate-700 text-xs sm:text-sm truncate">{queryResults.title}</h3>
                                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap ml-2">{queryResults.data.length} registros</span>
                                </div>
                                <div className="flex-1 overflow-x-auto overflow-y-auto">
                                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[500px] text-xs sm:text-sm">
                                        {(() => {
                                            const sample = queryResults.data[0] || {};
                                            let cols = Object.keys(sample).filter(k => k !== '_raw');
                                            
                                            if (selectedQuery === 'ventas' || (sample.product && sample.quantity !== undefined && sample.total !== undefined)) {
                                                cols = ['id','date','product','quantity','total','user'];
                                            } else if (selectedQuery === 'movimientos_caja') {
                                                cols = ['id', 'date', 'type', 'amount', 'payment_method', 'description', 'user'];
                                            } else if (sample.customerName || sample.customer_name) {
                                                cols = ['id','date','customerName','paymentMethod','status','products','units'];
                                            } else if (selectedQuery === 'compras') {
                                                cols = ['id', 'date', 'supplier', 'type', 'items', 'total'];
                                            } else if (selectedQuery === 'proveedores') {
                                                cols = ['id', 'name', 'cuit', 'phone', 'address', 'products'];
                                            }

                                            const numericCols = ['quantity', 'total', 'amount', 'units'];

                                            return (
                                                <>
                                                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                                        <tr>
                                                            {cols.map(key => (
                                                                <th key={key} className={`px-2 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50 ${numericCols.includes(key) ? 'text-right' : ''}`}>
                                                                    {headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {queryResults.data.map((row, index) => (
                                                            <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                                                {cols.map((k, ci) => (
                                                                    <td key={ci} className={`px-2 sm:px-4 py-1.5 sm:py-2 ${numericCols.includes(k) ? 'text-right font-mono' : 'text-slate-700'}`}>
                                                                        {k === 'items' && selectedQuery === 'compras' 
                                                                            ? (Array.isArray(row[k]) ? row[k].map(it => `${it.productName||it.name||''} (${it.quantity||0})`).join(', ') : String(row[k]))
                                                                            : renderCellValue(row[k] ?? row[k === 'products' ? 'items' : k], k)
                                                                        }
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </>
                                            );
                                        })()}
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-4 sm:p-8">
                                <AlertCircle size={28} className="sm:w-8 sm:h-8 text-orange-400 mb-3" />
                                <h3 className="font-bold text-slate-600 text-sm sm:text-base">No se encontraron datos</h3>
                                <p className="text-[10px] sm:text-xs mt-1 text-center">Intenta ajustando los filtros o el rango de fechas.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}