import React, { useState } from 'react';
import type { Worry, WorryReflection } from '../types/types';
import { format } from 'date-fns';

interface WorryCloseModalProps {
    worry: Worry;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reflection: WorryReflection) => void;
}

const WorryCloseModal: React.FC<WorryCloseModalProps> = ({ worry, isOpen, onClose, onSubmit }) => {
    const [reflection, setReflection] = useState<WorryReflection>({
        intentAchieved: '',
        intentChanged: '',
        satisfiedWithResult: '',
        whatChanged: '',
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof WorryReflection, value: string) => {
        setReflection(prev => ({ ...prev, [field]: value }));
    };

    const isValid = Object.values(reflection).every(val => val.trim().length > 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isValid) {
            onSubmit(reflection);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-bg-secondary rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-bg-tertiary">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-text-primary">고민 마무리하기</h2>
                        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">✕</button>
                    </div>

                    <div className="bg-green-900/20 rounded-xl p-4 mb-6 border border-green-800/50">
                        <h3 className="font-bold text-green-400 mb-1">{worry.title}</h3>
                        <p className="text-sm text-green-300/80">
                            {format(worry.startDate, 'yyyy.MM.dd')} ~ {format(new Date(), 'yyyy.MM.dd')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                💭 처음에 세운 의도를 이루었는가?
                            </label>
                            <textarea
                                value={reflection.intentAchieved}
                                onChange={(e) => handleChange('intentAchieved', e.target.value)}
                                className="w-full p-3 bg-bg-tertiary border border-bg-tertiary rounded-xl text-text-primary focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[80px] text-sm placeholder-text-secondary/50"
                                placeholder="처음의 목표나 바람이 달성되었나요?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                🔄 의도가 중간에 변화했는가?
                            </label>
                            <textarea
                                value={reflection.intentChanged}
                                onChange={(e) => handleChange('intentChanged', e.target.value)}
                                className="w-full p-3 bg-bg-tertiary border border-bg-tertiary rounded-xl text-text-primary focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[80px] text-sm placeholder-text-secondary/50"
                                placeholder="과정 중에 생각이 바뀐 부분이 있다면?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                ✨ 내가 만든 결과가 마음에 드는가?
                            </label>
                            <textarea
                                value={reflection.satisfiedWithResult}
                                onChange={(e) => handleChange('satisfiedWithResult', e.target.value)}
                                className="w-full p-3 bg-bg-tertiary border border-bg-tertiary rounded-xl text-text-primary focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[80px] text-sm placeholder-text-secondary/50"
                                placeholder="지금의 상황이나 결과에 만족하나요?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                🌱 이 과정에서 어떤 변화가 일어났는가?
                            </label>
                            <textarea
                                value={reflection.whatChanged}
                                onChange={(e) => handleChange('whatChanged', e.target.value)}
                                className="w-full p-3 bg-bg-tertiary border border-bg-tertiary rounded-xl text-text-primary focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[80px] text-sm placeholder-text-secondary/50"
                                placeholder="나에게 어떤 배움이나 성장이 있었나요?"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={!isValid}
                                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                마무리하기
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default WorryCloseModal;
