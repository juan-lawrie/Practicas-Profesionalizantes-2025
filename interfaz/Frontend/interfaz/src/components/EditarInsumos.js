import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import api from '../services/api';
import { formatStockDisplay, parseLocaleDecimal, formatDecimalInput, isValidDecimalInput } from '../utils/format';

const EditarInsumos = ({ products, setProducts, loadProducts, isLoading, showEditPanel, setShowEditPanel }) => {
    // Solo mostrar insumos (category === 'Insumo')
    const insumosOnly = products.filter(p => p.category === 'Insumo');
    
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [isFirstRender, setIsFirstRender] = useState(true);
    const [editingProduct, setEditingProduct] = useState({
        name: '',
        price: 0,
        category: 'Insumo',
        stock: 0,
        description: '',
        lowStockThreshold: 10,
        highStockMultiplier: 2.0
    });
    const [message, setMessage] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [highStockMultiplierInput, setHighStockMultiplierInput] = useState(null);
    const [showLoadingMessage, setShowLoadingMessage] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        setMessage('');
        setShowLoadingMessage(false);
        const timer = setTimeout(() => setIsFirstRender(false), 300);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (message && !message.includes('⚠️') && !message.includes('¿Estás seguro')) {
            const timer = setTimeout(() => {
                setMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    useEffect(() => {
        if (isLoading && !isFirstRender) {
            const timer = setTimeout(() => {
                setShowLoadingMessage(true);
            }, 5);
            return () => clearTimeout(timer);
        } else {
            setShowLoadingMessage(false);
        }
    }, [isLoading, isFirstRender]);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredProducts(insumosOnly);
        } else {
            const filtered = insumosOnly.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredProducts(filtered);
        }
    }, [products, searchTerm]);

    const selectProductForEdit = async (product) => {
        if (!product) {
            setMessage('⚠️ Insumo no encontrado.');
            return;
        }
        setSelectedProduct(product);
        setHighStockMultiplierInput(null);
        
        const convertThresholdFromBaseUnit = (threshold, unit) => {
            if (unit === 'g') return threshold / 1000;
            if (unit === 'ml') return threshold / 1000;
            return threshold;
        };
        
        setEditingProduct({
            name: product.name || '',
            price: product.price || 0,
            category: product.category || 'Insumo',
            stock: product.stock || 0,
            description: product.description || '',
            lowStockThreshold: convertThresholdFromBaseUnit(product.lowStockThreshold ?? product.low_stock_threshold ?? 10, product.unit),
            highStockMultiplier: product.highStockMultiplier ?? product.high_stock_multiplier ?? 2.0
        });
        setMessage('');
    };

    const handleSaveChanges = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (!selectedProduct) return;

        if (editingProduct.price <= 0) {
            setMessage('🚫 Error: El precio debe ser un número decimal positivo mayor a cero.');
            return;
        }

        if (!editingProduct.name.trim() || editingProduct.price <= 0 || !editingProduct.category) {
            setMessage('🚫 Error: No se pueden eliminar datos obligatorios (nombre, precio, categoría).');
            return;
        }

        try {
            const convertThresholdToBaseUnit = (threshold, unit) => {
                if (unit === 'g') return threshold * 1000;
                if (unit === 'ml') return threshold * 1000;
                return threshold;
            };

            const updatedProduct = {
                name: editingProduct.name,
                price: parseFloat(editingProduct.price),
                category: editingProduct.category,
                description: editingProduct.description,
                low_stock_threshold: convertThresholdToBaseUnit(parseFloat(editingProduct.lowStockThreshold), selectedProduct.unit),
                high_stock_multiplier: parseFloat(editingProduct.highStockMultiplier)
            };

            await api.put(`/products/${selectedProduct.id}/`, updatedProduct);
            await loadProducts();

            setSelectedProduct(null);
            setEditingProduct({
                name: '',
                price: 0,
                category: 'Insumo',
                stock: 0,
                description: '',
                lowStockThreshold: 10,
                highStockMultiplier: 2.0
            });
            
            setMessage('✅ Insumo actualizado correctamente en el servidor. Los cambios se reflejan en todas las secciones.');
        } catch (error) {
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                if (typeof errorData === 'string') {
                    setMessage(`❌ Error: ${errorData}`);
                } else if (errorData.detail) {
                    setMessage(`❌ Error: ${errorData.detail}`);
                } else {
                    setMessage('❌ Error: No se pudo actualizar el insumo. Verifique los datos.');
                }
            } else {
                setMessage('❌ Error: No se pudo actualizar el insumo en el servidor. Los cambios no fueron guardados.');
            }
        }
    };

    const handleCancelEdit = () => {
        setSelectedProduct(null);
        setEditingProduct({
            name: '',
            price: 0,
            category: 'Insumo',
            stock: 0,
            description: '',
            lowStockThreshold: 10
        });
        setMessage('');
        setConfirmDelete(false);
    };
    
    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        
        if (selectedProduct.hasSales) {
            setMessage(`⚠️ Error: No se puede eliminar un insumo que ya tiene ventas registradas.`);
            setShowDeleteModal(false);
            return;
        }
        
        if (!showDeleteModal) {
            setShowDeleteModal(true);
            return;
        }
        
        try {
            await api.delete(`/products/${selectedProduct.id}/`);
            const updatedProducts = products.filter(product => product.id !== selectedProduct.id);
            setProducts(updatedProducts);
            setSelectedProduct(null);
            setEditingProduct({
                name: '',
                price: 0,
                category: 'Insumo',
                stock: 0,
                description: '',
                lowStockThreshold: 10
            });
            setShowDeleteModal(false);
            setMessage(`✅ Insumo eliminado correctamente del servidor y todas las secciones.`);
        } catch (error) {
            setMessage(`❌ Error: No se pudo eliminar el insumo del servidor. El insumo permanece en el sistema.`);
            setShowDeleteModal(false);
        }
    };
    
    const productsToShow = filteredProducts.length > 0 ? filteredProducts : insumosOnly;

    if (isFirstRender) {
        return null;
    }

    if (showLoadingMessage && !isFirstRender) {
        return <p className="no-products">Cargando insumos...</p>;
    }

    return (
        <div>
            {message && <p className="message">{message}</p>}
            
            <div className="products-list">
                <h3>Insumos Disponibles para Edición</h3>
                
                <div className="search-container" style={{marginBottom: '20px'}}>
                    <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                        <input
                            type="text"
                            placeholder="Buscar por nombre"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                            style={{
                                width: '100%',
                                padding: '10px 40px 10px 10px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                marginBottom: '10px'
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '18px',
                                    cursor: 'pointer',
                                    color: '#666',
                                    marginBottom: '10px'
                                }}
                                title="Limpiar búsqueda"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    {searchTerm && (
                        <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
                            {productsToShow.length} resultado(s) encontrado(s) para "{searchTerm}"
                        </p>
                    )}
                </div>
                
                {productsToShow.length > 0 ? (
                    <ul className="list-container grid gap-4 grid-cols-1 min-[820px]:grid-cols-2 min-[1400px]:grid-cols-3 min-[1600px]:grid-cols-4 min-[1900px]:grid-cols-5 min-[2560px]:grid-cols-6">
                        {productsToShow.map(product => (
                            <React.Fragment key={product.id}>
                                <li className="product-list-item">
                                    <div className="product-info">
                                        <strong>{product.name}</strong>
                                        <span className="product-price">${product.price}</span>
                                        <span className="product-category">{product.category}</span>
                                        <span className="product-stock">Stock: {product.stock}</span>
                                        <span className="product-threshold">Umbral Stock Bajo: {product.lowStockThreshold || 10}</span>
                                        {product.description && (
                                            <span className="product-description">{product.description}</span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => selectProductForEdit(product)}
                                        className="edit-button"
                                    >
                                        Editar
                                    </button>
                                </li>
                            </React.Fragment>
                        ))}
                    </ul>
                ) : (
                    searchTerm ? (
                        <p className="no-products">No se encontraron insumos que coincidan con la búsqueda.</p>
                    ) : (
                        <p className="no-products">No hay insumos nuevos disponibles para editar.</p>
                    )
                )}
            </div>

            {/* Modal de edición de insumo */}
            {selectedProduct && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1200,
                    padding: '20px',
                    overflow: 'auto'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        maxWidth: window.innerWidth >= 2560 ? '1600px' : 
                                  window.innerWidth >= 1900 ? '1400px' : 
                                  window.innerWidth >= 1800 ? '1200px' : 
                                  window.innerWidth >= 1700 ? '1100px' : 
                                  window.innerWidth >= 1350 ? '1000px' : '800px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        padding: window.innerWidth <= 590 ? '15px' : '30px',
                        margin: 'auto'
                    }}>
                        <h3>Editar Insumo: {selectedProduct.name}</h3>
                                        
                                        <form onSubmit={handleSaveChanges} className="form-container">
                                            <div className="form-group">
                                                <label>Nombre del Insumo *</label>
                                                <input 
                                                    type="text" 
                                                    value={editingProduct.name} 
                                                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} 
                                                    placeholder="Nombre del insumo (máximo 100 caracteres)"
                                                    maxLength="100"
                                                    required 
                                                />
                                            </div>
                                            
                                            <div className="form-group">
                                                <label>Precio *</label>
                                                <input 
                                                    type="number" 
                                                    value={editingProduct.price} 
                                                    onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} 
                                                    placeholder="Precio (mayor a 0)"
                                                    min="0.01"
                                                    step="0.01"
                                                    required 
                                                />
                                            </div>
                                            
                                            <div className="form-group">
                                                <label>Descripción</label>
                                                <textarea 
                                                    value={editingProduct.description} 
                                                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                                                    placeholder="Descripción del insumo (opcional)"
                                                    rows="3"
                                                />
                                            </div>
                                            
                                            {/* Fila 1: Stock Actual + Umbral de Stock Bajo */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: window.innerWidth <= 590 ? '1fr' : '1fr 1fr',
                                                gap: '15px',
                                                marginBottom: '15px'
                                            }}>
                                                <div className="form-group" style={{marginBottom: 0}}>
                                                    <label>Stock Actual {selectedProduct?.unit && `(${selectedProduct.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'})`}</label>
                                                    <input 
                                                        type="text"
                                                        value={formatStockDisplay(editingProduct.stock, selectedProduct?.unit)} 
                                                        readOnly
                                                        disabled
                                                        style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                                                        placeholder={`Stock actual en ${selectedProduct?.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'} (solo lectura)`}
                                                    />
                                                    <small style={{ color: '#666', fontSize: '0.9em' }}>
                                                        Este campo es solo informativo. El stock se actualiza automáticamente con las ventas y movimientos de inventario.
                                                    </small>
                                                </div>
                                                
                                                <div className="form-group" style={{marginBottom: 0}}>
                                                    <label>Umbral de Stock Bajo * {selectedProduct?.unit && `(${selectedProduct.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'})`}</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.1"
                                                        value={editingProduct.lowStockThreshold} 
                                                        onChange={e => {
                                                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                                            setEditingProduct({...editingProduct, lowStockThreshold: value});
                                                        }} 
                                                        placeholder={`Nivel de stock para alertas en ${selectedProduct?.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'} (0 o mayor)`}
                                                        min="0"
                                                        required 
                                                    />
                                                    <small className="form-helper-text">
                                                        Cantidad mínima de stock antes de mostrar alertas en el Dashboard
                                                    </small>
                                                </div>
                                            </div>

                                            {/* Fila 2: Multiplicador para Stock Alto */}
                                            <div className="form-group">
                                                <label>Multiplicador para Stock Alto *</label>
                                                <input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={highStockMultiplierInput ?? formatDecimalInput(editingProduct.highStockMultiplier, { maximumFractionDigits: 1 })}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (!isValidDecimalInput(val)) return;
                                                        setHighStockMultiplierInput(val);
                                                        const parsed = parseLocaleDecimal(val);
                                                        if (parsed !== null) {
                                                            setEditingProduct({...editingProduct, highStockMultiplier: parsed});
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const parsed = parseLocaleDecimal(
                                                            highStockMultiplierInput ?? formatDecimalInput(editingProduct.highStockMultiplier, { maximumFractionDigits: 1 })
                                                        );
                                                        const final = Math.max(1.1, parsed ?? 2.0);
                                                        setEditingProduct({...editingProduct, highStockMultiplier: final});
                                                        setHighStockMultiplierInput(null);
                                                    }}
                                                    placeholder="Ej: 2,0 = duplicar, 3,5 = triplicar y medio"
                                                    required 
                                                />
                                                <small className="form-helper-text">
                                                    Factor para calcular stock alto: Stock Alto = Umbral × Multiplicador.
                                                </small>
                                            </div>
                                            
                                            <div className="button-group" style={{
                                                display: 'flex',
                                                gap: '1rem',
                                                flexDirection: window.innerWidth <= 590 ? 'column' : 'row',
                                                flexWrap: 'wrap'
                                            }}>
                                                <button type="submit" className="action-button primary" style={{
                                                    width: window.innerWidth <= 590 ? '100%' : 'auto',
                                                    flex: window.innerWidth > 590 ? '1' : 'none'
                                                }}>
                                                    Guardar Cambios
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEdit}
                                                    className="action-button secondary"
                                                    style={{
                                                        width: window.innerWidth <= 590 ? '100%' : 'auto',
                                                        flex: window.innerWidth > 590 ? '1' : 'none'
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleDeleteProduct}
                                                    className="action-button delete"
                                                    style={{
                                                        width: window.innerWidth <= 590 ? '100%' : 'auto',
                                                        flex: window.innerWidth > 590 ? '1' : 'none'
                                                    }}
                                                >
                                                    Eliminar Insumo
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>,
                document.body
            )}

            {/* Modal de confirmación para eliminar insumo */}
            {showDeleteModal && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1300
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                            ¿Estás seguro que desea eliminar este insumo?
                        </h3>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteProduct}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default EditarInsumos;
