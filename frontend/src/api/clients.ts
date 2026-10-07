import api from './axios'
import type { Client, Project, PaginatedResponse } from '../types/client'

export const getClients = async (search = '', page = 1): Promise<PaginatedResponse<Client>> => {
    const response = await api.get<PaginatedResponse<Client>>('/clients/', {
        params: { search, page }
    });
    return response.data;
};

export const createClient = async (data: Partial<Client>): Promise<Client> => {
    const response = await api.post<Client>('/clients/', data);
    return response.data;
};

export const updateClient = async (id: number, data: Partial<Client>): Promise<Client> => {
    const response = await api.patch<Client>(`/clients/${id}`, data);
    return response.data;
};

export const deleteClient = async (id: number): Promise<void> => {
    await api.delete(`/clients/${id}`);
};

export const getProjects = async (search = '', page = 1, clientId?: number): Promise<PaginatedResponse<Project>> => {
    const response = await api.get<PaginatedResponse<Project>>('/projects/', {
        params: { search, page, client: clientId }
    });
    return response.data;
};

export const createProject = async (data: Partial<Project>): Promise<Project> => {
    const response = await api.post<Project>('/projects/', data);
    return response.data;
};

export const updateProject = async (id: number, data: Partial<Project>): Promise<Project> => {
    const response = await api.patch<Project>(`/projects/${id}`, data);
    return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
};