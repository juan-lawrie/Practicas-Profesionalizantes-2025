import React, { useEffect, useState } from 'react';
import { formatMovementDate } from '../utils/date';
import { formatMoney } from '../utils/format';
import { getCashRegisterSessions, openCashRegister, closeCashRegister, getApiErrorMessage } from '../services/api';

// Roles que pueden abrir y cerrar la caja (todos menos Panadero)
export const ROLES_APERTURA_CAJA = ['Gerente', 'Encargado', 'Cajero'];

const EstadoBadge = ({ isOpen }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
        {isOpen ? 'Abierta' : 'Cerrada'}
    </span>
);

const FilaMonto = ({ label, value, className = 'text-gray-800', destacado = false }) => (
    <div className="flex justify-between items-center gap-4">
        <dt className={`text-gray-600 ${destacado ? 'font-semibold' : ''}`}>{label}</dt>
        <dd className={`${className} ${destacado ? 'text-lg font-bold' : 'font-medium'}`}>{formatMoney(value)}</dd>
    </div>
);

const TurnoCard = ({ turno, numero }) => (
    <div className="border border-gray-200 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-gray-800">Turno {numero}</span>
            <EstadoBadge isOpen={turno.is_open} />
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 text-sm">
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Apertura</p>
                <p className="text-gray-700">{formatMovementDate(turno.opened_at)}</p>
                <p className="text-gray-600">por {turno.opened_by || 'usuario eliminado'}</p>
                <p className="font-semibold text-gray-800">{formatMoney(turno.opening_balance)}</p>
            </div>
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Cierre</p>
                {turno.is_open ? (
                    <p className="text-green-700">Todavía abierta</p>
                ) : (
                    <>
                        <p className="text-gray-700">{formatMovementDate(turno.closed_at)}</p>
                        <p className="text-gray-600">por {turno.closed_by || 'usuario eliminado'}</p>
                        <p className="font-semibold text-gray-800">{formatMoney(turno.closing_balance)}</p>
                    </>
                )}
            </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
            {turno.movements_count} movimientos · Entradas {formatMoney(turno.total_entradas)} · Salidas {formatMoney(turno.total_salidas)}
        </p>
    </div>
);

const Apertura_Cierre_Caja = ({ cashRegister, onRefresh }) => {
    const [confirmAction, setConfirmAction] = useState(null); // 'open' | 'close'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [historySessions, setHistorySessions] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const today = cashRegister?.today || '';
    const isToday = !selectedDate || selectedDate === today;

    useEffect(() => {
        if (isToday) {
            setHistorySessions(null);
            return undefined;
        }
        let cancelled = false;
        setHistoryLoading(true);
        getCashRegisterSessions(selectedDate)
            .then(response => {
                if (!cancelled) setHistorySessions(Array.isArray(response.data) ? response.data : []);
            })
            .catch(error => {
                console.error('Error cargando los turnos de caja:', error);
                if (!cancelled) setHistorySessions([]);
            })
            .finally(() => {
                if (!cancelled) setHistoryLoading(false);
            });
        return () => { cancelled = true; };
    }, [selectedDate, isToday]);

    if (!cashRegister) {
        return (
            <div className="max-w-5xl mx-auto p-2 md:p-4">
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                    Cargando estado de la caja...
                </div>
            </div>
        );
    }

    const {
        is_open: isOpen,
        session,
        current_balance: currentBalance,
        openings_today: openingsToday,
        closings_today: closingsToday,
        max_per_day: maxPerDay,
        can_manage: canManage,
        can_open: canOpen,
        can_close: canClose,
    } = cashRegister;
    const sessionsToShow = isToday ? (cashRegister.today_sessions || []) : (historySessions || []);

    const requestAction = (action) => {
        setMessage(null);
        setConfirmAction(action);
        onRefresh();
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            if (confirmAction === 'open') {
                const { data } = await openCashRegister();
                setMessage({ type: 'success', text: `Caja abierta el ${formatMovementDate(data.opened_at)} con ${formatMoney(data.opening_balance)} en caja.` });
            } else {
                const { data } = await closeCashRegister();
                setMessage({ type: 'success', text: `Caja cerrada el ${formatMovementDate(data.closed_at)} con ${formatMoney(data.closing_balance)} en caja.` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: getApiErrorMessage(error, 'No se pudo completar la operación. Intentá de nuevo.') });
        } finally {
            setIsSubmitting(false);
            setConfirmAction(null);
            onRefresh();
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-2 md:p-4 space-y-4">
            {message && (
                <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <section className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xl font-bold text-gray-700">Estado de la caja</h3>
                        <EstadoBadge isOpen={isOpen} />
                    </div>

                    {isOpen && session ? (
                        <>
                            <p className="text-sm text-gray-600 mb-3">
                                Abierta por <span className="font-semibold text-gray-800">{session.opened_by || 'usuario eliminado'}</span> el {formatMovementDate(session.opened_at)}
                            </p>
                            <dl className="space-y-2 text-sm">
                                <FilaMonto label="Dinero al abrir" value={session.opening_balance} />
                                <FilaMonto label="Entradas del turno" value={session.total_entradas} className="text-green-600" />
                                <FilaMonto label="Salidas del turno" value={session.total_salidas} className="text-red-600" />
                                <div className="border-t border-gray-200 pt-2">
                                    <FilaMonto label="Dinero actual en caja" value={currentBalance} destacado />
                                </div>
                            </dl>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600 mb-3">
                                La caja está cerrada. No se pueden registrar ventas ni movimientos hasta que se abra.
                            </p>
                            <dl className="text-sm">
                                <FilaMonto label="Dinero actual en caja" value={currentBalance} destacado />
                            </dl>
                        </>
                    )}

                    {canManage && (
                        <div className="mt-4">
                            {isOpen ? (
                                <button
                                    type="button"
                                    onClick={() => requestAction('close')}
                                    disabled={!canClose}
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                                >
                                    Cerrar caja
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => requestAction('open')}
                                    disabled={!canOpen}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                                >
                                    Abrir caja
                                </button>
                            )}
                            {!isOpen && openingsToday >= maxPerDay && (
                                <p className="text-xs text-amber-700 mt-2">
                                    Ya se usaron las {maxPerDay} aperturas de hoy. La caja se podrá volver a abrir mañana.
                                </p>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-gray-500 mt-3">
                        Aperturas hoy: {openingsToday} de {maxPerDay} · Cierres hoy: {closingsToday} de {maxPerDay}
                    </p>
                </section>

                <section className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                        <h3 className="text-xl font-bold text-gray-700">
                            {isToday ? 'Turnos de hoy' : `Turnos del ${selectedDate.split('-').reverse().join('/')}`}
                        </h3>
                        <input
                            type="date"
                            value={selectedDate || today}
                            max={today || undefined}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {historyLoading ? (
                        <p className="text-sm text-gray-500 text-center py-6">Cargando turnos...</p>
                    ) : sessionsToShow.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">No hubo aperturas de caja este día.</p>
                    ) : (
                        <div className="space-y-3">
                            {sessionsToShow.map((turno, index) => (
                                <TurnoCard key={turno.id} turno={turno} numero={index + 1} />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {confirmAction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                            {confirmAction === 'open' ? '¿Abrir la caja?' : '¿Cerrar la caja?'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            {confirmAction === 'open'
                                ? `Quedan registradas la fecha, la hora y tu usuario. Los movimientos que se hagan desde ahora quedan asociados a esta apertura. Es la apertura ${openingsToday + 1} de ${maxPerDay} de hoy.`
                                : 'Quedan registradas la fecha, la hora y tu usuario. Después del cierre no se pueden registrar ventas ni movimientos hasta una nueva apertura.'}
                        </p>
                        <dl className="space-y-2 text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5">
                            {confirmAction === 'open' ? (
                                <FilaMonto label="Dinero en caja al abrir" value={currentBalance} destacado />
                            ) : (
                                <>
                                    <FilaMonto label="Dinero al abrir" value={session?.opening_balance} />
                                    <FilaMonto label="Entradas del turno" value={session?.total_entradas} className="text-green-600" />
                                    <FilaMonto label="Salidas del turno" value={session?.total_salidas} className="text-red-600" />
                                    <div className="border-t border-gray-200 pt-2">
                                        <FilaMonto label="Dinero en caja al cerrar" value={currentBalance} destacado />
                                    </div>
                                </>
                            )}
                        </dl>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting}
                                className={`px-4 py-2 text-white rounded-lg font-semibold transition-colors disabled:opacity-60 ${confirmAction === 'open' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {isSubmitting ? 'Procesando...' : confirmAction === 'open' ? 'Confirmar apertura' : 'Confirmar cierre'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Apertura_Cierre_Caja;
