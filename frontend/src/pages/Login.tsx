import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export const Login = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
    const { login } = useAuth();
    const navigate = useNavigate();

    const onSubmit = async (data: FormData) => {
        try {
            const res = await api.post('/accounts/login/', data);
            login(res.data.access, res.data.refresh);
            navigate('/');
        } catch (err) {
            alert('Invalid credentials');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
            <h2 className="text-2xl mb-4 text-gray-900">Login</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-gray-700">Email</label>
                    <input {...register('email')} className="w-full border p-2 rounded text-gray-900" />
                    {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
                </div>
                <div>
                    <label className="block text-gray-700">Password</label>
                    <input type="password" {...register('password')} className="w-full border p-2 rounded text-gray-900" />
                    {errors.password && <span className="text-red-500 text-sm">{errors.password.message}</span>}
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
            </form>
        </div>
    );
};
