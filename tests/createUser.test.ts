import request from 'supertest';
import express from 'express';
import createUserRouter from '../src/routes/createUser';

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use('/users', createUserRouter);

describe('POST /users', () => {
    it('should create a new user and return 201 with user data', async () => {
        const newUser = {
            name: 'John Doe',
            email: 'john.doe@example.com',
        };

        const res = await request(app).post('/users').send(newUser);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(newUser);
    });
});