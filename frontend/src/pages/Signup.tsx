import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const schema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Za-z]/, 'Must include at least one letter')
        .regex(/[0-9]/, 'Must include at least one number')
        .refine(
            (val) => !/^(password|12345678|qwerty|admin)/i.test(val),
            'Password is too common or easily guessable'
        ),
});

type FormData = z.infer<typeof schema>;

export const Signup: React.FC = () => {
    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ 
        resolver: zodResolver(schema),
        mode: 'onChange',
    });
    const passwordValue = watch('password', '');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [serverError, setServerError] = useState<string | null>(null);

    const onSubmit = async (data: FormData): Promise<void> => {
        setServerError(null);
        try {
            // Register new account with backend
            await api.post('/accounts/register/', data);
            
            // Automatically log the new user in to get tokens
            const loginRes = await api.post('/accounts/login/', {
                email: data.email,
                password: data.password,
            });
            await login(loginRes.data.access, loginRes.data.refresh);
            navigate('/');
        } catch (err: any) {
            if (err?.response?.data) {
                const data = err.response.data;
                const messages = Object.entries(data)
                    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                    .join(' | ');
                setServerError(messages || 'Registration failed. Please check your information.');
            } else {
                setServerError('Network error. Unable to complete registration.');
            }
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100/50 p-8 sm:p-10 transition-all">
                    <div className="flex flex-col items-center text-center mb-8">
                        <img 
                            src="/favicon.svg" 
                            alt="Billable BD Logo" 
                            className="w-12 h-12 rounded-xl shadow-md mb-4 object-contain" 
                        />
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create an Account</h2>
                        <p className="text-sm text-slate-500 mt-1.5">Start managing your billable hours and invoices</p>
                    </div>

                    {serverError && (
                        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                            {serverError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    First Name
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        {...register('first_name')}
                                        placeholder="Jane"
                                        className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    />
                                </div>
                                {errors.first_name && (
                                    <span className="text-red-500 text-xs mt-1 block font-medium">
                                        {errors.first_name.message}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Last Name
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        {...register('last_name')}
                                        placeholder="Doe"
                                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    />
                                </div>
                                {errors.last_name && (
                                    <span className="text-red-500 text-xs mt-1 block font-medium">
                                        {errors.last_name.message}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <input
                                    type="email"
                                    {...register('email')}
                                    placeholder="you@company.com"
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>
                            {errors.email && (
                                <span className="text-red-500 text-xs mt-1.5 block font-medium">
                                    {errors.email.message}
                                </span>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type="password"
                                    {...register('password')}
                                    placeholder="Create a strong password"
                                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>

                            {/* Live Password Requirements Checklist */}
                            {passwordValue && (
                                <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-[11px]">
                                    <div className={`flex items-center gap-1.5 ${passwordValue.length >= 8 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{passwordValue.length >= 8 ? '✓' : '○'}</span>
                                        <span>At least 8 characters long</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 ${/[A-Za-z]/.test(passwordValue) ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{/[A-Za-z]/.test(passwordValue) ? '✓' : '○'}</span>
                                        <span>Contains at least one letter</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 ${/[0-9]/.test(passwordValue) ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{/[0-9]/.test(passwordValue) ? '✓' : '○'}</span>
                                        <span>Contains at least one number</span>
                                    </div>
                                </div>
                            )}

                            {errors.password && (
                                <span className="text-red-500 text-xs mt-1.5 block font-medium">
                                    {errors.password.message}
                                </span>
                            )}
                        </div>


                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.99] rounded-xl shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-50 mt-2"
                        >
                            <span>{isSubmitting ? 'Creating account...' : 'Create Account'}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-slate-500">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-amber-600 hover:text-amber-700 transition">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
