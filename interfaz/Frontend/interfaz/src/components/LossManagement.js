import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../services/api';
import DialogoHistorialDePerdidas from './dialogoHistorialDePerdidas';
import HistorialPerdidasMovil from './historial_De_Perdidas_Para_Pantallas_Menores_Que_1200_width';

const LossManagement = ({ products, userRole, loadProducts }) => {
    const [activeSubTab, setActiveSubTab] = useState('register'); // 'register', 'history'
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showConfirmLoss, setShowConfirmLoss] = useState(false);
    
    // Detección de pantalla grande para elegir la interfaz adecuada
    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1200);

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1200);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Estados para registrar pérdida
    const [newLoss, setNewLoss] = useState({
        product: null,
        quantity: '',
        category: '',
        description: ''
    });

    // Función para convertir y mostrar el stock en las unidades correctas
    const getDisplayStock = (product) => {
        const stock = parseFloat(product.stock) || 0;
        switch (product.unit) {
            case 'g':
                return `${(stock / 1000).toFixed(3)} kg`; // Convertir gramos a kilos
            case 'ml':
                return `${(stock / 1000).toFixed(3)} l`; // Convertir mililitros a litros
            case 'unidades':
                return `${stock} unidades`;
            default:
                return `${stock} ${product.unit}`;
        }
    };

    // Opciones para el selector de productos
    const productOptions = products.map(p => ({ 
        value: p.id, 
        label: `${p.name} (Stock: ${getDisplayStock(p)}) - ${p.category}`,
        category: p.category
    }));

    // Categorías de pérdida según el tipo de producto
    const getLossCategories = (productCategory) => {
        if (productCategory === 'Insumo') {
            return [
                { value: 'empaque_danado', label: 'Empaque dañado' },
                { value: 'rotura_insumo', label: 'Rotura del insumo' },
                { value: 'sobreuso_receta', label: 'Sobreuso en receta' },
                { value: 'vencimiento', label: 'Vencimiento' },
                { value: 'cadena_frio', label: 'Perdió la cadena de frío - Temperatura inadecuada' }
            ];
        } else {
            return [
                { value: 'accidente_fisico', label: 'Accidentes físicos' },
                { value: 'contaminacion', label: 'Contaminación' },
                { value: 'vencimiento', label: 'Vencimiento' },
                { value: 'cadena_frio', label: 'Perdió la cadena de frío - Temperatura inadecuada' }
            ];
        }
    };

    // Manejar registro de nueva pérdida (abre modal de confirmación)
    const handleRegisterLoss = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (!newLoss.product || !newLoss.quantity || !newLoss.category) {
            setError('Por favor, completa todos los campos obligatorios.');
            return;
        }

        const quantity = parseFloat(newLoss.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            setError('La cantidad debe ser un número positivo.');
            return;
        }

        // Mostrar modal de confirmación
        setShowConfirmLoss(true);
    };

    // Ejecuta el registro de pérdida después de confirmar
    const confirmRegisterLoss = async () => {
        setShowConfirmLoss(false);
        setMessage('');
        setError('');
        try {
            const quantity = parseFloat(newLoss.quantity);
            const payload = {
                product: newLoss.product.value,
                quantity: quantity,
                category: newLoss.category,
                description: newLoss.description.trim()
            };

            await api.post('/loss-records/', payload);
            setMessage('✅ Pérdida registrada exitosamente.');

            // Limpiar formulario
            setNewLoss({
                product: null,
                quantity: '',
                category: '',
                description: ''
            });

            // Recargar datos
            await loadProducts();
        } catch (err) {
            const errorMessage = err.response?.data?.detail || 
                               err.response?.data?.message || 
                               'Error al registrar la pérdida.';
            setError(errorMessage);
            console.error('Error registrando pérdida:', err);
        }
    };

    // Función para cancelar la confirmación de pérdida
    const handleCancelLoss = () => {
        setShowConfirmLoss(false);
        setMessage('');
        setError('');
    };

    // Manejar selección de producto
    const handleProductChange = (selectedProduct) => {
        setNewLoss(prev => ({
            ...prev,
            product: selectedProduct,
            category: '' // Limpiar categoría cuando cambia el producto
        }));
    };

    // Verificar permisos
    if (userRole !== 'Gerente' && userRole !== 'Encargado') {
        return (
            <div className="unauthorized-message">
                <h2>Acceso Denegado</h2>
                <p>Esta función solo está disponible para Gerentes y Encargados.</p>
            </div>
        );
    }

    return (
        <div className="loss-management-container">
            <h3>Gestión de Pérdidas y Mermas</h3>
            
            {/* Sub-pestañas */}
            <div className="sub-tab-navigation flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
                <button
                    className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 flex-1 sm:flex-none ${
                        activeSubTab === 'register' 
                            ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => setActiveSubTab('register')}
                >
                     Registrar Pérdida
                </button>
                <button
                    className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 flex-1 sm:flex-none ${
                        activeSubTab === 'history' 
                            ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => setActiveSubTab('history')}
                >
                     Historial de Pérdidas
                </button>
            </div>

            {/* Mensajes */}
            {message && <div className="message success-message">{message}</div>}
            {error && <div className="message error-message">{error}</div>}

            {/* Modal de confirmación para registrar pérdida */}
            {showConfirmLoss && (
                <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000}}>
                    <div style={{background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '480px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'}}>
                        <h3 style={{marginTop: 0}}>Confirmar registro de pérdida</h3>
                        <p>¿Estás seguro que deseas registrar esta pérdida? Se actualizará el stock del producto seleccionado.</p>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
                            <button 
                                onClick={handleCancelLoss} 
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors duration-200"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmRegisterLoss} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors duration-200"
                            >
                                ✓ Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenido de sub-pestañas */}
            <div className="sub-tab-content">
                {/* Registrar Pérdida */}
                {activeSubTab === 'register' && (
                    <div className="register-loss-container form-container shrink-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        <h4>Registrar Nueva Pérdida</h4>
                        <form onSubmit={handleRegisterLoss}>
                            <div className="form-group">
                                <label htmlFor="product-select">Producto/Insumo Afectado *</label>
                                <Select
                                    id="product-select"
                                    options={productOptions}
                                    value={newLoss.product}
                                    onChange={handleProductChange}
                                    placeholder="Selecciona un producto o insumo..."
                                    isClearable
                                    className="searchable-select"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="quantity">
                                    {newLoss.product && 
                                        products.find(p => p.id === newLoss.product.value)?.unit === 'g' 
                                        ? 'Cantidad Perdida (en kg) *' 
                                        : newLoss.product && products.find(p => p.id === newLoss.product.value)?.unit === 'ml'
                                        ? 'Cantidad Perdida (en litros) *'
                                        : 'Cantidad Perdida *'
                                    }
                                </label>
                                <input
                                    id="quantity"
                                    type="number"
                                    step="0.01"
                                    value={newLoss.quantity}
                                    onChange={(e) => setNewLoss({...newLoss, quantity: e.target.value})}
                                    placeholder={
                                        newLoss.product && products.find(p => p.id === newLoss.product.value)?.unit === 'g' 
                                        ? "Ej: 2.50 (kg)" 
                                        : newLoss.product && products.find(p => p.id === newLoss.product.value)?.unit === 'ml'
                                        ? "Ej: 1.20 (litros)"
                                        : "Ingrese la cantidad"
                                    }
                                    min="0.01"
                                    required
                                />
                                {newLoss.product && (
                                    <small style={{ color: '#666', fontSize: '0.85em' }}>
                                        {products.find(p => p.id === newLoss.product.value)?.unit === 'g' && (
                                            <>ℹ️ Ingrese la cantidad perdida en kilos. Se descontará automáticamente del stock en gramos.</>
                                        )}
                                        {products.find(p => p.id === newLoss.product.value)?.unit === 'ml' && (
                                            <>ℹ️ Ingrese la cantidad perdida en litros. Se descontará automáticamente del stock en mililitros.</>
                                        )}
                                        {products.find(p => p.id === newLoss.product.value)?.unit === 'unidades' && (
                                            <>ℹ️ Ingrese la cantidad de unidades perdidas.</>
                                        )}
                                    </small>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="category">Motivo de la Pérdida *</label>
                                <select
                                    id="category"
                                    value={newLoss.category}
                                    onChange={(e) => setNewLoss(prev => ({...prev, category: e.target.value}))}
                                    required
                                    disabled={!newLoss.product || !newLoss.product.category}
                                >
                                    <option value="">Selecciona un motivo...</option>
                                    {newLoss.product && newLoss.product.category && 
                                        getLossCategories(newLoss.product.category).map(cat => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Descripción Adicional</label>
                                <textarea
                                    id="description"
                                    value={newLoss.description}
                                    onChange={(e) => setNewLoss({...newLoss, description: e.target.value})}
                                    placeholder="Detalles adicionales sobre la pérdida..."
                                    rows={3}
                                />
                            </div>

                            <div className="button-group mt-6">
                                <button 
                                    type="submit" 
                                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-lg shadow-md hover:from-red-700 hover:to-red-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                >
                                    🔴 Registrar Pérdida
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Historial de Pérdidas - INTERFAZ RESPONSIVA */}
                {activeSubTab === 'history' && (
                    <div className="history-container h-[700px] relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
                        {isLargeScreen ? (
                            <DialogoHistorialDePerdidas 
                                isEmbedded={false} 
                                onClose={() => setActiveSubTab('register')}
                            />
                        ) : (
                            <HistorialPerdidasMovil />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LossManagement;