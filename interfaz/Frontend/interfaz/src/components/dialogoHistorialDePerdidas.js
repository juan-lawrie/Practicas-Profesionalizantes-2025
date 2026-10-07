import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Maximize2, Minimize2, ExternalLink, MoreVertical, PieChart, Sliders, GripHorizontal, AlignLeft, Tag, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { getLossRecords } from '../services/api';
import SearchableSelect from './SearchableSelect';
import { nameOptions, sameName } from '../utils/filterOptions';
import { formatMoney, formatLossQuantity } from '../utils/format';

// --- UTILIDADES ---

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

const parseDateInput = (value, endOfDay = false) => {
    if (!value) return null;

    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;

    return new Date(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0
    );
};

export default function DialogoHistorialDePerdidas({ onClose, isWindowMode = false, isEmbedded = false }) {
    // Estado de la ventana (posición y tamaño)
    const [windowState, setWindowState] = useState({
        x: 100, y: 50, width: 1100, height: 700, isMinimized: false, isMaximized: isWindowMode
    });
    
    // Estado para el ancho del panel izquierdo (ajustable)
    const [leftPanelWidth, setLeftPanelWidth] = useState(400);
    const isResizingPanel = useRef(false);
    const containerRef = useRef(null);
    
    // Estado para detectar ancho de pantalla
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    
    // Hook para detectar cambios en el ancho de pantalla
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Calcular configuración responsiva basada en el ancho de pantalla
    const getResponsiveConfig = () => {
        if (screenWidth >= 3840) return { leftPanelExtra: 1700, detailsOffset: 700, isLargeScreen: true, isUltraWideScreen: true }; // Dual QHD+
        if (screenWidth >= 3440) return { leftPanelExtra: 1680, detailsOffset: 650, isLargeScreen: true, isUltraWideScreen: true }; // UWQHD
        if (screenWidth >= 3200) return { leftPanelExtra: 1640, detailsOffset: 620, isLargeScreen: true, isUltraWideScreen: true };
        if (screenWidth >= 3000) return { leftPanelExtra: 1611, detailsOffset: 600, isLargeScreen: true, isUltraWideScreen: true };
        if (screenWidth >= 2800) return { leftPanelExtra: 1050, detailsOffset: 580, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2600) return { leftPanelExtra: 1000, detailsOffset: 560, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2500) return { leftPanelExtra: 950, detailsOffset: 550, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2400) return { leftPanelExtra: 900, detailsOffset: 500, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2300) return { leftPanelExtra: 800, detailsOffset: 460, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2200) return { leftPanelExtra: 700, detailsOffset: 400, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2100) return { leftPanelExtra: 650, detailsOffset: 400, isLargeScreen: true, isUltraWideScreen: false };
        if (screenWidth >= 2000) return { leftPanelExtra: 500, detailsOffset: 360, isLargeScreen: true, isUltraWideScreen: false };
        // 1800px y 1900px: sin cambios especiales
        return { leftPanelExtra: 0, detailsOffset: 0, isLargeScreen: false, isUltraWideScreen: false };
    };
    
    const responsiveConfig = getResponsiveConfig();
    const fullBleed = isWindowMode || windowState.isMaximized || isEmbedded;

    // Datos
    const [lossRecords, setLossRecords] = useState([]);
    const [selectedLoss, setSelectedLoss] = useState(null);
    
    const [filtersOpen, setFiltersOpen] = useState(false);
    
    // Pestaña activa: 'all', 'insumos', 'productos'
    const [activeTab, setActiveTab] = useState('all');
    
    // Estados de filtros completos
    const [filters, setFilters] = useState({
        id: '', idOp: 'equals',
        product: '',
        user: '',
        quantity: '', quantityOp: 'equals',
        cost: '', costOp: 'equals',
        categories: [], // Array para checkboxes múltiples
        description: '', descriptionOp: 'contains',
        dateFrom: '',
        dateTo: ''
    });

    // Carga de datos
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await getLossRecords();
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            setLossRecords(data);
            if (data.length > 0 && !selectedLoss) setSelectedLoss(data[0]);
        } catch (err) {
            console.error("Error cargando historial de pérdidas", err);
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
            dateFrom: '',
            dateTo: ''
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

        // Filtro por Producto (nombre elegido de la lista)
        if (filters.product.trim()) {
            filtered = filtered.filter(record => sameName(record.product_name, filters.product));
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
                const filterValue = filters.description.toLowerCase();
                switch (filters.descriptionOp) {
                    case 'equals': return description === filterValue;
                    case 'contains': return description.includes(filterValue);
                    default: return description.includes(filterValue);
                }
            });
        }

        // Filtro de fecha por rango usando calendario nativo
        if (filters.dateFrom || filters.dateTo) {
            const fromDate = parseDateInput(filters.dateFrom, false);
            const toDate = parseDateInput(filters.dateTo, true);

            filtered = filtered.filter(record => {
                const recordDate = parseAnyDate(record.timestamp);
                if (!recordDate) return false;

                if (fromDate && recordDate < fromDate) return false;
                if (toDate && recordDate > toDate) return false;
                return true;
            });
        }

        return filtered;
    };

    // Calcular KPIs dinámicos
    // Lógica de Arrastre (Drag & Drop)
    const dragRef = useRef(null);
    const isDragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (windowState.isMaximized || isWindowMode) return;
        if (e.target.closest('.no-drag')) return;
        isDragging.current = true;
        offset.current = {
            x: e.clientX - windowState.x,
            y: e.clientY - windowState.y
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        setWindowState(prev => ({
            ...prev,
            x: e.clientX - offset.current.x,
            y: e.clientY - offset.current.y
        }));
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    // Lógica de resize del panel izquierdo
    const handlePanelResizeStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizingPanel.current = true;
        document.addEventListener('mousemove', handlePanelResize);
        document.addEventListener('mouseup', handlePanelResizeEnd);
    };

    const handlePanelResize = (e) => {
        if (!isResizingPanel.current) return;
        const rect = containerRef.current?.getBoundingClientRect();
        const containerLeft = rect ? rect.left : 0;
        const containerWidth = rect ? rect.width : (fullBleed ? screenWidth : windowState.width);
        const extraWidth = fullBleed ? (responsiveConfig.leftPanelExtra || 0) : 0;
        const limits = panelLimits(containerWidth);
        const nextWidth = Math.max(limits.min, Math.min(limits.max, e.clientX - containerLeft));
        setLeftPanelWidth(Math.max(0, nextWidth - extraWidth));
    };

    const handlePanelResizeEnd = () => {
        isResizingPanel.current = false;
        document.removeEventListener('mousemove', handlePanelResize);
        document.removeEventListener('mouseup', handlePanelResizeEnd);
    };

    // Lógica de Abrir en Nueva Pestaña
    const handleOpenNewTab = () => {
        const url = `${window.location.origin}?view=loss-history-window`;
        window.open(url, '_blank', 'width=1200,height=800');
        if (onClose) onClose();
    };

    const recordMatchesTab = (record, tab) => {
        if (tab === 'insumos') return record.product_category === 'Insumo';
        if (tab === 'productos') return record.product_category === 'Producto';
        return true;
    };

    // En Insumos solo insumos, en Productos solo productos, en Todos ambos.
    const productOptions = nameOptions(
        lossRecords
            .filter(record => recordMatchesTab(record, activeTab))
            .map(record => record.product_name)
    );

    const selectTab = (tab) => {
        setActiveTab(tab);
        if (!filters.product) return;
        const stillValid = lossRecords.some(record =>
            sameName(record.product_name, filters.product) && recordMatchesTab(record, tab)
        );
        if (!stillValid) setFilters(prev => ({ ...prev, product: '' }));
    };

    // Usar la función de filtrado completa y aplicar filtro por pestaña

    const filteredData = getFilteredRecords().filter(record => {
        if (activeTab === 'all') return true;
        if (activeTab === 'insumos') return record.product_category === 'Insumo';
        if (activeTab === 'productos') return record.product_category === 'Producto';
        return true;
    });

    // KPIs
    const totalLossValue = filteredData.reduce((acc, curr) => acc + (parseFloat(curr.cost_estimate) || 0), 0);
    
    // Contar filtros activos (excluyendo operadores por defecto y arrays vacíos)
    const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
        if (key.endsWith('Op')) return false; // Ignorar operadores
        if (Array.isArray(value)) return value.length > 0;
        return value !== '';
    }).length;

    // Estilos dinámicos para la ventana
    const windowStyle = isEmbedded ? {
        // Cuando está embebido: ocupa todo el contenedor padre
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    } : isWindowMode ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
    } : windowState.isMinimized ? {
        // Cuando está minimizado: barra compacta en la posición actual
        position: 'fixed',
        left: windowState.x,
        top: windowState.y,
        width: '350px', // Ancho fijo para mostrar título y botones
        height: '48px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.2)',
    } : windowState.isMaximized ? {
        // Cuando está maximizado: pantalla completa
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'none',
    } : {
        // Estado normal
        position: 'fixed',
        left: windowState.x,
        top: windowState.y,
        width: windowState.width,
        height: windowState.height,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    };

    const dialogPixelWidth = fullBleed ? screenWidth : windowState.width;
    const panelLimits = (containerWidth) => {
        if (responsiveConfig.isLargeScreen) {
            return { min: containerWidth * 0.3, max: containerWidth * 0.7 };
        }
        return { min: 200, max: Math.min(600, Math.max(200, containerWidth - 200)) };
    };
    const limits = panelLimits(dialogPixelWidth);
    const extraWidth = fullBleed ? responsiveConfig.leftPanelExtra : 0;
    const desiredPanelWidth = Math.max(
        leftPanelWidth + extraWidth,
        responsiveConfig.isLargeScreen && fullBleed ? 520 + extraWidth : leftPanelWidth
    );
    const panelWidth = Math.min(limits.max, Math.max(limits.min, desiredPanelWidth));
    const filterItemStyle = {
        flex: panelWidth < 480 ? '1 1 100%' : (responsiveConfig.isLargeScreen ? '1 1 20%' : '1 1 45%'),
        minWidth: 0,
    };

    return (
        <div 
            ref={containerRef}
            style={windowStyle}
            className={`bg-white rounded-lg border border-slate-300 overflow-hidden transition-all duration-75 ${windowState.isMaximized && !isWindowMode ? '!rounded-none' : ''}`}
        >
            {/* --- HEADER DE LA VENTANA (Barra de Título) --- */}
            {!isEmbedded && (
                <div 
                    onMouseDown={handleMouseDown}
                    className={`bg-slate-800 text-white px-4 py-2 flex justify-between items-center cursor-move select-none flex-shrink-0 ${isWindowMode ? 'hidden' : ''}`}
                >
                    <div className="flex items-center gap-2">
                        <GripHorizontal size={16} className="text-slate-400" />
                        <span className="font-bold text-sm tracking-wide">Historial de Pérdidas</span>
                    </div>
                    <div className="flex items-center gap-2 no-drag">
                        <button onClick={handleOpenNewTab} className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white" title="Abrir en nueva ventana">
                            <ExternalLink size={14} />
                        </button>
                        <button onClick={() => setWindowState(p => ({...p, isMinimized: !p.isMinimized}))} className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white">
                            <Minimize2 size={14} />
                        </button>
                        <button onClick={() => setWindowState(p => ({...p, isMaximized: !p.isMaximized}))} className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white">
                            <Maximize2 size={14} />
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-red-600 rounded text-slate-300 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* --- CONTENIDO PRINCIPAL (Si no está minimizado o está embebido) --- */}
            {(isEmbedded || !windowState.isMinimized) && (
                <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-50">
                    
                    {/* PANEL IZQUIERDO: LISTA COMPACTA (con ancho ajustable y responsivo) */}
                    <div 
                        style={{ 
                            width: panelWidth,
                            minWidth: limits.min,
                            maxWidth: limits.max,
                            flexShrink: 0
                        }}
                        className="border-r border-slate-200 flex flex-col bg-white relative min-h-0 overflow-hidden"
                    >
                        {/* Header de Lista & Filtros */}
                        <div className={`p-3 border-b border-slate-100 bg-slate-50 flex-shrink-0 ${responsiveConfig.isLargeScreen ? 'p-4' : ''}`}>
                            <div className="flex gap-2 mb-2 items-center">
                                <div className="flex-1 min-w-0">
                                    <SearchableSelect
                                        options={productOptions}
                                        value={filters.product}
                                        onChange={(product) => setFilters({ ...filters, product })}
                                        placeholder={activeTab === 'insumos' ? 'Buscar insumo' : activeTab === 'productos' ? 'Buscar producto' : 'Buscar producto o insumo'}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(!filtersOpen)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors shrink-0 ${
                                        filtersOpen || activeFiltersCount > 0
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                    title={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                                >
                                    <Filter size={14} />
                                    {activeFiltersCount > 0 && (
                                        <span className="bg-white text-blue-600 rounded-full px-1.5 text-xs font-bold">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                            
                            {filtersOpen && (
                                <div className="bg-white border border-slate-200 rounded-lg p-3 mb-2 overflow-x-hidden overflow-y-auto max-h-[42vh]">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-xs font-bold text-slate-600 uppercase">Filtros Avanzados</span>
                                        <button 
                                            onClick={clearFilters}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                            <RotateCcw size={12} /> Limpiar
                                        </button>
                                    </div>
                                    
                                    {/* Contenedor flexible - más columnas en pantallas grandes */}
                                    <div className="flex flex-wrap gap-3 text-xs overflow-x-hidden">
                                        
                                        {/* Filtro ID */}
                                        <div style={filterItemStyle}>
                                            <label className="text-slate-500 block mb-1">ID</label>
                                            <div className="flex gap-1">
                                                <select 
                                                    value={filters.idOp}
                                                    onChange={(e) => setFilters({...filters, idOp: e.target.value})}
                                                    className="shrink-0 px-1 py-1.5 border border-slate-200 rounded text-xs bg-white"
                                                    style={{ width: '3.5rem' }}
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
                                                    className="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Filtro Usuario */}
                                        <div style={filterItemStyle}>
                                            <label className="text-slate-500 block mb-1">Usuario</label>
                                            <input 
                                                type="text"
                                                value={filters.user}
                                                onChange={(e) => setFilters({...filters, user: e.target.value})}
                                                placeholder="Registrado por..."
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                                            />
                                        </div>
                                        
                                        {/* Filtro Cantidad */}
                                        <div style={filterItemStyle}>
                                            <label className="text-slate-500 block mb-1">Cantidad</label>
                                            <div className="flex gap-1">
                                                <select 
                                                    value={filters.quantityOp}
                                                    onChange={(e) => setFilters({...filters, quantityOp: e.target.value})}
                                                    className="shrink-0 px-1 py-1.5 border border-slate-200 rounded text-xs bg-white"
                                                    style={{ width: '3.5rem' }}
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
                                                    className="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Filtro Costo Estimado */}
                                        <div style={filterItemStyle}>
                                            <label className="text-slate-500 block mb-1">Costo Estimado</label>
                                            <div className="flex gap-1">
                                                <select 
                                                    value={filters.costOp}
                                                    onChange={(e) => setFilters({...filters, costOp: e.target.value})}
                                                    className="shrink-0 px-1 py-1.5 border border-slate-200 rounded text-xs bg-white"
                                                    style={{ width: '3.5rem' }}
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
                                                    className="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Filtro Motivos (Checkboxes) */}
                                        <div style={{ 
                                            flex: responsiveConfig.isUltraWideScreen ? '0 0 auto' : (responsiveConfig.isLargeScreen ? '1 1 100%' : '1 1 100%')
                                        }} className={responsiveConfig.isUltraWideScreen ? '' : 'border-t border-slate-100 pt-2 mt-1'}>
                                            <label className="text-slate-500 block mb-2 font-medium">Motivo/Categoría</label>
                                            <div className={responsiveConfig.isUltraWideScreen ? 'flex flex-nowrap gap-x-4 gap-y-2' : 'flex flex-wrap gap-x-4 gap-y-2'}>
                                                {Object.entries(categoryLabels).map(([key, label]) => (
                                                    <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-slate-700 whitespace-nowrap">
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
                                                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-slate-600 text-xs">{label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Filtros de Fecha */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full" style={{ flex: '1 1 100%' }}>
                                            <div className={responsiveConfig.isUltraWideScreen ? '' : 'border-t border-slate-100 pt-2 mt-1'}>
                                                <label className="text-slate-500 block mb-1 font-medium">Fecha Desde</label>
                                                <input 
                                                    type="date"
                                                    value={filters.dateFrom}
                                                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                                                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                                                />
                                            </div>
                                            <div className={responsiveConfig.isUltraWideScreen ? '' : 'border-t border-slate-100 pt-2 mt-1'}>
                                                <label className="text-slate-500 block mb-1 font-medium">Fecha Hasta</label>
                                                <input 
                                                    type="date"
                                                    value={filters.dateTo}
                                                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                                                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Filtro Descripción - Movido para estar junto a fechas en pantallas grandes */}
                                        <div style={{ flex: '1 1 100%', minWidth: 0 }} className={responsiveConfig.isUltraWideScreen && fullBleed ? '' : 'border-t border-slate-100 pt-2 mt-1'}>
                                            <label className="text-slate-500 block mb-1">Descripción</label>
                                            <input 
                                                type="text"
                                                value={filters.description}
                                                onChange={(e) => setFilters({...filters, description: e.target.value})}
                                                placeholder="Buscar en descripción..."
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex justify-between items-center text-xs text-slate-500 px-1">
                                <span>{filteredData.length} registros</span>
                                <span className="font-mono font-bold text-slate-700">Total: {formatMoney(totalLossValue)}</span>
                            </div>
                            
                            {/* Pestañas: Todos, Insumos, Productos */}
                            <div className="flex gap-1 mt-2">
                                <button
                                    onClick={() => selectTab('all')}
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        activeTab === 'all' 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => selectTab('insumos')}
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        activeTab === 'insumos' 
                                            ? 'bg-amber-600 text-white' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Insumos
                                </button>
                                <button
                                    onClick={() => selectTab('productos')}
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        activeTab === 'productos' 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Productos
                                </button>
                            </div>
                        </div>

                        {/* Lista Scrolleable */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ minHeight: 0, maxHeight: '100%' }}>
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-2 py-2 border-b w-12">ID</th>
                                        <th className="px-2 py-2 border-b">
                                            {activeTab === 'all' ? 'Producto/Insumo' : activeTab === 'insumos' ? 'Insumo' : 'Producto'}
                                        </th>
                                        <th className="px-2 py-2 border-b text-right">Cant.</th>
                                        <th className="px-2 py-2 border-b w-1"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredData.map(item => (
                                        <tr 
                                            key={item.id} 
                                            onClick={() => setSelectedLoss(item)}
                                            className={`
                                                cursor-pointer transition-colors hover:bg-blue-50 text-sm group
                                                ${selectedLoss?.id === item.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}
                                            `}
                                        >
                                            <td className="px-2 py-3 text-slate-400 font-mono text-xs">
                                                #{item.id}
                                            </td>
                                            <td className="px-2 py-3">
                                                <div className="font-medium text-slate-800 truncate">{item.product_name}</div>
                                                <div className="text-xs text-slate-400">
                                                    <span>{new Date(item.timestamp).toLocaleString('es-AR', { hour12: false })}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 text-right font-mono text-slate-600 text-xs whitespace-nowrap">
                                                {formatLossQuantity(item.quantity, item.product_unit)}
                                            </td>
                                            <td className="px-2 py-3 text-center text-slate-300">
                                                <MoreVertical size={14} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Resize Handle del Panel */}
                        <div 
                            className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-slate-200 hover:bg-blue-500 transition-colors z-30"
                            onMouseDown={handlePanelResizeStart}
                        />
                    </div>

                    {/* PANEL DERECHO: DETALLES (Vista Previa) */}
                    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
                        {selectedLoss ? (
                            <div className="p-8 max-w-3xl mx-auto w-full animate-in fade-in duration-300">
                                {/* Header del Detalle */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded font-mono text-sm font-bold">
                                            #{selectedLoss.id}
                                        </span>
                                        <h2 className="text-2xl font-bold text-slate-800">{selectedLoss.product_name}</h2>
                                    </div>
                                    <p className="text-slate-500 text-sm mt-2">
                                        Reportado por <strong>{selectedLoss.user_name}</strong> el {new Date(selectedLoss.timestamp).toLocaleString('es-AR', { hour12: false })}
                                    </p>
                                </div>

                                {/* Tarjetas de Resumen */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm min-w-0">
                                        <span className="text-xs uppercase font-bold text-slate-400 mb-1 block">Costo Estimado</span>
                                        <span className="text-lg sm:text-2xl font-mono font-bold text-slate-800">
                                            {formatMoney(selectedLoss.cost_estimate || 0)}
                                        </span>
                                    </div>
                                    <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm min-w-0">
                                        <span className="text-xs uppercase font-bold text-slate-400 mb-1 block">Cantidad Perdida</span>
                                        <span className="text-lg sm:text-2xl font-bold text-slate-800">
                                            {formatLossQuantity(selectedLoss.quantity, selectedLoss.product_unit)}
                                        </span>
                                    </div>
                                </div>

                                {/* Motivo de la Pérdida */}
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Tag size={16} className="text-red-600" />
                                        <span className="text-xs uppercase font-bold text-red-600">Motivo de la Pérdida</span>
                                    </div>
                                    <span className="text-lg font-semibold text-red-700">
                                        {formatCategory(selectedLoss.category_display || selectedLoss.category)}
                                    </span>
                                </div>

                                {/* Detalles Completos */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <AlignLeft size={18} className="text-slate-400"/> Detalles del Incidente
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed">
                                        {selectedLoss.description || "Sin descripción detallada disponible."}
                                    </p>
                                </div>

                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <PieChart size={48} className="mb-4 text-slate-300"/>
                                <p>Selecciona un registro para ver los detalles</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Resizer Handle (Solo desktop no maximizado y no embebido) */}
            {!isEmbedded && !windowState.isMaximized && !isWindowMode && !windowState.isMinimized && (
                <div 
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-slate-200 hover:bg-blue-500 rounded-tl transition-colors"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startW = windowState.width;
                        const startH = windowState.height;
                        
                        const onResize = (moveEvent) => {
                            setWindowState(prev => ({
                                ...prev,
                                width: Math.max(600, startW + (moveEvent.clientX - startX)),
                                height: Math.max(400, startH + (moveEvent.clientY - startY))
                            }));
                        };
                        
                        const stopResize = () => {
                            document.removeEventListener('mousemove', onResize);
                            document.removeEventListener('mouseup', stopResize);
                        };
                        
                        document.addEventListener('mousemove', onResize);
                        document.addEventListener('mouseup', stopResize);
                    }}
                />
            )}
        </div>
    );
}