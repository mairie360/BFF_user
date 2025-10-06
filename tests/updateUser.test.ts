import request from 'supertest';
import express from 'express';
import updateUserRouter from '../src/routes/updateUser';

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use('/users', updateUserRouter);

describe('PUT /users/:id', () => {
  it('should respond with a valid status for update', async () => {
    const updatedUser = {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    };

    const res = await request(app).put('/users/1').send(updatedUser);

    // JSONPlaceholder returns only { id: 1 } for PUT
    expect(res.status).toBe(200);

    // Optionally, check that id is returned
    expect(res.body).toHaveProperty('id');

  });

});
