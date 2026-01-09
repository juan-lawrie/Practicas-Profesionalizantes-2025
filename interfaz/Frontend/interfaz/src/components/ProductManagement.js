
import React, { useState } from 'react';
import ProductionCreation from './ProductionCreation';
import LossManagement from './LossManagement';

// Este componente actuará como un wrapper para la vista de creación de productos que está en App.js
const ProductCreationView = (props) => {
    // Aquí pasaremos directamente los props al componente que definiremos en App.js
    // Esto es un placeholder que se reemplazará con el componente real de App.js
    return <div></div>;
};

const ProductManagement = ({ userRole, products, inventory, loadProducts, ProductCreationViewComponent }) => {
    const [activeView, setActiveView] = useState('create'); // 'create', 'produce', or 'losses'

    // Solo el gerente puede ver todas las opciones
    if (userRole !== 'Gerente') {
        return <ProductCreationViewComponent />;
    }

    return (
        <div className="product-management-container ">
            <div className="tab-navigation flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                    className={`tab-button flex-1 min-w-[100px] sm:min-w-[140px] text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap ${activeView === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveView('create')}
                >
                    <span className="hidden sm:inline">Crear Nuevo Producto</span>
                    <span className="sm:hidden">Producto</span>
                </button>
                <button
                    className={`tab-button flex-1 min-w-[100px] sm:min-w-[140px] text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap ${activeView === 'produce' ? 'active' : ''}`}
                    onClick={() => setActiveView('produce')}
                >
                    <span className="hidden sm:inline">Crear Producción</span>
                    <span className="sm:hidden">Producción</span>
                </button>
                <button
                    className={`tab-button flex-1 min-w-[100px] sm:min-w-[140px] text-xs sm:text-sm px-2 sm:px-4 py-2 whitespace-nowrap ${activeView === 'losses' ? 'active' : ''}`}
                    onClick={() => setActiveView('losses')}
                >
                    <span className="hidden sm:inline">Pérdidas y Mermas</span>
                    <span className="sm:hidden">Pérdidas</span>
                </button>
            </div>

            <div className="tab-content">
                {activeView === 'create' && (
                    <ProductCreationViewComponent />
                )}
                {activeView === 'produce' && (
                    <ProductionCreation
                        products={products}
                        userRole={userRole}
                        loadProducts={loadProducts}
                    />
                )}
                {activeView === 'losses' && (
                    <LossManagement
                        products={products}
                        userRole={userRole}
                        loadProducts={loadProducts}
                    />
                )}
            </div>
        </div>
    );
};

export default ProductManagement;
