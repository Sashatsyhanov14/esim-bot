import React, { useState } from 'react';
import { X } from 'lucide-react';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, balance }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would send a notification to the manager via bot/api
        alert(`Заявка на вывод ${amount} ₽ (${method}) отправлена менеджеру!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Вывод бонусов</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 bg-transparent text-gray-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm opacity-70">Сумма (Макс: {balance} ₽)</label>
                        <input
                            type="number"
                            required
                            max={balance}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-transparent"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm opacity-70">Способ выплаты (Карта / USDT / Номер)</label>
                        <input
                            type="text"
                            required
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-transparent"
                            placeholder="Реквизиты..."
                        />
                    </div>

                    <button type="submit" className="w-full py-4 text-lg font-bold">
                        Отправить запрос
                    </button>
                </form>
            </div>
        </div>
    );
};

export default WithdrawModal;
