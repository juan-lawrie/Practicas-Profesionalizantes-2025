import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { nameOptions, productNameOptions, sameName } from '../utils/filterOptions';

const PurchaseHistory = ({ purchases, onDeletePurchase, confirmDelete, onCancelDelete, userRole, inventory = [], suppliers = [] }) => {
    // Estados para filtros
    const [purchasesIdFilter, setPurchasesIdFilter] = useState('');
    const [purchasesIdFilterOp, setPurchasesIdFilterOp] = useState('equals');
    const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState('');
    const [purchasesTotalFilter, setPurchasesTotalFilter] = useState('');
    const [purchasesTotalFilterOp, setPurchasesTotalFilterOp] = useState('equals');
    
    // NUEVOS ESTADOS DE FECHA (Simplificados)
    const [purchasesDateFrom, setPurchasesDateFrom] = useState('');
    const [purchasesDateTo, setPurchasesDateTo] = useState('');

    const [purchasesTypeFilter, setPurchasesTypeFilter] = useState([]);
    const [purchasesProductFilter, setPurchasesProductFilter] = useState('');
    const [purchasesQuantityFilter, setPurchasesQuantityFilter] = useState('');
    const [purchasesQuantityFilterOp, setPurchasesQuantityFilterOp] = useState('equals');
    const [purchasesQuantityUnit, setPurchasesQuantityUnit] = useState('Kg');
    
    // Estados para filtros colapsables
    const [isCollapsible, setIsCollapsible] = useState(false);
    const [showFilters, setShowFilters] = useState(true);

    // Detectar tamaño de pantalla para hacer filtros colapsables en <= 1649px
    useEffect(() => {
        const checkWidth = () => {
            const collapsible = typeof window !== 'undefined' && window.innerWidth <= 1649;
            setIsCollapsible(collapsible);
            if (!collapsible) setShowFilters(true);
        };
        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    // Formatear fecha como año/mes/dia hora:minutos
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    };

    // Obtener nombre completo de la unidad
    const getUnitName = (unit) => {
        switch (unit?.toLowerCase()) {
            case 'kg':
            case 'g':
                return 'Kilogramo';
            case 'l':
            case 'ml':
                return 'Litro';
            case 'u':
            case 'unidades':
            default:
                return 'Unidad';
        }
    };

    // Obtener etiqueta de precio según unidad
    const getPriceLabel = (unit) => {
        const unitName = getUnitName(unit);
        return `Precio por ${unitName}`;
    };
    
    // Normalizar y filtrar compras
    const normalizedPurchases = purchases.map(purchase => {
        const itemsArray = Array.isArray(purchase.items) ? purchase.items.map(it => { 
            const productName = it.productName || it.product_name || it.product || it.name || ''; 
            const quantity = it.quantity ?? it.qty ?? 0; 
            const unitPrice = it.unitPrice ?? it.unit_price ?? it.price ?? 0; 
            const total = it.total ?? it.totalAmount ?? ((quantity ?? 0) * (unitPrice ?? 0)); 
            const unit = it.unit || 'u';
            let category = it.category || it.type || it.productCategory || it.product_category || ''; 
            if ((!category || String(category).trim() === '') && productName) { 
                try { 
                    const found = (inventory || []).find(p => p && p.name && String(p.name).toLowerCase() === String(productName).toLowerCase()); 
                    if (found && (found.type || found.category)) { 
                        category = found.type || found.category || ''; 
                    } 
                } catch (e) { } 
            } 
            return { productName, quantity, unitPrice, total, category, unit }; 
        }) : [];
        
        const supplierName = purchase.supplier_name || purchase.supplier || '';
        const totalAmount = Number(purchase.total_amount ?? purchase.total ?? 0);
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
            type: purchaseType,
            approved_by_name: purchase.approved_by_name,
            original: purchase
        };
    });
    
    const supplierOptions = nameOptions([
        ...(suppliers || []).map(supplier => supplier.name),
        ...normalizedPurchases.map(purchase => purchase.supplier),
    ]);
    const productOptions = productNameOptions(inventory, {
        extraNames: normalizedPurchases.flatMap(purchase => purchase.items.map(item => item.productName)),
    });

    let filteredPurchases = normalizedPurchases;

    // 1. FILTRO DE FECHAS (Corrección de zona horaria y formato)
    if (purchasesDateFrom || purchasesDateTo) {
        filteredPurchases = filteredPurchases.filter(purchase => {
            if (!purchase.date) return false;
            
            // Convertimos la fecha de la compra a un objeto Date
            const purchaseDate = new Date(purchase.date);
            if (isNaN(purchaseDate.getTime())) return false;
            
            // Normalizamos a la medianoche local para evitar saltos de día por la zona horaria
            purchaseDate.setHours(0, 0, 0, 0);

            if (purchasesDateFrom) {
                // Extraemos año, mes y día directamente del string YYYY-MM-DD
                const [year, month, day] = purchasesDateFrom.split('-');
                const startDate = new Date(year, month - 1, day);
                startDate.setHours(0, 0, 0, 0);
                
                if (purchaseDate < startDate) return false;
            }

            if (purchasesDateTo) {
                const [year, month, day] = purchasesDateTo.split('-');
                const endDate = new Date(year, month - 1, day);
                endDate.setHours(0, 0, 0, 0);
                
                if (purchaseDate > endDate) return false;
            }

            return true;
        });
    }
    
    // 2. Filtro de ID
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
    
    // 3. Filtro de proveedor
    if (purchasesSupplierFilter) {
        filteredPurchases = filteredPurchases.filter(purchase => sameName(purchase.supplier, purchasesSupplierFilter));
    }
    
    // 4. Filtro de total
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
    
    // 5. Filtro de tipos
    if (purchasesTypeFilter.length > 0) {
        filteredPurchases = filteredPurchases.filter(purchase => 
            purchasesTypeFilter.includes(purchase.type)
        );
    }
    
    // 6. Filtro por nombre de producto/insumo
    if (purchasesProductFilter) {
        filteredPurchases = filteredPurchases.filter(purchase => 
            purchase.items.some(item => sameName(item.productName, purchasesProductFilter))
        );
    }
    
    // 7. Filtro por cantidad
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
                    } else {
                        return false;
                    }
                } else {
                    if (purchasesQuantityUnit !== 'U') {
                        return false;
                    }
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
    
    // Ordenar las compras filtradas por fecha
    const sortedPurchases = [...filteredPurchases].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="purchase-history-container">
            <h3 className="text-base xs:text-lg sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">Historial de Compras</h3>
            
            {/* Filtros de Compras */}
            <div className="mb-4 sm:mb-5 p-2 sm:p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h4 className="text-sm sm:text-base font-semibold text-slate-700">Filtros de Compras</h4>
                    {isCollapsible && (
                        <button
                            onClick={() => setShowFilters(prev => !prev)}
                            className="px-2 py-1 text-xs sm:text-sm bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors flex items-center gap-1"
                        >
                            <svg 
                                className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {showFilters ? 'Ocultar' : 'Mostrar'}
                        </button>
                    )}
                </div>
                
                <div className={`${showFilters ? 'block' : 'hidden'}`}>
                {/* Fila principal de filtros - flex-wrap para adaptarse */}
                <div className="flex flex-wrap items-end gap-1.5 sm:gap-2 md:gap-3 mb-3 sm:mb-4">
                    
                    {/* Filtro de ID */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <label className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">ID:</label>
                        <select 
                            value={purchasesIdFilterOp} 
                            onChange={e => setPurchasesIdFilterOp(e.target.value)}
                            className="px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 md:py-1.5 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="equals">=</option>
                            <option value="lt">&lt;</option>
                            <option value="lte">=</option>
                            <option value="gt">&gt;</option>
                            <option value="gte">=</option>
                        </select>
                        <input 
                            type="number" 
                            value={purchasesIdFilter} 
                            onChange={e => setPurchasesIdFilter(e.target.value)} 
                            placeholder="ID"
                            className="w-12 sm:w-14 md:w-16 px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 md:py-1.5 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Filtro de Proveedor */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <label className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">Proveedor:</label>
                        <div className="w-40 sm:w-52">
                            <SearchableSelect
                                options={supplierOptions}
                                value={purchasesSupplierFilter}
                                onChange={setPurchasesSupplierFilter}
                                placeholder="Elegir proveedor..."
                            />
                        </div>
                    </div>

                    {/* Filtro de Total */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <label className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">Total:</label>
                        <select 
                            value={purchasesTotalFilterOp} 
                            onChange={e => setPurchasesTotalFilterOp(e.target.value)}
                            className="px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 md:py-1.5 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="equals">=</option>
                            <option value="lt">&lt;</option>
                            <option value="lte">=</option>
                            <option value="gt">&gt;</option>
                            <option value="gte">=</option>
                        </select>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={purchasesTotalFilter} 
                            onChange={e => setPurchasesTotalFilter(e.target.value)} 
                            placeholder="Total"
                            className="w-16 sm:w-20 md:w-24 px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 md:py-1.5 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Filtro de Tipos (Checkboxes) */}
                    <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white border border-slate-300 rounded flex-shrink-0">
                        <span className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-600">Tipo:</span>
                        {['Producto', 'Insumo'].map(type => (
                            <label key={type} className="flex items-center gap-0.5 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={purchasesTypeFilter.includes(type)} 
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setPurchasesTypeFilter(prev => 
                                            checked 
                                                ? Array.from(new Set([...prev, type])) 
                                                : prev.filter(x => x !== type)
                                        );
                                    }}
                                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-[10px] sm:text-xs md:text-sm text-slate-600">{type.substring(0, 8)}</span>
                            </label>
                        ))}
                    </div>

                    {/* Filtro de Cantidad */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <label className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">Cantidad:</label>
                        <select 
                            value={purchasesQuantityFilterOp} 
                            onChange={e => setPurchasesQuantityFilterOp(e.target.value)}
                            className="px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="equals">=</option>
                            <option value="greater">&gt;</option>
                            <option value="greaterOrEqual">=</option>
                            <option value="less">&lt;</option>
                            <option value="lessOrEqual">=</option>
                        </select>
                        <input 
                            type="number" 
                            value={purchasesQuantityFilter} 
                            onChange={e => setPurchasesQuantityFilter(e.target.value)} 
                            className="w-16 sm:w-36 md:w-24 px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <select 
                            value={purchasesQuantityUnit} 
                            onChange={e => setPurchasesQuantityUnit(e.target.value)}
                            className="px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="Kg">Kg</option>
                            <option value="L">L</option>
                            <option value="U">U</option>
                        </select>
                    </div>

                    {/* Buscador de Producto/Insumo */}
                    <div className="flex items-center gap-1 flex-1 w-full sm:w-auto sm:min-w-[180px] md:min-w-[250px] lg:min-w-[378px]">
                        <label className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">Buscar Producto/Insumo</label>
                        <div className="flex-1 min-w-[180px]">
                            <SearchableSelect
                                options={productOptions}
                                value={purchasesProductFilter}
                                onChange={setPurchasesProductFilter}
                                placeholder="Elegir producto o insumo..."
                            />
                        </div>
                    </div>
                </div>

                {/* FILTROS DE FECHA (Calendario Nativo) */}
                <div className="border-t border-slate-200 pt-2 sm:pt-3 md:pt-4 overflow-hidden">
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 italic mb-1.5 sm:mb-2 md:mb-3">
                        🗓️ <strong>Fechas:</strong> Selecciona el rango para filtrar el historial.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-600 mb-1 block uppercase">Desde:</label>
                            <input 
                                type="date" 
                                value={purchasesDateFrom} 
                                onChange={e => setPurchasesDateFrom(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-600 mb-1 block uppercase">Hasta:</label>
                            <input 
                                type="date" 
                                value={purchasesDateTo} 
                                onChange={e => setPurchasesDateTo(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
                </div>
            </div>
            
            {sortedPurchases.length === 0 ? (
                <div className="text-center py-6 sm:py-10 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p className="text-sm sm:text-base">No hay compras que coincidan con los filtros.</p>
                </div>
            ) : (
                <div className="grid gap-2 xs:gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
                    {sortedPurchases.map(purchase => (
                        <div 
                            key={purchase.id} 
                            className="bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        >
                            {/* Encabezado */}
                            <div className="px-3 py-2 sm:px-4 sm:py-3" style={{backgroundColor: 'rgb(47, 60, 87)'}}>
                                <div className="flex items-center justify-between">
                                    <span className="text-white font-semibold text-xs sm:text-sm">
                                        ID {purchase.id}
                                    </span>
                                 
                                </div>
                            </div>

                            {/* Contenido */}
                            <div className="p-3 sm:p-4">
                                {/* Proveedor */}
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                                    </svg>
                                    <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Proveedor:</span>
                                    <span className="text-xs sm:text-sm font-semibold text-slate-700">{purchase.supplier || 'N/A'}</span>
                                </div>

                                {/* Fecha, Estado y Aprobado por */}
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-2 sm:mb-3">
                                    {/* Fecha */}
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Fecha:</span>
                                        <span className="text-xs sm:text-sm font-medium text-slate-700">{formatDate(purchase.date)}</span>
                                    </div>

                                    {/* Estado */}
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Estado:</span>
                                        <span className="text-xs sm:text-sm font-semibold text-emerald-600">Aprobada</span>
                                    </div>

                                    {/* Aprobado por */}
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Aprobado por:</span>
                                        <span className="text-xs sm:text-sm font-medium text-slate-700">{purchase.approved_by_name || 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-slate-100">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Total:</span>
                                    <span className="text-base sm:text-lg font-bold text-green-600">
                                        ${(purchase.total || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Productos/Insumos */}
                                <div className="mb-3 sm:mb-4">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide font-semibold">Productos/Insumos</span>
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
                                        {purchase.items && purchase.items.map((item, index) => (
                                            <div 
                                                key={index} 
                                                className="bg-slate-50 rounded-md sm:rounded-lg p-2 sm:p-2.5 text-xs sm:text-sm"
                                            >
                                                <div className="font-medium text-slate-700 mb-0.5 sm:mb-1 truncate">
                                                    {item.productName}
                                                </div>
                                                <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5 sm:gap-y-1 text-[10px] sm:text-xs text-slate-500">
                                                    <span className="whitespace-nowrap">
                                                        <span className="font-medium">Cantidad:</span> {item.quantity} {(() => {
                                                            const unit = getUnitName(item.unit);
                                                            if (unit === 'Unidad') {
                                                                return item.quantity !== 1 ? 'Unidades' : 'Unidad';
                                                            }
                                                            return item.quantity !== 1 ? unit + 's' : unit;
                                                        })()}
                                                    </span>
                                                    <span className="whitespace-nowrap">
                                                        <span className="font-medium">{getPriceLabel(item.unit)}:</span> ${item.unitPrice || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Botón de Eliminar - solo para Gerente */}
                                {userRole === 'Gerente' && (
                                    <div className="pt-2 sm:pt-3 border-t border-slate-100">
                                        {confirmDelete === purchase.id ? (
                                            <div className="flex gap-1.5 sm:gap-2">
                                                <button 
                                                    onClick={() => onDeletePurchase(purchase.id)} 
                                                    className="flex-1 px-2 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                                                >
                                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                    Confirmar
                                                </button>
                                                <button 
                                                    onClick={onCancelDelete} 
                                                    className="flex-1 px-2 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                                                >
                                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                                    </svg>
                                                    Cancelar
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => onDeletePurchase(purchase.id)} 
                                                className="w-full px-2 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                </svg>
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PurchaseHistory;