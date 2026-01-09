import React, { useState, useEffect } from 'react';
import Select from 'react-select';

const CrearNuevoProducto = ({ products, inventory, loadProducts, getInMemoryToken, api }) => {
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Función para convertir y formatear unidades
    const formatQuantityWithConversion = (quantity, unit) => {
        const num = parseFloat(quantity);
        if (unit === 'g') {
            if (num >= 1000) {
                const kg = (num / 1000).toFixed(2);
                return `${num.toFixed(1)} g (${kg} kg)`;
            }
            return `${num.toFixed(1)} g`;
        } else if (unit === 'ml') {
            if (num >= 1000) {
                const liters = (num / 1000).toFixed(2);
                return `${num.toFixed(1)} ml (${liters} L)`;
            }
            return `${num.toFixed(1)} ml`;
        }
        return `${num.toFixed(1)} ${unit}`;
    };

    const [newProduct, setNewProduct] = useState({
        name: '', 
        description: '', 
        price: '', 
        stock: '', 
        recipe_yield: '',
        low_stock_threshold: '',
        high_stock_multiplier: '',
        category: 'Producto',
        unit: 'unidades'
    });
    const [recipeItems, setRecipeItems] = useState([]);
    const [message, setMessage] = useState('');
    const [newIngredient, setNewIngredient] = useState({ ingredient: null, quantity: '', unit: 'g' });

    const handleRecipeChange = (index, field, value) => {
        const newRecipeItems = [...recipeItems];
        newRecipeItems[index][field] = value;
        setRecipeItems(newRecipeItems);
    };

    const addRecipeItem = () => {
        const qty = parseFloat(newIngredient.quantity);
        if (!newIngredient.ingredient || !newIngredient.quantity || isNaN(qty) || qty <= 0) {
            return;
        }
        
        // Verificar si ya existe
        const exists = recipeItems.some(item => item.ingredient === newIngredient.ingredient.value);
        if (exists) {
            setMessage('⚠️ Este insumo ya está en la receta.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        const selectedIngredientData = products.find(p => p.id === newIngredient.ingredient.value);
        
        // Normalizar unidad
        const normalizeUnit = (u) => {
            if (!u) return 'g';
            const s = String(u).toLowerCase().trim();
            if (['g', 'gr', 'grs', 'gramo', 'gramos'].includes(s)) return 'g';
            if (['ml', 'mililitro', 'mililitros'].includes(s)) return 'ml';
            if (['unidad', 'unidades', 'u', 'uds'].includes(s)) return 'unidades';
            return 'g';
        };

        const unit = normalizeUnit(selectedIngredientData?.unit || newIngredient.unit);
        
        setRecipeItems([...recipeItems, { 
            ingredient: newIngredient.ingredient.value,
            ingredientName: newIngredient.ingredient.label,
            quantity: qty, 
            unit: unit
        }]);
        
        // Reset
        setNewIngredient({ ingredient: null, quantity: '', unit: 'g' });
    };

    const removeRecipeItem = (index) => {
        setRecipeItems(recipeItems.filter((_, i) => i !== index));
    };

    const ingredientOptions = products
        .filter(p => p.category === 'Insumo')
        .map(p => ({ value: p.id, label: p.name }));

    // Función para formatear la unidad mostrada en las tarjetas
    const getDisplayUnit = (unit) => {
        switch(unit) {
            case 'g': return 'G';
            case 'ml': return 'ML';
            case 'unidades': return 'U';
            default: return unit?.toUpperCase() || '';
        }
    };

    // Función para formatear la cantidad mostrada
    const getDisplayQuantity = (quantity, unit) => {
        const num = parseFloat(quantity);
        return num;
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        
        // Validaciones
        if (!newProduct.name.trim()) {
            setMessage('🚫 Error: El nombre del producto es obligatorio.');
            return;
        }
        
        if (!newProduct.price || parseFloat(newProduct.price) <= 0) {
            setMessage('🚫 Error: El precio debe ser mayor a 0.');
            return;
        }
        
        if (newProduct.stock !== '' && parseInt(newProduct.stock) < 0) {
            setMessage('🚫 Error: El stock no puede ser negativo.');
            return;
        }
        
        if (newProduct.low_stock_threshold !== '' && parseInt(newProduct.low_stock_threshold) < 0) {
            setMessage('🚫 Error: El umbral de stock bajo no puede ser negativo.');
            return;
        }

        const productExistsInInventory = inventory.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase());
        const productExistsInProducts = products.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase());
        
        if (productExistsInInventory && productExistsInProducts) {
            setMessage('⚠️ Error: El producto ya existe en el sistema.');
            return;
        }

        try {
            const token = getInMemoryToken();
            if (!token) {
                setMessage('🚫 Error: No hay token de autenticación. Por favor, vuelve a iniciar sesión.');
                return;
            }

            if (newProduct.category === 'Producto' && newProduct.stock > 0) {
                for (const item of recipeItems) {
                    if (!item.ingredient || !item.quantity || parseFloat(item.quantity) <= 0) {
                        setMessage('🚫 Error: Todos los insumos deben tener cantidad válida.');
                        return;
                    }

                    const ingredientInStore = products.find(p => p.id === item.ingredient);
                    if (!ingredientInStore) {
                        setMessage(`🚫 Error: Insumo no encontrado en inventario.`);
                        return;
                    }

                    const recipeYield = newProduct.recipe_yield ? parseFloat(newProduct.recipe_yield) : 1;
                    const stockFloat = newProduct.stock ? parseFloat(newProduct.stock) : 0;
                    const multiplier = recipeYield > 0 ? (stockFloat / recipeYield) : 0;
                    let requiredQuantity = parseFloat(item.quantity) * multiplier;

                    if ((item.unit || '').toString().toLowerCase() === 'unidades') {
                        requiredQuantity = Math.ceil(requiredQuantity);
                    }

                    if (ingredientInStore.stock < requiredQuantity) {
                        const requiredFormatted = formatQuantityWithConversion(requiredQuantity, item.unit);
                        const availableFormatted = formatQuantityWithConversion(ingredientInStore.stock, ingredientInStore.unit || item.unit);
                        setMessage(`🚫 Stock insuficiente para "${ingredientInStore.name}". Necesitas ${requiredFormatted}, disponible: ${availableFormatted}.`);
                        return;
                    }
                }
            }

            let recipePayload = [];
            if (newProduct.category === 'Producto') {
                recipePayload = recipeItems
                    .filter(item => item.ingredient && parseFloat(item.quantity) > 0)
                    .map(item => ({
                        ingredient: item.ingredient,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                    }));
            }

            const convertToBaseUnit = (value, unit) => {
                if (unit === 'g') return value * 1000;
                if (unit === 'ml') return value * 1000;
                return value;
            };

            const payload = {
                name: newProduct.name.trim(),
                description: newProduct.description.trim(),
                price: parseFloat(newProduct.price),
                stock: convertToBaseUnit(newProduct.stock ? parseInt(newProduct.stock) : 0, newProduct.unit),
                recipe_yield: newProduct.recipe_yield ? parseInt(newProduct.recipe_yield) : 1,
                low_stock_threshold: convertToBaseUnit(newProduct.low_stock_threshold ? parseInt(newProduct.low_stock_threshold) : 10, newProduct.unit),
                high_stock_multiplier: newProduct.high_stock_multiplier ? parseFloat(newProduct.high_stock_multiplier) : 2.5,
                category: newProduct.category,
                unit: newProduct.unit,
                recipe_ingredients: recipePayload
            };
            
            await api.post('/products/', payload);
            await loadProducts();
            setMessage('✅ Producto creado exitosamente.');
            
            // Limpiar formulario
            setNewProduct({ 
                name: '', 
                description: '', 
                price: '', 
                stock: '', 
                recipe_yield: '',
                low_stock_threshold: '',
                high_stock_multiplier: '',
                category: 'Producto',
                unit: 'unidades'
            });
            setRecipeItems([]);
            
            setTimeout(() => setMessage(''), 4000);
        } catch (error) {
            console.error('Error creando producto:', error);
            if (error.response) {
                if (error.response.status === 400) {
                    setMessage('🚫 Error: ' + (error.response.data.detail || JSON.stringify(error.response.data)));
                } else if (error.response.status === 401) {
                    setMessage('🚫 Error: No tienes autorización.');
                } else if (error.response.status === 403) {
                    setMessage('🚫 Error: Sin permisos.');
                } else {
                    setMessage(`🚫 Error del servidor: ${error.response.status}`);
                }
            } else if (error.request) {
                setMessage('🚫 Error: No se pudo conectar con el servidor.');
            } else {
                setMessage('🚫 Error: ' + (error.message || 'Error desconocido.'));
            }
        }
    };

    // Configuración responsiva
    const getLayoutConfig = () => {
        if (screenWidth >= 1710) {
            // Layout de 3 columnas: Datos Básicos | Config Stock | Composición
            return { 
                layout: 'three-column', 
                leftWidth: '340px',
                centerWidth: '340px',
                ingredientCols: 3,
                gap: '24px'
            };
        }
        if (screenWidth >= 1200) {
            return { 
                layout: 'two-column', 
                leftWidth: '340px', 
                ingredientCols: 3,
                gap: '20px'
            };
        }
        if (screenWidth >= 768) {
            return { 
                layout: 'two-column', 
                leftWidth: '300px', 
                ingredientCols: 2,
                gap: '16px'
            };
        }
        return { 
            layout: 'single-column', 
            leftWidth: '100%', 
            ingredientCols: 1,
            gap: '12px'
        };
    };

    const config = getLayoutConfig();
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1200;
    const isThreeColumn = config.layout === 'three-column';

    // Estilos personalizados para react-select
    const selectStyles = {
        control: (base) => ({
            ...base,
            minHeight: isMobile ? '40px' : '38px',
            fontSize: isMobile ? '14px' : '13px',
            borderColor: '#e2e8f0',
            '&:hover': { borderColor: '#cbd5e0' }
        }),
        menu: (base) => ({
            ...base,
            zIndex: 50,
            fontSize: isMobile ? '14px' : '13px'
        }),
        option: (base) => ({
            ...base,
            padding: isMobile ? '10px 12px' : '8px 10px'
        })
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <h2 className="text-base font-bold text-slate-800">Crear Producto</h2>
                </div>
                <button 
                    onClick={handleCreateProduct}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    GUARDAR
                </button>
            </div>

            {/* Mensaje */}
            {message && (
                <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    message.includes('✅') 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : message.includes('⚠️')
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {message}
                </div>
            )}

            {/* Contenido principal */}
            <form onSubmit={handleCreateProduct} className="p-4">
                <div style={{
                    display: 'flex',
                    flexDirection: config.layout === 'single-column' ? 'column' : 'row',
                    gap: config.gap,
                    alignItems: 'flex-start'
                }}>
                    {/* Panel Izquierdo - Datos Básicos */}
                    <div style={{
                        width: config.layout === 'single-column' ? '100%' : config.leftWidth,
                        flexShrink: 0
                    }}>
                        {/* Sección Datos Básicos */}
                        <div className={`bg-slate-50 rounded-xl p-4 border border-slate-200 ${!isThreeColumn ? 'mb-4' : ''}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Datos Básicos</span>
                            </div>

                            <div className="space-y-3">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">NOMBRE *</label>
                                    <input 
                                        type="text" 
                                        value={newProduct.name} 
                                        onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
                                        placeholder="Nombre del producto" 
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        required 
                                    />
                                </div>

                                {/* Precio y Descripción en fila */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">PRECIO *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                            <input 
                                                type="number" 
                                                value={newProduct.price} 
                                                onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} 
                                                min="0"
                                                placeholder="0"
                                                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                required 
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">DESCRIPCIÓN</label>
                                        <textarea 
                                            value={newProduct.description} 
                                            onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} 
                                            placeholder="Detalles..."
                                            rows="2"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sección Configuración de Stock - Solo en layout de 2 columnas o menos */}
                        {!isThreeColumn && (
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Configuración de Stock</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Stock Inicial */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">STOCK INICIAL *</label>
                                        <input 
                                            type="number" 
                                            value={newProduct.stock} 
                                            onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} 
                                            min="0"
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            required 
                                        />
                                    </div>

                                    {/* Rendimiento Receta */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">RENDIMIENTO RECETA</label>
                                        <input
                                            type="number"
                                            value={newProduct.recipe_yield}
                                            onChange={e => setNewProduct({ ...newProduct, recipe_yield: e.target.value })}
                                            min="1"
                                            placeholder="Ej: 10"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Umbral Stock Bajo */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">UMBRAL STOCK BAJO</label>
                                        <input
                                            type="number"
                                            value={newProduct.low_stock_threshold}
                                            onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })}
                                            min="0"
                                            placeholder="Ej: 10"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Mult. Stock Alto */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">MULT. STOCK ALTO</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={newProduct.high_stock_multiplier}
                                            onChange={e => setNewProduct({ ...newProduct, high_stock_multiplier: e.target.value })}
                                            min="1.1"
                                            placeholder="Ej: 2.5"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel Central - Configuración de Stock (solo en layout de 3 columnas) */}
                    {isThreeColumn && (
                        <div style={{
                            width: config.centerWidth,
                            flexShrink: 0
                        }}>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 h-full">
                                <div className="flex items-center gap-2 mb-3">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Configuración de Stock</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Stock Inicial */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">STOCK INICIAL *</label>
                                        <input 
                                            type="number" 
                                            value={newProduct.stock} 
                                            onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} 
                                            min="0"
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            required 
                                        />
                                    </div>

                                    {/* Rendimiento Receta */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">RENDIMIENTO RECETA</label>
                                        <input
                                            type="number"
                                            value={newProduct.recipe_yield}
                                            onChange={e => setNewProduct({ ...newProduct, recipe_yield: e.target.value })}
                                            min="1"
                                            placeholder="Ej: 10"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Umbral Stock Bajo */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">UMBRAL STOCK BAJO</label>
                                        <input
                                            type="number"
                                            value={newProduct.low_stock_threshold}
                                            onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })}
                                            min="0"
                                            placeholder="Ej: 10"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Mult. Stock Alto */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">MULT. STOCK ALTO</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={newProduct.high_stock_multiplier}
                                            onChange={e => setNewProduct({ ...newProduct, high_stock_multiplier: e.target.value })}
                                            min="1.1"
                                            placeholder="Ej: 2.5"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Panel Derecho - Composición */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 h-full">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Composición</span>
                                </div>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                    {recipeItems.length} INS.
                                </span>
                            </div>

                            {/* Agregar insumo */}
                            <div className="flex gap-2 mb-4" style={{ flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                <div style={{ flex: isMobile ? '1 1 100%' : '1 1 auto', minWidth: isMobile ? '100%' : '200px' }}>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">INSUMO</label>
                                    <Select
                                        options={ingredientOptions}
                                        value={newIngredient.ingredient}
                                        onChange={selected => {
                                            if (selected) {
                                                const ing = products.find(p => p.id === selected.value);
                                                const normalizeUnit = (u) => {
                                                    if (!u) return 'g';
                                                    const s = String(u).toLowerCase().trim();
                                                    if (['g', 'gr', 'grs', 'gramo', 'gramos'].includes(s)) return 'g';
                                                    if (['ml', 'mililitro', 'mililitros'].includes(s)) return 'ml';
                                                    if (['unidad', 'unidades', 'u', 'uds'].includes(s)) return 'unidades';
                                                    return 'g';
                                                };
                                                setNewIngredient({
                                                    ingredient: selected,
                                                    quantity: newIngredient.quantity || '',
                                                    unit: normalizeUnit(ing?.unit)
                                                });
                                            } else {
                                                setNewIngredient({ ...newIngredient, ingredient: null });
                                            }
                                        }}
                                        placeholder="Buscar..."
                                        isClearable
                                        styles={selectStyles}
                                    />
                                </div>
                                <div style={{ width: isMobile ? '50%' : '80px', flexShrink: 0 }}>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">CANT.</label>
                                    <input
                                        type="number"
                                        value={newIngredient.quantity}
                                        onChange={e => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                        placeholder="0"
                                        min="0"
                                        step="any"
                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                                        style={{ height: '38px' }}
                                    />
                                </div>
                                <div style={{ width: isMobile ? 'calc(50% - 8px)' : 'auto', flexShrink: 0, alignSelf: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={addRecipeItem}
                                        disabled={!newIngredient.ingredient || !newIngredient.quantity || parseFloat(newIngredient.quantity) <= 0}
                                        className={`w-full px-3 py-1.5 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-1 ${
                                            !newIngredient.ingredient || !newIngredient.quantity || parseFloat(newIngredient.quantity) <= 0
                                                ? 'bg-slate-300 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md'
                                        }`}
                                        style={{ height: '38px', minWidth: isMobile ? '100%' : '44px' }}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Lista de insumos como tarjetas */}
                            {recipeItems.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    Agrega insumos para la receta
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isThreeColumn 
                                        ? `repeat(auto-fill, minmax(275px, 1fr))`
                                        : `repeat(${config.ingredientCols}, 1fr)`,
                                    gap: isMobile ? '8px' : '10px'
                                }}>
                                    {recipeItems.map((item, index) => (
                                        <div 
                                            key={index}
                                            className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md transition-all group relative"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => removeRecipeItem(index)}
                                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                            
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-slate-700 truncate pr-6" title={item.ingredientName}>
                                                    {item.ingredientName}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-baseline gap-1 mt-1">
                                                <span className="text-xl font-bold text-slate-800">
                                                    {getDisplayQuantity(item.quantity, item.unit)}
                                                </span>
                                                <span className="text-xs font-medium text-slate-400">
                                                    {getDisplayUnit(item.unit)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Botón guardar para móviles (fijo en bottom) */}
                {isMobile && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg z-50">
                        <button 
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-base font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            GUARDAR PRODUCTO
                        </button>
                    </div>
                )}
                
                {/* Espaciado para el botón fijo en móviles */}
                {isMobile && <div className="h-20"></div>}
            </form>
        </div>
    );
};

export default CrearNuevoProducto;
