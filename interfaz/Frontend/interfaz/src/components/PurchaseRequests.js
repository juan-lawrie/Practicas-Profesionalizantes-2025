
import React from 'react';

const PurchaseRequests = ({ purchases, onApprove, onReject, userRole }) => {
    
    // Formatear fecha como año/mes/dia hora:minutos
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    };

    // Obtener nombre completo de la unidad
    const getUnitName = (unit) => {
        switch (unit?.toLowerCase()) {
            case 'kg':
            case 'g':
                return 'Kilogramo';
            case 'l':
            case 'ml':
                return 'Litro';
            case 'u':
            case 'unidades':
            default:
                return 'Unidad';
        }
    };

    // Obtener etiqueta de precio según unidad
    const getPriceLabel = (unit) => {
        const unitName = getUnitName(unit);
        return `Precio por ${unitName}`;
    };

    return (
        <div className="purchase-requests-container">
            <h3 className="text-base xs:text-lg sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">Solicitudes de Compra Pendientes</h3>
            
            {purchases.length === 0 ? (
                <div className="text-center py-6 sm:py-10 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p className="text-sm sm:text-base">No hay solicitudes de compra pendientes.</p>
                </div>
            ) : (
                <div className="grid gap-2 xs:gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
                    {purchases.map(purchase => (
                        <div 
                            key={purchase.id} 
                            className="bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        >
                            {/* Encabezado de la tarjeta */}
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 sm:px-4 sm:py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-white font-semibold text-xs sm:text-sm">
                                        ID {purchase.id}
                                    </span>
                                    <span className="bg-white/20 text-white text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full">
                                        Pendiente
                                    </span>
                                </div>
                            </div>

                            {/* Contenido de la tarjeta */}
                            <div className="p-3 sm:p-4">
                                {/* Proveedor y Fecha en la misma fila si hay espacio */}
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-2 sm:mb-3">
                                    {/* Proveedor */}
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Proveedor:</span>
                                        <span className="text-xs sm:text-sm font-semibold text-slate-700">{purchase.supplier_name || 'N/A'}</span>
                                    </div>

                                    {/* Fecha */}
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Fecha:</span>
                                        <span className="text-xs sm:text-sm font-medium text-slate-700">{formatDate(purchase.created_at)}</span>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-slate-100">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide flex-shrink-0">Total:</span>
                                    <span className="text-base sm:text-lg font-bold text-green-600">
                                        ${(purchase.total || purchase.total_amount || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Productos/Insumos */}
                                <div className="mb-3 sm:mb-4">
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                        </svg>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide font-semibold">Productos/Insumos</span>
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2 max-h-36 sm:max-h-48 overflow-y-auto">
                                        {purchase.items.map((item, index) => (
                                            <div 
                                                key={index} 
                                                className="bg-slate-50 rounded-md sm:rounded-lg p-2 sm:p-2.5 text-xs sm:text-sm"
                                            >
                                                <div className="font-medium text-slate-700 mb-0.5 sm:mb-1 truncate">
                                                    {item.productName || item.product_name || item.product}
                                                </div>
                                                <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5 sm:gap-y-1 text-[10px] sm:text-xs text-slate-500">
                                                    <span className="whitespace-nowrap">
                                                        <span className="font-medium">Cantidad:</span> {item.quantity} {(() => {
                                                            const unit = getUnitName(item.unit);
                                                            if (unit === 'Unidad') {
                                                                return item.quantity !== 1 ? 'Unidades' : 'Unidad';
                                                            }
                                                            return item.quantity !== 1 ? unit + 's' : unit;
                                                        })()}
                                                    </span>
                                                    <span className="whitespace-nowrap">
                                                        <span className="font-medium">{getPriceLabel(item.unit)}:</span> ${item.unitPrice || item.unit_price || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Botones de acción */}
                                {userRole === 'Gerente' && (
                                    <div className="flex gap-1.5 sm:gap-2 pt-2 sm:pt-3 border-t border-slate-100">
                                        <button 
                                            onClick={() => onApprove(purchase.id)} 
                                            className="flex-1 px-2 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                                        >
                                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                            </svg>
                                            <span className="hidden xs:inline">Aprobar</span>
                                            <span className="xs:hidden">✓</span>
                                        </button>
                                        <button 
                                            onClick={() => onReject(purchase.id)} 
                                            className="flex-1 px-2 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-md sm:rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition-all"
                                        >
                                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                            </svg>
                                            <span className="hidden xs:inline">Rechazar</span>
                                            <span className="xs:hidden">✗</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PurchaseRequests;
