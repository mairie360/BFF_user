import reqiest from 'supertest';
import express from 'express';
import usersRouter from '../src/routes/getUsers';

const app = express();
app.use('/users', usersRouter);

describe('GET /users', () => {
  it('should return 200 and a list of users', async () => {
    const res = await reqiest(app).get('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /users/:id', () => {
  it('should return 200 and a user object for a valid ID', async () => {
    const res = await reqiest(app).get('/users/1'); // Assuming 1 is a valid user ID
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 1);
  });

  it('should return 404 for an invalid user ID', async () => {
    const res = await reqiest(app).get('/users/99999'); // Assuming 99999 is an invalid user ID
    expect(res.status).toBe(404);
  });
});