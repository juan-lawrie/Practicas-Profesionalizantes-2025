import React, { useCallback, useEffect, useState } from 'react';
import Registrar_Venta from './Registrar_Venta';
import Movimientos_De_Caja from './Movimientos_De_Caja';
import Apertura_Cierre_Caja, { ROLES_APERTURA_CAJA } from './Apertura_Cierre_Caja';
import { getCashRegisterStatus } from '../services/api';

const CASH_REGISTER_REFRESH_MS = 30000;

// Vive fuera de App para no volver a montarse (y perder la pestaña activa) con cada cambio de estado de App
const SalesView = ({ products, loadProducts, loadCashMovements, cashMovements, cashBalance, userRole }) => {
    const [activeTab, setActiveTab] = useState('ventas'); // 'ventas', 'caja' o 'apertura'
    const [cashRegister, setCashRegister] = useState(null);
    const canManageCashRegister = ROLES_APERTURA_CAJA.includes(userRole);

    const loadCashRegister = useCallback(async () => {
        try {
            const response = await getCashRegisterStatus();
            setCashRegister(prev => (JSON.stringify(prev) === JSON.stringify(response.data) ? prev : response.data));
        } catch (error) {
            console.error('❌ Error cargando el estado de la caja:', error && error.message ? error.message : error);
        }
    }, []);

    // cashMovements cambia después de cada venta o movimiento, así se actualizan los totales del turno
    useEffect(() => {
        loadCashRegister();
    }, [loadCashRegister, cashMovements]);

    useEffect(() => {
        const interval = setInterval(loadCashRegister, CASH_REGISTER_REFRESH_MS);
        return () => clearInterval(interval);
    }, [loadCashRegister]);

    const tabs = [
        { id: 'ventas', label: 'Registrar Venta' },
        { id: 'caja', label: 'Movimientos de Caja' },
    ];
    if (canManageCashRegister) {
        tabs.push({ id: 'apertura', label: 'Apertura y Cierre de Caja' });
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Tabs */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-full mx-auto px-2 sm:px-4">
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-6 font-medium text-lg transition-all rounded-t-lg ${
                                    activeTab === tab.id
                                        ? 'text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                style={activeTab === tab.id ? { backgroundColor: 'rgb(82, 150, 214)' } : {}}
                            >
                                {tab.label}
                            </button>
                        ))}
                        {cashRegister && (
                            <span
                                className={`ml-auto self-center inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                    cashRegister.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${cashRegister.is_open ? 'bg-green-500' : 'bg-red-500'}`} />
                                {cashRegister.is_open
                                    ? `Caja abierta por ${cashRegister.session?.opened_by || 'usuario eliminado'}`
                                    : 'Caja cerrada'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-full mx-auto px-2 sm:px-4 py-4">
                <div style={{ display: activeTab === 'ventas' ? 'block' : 'none' }}>
                    <Registrar_Venta
                        products={products}
                        loadProducts={loadProducts}
                        loadCashMovements={loadCashMovements}
                        isCashRegisterClosed={cashRegister ? !cashRegister.is_open : false}
                    />
                </div>

                <div style={{ display: activeTab === 'caja' ? 'block' : 'none' }}>
                    <Movimientos_De_Caja
                        cashMovements={cashMovements}
                        cashBalance={cashBalance}
                    />
                </div>

                {canManageCashRegister && (
                    <div style={{ display: activeTab === 'apertura' ? 'block' : 'none' }}>
                        <Apertura_Cierre_Caja
                            cashRegister={cashRegister}
                            onRefresh={loadCashRegister}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesView;
