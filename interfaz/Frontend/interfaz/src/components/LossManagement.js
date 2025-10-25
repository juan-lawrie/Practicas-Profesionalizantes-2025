import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../services/api';

const LossManagement = ({ products, userRole, loadProducts }) => {
    const [activeSubTab, setActiveSubTab] = useState('register'); // 'register', 'history', 'configure'
    const [lossRecords, setLossRecords] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

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

    // Opciones para el selector de productos
    const productOptions = products.map(p => ({ 
        value: p.id, 
        label: `${p.name} (Stock: ${p.stock}) - ${p.category}`,
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

    // Manejar registro de nueva pérdida
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

        try {
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

    // Manejar selección de producto
    const handleProductChange = (selectedProduct) => {
        setNewLoss(prev => ({
            ...prev,
            product: selectedProduct,
            category: '' // Limpiar categoría cuando cambia el producto
        }));
    };

    // Actualizar tasa de pérdida de un producto
    const updateProductLossRate = async (productId, newRate) => {
        try {
            // Convertir el porcentaje ingresado a decimal para el backend
            const decimalRate = parseFloat(newRate) / 100;
            await api.patch(`/products/${productId}/`, {
                loss_rate: decimalRate
            });
            setMessage('✅ Tasa de pérdida actualizada exitosamente.');
            await loadProducts();
        } catch (err) {
            setError('Error al actualizar la tasa de pérdida.');
            console.error('Error:', err);
        }
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
                <button
                    className={`sub-tab-button ${activeSubTab === 'configure' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('configure')}
                >
                    Configurar Tasas
                </button>
            </div>

            {/* Mensajes */}
            {message && <div className="message success-message">{message}</div>}
            {error && <div className="message error-message">{error}</div>}

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
                                <label htmlFor="quantity">Cantidad Perdida *</label>
                                <input
                                    id="quantity"
                                    type="number"
                                    step="0.01"
                                    value={newLoss.quantity}
                                    onChange={(e) => setNewLoss({...newLoss, quantity: e.target.value})}
                                    placeholder="Ej: 5.5"
                                    min="0"
                                    required
                                />
                                {newLoss.product && (
                                    <small>Unidad: {products.find(p => p.id === newLoss.product.value)?.unit || 'unidades'}</small>
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

                {/* Configurar Tasas */}
                {activeSubTab === 'configure' && (
                    <div className="configure-rates-container">
                        <div className="configure-rates-header">
                            <h4>⚙️ Configurar Tasas de Pérdida Esperada</h4>
                            <p className="configure-rates-description">
                                Define el porcentaje de pérdida esperado para cada producto e insumo durante la producción. 
                                Estos valores se aplicarán automáticamente al calcular las cantidades necesarias.
                            </p>
                        </div>
                        
                        <div className="rates-grid">
                            {products.map(product => (
                                <div key={product.id} className="rate-card">
                                    <div className="rate-card-header">
                                        <div className="product-details">
                                            <h5 className="product-name">{product.name}</h5>
                                            <span className={`category-badge ${product.category.toLowerCase()}`}>
                                                {product.category}
                                            </span>
                                        </div>
                                        <div className="stock-info">
                                            <small>Stock: {product.stock} {product.unit}</small>
                                        </div>
                                    </div>
                                    
                                    <div className="rate-control-section">
                                        <label className="rate-label">Tasa de Pérdida</label>
                                        <div className="rate-input-group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="100"
                                                className="rate-input"
                                                defaultValue={((product.loss_rate || 0.02) * 100).toFixed(1)}
                                                onBlur={(e) => {
                                                    const newRate = parseFloat(e.target.value);
                                                    const currentRate = ((product.loss_rate || 0.02) * 100);
                                                    if (!isNaN(newRate) && newRate !== currentRate) {
                                                        updateProductLossRate(product.id, newRate);
                                                    }
                                                }}
                                                placeholder="0.0"
                                            />
                                            <span className="percentage-symbol">%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LossManagement;