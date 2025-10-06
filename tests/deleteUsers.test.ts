import request from 'supertest';
import express from 'express';
import deleteUserRouter from '../src/routes/deleteUser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use('/users', deleteUserRouter);

describe('DELETE /users/:id', () => {
    it('should respond with 200', async () => {
    const res = await request(app).delete('/users/1');
    expect(res.status).toBe(200);
});

});
