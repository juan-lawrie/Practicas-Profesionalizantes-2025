
import React, { useState } from 'react';
import Select from 'react-select';
import api from '../services/api';

const ProductionCreation = ({ products, userRole, loadProducts }) => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    
    // Función para obtener el producto completo seleccionado
    const getSelectedProductData = () => {
        if (!selectedProduct) return null;
        return products.find(p => p.id === selectedProduct.value);
    };

    if (userRole !== 'Gerente') {
        return (
            <div className="unauthorized-message">
                <h2>Acceso Denegado</h2>
                <p>Esta función solo está disponible para el rol de Gerente.</p>
            </div>
        );
    }

    const finalProducts = products.filter(p => !p.is_ingredient && p.category === 'Producto');
    const productOptions = finalProducts.map(p => ({ value: p.id, label: `${p.name} (Stock: ${p.stock})` }));

    const handleProduce = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (!selectedProduct || !quantity) {
            setError('Por favor, selecciona un producto y especifica una cantidad.');
            return;
        }

        const numQuantity = parseInt(quantity, 10);
        if (isNaN(numQuantity) || numQuantity <= 0) {
            setError('La cantidad debe ser un número entero positivo.');
            return;
        }

        // Obtener los datos del producto para aplicar la tasa de pérdida
        const productData = getSelectedProductData();
        const lossRate = productData?.loss_rate || 0.02; // 2% por defecto si no tiene tasa definida
        
        // Calcular la cantidad con pérdida aplicada
        const quantityWithLoss = Math.ceil(numQuantity * (1 + lossRate));

        try {
            const response = await api.post('/products/produce/', {
                product_id: selectedProduct.value,
                quantity: quantityWithLoss,
            });
            
            const lossPercentage = (lossRate * 100).toFixed(1);
            const extraUnits = quantityWithLoss - numQuantity;
            
            setMessage(
                `✅ Producción registrada con éxito. Se produjeron ${quantityWithLoss} unidades ` +
                `(${numQuantity} deseadas + ${extraUnits} extra por tasa de pérdida del ${lossPercentage}%).`
            );
            setSelectedProduct(null);
            setQuantity('');
            // Recargar la lista de productos para ver el stock actualizado
            await loadProducts();
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Ocurrió un error al registrar la producción.';
            setError(errorMessage);
            console.error('Error creating production:', err);
        }
    };

    return (
        <div className="production-creation-container form-container">
            <h3>Crear Producción de Producto Existente</h3>
            {message && <p className="message success-message">{message}</p>}
            {error && <p className="message error-message">{error}</p>}
            <form onSubmit={handleProduce}>
                <div className="form-group">
                    <label htmlFor="product-select">Producto a Producir</label>
                    <Select
                        id="product-select"
                        options={productOptions}
                        value={selectedProduct}
                        onChange={setSelectedProduct}
                        placeholder="Selecciona un producto final..."
                        isClearable
                        className="searchable-select"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="quantity">Cantidad a Producir</label>
                    <input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Ej: 50"
                        min="1"
                        required
                    />
                </div>
                
                {/* Información sobre pérdida aplicada */}
                {selectedProduct && quantity && (
                    <div className="loss-info" style={{
                        background: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '6px',
                        border: '1px solid #dee2e6',
                        marginBottom: '20px'
                    }}>
                        <h4 style={{margin: '0 0 10px 0', fontSize: '16px', color: '#495057'}}>
                            Cálculo con Tasa de Pérdida
                        </h4>
                        {(() => {
                            const productData = getSelectedProductData();
                            const lossRate = productData?.loss_rate || 0.02;
                            const numQuantity = parseInt(quantity, 10);
                            const quantityWithLoss = Math.ceil(numQuantity * (1 + lossRate));
                            
                            return (
                                <div>
                                    <p style={{margin: '5px 0', fontSize: '14px'}}>
                                        <strong>Cantidad deseada:</strong> {numQuantity} unidades
                                    </p>
                                    <p style={{margin: '5px 0', fontSize: '14px'}}>
                                        <strong>Tasa de pérdida:</strong> {(lossRate * 100).toFixed(1)}%
                                    </p>
                                    <p style={{margin: '5px 0', fontSize: '14px', color: '#28a745'}}>
                                        <strong>Cantidad total a producir:</strong> {quantityWithLoss} unidades
                                    </p>
                                    <small style={{color: '#6c757d'}}>
                                        Se producirán {quantityWithLoss - numQuantity} unidades adicionales para compensar las pérdidas esperadas.
                                    </small>
                                </div>
                            );
                        })()}
                    </div>
                )}
                
                <div className="button-group">
                    <button type="submit" className="action-button primary">
                        Registrar Producción
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProductionCreation;
