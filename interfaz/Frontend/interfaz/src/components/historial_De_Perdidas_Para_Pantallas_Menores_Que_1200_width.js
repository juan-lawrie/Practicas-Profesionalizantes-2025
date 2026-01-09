import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronRight, ArrowLeft, Calendar, User, FileWarning, Sliders, X, RotateCcw } from 'lucide-react';
import { getLossRecords } from '../services/api';

// --- UTILIDADES ---
const formatCurrency = (amount) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(amount) || 0);

// Función para formatear la unidad de cantidad
const formatQuantityWithUnit = (quantity, unit) => {
    const qty = parseFloat(quantity) || 0;
    switch (unit) {
        case 'g':
            return `${(qty / 1000).toFixed(3)} Kg`;
        case 'ml':
            return `${(qty / 1000).toFixed(3)} L`;
        case 'unidades':
        default:
            return `${qty} un.`;
    }
};

// Mapeo de categorías a texto legible
const categoryLabels = {
    'empaque_danado': 'Empaque dañado',
    'rotura_insumo': 'Rotura del insumo',
    'sobreuso_receta': 'Sobreuso en receta',
    'vencimiento': 'Vencimiento',
    'cadena_frio': 'Perdió la cadena de frío - Temperatura inadecuada',
    'accidente_fisico': 'Accidentes físicos',
    'contaminacion': 'Contaminación'
};

// Función para formatear el motivo de pérdida
const formatCategory = (category) => {
    if (!category) return '';
    if (categoryLabels[category]) {
        return categoryLabels[category];
    }
    const text = category.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Función para parsear fechas
const parseAnyDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

export default function HistorialPerdidasMovil() {
    const [lossRecords, setLossRecords] = useState([]);
    const [selectedLoss, setSelectedLoss] = useState(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    
    // Pestaña activa: 'all', 'insumos', 'productos'
    const [activeTab, setActiveTab] = useState('all');
    
    // Estados de filtros completos (igual que desktop)
    const [filters, setFilters] = useState({
        id: '', idOp: 'equals',
        product: '',
        user: '',
        quantity: '', quantityOp: 'equals',
        cost: '', costOp: 'equals',
        categories: [],
        description: '', descriptionOp: 'contains',
        dateFromYear: '', dateFromMonth: '', dateFromDay: '', dateFromHour: '', dateFromMinute: '',
        dateToYear: '', dateToMonth: '', dateToDay: '', dateToHour: '', dateToMinute: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await getLossRecords();
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            setLossRecords(data);
        } catch (err) {
            console.error("Error cargando historial", err);
        }
    };

    // Limpiar todos los filtros
    const clearFilters = () => {
        setFilters({
            id: '', idOp: 'equals',
            product: '',
            user: '',
            quantity: '', quantityOp: 'equals',
            cost: '', costOp: 'equals',
            categories: [],
            description: '', descriptionOp: 'contains',
            dateFromYear: '', dateFromMonth: '', dateFromDay: '', dateFromHour: '', dateFromMinute: '',
            dateToYear: '', dateToMonth: '', dateToDay: '', dateToHour: '', dateToMinute: ''
        });
    };

    // Función de filtrado completa
    const getFilteredRecords = () => {
        let filtered = [...lossRecords];

        // Filtro por ID
        if (filters.id.trim()) {
            const filterValue = parseInt(filters.id);
            if (!isNaN(filterValue)) {
                filtered = filtered.filter(record => {
                    const recordId = parseInt(record.id);
                    switch (filters.idOp) {
                        case 'equals': return recordId === filterValue;
                        case 'lt': return recordId < filterValue;
                        case 'lte': return recordId <= filterValue;
                        case 'gt': return recordId > filterValue;
                        case 'gte': return recordId >= filterValue;
                        default: return recordId === filterValue;
                    }
                });
            }
        }

        // Filtro por Producto
        if (filters.product.trim()) {
            filtered = filtered.filter(record =>
                String(record.product_name || '').toLowerCase().includes(filters.product.toLowerCase())
            );
        }

        // Filtro por Usuario
        if (filters.user.trim()) {
            filtered = filtered.filter(record =>
                String(record.user_name || '').toLowerCase().includes(filters.user.toLowerCase())
            );
        }

        // Filtro por Cantidad
        if (filters.quantity.trim()) {
            const filterValue = parseFloat(filters.quantity);
            if (!isNaN(filterValue)) {
                filtered = filtered.filter(record => {
                    const quantity = parseFloat(record.quantity) || 0;
                    switch (filters.quantityOp) {
                        case 'equals': return quantity === filterValue;
                        case 'lt': return quantity < filterValue;
                        case 'lte': return quantity <= filterValue;
                        case 'gt': return quantity > filterValue;
                        case 'gte': return quantity >= filterValue;
                        default: return quantity === filterValue;
                    }
                });
            }
        }

        // Filtro por Costo
        if (filters.cost.trim()) {
            const filterValue = parseFloat(filters.cost);
            if (!isNaN(filterValue)) {
                filtered = filtered.filter(record => {
                    const cost = parseFloat(record.cost_estimate) || 0;
                    switch (filters.costOp) {
                        case 'equals': return cost === filterValue;
                        case 'lt': return cost < filterValue;
                        case 'lte': return cost <= filterValue;
                        case 'gt': return cost > filterValue;
                        case 'gte': return cost >= filterValue;
                        case 'neq': return cost !== filterValue;
                        default: return cost === filterValue;
                    }
                });
            }
        }

        // Filtro por Categoría/Motivo (múltiple con checkboxes)
        if (filters.categories && filters.categories.length > 0) {
            filtered = filtered.filter(record => {
                const recordCategory = record.category || '';
                return filters.categories.includes(recordCategory);
            });
        }

        // Filtro por Descripción
        if (filters.description.trim()) {
            filtered = filtered.filter(record => {
                const description = String(record.description || '').toLowerCase();
                return description.includes(filters.description.toLowerCase());
            });
        }

        // Filtros de fecha granular
        const hasFromFilters = filters.dateFromYear || filters.dateFromMonth || filters.dateFromDay || 
                               filters.dateFromHour !== '' || filters.dateFromMinute !== '';
        const hasToFilters = filters.dateToYear || filters.dateToMonth || filters.dateToDay || 
                            filters.dateToHour !== '' || filters.dateToMinute !== '';
        const hasGranularFilters = hasFromFilters || hasToFilters;

        if (hasGranularFilters) {
            filtered = filtered.filter(record => {
                const recordDate = parseAnyDate(record.timestamp);
                if (!recordDate) return false;

                let matches = true;

                // --- FILTROS "DESDE" ---
                if (hasFromFilters && matches) {
                    // Año
                    if (filters.dateFromYear) {
                        const fromYear = parseInt(filters.dateFromYear);
                        if (hasToFilters) {
                            if (recordDate.getFullYear() < fromYear) matches = false;
                        } else {
                            if (recordDate.getFullYear() !== fromYear) matches = false;
                        }
                    }
                    
                    // Mes
                    if (matches && filters.dateFromMonth) {
                        const fromMonth = parseInt(filters.dateFromMonth) - 1;
                        const yearOk = !filters.dateFromYear || recordDate.getFullYear() >= parseInt(filters.dateFromYear);
                        if (hasToFilters && yearOk) {
                            const sameYear = !filters.dateFromYear || recordDate.getFullYear() === parseInt(filters.dateFromYear);
                            if (sameYear && recordDate.getMonth() < fromMonth) matches = false;
                        } else {
                            if (recordDate.getMonth() !== fromMonth) matches = false;
                        }
                    }
                    
                    // Día
                    if (matches && filters.dateFromDay) {
                        const fromDay = parseInt(filters.dateFromDay);
                        const sameYearMonth = (!filters.dateFromYear || recordDate.getFullYear() === parseInt(filters.dateFromYear)) &&
                                              (!filters.dateFromMonth || recordDate.getMonth() === parseInt(filters.dateFromMonth) - 1);
                        if (hasToFilters && sameYearMonth) {
                            if (recordDate.getDate() < fromDay) matches = false;
                        } else if (sameYearMonth) {
                            if (recordDate.getDate() !== fromDay) matches = false;
                        }
                    }
                    
                    // Hora
                    if (matches && filters.dateFromHour !== '') {
                        const fromHour = parseInt(filters.dateFromHour);
                        const sameDate = (!filters.dateFromYear || recordDate.getFullYear() === parseInt(filters.dateFromYear)) &&
                                         (!filters.dateFromMonth || recordDate.getMonth() === parseInt(filters.dateFromMonth) - 1) &&
                                         (!filters.dateFromDay || recordDate.getDate() === parseInt(filters.dateFromDay));
                        if (hasToFilters && sameDate) {
                            if (recordDate.getHours() < fromHour) matches = false;
                        } else if (sameDate || (!filters.dateFromYear && !filters.dateFromMonth && !filters.dateFromDay)) {
                            if (!hasToFilters) {
                                if (recordDate.getHours() !== fromHour) matches = false;
                            } else if (recordDate.getHours() < fromHour) {
                                matches = false;
                            }
                        }
                    }
                    
                    // Minuto
                    if (matches && filters.dateFromMinute !== '') {
                        const fromMinute = parseInt(filters.dateFromMinute);
                        const sameDateTime = (!filters.dateFromYear || recordDate.getFullYear() === parseInt(filters.dateFromYear)) &&
                                             (!filters.dateFromMonth || recordDate.getMonth() === parseInt(filters.dateFromMonth) - 1) &&
                                             (!filters.dateFromDay || recordDate.getDate() === parseInt(filters.dateFromDay)) &&
                                             (filters.dateFromHour === '' || recordDate.getHours() === parseInt(filters.dateFromHour));
                        if (hasToFilters && sameDateTime) {
                            if (recordDate.getMinutes() < fromMinute) matches = false;
                        } else if (sameDateTime || (filters.dateFromHour !== '' && !filters.dateFromYear && !filters.dateFromMonth && !filters.dateFromDay)) {
                            if (!hasToFilters) {
                                if (recordDate.getMinutes() !== fromMinute) matches = false;
                            } else if (recordDate.getMinutes() < fromMinute) {
                                matches = false;
                            }
                        }
                    }
                }

                // --- FILTROS "HASTA" ---
                if (matches && hasToFilters) {
                    // Año
                    if (filters.dateToYear) {
                        const toYear = parseInt(filters.dateToYear);
                        if (recordDate.getFullYear() > toYear) matches = false;
                    }
                    
                    // Mes
                    if (matches && filters.dateToMonth) {
                        const toMonth = parseInt(filters.dateToMonth) - 1;
                        const sameYear = !filters.dateToYear || recordDate.getFullYear() === parseInt(filters.dateToYear);
                        if (sameYear && recordDate.getMonth() > toMonth) matches = false;
                    }
                    
                    // Día
                    if (matches && filters.dateToDay) {
                        const toDay = parseInt(filters.dateToDay);
                        const sameYearMonth = (!filters.dateToYear || recordDate.getFullYear() === parseInt(filters.dateToYear)) &&
                                              (!filters.dateToMonth || recordDate.getMonth() === parseInt(filters.dateToMonth) - 1);
                        if (sameYearMonth && recordDate.getDate() > toDay) matches = false;
                    }
                    
                    // Hora
                    if (matches && filters.dateToHour !== '') {
                        const toHour = parseInt(filters.dateToHour);
                        const sameDate = (!filters.dateToYear || recordDate.getFullYear() === parseInt(filters.dateToYear)) &&
                                         (!filters.dateToMonth || recordDate.getMonth() === parseInt(filters.dateToMonth) - 1) &&
                                         (!filters.dateToDay || recordDate.getDate() === parseInt(filters.dateToDay));
                        if (sameDate || (!filters.dateToYear && !filters.dateToMonth && !filters.dateToDay)) {
                            if (recordDate.getHours() > toHour) matches = false;
                        }
                    }
                    
                    // Minuto
                    if (matches && filters.dateToMinute !== '') {
                        const toMinute = parseInt(filters.dateToMinute);
                        const sameDateTime = (!filters.dateToYear || recordDate.getFullYear() === parseInt(filters.dateToYear)) &&
                                             (!filters.dateToMonth || recordDate.getMonth() === parseInt(filters.dateToMonth) - 1) &&
                                             (!filters.dateToDay || recordDate.getDate() === parseInt(filters.dateToDay)) &&
                                             (filters.dateToHour === '' || recordDate.getHours() === parseInt(filters.dateToHour));
                        if (sameDateTime || (filters.dateToHour !== '' && !filters.dateToYear && !filters.dateToMonth && !filters.dateToDay)) {
                            if (recordDate.getMinutes() > toMinute) matches = false;
                        }
                    }
                }

                return matches;
            });
        }

        return filtered;
    };

    // Aplicar filtros y luego filtrar por pestaña
    const filteredData = getFilteredRecords().filter(record => {
        if (activeTab === 'all') return true;
        if (activeTab === 'insumos') return record.product_category === 'Insumo';
        if (activeTab === 'productos') return record.product_category === 'Producto';
        return true;
    });
    
    // Contar filtros activos
    const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
        if (key.endsWith('Op')) return false;
        if (Array.isArray(value)) return value.length > 0;
        return value !== '';
    }).length;

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
            
            {/* VISTA 1: LISTA (Solo visible si no hay selección) */}
            <div className={`flex flex-col h-full transition-transform duration-300 ${selectedLoss ? '-translate-x-full absolute inset-0' : 'translate-x-0'}`}>
                
                {/* Header Móvil */}
                <div className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-20">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <FileWarning size={20} className="text-red-500"/> Historial de Pérdidas
                    </h3>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar producto..." 
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-1 focus:ring-blue-500"
                                value={filters.product}
                                onChange={(e) => setFilters({...filters, product: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={() => setFiltersOpen(true)}
                            className={`p-2 rounded-lg flex items-center gap-1 ${
                                activeFiltersCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                            <Sliders size={20} />
                            {activeFiltersCount > 0 && (
                                <span className="bg-white text-blue-600 rounded-full px-1.5 text-xs font-bold">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                        <span>{filteredData.length} registros</span>
                    </div>
                    
                    {/* Pestañas: Todos, Insumos, Productos */}
                    <div className="flex gap-1 mt-3">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                activeTab === 'all' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setActiveTab('insumos')}
                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                activeTab === 'insumos' 
                                    ? 'bg-amber-600 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Insumos
                        </button>
                        <button
                            onClick={() => setActiveTab('productos')}
                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                                activeTab === 'productos' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Productos
                        </button>
                    </div>
                </div>

                {/* Lista de Tarjetas */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {filteredData.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => setSelectedLoss(item)}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="text-slate-400 font-mono text-xs">#{item.id}</span>
                                    <span className="font-bold text-slate-800 text-base ml-2">{item.product_name}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded text-xs">
                                    {formatQuantityWithUnit(item.quantity, item.product_unit)}
                                </span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="text-xs text-slate-500 space-y-1">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={12}/> {new Date(item.timestamp).toLocaleString('es-AR', { hour12: false })}
                                    </div>
                                    <div className="text-red-500 font-medium">
                                        {formatCategory(item.category_display || item.category)}
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-slate-300"/>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* VISTA 2: DETALLE (Entra desde la derecha) */}
            <div className={`absolute inset-0 bg-slate-50 flex flex-col transition-transform duration-300 z-30 ${selectedLoss ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedLoss && (
                    <>
                        <div className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 flex items-center gap-3">
                            <button onClick={() => setSelectedLoss(null)} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
                                <ArrowLeft size={20} className="text-slate-600"/>
                            </button>
                            <span className="font-bold text-slate-800 truncate">Detalle de Pérdida</span>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded font-mono text-sm font-bold">
                                    #{selectedLoss.id}
                                </span>
                                <h2 className="text-xl font-bold text-slate-800 mt-2">{selectedLoss.product_name}</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Costo</span>
                                    <span className="text-lg font-bold text-slate-800">{formatCurrency(selectedLoss.cost_estimate || 0)}</span>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cantidad</span>
                                    <span className="text-lg font-bold text-slate-800">{formatQuantityWithUnit(selectedLoss.quantity, selectedLoss.product_unit)}</span>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase">Detalles</h4>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-slate-400 block">Motivo</span>
                                        <span className="text-red-600 font-medium">{formatCategory(selectedLoss.category_display || selectedLoss.category)}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-400 block">Descripción</span>
                                        <p className="text-sm text-slate-600 mt-1">{selectedLoss.description || 'Sin descripción'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-400 block">Fecha y hora</span>
                                        <p className="text-sm text-slate-600">{new Date(selectedLoss.timestamp).toLocaleString('es-AR', { hour12: false })}</p>
                                    </div>
                                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                        <User size={14} className="text-slate-400"/>
                                        <span className="text-xs text-slate-500">Registrado por <strong>{selectedLoss.user_name}</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Sheet de Filtros (Mobile) */}
            {filtersOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
                    <div className="fixed inset-x-0 bottom-0 bg-white z-50 rounded-t-2xl p-5 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Filtros Avanzados</h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={clearFilters}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                    <RotateCcw size={12} /> Limpiar
                                </button>
                                <button onClick={() => setFiltersOpen(false)}><X size={24} /></button>
                            </div>
                        </div>
                        
                        <div className="space-y-4 mb-6 text-sm">
                            {/* Filtro ID */}
                            <div>
                                <label className="text-slate-500 block mb-1 text-xs font-medium">ID</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={filters.idOp}
                                        onChange={(e) => setFilters({...filters, idOp: e.target.value})}
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                        style={{ width: '4rem' }}
                                    >
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input 
                                        type="number"
                                        value={filters.id}
                                        onChange={(e) => setFilters({...filters, id: e.target.value})}
                                        placeholder="Ej: 15"
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            
                            {/* Filtro Usuario */}
                            <div>
                                <label className="text-slate-500 block mb-1 text-xs font-medium">Usuario</label>
                                <input 
                                    type="text"
                                    value={filters.user}
                                    onChange={(e) => setFilters({...filters, user: e.target.value})}
                                    placeholder="Registrado por..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                            
                            {/* Filtro Cantidad */}
                            <div>
                                <label className="text-slate-500 block mb-1 text-xs font-medium">Cantidad</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={filters.quantityOp}
                                        onChange={(e) => setFilters({...filters, quantityOp: e.target.value})}
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                        style={{ width: '4rem' }}
                                    >
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                    </select>
                                    <input 
                                        type="number"
                                        value={filters.quantity}
                                        onChange={(e) => setFilters({...filters, quantity: e.target.value})}
                                        placeholder="Cantidad"
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            
                            {/* Filtro Costo Estimado */}
                            <div>
                                <label className="text-slate-500 block mb-1 text-xs font-medium">Costo Estimado</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={filters.costOp}
                                        onChange={(e) => setFilters({...filters, costOp: e.target.value})}
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                        style={{ width: '4rem' }}
                                    >
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">≤</option>
                                        <option value="neq">≠</option>
                                    </select>
                                    <input 
                                        type="number"
                                        value={filters.cost}
                                        onChange={(e) => setFilters({...filters, cost: e.target.value})}
                                        placeholder="Costo $"
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            
                            {/* Filtro Descripción */}
                            <div>
                                <label className="text-slate-500 block mb-1 text-xs font-medium">Descripción</label>
                                <input 
                                    type="text"
                                    value={filters.description}
                                    onChange={(e) => setFilters({...filters, description: e.target.value})}
                                    placeholder="Buscar en descripción..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                            
                            {/* Filtro Motivos (Checkboxes) */}
                            <div className="border-t border-slate-100 pt-3">
                                <label className="text-slate-500 block mb-2 text-xs font-medium">Motivo/Categoría</label>
                                <div className="space-y-2">
                                    {Object.entries(categoryLabels).map(([key, label]) => (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={filters.categories.includes(key)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFilters({...filters, categories: [...filters.categories, key]});
                                                    } else {
                                                        setFilters({...filters, categories: filters.categories.filter(c => c !== key)});
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-slate-700 text-sm">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Filtros de Fecha - Desde */}
                            <div className="border-t border-slate-100 pt-3">
                                <label className="text-slate-500 block mb-2 text-xs font-medium">Fecha Desde</label>
                                <div className="flex flex-wrap gap-2">
                                    <input 
                                        type="number"
                                        value={filters.dateFromYear}
                                        onChange={(e) => setFilters({...filters, dateFromYear: e.target.value})}
                                        placeholder="Año"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '4.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateFromMonth}
                                        onChange={(e) => setFilters({...filters, dateFromMonth: e.target.value})}
                                        placeholder="Mes"
                                        min="1" max="12"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '3.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateFromDay}
                                        onChange={(e) => setFilters({...filters, dateFromDay: e.target.value})}
                                        placeholder="Día"
                                        min="1" max="31"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '3.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateFromHour}
                                        onChange={(e) => setFilters({...filters, dateFromHour: e.target.value})}
                                        placeholder="Hora"
                                        min="0" max="23"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '3.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateFromMinute}
                                        onChange={(e) => setFilters({...filters, dateFromMinute: e.target.value})}
                                        placeholder="Min"
                                        min="0" max="59"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '4rem' }}
                                    />
                                </div>
                            </div>
                            
                            {/* Filtros de Fecha - Hasta */}
                            <div>
                                <label className="text-slate-500 block mb-2 text-xs font-medium">Fecha Hasta</label>
                                <div className="flex flex-wrap gap-2">
                                    <input 
                                        type="number"
                                        value={filters.dateToYear}
                                        onChange={(e) => setFilters({...filters, dateToYear: e.target.value})}
                                        placeholder="Año"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '4.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateToMonth}
                                        onChange={(e) => setFilters({...filters, dateToMonth: e.target.value})}
                                        placeholder="Mes"
                                        min="1" max="12"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '3.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateToDay}
                                        onChange={(e) => setFilters({...filters, dateToDay: e.target.value})}
                                        placeholder="Día"
                                        min="1" max="31"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '3.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateToHour}
                                        onChange={(e) => setFilters({...filters, dateToHour: e.target.value})}
                                        placeholder="Hora"
                                        min="0" max="23"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '3.5rem' }}
                                    />
                                    <input 
                                        type="number"
                                        value={filters.dateToMinute}
                                        onChange={(e) => setFilters({...filters, dateToMinute: e.target.value})}
                                        placeholder="Min"
                                        min="0" max="59"
                                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-center"
                                        style={{ width: '4rem' }}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={() => setFiltersOpen(false)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">
                            Aplicar Filtros
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}