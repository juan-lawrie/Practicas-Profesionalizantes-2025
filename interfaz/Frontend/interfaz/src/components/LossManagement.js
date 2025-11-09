import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../services/api';

const LossManagement = ({ products, userRole, loadProducts }) => {
    const [activeSubTab, setActiveSubTab] = useState('register'); // 'register', 'history'
    const [lossRecords, setLossRecords] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showConfirmLoss, setShowConfirmLoss] = useState(false); // Confirmación para registrar pérdida

    // Estados para registrar pérdida
    const [newLoss, setNewLoss] = useState({
        product: null,
        quantity: '',
        category: '',
        description: ''
    });

    // Cargar registros de pérdidas
    const loadLossRecords = async () => {
        try {
            const response = await api.get('/loss-records/');
            setLossRecords(response.data);
        } catch (err) {
            console.error('Error cargando registros de pérdidas:', err);
        }
    };

    useEffect(() => {
        if (userRole === 'Gerente' || userRole === 'Encargado') {
            loadLossRecords();
        }
    }, [userRole]);

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
                { value: 'empaque_danado', label: 'Empaque dañado - Se rompió el empaque' },
                { value: 'sobreuso_receta', label: 'Sobreuso en receta - Se usó más de lo planificado' },
                { value: 'vencimiento', label: 'Vencimiento - Fecha de caducidad vencida' },
                { value: 'cadena_frio', label: 'Perdió la cadena de frío - Temperatura inadecuada' }
            ];
        } else {
            return [
                { value: 'accidente_fisico', label: 'Accidentes físicos - Se cayó al piso' },
                { value: 'contaminacion', label: 'Contaminación - Se ensució o contaminó' },
                { value: 'vencimiento', label: 'Vencimiento - Pasó el tiempo de venta' },
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

        // Mostrar modal de confirmación (más visible) y no enviar todavía
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
            await loadLossRecords();
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
            <div className="sub-tab-navigation">
                <button
                    className={`sub-tab-button ${activeSubTab === 'register' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('register')}
                >
                    Registrar Pérdida
                </button>
                <button
                    className={`sub-tab-button ${activeSubTab === 'history' ? 'active' : ''}`}
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
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px'}}>
                            <button onClick={confirmRegisterLoss} className="action-button primary">Confirmar</button>
                            <button onClick={handleCancelLoss} className="action-button secondary">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenido de sub-pestañas */}
            <div className="sub-tab-content">
                {/* Registrar Pérdida */}
                {activeSubTab === 'register' && (
                    <div className="register-loss-container form-container">
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

                            <div className="button-group">
                                <button type="submit" className="action-button primary">
                                    Registrar Pérdida
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Historial de Pérdidas */}
                {activeSubTab === 'history' && (
                    <div className="loss-history-container">
                        <h4>Historial de Pérdidas</h4>
                        {lossRecords.length === 0 ? (
                            <p>No hay registros de pérdidas.</p>
                        ) : (
                            <div className="loss-records-table-container">
                                <table className="loss-records-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Fecha y Hora</th>
                                            <th>Cantidad</th>
                                            <th>Motivo</th>
                                            <th>Costo Estimado</th>
                                            <th>Descripción</th>
                                            <th>Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lossRecords.map(record => (
                                            <tr key={record.id} className="loss-record-row">
                                                <td className="product-name">
                                                    {record.product_name}
                                                </td>
                                                <td className="timestamp">
                                                    <div>
                                                        {new Date(record.timestamp).toLocaleDateString('es-ES')}
                                                    </div>
                                                    <div className="time">
                                                        {new Date(record.timestamp).toLocaleTimeString('es-ES', { 
                                                            hour: '2-digit', minute: '2-digit' 
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="quantity">
                                                    {record.quantity}
                                                </td>
                                                <td className="category">
                                                    {record.category_display}
                                                </td>
                                                <td className="cost">
                                                    ${(parseFloat(record.cost_estimate) || 0).toFixed(2)}
                                                </td>
                                                <td className="description">
                                                    {record.description || 'N/A'}
                                                </td>
                                                <td className="user">
                                                    {record.user_name}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LossManagement;