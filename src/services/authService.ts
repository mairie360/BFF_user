import coreClient from "../clients/coreClient";


export async function login(email: string, password: string) {
    try {
        return await coreClient.POST('/auth/login', {
            body: { email, password }
        });
    } catch (error) {
        console.error('Login error:', error);
        throw new Error('Login failed');
    }
}